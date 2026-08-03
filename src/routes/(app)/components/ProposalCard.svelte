<script lang="ts" module>
  /** A pending (or applied) edit the assistant proposed. Shaped by the API. */
  export type Proposal = {
    message_id: number;
    capability: string;
    title: string;
    rationale: string;
    target: { id: number; label: string };
    changes: { field: string; label: string; from: string; to: string }[];
    applied_at: string | null;
  };
</script>

<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faArrowRight,
    faCheck,
    faPenToSquare,
    faTriangleExclamation,
  } from "@fortawesome/free-solid-svg-icons";
  import Spinner from "$lib/components/Spinner.svelte";

  /**
   * The consent step between what the assistant suggests and what happens.
   *
   * Deliberately a diff rather than a list of new values: "Salary — $50/hour →
   * $55/hour" is reviewable at a glance, where "salary_min: 55" asks the user to
   * remember what it was. Long text (a rewritten description) is the one case
   * that can't be shown inline; it gets a length summary and lands in the page's
   * own editor once applied.
   */
  let { proposal }: { proposal: Proposal } = $props();

  let applying = $state(false);
  let error = $state("");
  let appliedAt = $state<string | null>(proposal.applied_at);

  /** Values too long to sit in a chat panel — show the shape, not the blob. */
  const LONG_VALUE_CHARS = 120;

  function summarize(value: string): string {
    if (value === "—") return "empty";
    if (value.length <= LONG_VALUE_CHARS) return value;
    return `${value.length.toLocaleString()} characters`;
  }

  async function apply() {
    if (applying || appliedAt) return;
    applying = true;
    error = "";
    try {
      const res = await fetch(
        `/api/ai/agent/proposals/${proposal.message_id}/apply`,
        { method: "POST" },
      );
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        error = data?.message || "Could not apply that change.";
        return;
      }
      appliedAt = new Date().toISOString();
      // The page behind the panel is now stale — it is very often the very
      // record that just changed.
      await invalidateAll();
    } catch {
      error = "Could not reach the server. Please try again.";
    } finally {
      applying = false;
    }
  }
</script>

<div
  class="mt-2 rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)] overflow-hidden"
>
  <div
    class="flex items-center gap-2 px-3 py-2 border-b border-[var(--dash-border)]"
  >
    <FontAwesomeIcon
      icon={appliedAt ? faCheck : faPenToSquare}
      class="w-3 h-3 shrink-0 {appliedAt
        ? 'text-[var(--dash-success)]'
        : 'text-[var(--dash-primary)]'}"
    />
    <span class="text-xs font-medium text-[var(--dash-text)] truncate">
      {proposal.title}
    </span>
    <span
      class="text-[11px] text-[var(--dash-text-muted)] truncate ml-auto shrink-0 max-w-[45%]"
      title={proposal.target.label}
    >
      {proposal.target.label}
    </span>
  </div>

  <div class="px-3 py-2 space-y-2">
    {#if proposal.changes.length === 0}
      <p class="text-xs text-[var(--dash-text-muted)]">
        {appliedAt
          ? "Applied."
          : "Nothing left to change — these values are already set."}
      </p>
    {:else}
      <dl class="space-y-1.5">
        {#each proposal.changes as change}
          <div class="text-xs">
            <dt class="text-[var(--dash-text-muted)]">{change.label}</dt>
            <dd class="flex items-start gap-1.5 text-[var(--dash-text)]">
              <span class="line-through text-[var(--dash-text-muted)] break-words">
                {summarize(change.from)}
              </span>
              <FontAwesomeIcon
                icon={faArrowRight}
                class="w-2.5 h-2.5 mt-1 shrink-0 text-[var(--dash-text-muted)]"
              />
              <span class="font-medium break-words">{summarize(change.to)}</span>
            </dd>
          </div>
        {/each}
      </dl>
    {/if}

    {#if proposal.rationale && !appliedAt}
      <p class="text-[11px] text-[var(--dash-text-muted)] italic">
        {proposal.rationale}
      </p>
    {/if}

    {#if error}
      <p class="flex items-start gap-1.5 text-[11px] text-[var(--dash-error)]">
        <FontAwesomeIcon
          icon={faTriangleExclamation}
          class="w-3 h-3 mt-0.5 shrink-0"
        />
        {error}
      </p>
    {/if}
  </div>

  {#if proposal.changes.length > 0}
    <div
      class="px-3 py-2 border-t border-[var(--dash-border)] bg-[var(--dash-bg)]"
    >
      {#if appliedAt}
        <p
          class="flex items-center gap-1.5 text-[11px] text-[var(--dash-success)]"
        >
          <FontAwesomeIcon icon={faCheck} class="w-3 h-3" />
          Applied
        </p>
      {:else}
        <button
          type="button"
          onclick={apply}
          disabled={applying}
          class="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-[var(--dash-primary)] text-white hover:bg-[var(--dash-primary-hover)] transition-colors disabled:opacity-60"
        >
          {#if applying}
            <Spinner size="w-3 h-3" />
          {:else}
            <FontAwesomeIcon icon={faCheck} class="w-3 h-3" />
          {/if}
          {applying ? "Applying…" : "Apply"}
        </button>
      {/if}
    </div>
  {/if}
</div>
