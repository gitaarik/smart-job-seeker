<script lang="ts">
  import type { ActionData, PageData } from "./$types";
  import { enhance } from "$app/forms";
  import { invalidateAll } from "$app/navigation";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faArrowLeft,
    faChartLine,
    faCheck,
    faExternalLinkAlt,
    faFlask,
    faHistory,
    faPlus,
    faPenToSquare,
    faTrash,
    faTriangleExclamation,
    faXmark,
  } from "@fortawesome/free-solid-svg-icons";

  let { data, form }: { data: PageData; form: ActionData } = $props();

  // Bound form values for the platform-level fields.
  let saving = $state(false);
  let name = $state(data.platform.name);
  let key = $state(data.platform.key);
  let url = $state(data.platform.url);
  let type = $state(data.platform.type ?? "");
  let status = $state(data.platform.status);
  let loginPageUrl = $state(data.platform.login_page_url ?? "");
  let suggestionPriority = $state(
    data.platform.suggestion_priority?.toString() ?? "",
  );
  let suggestionHint = $state(data.platform.suggestion_hint ?? "");

  function discoveryStatusColor(s: string) {
    if (s === "success") return "text-green-600 dark:text-green-400";
    if (s === "error") return "text-red-600 dark:text-red-400";
    if (s === "running" || s === "queued" || s === "cancelling") {
      return "text-blue-600 dark:text-blue-400";
    }
    if (s === "cancelled") return "text-[var(--dash-text-muted)]";
    return "text-[var(--dash-text-muted)]";
  }

  // Phase 1 platform-level signal stats.
  let totalRuns = $derived(
    data.platform.success_count + data.platform.failure_count,
  );
  let successRate = $derived(
    totalRuns > 0
      ? Math.round((data.platform.success_count / totalRuns) * 100)
      : null,
  );

  function formatTimestamp(ts: Date | string | null): string {
    if (!ts) return "";
    const d = typeof ts === "string" ? new Date(ts) : ts;
    return d.toLocaleString();
  }

  function truncate(value: string | null, max: number): string {
    if (!value) return "—";
    return value.length > max ? value.slice(0, max) + "…" : value;
  }
</script>

<svelte:head>
  <title>{data.platform.name} - Job Platforms - Admin</title>
</svelte:head>

