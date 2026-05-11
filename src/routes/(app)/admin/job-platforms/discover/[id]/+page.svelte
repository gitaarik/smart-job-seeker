<script lang="ts">
  import type { PageData } from "./$types";
  import { onMount, onDestroy } from "svelte";
  import { invalidateAll } from "$app/navigation";

  let { data }: { data: PageData } = $props();

  let run = $state(data.run);
  let logs = $state(data.logs);
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let showBrowser = $state(false);

  // Findings draft (editable on success). Reads `data.run` (not the $state
  // `run`) to capture the initial value without tripping the
  // state_referenced_locally lint.
  let draftName = $state(data.run.findings?.platform_name ?? "");
  let draftKey = $state(data.run.findings?.platform_key ?? "");
  let draftLogin = $state(data.run.findings?.login_page_url ?? "");
  let draftTemplate = $state(data.run.findings?.search_url_template ?? "");
  let draftHint = $state(data.run.findings?.applicable_hint ?? "");
  let applying = $state(false);
  let applyError = $state<string | null>(null);
  let applyResult = $state<{ platform_id: number; preset_id: number | null } | null>(null);

  function isTerminal(status: string) {
    return ["success", "error", "cancelled"].includes(status);
  }

  async function poll() {
    const sinceId = logs.length > 0 ? logs[logs.length - 1].id : 0;
    const res = await fetch(
      `/api/admin/discover/${run.id}?since=${sinceId}`,
    );
    if (!res.ok) return;
    const fresh = await res.json();
    run = fresh.run;
    if (fresh.logs.length > 0) {
      logs = [...logs, ...fresh.logs];
    }
    // Sync draft fields once findings arrive (only if user hasn't typed yet)
    if (run.status === "success") {
      if (!draftName) draftName = run.findings?.platform_name ?? "";
      if (!draftKey) draftKey = run.findings?.platform_key ?? "";
      if (!draftLogin) draftLogin = run.findings?.login_page_url ?? "";
      if (!draftTemplate) draftTemplate = run.findings?.search_url_template ?? "";
      if (!draftHint) draftHint = run.findings?.applicable_hint ?? "";
    }
    if (isTerminal(run.status) && pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  onMount(() => {
    if (!isTerminal(run.status)) {
      pollTimer = setInterval(poll, 2000);
    }
  });
  onDestroy(() => {
    if (pollTimer) clearInterval(pollTimer);
  });

  async function applyFindings() {
    applying = true;
    applyError = null;
    try {
      const res = await fetch(`/api/admin/discover/${run.id}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform_name: draftName,
          platform_key: draftKey,
          login_page_url: draftLogin || null,
          search_url_template: draftTemplate || null,
          applicable_hint: draftHint || null,
        }),
      });
      if (!res.ok) {
        applyError = (await res.text()) || `HTTP ${res.status}`;
        return;
      }
      applyResult = await res.json();
      await invalidateAll();
    } finally {
      applying = false;
    }
  }

  function statusColor(s: string) {
    if (s === "success") return "text-green-600 dark:text-green-400";
    if (s === "error") return "text-red-600 dark:text-red-400";
    if (s === "running" || s === "queued") return "text-blue-600 dark:text-blue-400";
    return "text-[var(--dash-text-muted)]";
  }

  function levelColor(level: string) {
    if (level === "error") return "text-red-600 dark:text-red-400";
    if (level === "warn") return "text-amber-600 dark:text-amber-400";
    if (level === "debug") return "text-[var(--dash-text-muted)]";
    return "text-[var(--dash-text)]";
  }
</script>

<div class="max-w-5xl mx-auto p-6 space-y-6">
  <header class="space-y-1">
    <a
      href="/admin/job-platforms/discover"
      class="text-xs text-[var(--dash-text-muted)] hover:text-[var(--dash-primary)]"
    >← All discovery runs</a>
    <div class="flex items-center justify-between gap-3">
      <h1 class="text-xl font-semibold text-[var(--dash-text)] font-mono truncate">
        {run.target_url}
      </h1>
      <span class="text-sm font-medium {statusColor(run.status)}">{run.status}</span>
    </div>
    {#if run.error_message}
      <p class="text-xs text-red-600 dark:text-red-400">{run.error_message}</p>
    {/if}
  </header>

  {#if run.live_url}
    <div class="flex gap-2">
      <button
        type="button"
        onclick={() => (showBrowser = true)}
        class="px-3 py-1.5 text-xs border border-[var(--dash-border)] rounded hover:bg-[var(--dash-bg)]"
      >Open browser view</button>
    </div>
  {/if}

  <!-- Logs -->
  <section class="space-y-2">
    <h2 class="text-xs font-medium text-[var(--dash-text-muted)] uppercase tracking-wide">
      Logs
    </h2>
    <div class="bg-black/90 text-xs text-white rounded border border-[var(--dash-border)] p-3 font-mono max-h-[40vh] overflow-y-auto">
      {#each logs as line (line.id)}
        <div class="flex gap-2">
          <span class="text-[var(--dash-text-muted)] shrink-0">
            {new Date(line.timestamp).toLocaleTimeString()}
          </span>
          <span class="shrink-0 uppercase {levelColor(line.level)}">{line.level}</span>
          <span class="text-white">{line.message}</span>
        </div>
      {:else}
        <p class="text-[var(--dash-text-muted)]">No logs yet.</p>
      {/each}
    </div>
  </section>

  <!-- Findings review (only on success) -->
  {#if run.status === "success"}
    <section class="space-y-3">
      <h2 class="text-xs font-medium text-[var(--dash-text-muted)] uppercase tracking-wide">
        Findings
      </h2>
      <div class="bg-[var(--dash-card)] rounded-lg border border-[var(--dash-border)] p-4 space-y-3">
        <div>
          <label class="block text-xs font-medium text-[var(--dash-text-secondary)] mb-1" for="fname">
            Platform name
          </label>
          <input
            id="fname"
            type="text"
            bind:value={draftName}
            class="w-full px-2 py-1.5 text-sm border border-[var(--dash-border)] rounded bg-[var(--dash-bg)] text-[var(--dash-text)]"
          />
        </div>
        <div>
          <label class="block text-xs font-medium text-[var(--dash-text-secondary)] mb-1" for="fkey">
            Platform key
          </label>
          <input
            id="fkey"
            type="text"
            bind:value={draftKey}
            class="w-full px-2 py-1.5 text-sm border border-[var(--dash-border)] rounded bg-[var(--dash-bg)] text-[var(--dash-text)] font-mono"
          />
        </div>
        <div>
          <label class="block text-xs font-medium text-[var(--dash-text-secondary)] mb-1" for="flogin">
            Login page URL
          </label>
          <input
            id="flogin"
            type="text"
            bind:value={draftLogin}
            placeholder="(none)"
            class="w-full px-2 py-1.5 text-sm border border-[var(--dash-border)] rounded bg-[var(--dash-bg)] text-[var(--dash-text)] font-mono"
          />
        </div>
        <div>
          <label class="block text-xs font-medium text-[var(--dash-text-secondary)] mb-1" for="ftpl">
            Search URL template
          </label>
          <textarea
            id="ftpl"
            bind:value={draftTemplate}
            rows={3}
            placeholder={"https://…?keywords={KEYWORDS}"}
            class="w-full px-2 py-1.5 text-sm border border-[var(--dash-border)] rounded bg-[var(--dash-bg)] text-[var(--dash-text)] font-mono break-all resize-y"
          ></textarea>
        </div>
        <div>
          <label class="block text-xs font-medium text-[var(--dash-text-secondary)] mb-1" for="fhint">
            Applicable hint <span class="font-normal text-[var(--dash-text-muted)]">(optional)</span>
          </label>
          <input
            id="fhint"
            type="text"
            bind:value={draftHint}
            class="w-full px-2 py-1.5 text-sm border border-[var(--dash-border)] rounded bg-[var(--dash-bg)] text-[var(--dash-text)]"
          />
        </div>
        {#if (run.findings?.notes?.length ?? 0) > 0}
          <details class="text-xs">
            <summary class="cursor-pointer text-[var(--dash-text-muted)]">LLM notes ({run.findings!.notes!.length})</summary>
            <ul class="list-disc pl-5 mt-1 space-y-0.5 text-[var(--dash-text-secondary)]">
              {#each run.findings!.notes! as note (note)}
                <li>{note}</li>
              {/each}
            </ul>
          </details>
        {/if}
        {#if applyError}
          <p class="text-xs text-red-600 dark:text-red-400">{applyError}</p>
        {/if}
        {#if applyResult}
          <p class="text-xs text-green-600 dark:text-green-400">
            Applied — created platform #{applyResult.platform_id}
            {#if applyResult.preset_id}
              and preset #{applyResult.preset_id}
            {/if}
          </p>
        {:else if !run.applied_platform_id}
          <div class="flex justify-end">
            <button
              type="button"
              onclick={applyFindings}
              disabled={applying || !draftName || !draftKey}
              class="px-4 py-2 text-sm bg-[var(--dash-primary)] text-white rounded hover:bg-[var(--dash-primary-hover)] disabled:opacity-50"
            >{applying ? "Applying…" : "Apply as platform"}</button>
          </div>
        {:else}
          <p class="text-xs text-[var(--dash-text-muted)]">
            Already applied to platform #{run.applied_platform_id}.
          </p>
        {/if}
      </div>
    </section>
  {/if}
</div>

<!-- Browser view popup -->
{#if showBrowser && run.live_url}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center p-4"
    onclick={() => (showBrowser = false)}
    role="presentation"
  >
    <div class="absolute inset-0 bg-black/60"></div>
    <div
      class="relative bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-lg w-full max-w-5xl h-[80vh] flex flex-col"
      onclick={(e) => e.stopPropagation()}
      role="presentation"
    >
      <div class="flex items-center justify-between px-4 py-2 border-b border-[var(--dash-border)]">
        <span class="text-sm font-medium text-[var(--dash-text)]">Browser view</span>
        <button
          type="button"
          onclick={() => (showBrowser = false)}
          class="text-[var(--dash-text-muted)] hover:text-[var(--dash-text)]"
        >Close</button>
      </div>
      <iframe
        src={run.live_url}
        title="Browser view"
        class="flex-1 w-full"
      ></iframe>
    </div>
  </div>
{/if}