<div class="space-y-6">
  <div class="flex items-center gap-3">
    <a
      href="/admin/job-platforms"
      class="text-[var(--dash-text-secondary)] hover:text-[var(--dash-text)]"
    >
      <FontAwesomeIcon icon={faArrowLeft} class="w-4 h-4" />
    </a>
    <h1 class="text-2xl font-semibold text-[var(--dash-text)]">{data.platform.name}</h1>
    <code
      class="text-sm text-[var(--dash-text-secondary)] font-mono"
    >{data.platform.key}</code>
  </div>

  {#if form && "savedFields" in form && form.savedFields}
    <div
      class="flex items-center gap-2 p-3 rounded bg-green-50 border border-green-200 text-green-800 dark:bg-green-950/30 dark:border-green-800 dark:text-green-200 text-sm"
    >
      <FontAwesomeIcon icon={faCheck} class="w-4 h-4" />
      {#if form.savedFields.length === 0}
        No changes to save.
      {:else}
        Saved: {form.savedFields.join(", ")}
      {/if}
    </div>
  {/if}

  {#if form && "error" in form && form.error}
    <div
      class="flex items-center gap-2 p-3 rounded bg-red-50 border border-red-200 text-red-800 dark:bg-red-950/30 dark:border-red-800 dark:text-red-200 text-sm"
    >
      <FontAwesomeIcon icon={faTriangleExclamation} class="w-4 h-4" />
      {form.error}
    </div>
  {/if}

  <!-- Platform-level fields -->
  <form
    method="POST"
    action="?/save"
    class="bg-[var(--dash-card)] rounded-lg border border-[var(--dash-border)] p-4 space-y-4"
    use:enhance={() => {
      saving = true;
      return async ({ update }) => {
        await update();
        saving = false;
      };
    }}
  >
    <h3 class="text-sm font-medium text-[var(--dash-text)]">Platform details</h3>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label
          class="block text-xs font-medium text-[var(--dash-text-secondary)] mb-1"
          for="field-name"
        >Name</label>
        <input
          id="field-name"
          name="name"
          type="text"
          bind:value={name}
          required
          class="w-full px-2 py-1 text-sm border border-[var(--dash-border)] rounded bg-[var(--dash-bg)] text-[var(--dash-text)]"
        />
      </div>
      <div>
        <label
          class="block text-xs font-medium text-[var(--dash-text-secondary)] mb-1"
          for="field-key"
        >Key</label>
        <input
          id="field-key"
          name="key"
          type="text"
          bind:value={key}
          required
          class="w-full px-2 py-1 text-sm border border-[var(--dash-border)] rounded bg-[var(--dash-bg)] text-[var(--dash-text)] font-mono"
        />
      </div>
      <div class="md:col-span-2">
        <label
          class="block text-xs font-medium text-[var(--dash-text-secondary)] mb-1"
          for="field-url"
        >Base URL</label>
        <div class="flex items-center gap-2">
          <input
            id="field-url"
            name="url"
            type="url"
            bind:value={url}
            required
            class="flex-1 px-2 py-1 text-sm border border-[var(--dash-border)] rounded bg-[var(--dash-bg)] text-[var(--dash-text)]"
          />
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            class="text-[var(--dash-text-muted)] hover:text-[var(--dash-primary)]"
            aria-label="Open base URL"
          >
            <FontAwesomeIcon icon={faExternalLinkAlt} class="w-4 h-4" />
          </a>
        </div>
      </div>
      <div>
        <label
          class="block text-xs font-medium text-[var(--dash-text-secondary)] mb-1"
          for="field-status"
        >Status</label>
        <input
          id="field-status"
          name="status"
          type="text"
          bind:value={status}
          required
          class="w-full px-2 py-1 text-sm border border-[var(--dash-border)] rounded bg-[var(--dash-bg)] text-[var(--dash-text)]"
        />
      </div>
      <div>
        <label
          class="block text-xs font-medium text-[var(--dash-text-secondary)] mb-1"
          for="field-type"
        >Type</label>
        <input
          id="field-type"
          name="type"
          type="text"
          bind:value={type}
          placeholder="job_boards / vetted_platforms / …"
          class="w-full px-2 py-1 text-sm border border-[var(--dash-border)] rounded bg-[var(--dash-bg)] text-[var(--dash-text)]"
        />
      </div>
      <div class="md:col-span-2">
        <label
          class="block text-xs font-medium text-[var(--dash-text-secondary)] mb-1"
          for="field-login"
        >Login page URL</label>
        <input
          id="field-login"
          name="login_page_url"
          type="url"
          bind:value={loginPageUrl}
          placeholder="https://example.com/login"
          class="w-full px-2 py-1 text-sm border border-[var(--dash-border)] rounded bg-[var(--dash-bg)] text-[var(--dash-text)]"
        />
      </div>
      <div>
        <label
          class="block text-xs font-medium text-[var(--dash-text-secondary)] mb-1"
          for="field-priority"
        >Platform suggestion priority</label>
        <input
          id="field-priority"
          name="suggestion_priority"
          type="number"
          bind:value={suggestionPriority}
          placeholder="1 = top, blank = not in pool"
          min="1"
          class="w-full px-2 py-1 text-sm border border-[var(--dash-border)] rounded bg-[var(--dash-bg)] text-[var(--dash-text)]"
        />
      </div>
      <div>
        <label
          class="block text-xs font-medium text-[var(--dash-text-secondary)] mb-1"
          for="field-hint"
        >Platform suggestion hint</label>
        <input
          id="field-hint"
          name="suggestion_hint"
          type="text"
          bind:value={suggestionHint}
          placeholder="When should the LLM consider this platform?"
          class="w-full px-2 py-1 text-sm border border-[var(--dash-border)] rounded bg-[var(--dash-bg)] text-[var(--dash-text)]"
        />
      </div>
    </div>

    <div class="flex justify-end">
      <button
        type="submit"
        disabled={saving}
        class="px-4 py-2 bg-[var(--dash-primary)] text-white rounded hover:bg-[var(--dash-primary-hover)] disabled:opacity-60"
      >{saving ? "Saving…" : "Save platform"}</button>
    </div>
  </form>

  <!-- Discovery — the dedicated discovery page hosts the config + history -->
  <div class="bg-[var(--dash-card)] rounded-lg border border-[var(--dash-border)] p-4">
    <div class="flex items-start justify-between gap-3">
      <div>
        <h3 class="text-sm font-medium text-[var(--dash-text)]">Discovery</h3>
        <p class="text-xs text-[var(--dash-text-secondary)] mt-1">
          The discovery scraper auto-detects this platform's search URL
          template + filter parameters by logging in, probing the search
          form, and clicking each filter option. Configure credentials and
          start runs on the discovery page.
        </p>
        {#if !data.platform.login_page_url}
          <p class="text-xs text-amber-600 dark:text-amber-400 mt-2">
            Set a login page URL above first — discovery requires login.
          </p>
        {/if}
        {#if data.discoveryRuns.length > 0}
          {@const lastRun = data.discoveryRuns[0]}
          <p class="text-xs text-[var(--dash-text-muted)] mt-2">
            {data.discoveryRuns.length} run{data.discoveryRuns.length === 1 ? "" : "s"}
            ·
            <span class={discoveryStatusColor(lastRun.status)}>last {lastRun.status}</span>
            {new Date(lastRun.started_at).toLocaleString()}
          </p>
        {/if}
      </div>
      <a
        href={`/admin/job-platforms/${data.platform.id}/discover`}
        class="px-4 py-2 text-sm bg-[var(--dash-primary)] text-white rounded hover:bg-[var(--dash-primary-hover)] whitespace-nowrap shrink-0"
      >Open discovery</a>
    </div>
  </div>

  <!-- Platform-level usage signals -->
  <div class="bg-[var(--dash-card)] rounded-lg border border-[var(--dash-border)] p-4">
    <div class="flex items-center gap-2 mb-3">
      <FontAwesomeIcon
        icon={faChartLine}
        class="w-4 h-4 text-[var(--dash-text-secondary)]"
      />
      <h3 class="text-sm font-medium text-[var(--dash-text)]">Platform-level signals</h3>
      <span
        class="text-xs text-[var(--dash-text-muted)]"
      >aggregate across all scrape runs</span>
    </div>
    {#if totalRuns === 0}
      <p
        class="text-sm text-[var(--dash-text-muted)]"
      >No runs recorded for this platform yet.</p>
    {:else}
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div>
          <div class="text-[var(--dash-text-muted)]">Successful runs</div>
          <div class="text-base font-medium text-green-600 dark:text-green-400 tabular-nums">{data.platform.success_count}</div>
          {#if data.platform.last_success_at}
            <div class="text-[var(--dash-text-muted)] mt-0.5">last {formatTimestamp(data.platform.last_success_at)}</div>
          {/if}
        </div>
        <div>
          <div class="text-[var(--dash-text-muted)]">Failed runs</div>
          <div class="text-base font-medium text-red-600 dark:text-red-400 tabular-nums">{data.platform.failure_count}</div>
          {#if data.platform.last_failure_at}
            <div class="text-[var(--dash-text-muted)] mt-0.5">last {formatTimestamp(data.platform.last_failure_at)}</div>
          {/if}
        </div>
        <div>
          <div class="text-[var(--dash-text-muted)]">Total runs</div>
          <div class="text-base font-medium text-[var(--dash-text)] tabular-nums">{totalRuns}</div>
        </div>
        <div>
          <div class="text-[var(--dash-text-muted)]">Success rate</div>
          <div
            class="text-base font-medium tabular-nums {successRate != null && successRate >= 70
              ? 'text-green-600 dark:text-green-400'
              : successRate != null && successRate >= 40
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-red-600 dark:text-red-400'}"
          >{successRate}%</div>
        </div>
      </div>
    {/if}
  </div>

  <!-- Change history -->
  <div class="bg-[var(--dash-card)] rounded-lg border border-[var(--dash-border)] p-4">
    <div class="flex items-center gap-2 mb-3">
      <FontAwesomeIcon
        icon={faHistory}
        class="w-4 h-4 text-[var(--dash-text-secondary)]"
      />
      <h3 class="text-sm font-medium text-[var(--dash-text)]">
        Change history
        <span class="text-[var(--dash-text-muted)] font-normal">
          ({data.history.length})
        </span>
      </h3>
    </div>
    {#if data.history.length === 0}
      <p
        class="text-sm text-[var(--dash-text-muted)]"
      >No platform-level edits recorded yet. (Preset CRUD is not audited in v1.)</p>
    {:else}
      <div class="space-y-2 text-xs">
        {#each data.history as entry (entry.id)}
          <div
            class="flex items-start gap-3 py-1 border-b border-[var(--dash-border)] last:border-0"
          >
            <span class="text-[var(--dash-text-muted)] whitespace-nowrap">
              {formatTimestamp(entry.changed_at)}
            </span>
            <span
              class="font-mono px-1.5 py-0.5 bg-[var(--dash-bg)] rounded text-[var(--dash-text)]"
            >{entry.field}</span>
            <div class="flex-1 min-w-0">
              <span class="text-red-600 dark:text-red-400 line-through">
                {truncate(entry.old_value, 80)}
              </span>
              <span class="text-[var(--dash-text-muted)] mx-1">→</span>
              <span class="text-green-600 dark:text-green-400">
                {truncate(entry.new_value, 80)}
              </span>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>
