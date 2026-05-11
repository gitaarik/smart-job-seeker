<script lang="ts">
  import type { PageData } from "./$types";
  import { onMount, onDestroy } from "svelte";
  import { invalidateAll } from "$app/navigation";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import { faCheck, faCopy } from "@fortawesome/free-solid-svg-icons";

  let { data }: { data: PageData } = $props();
  let copied = $state(false);
  let cancelling = $state(false);
  let cancelError = $state<string | null>(null);

  async function copyId() {
    try {
      await navigator.clipboard.writeText(String(data.run.id));
      copied = true;
      setTimeout(() => (copied = false), 1500);
    } catch {
      // Clipboard API rejected (insecure context, permissions, etc.) —
      // silently no-op; admin can still read the id from the URL bar.
    }
  }

  let run = $state(data.run);
  let logs = $state(data.logs);
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let showBrowser = $state(false);

  // Apply form (editable on success)
  let draftLogin = $state(data.run.findings?.login_page_url ?? "");
  let draftTemplate = $state(data.run.findings?.search_url_template ?? "");
  let draftHint = $state(data.run.findings?.applicable_hint ?? "");
  let applying = $state(false);
  let applyError = $state<string | null>(null);
  let applyResult = $state<{ platform_id: number; preset_id: number | null } | null>(null);

  function isTerminal(status: string) {
    return ["success", "error", "cancelled"].includes(status);
  }

  async function cancelRun() {
    if (!confirm("Cancel this discovery run?")) return;
    cancelling = true;
    cancelError = null;
    try {
      const res = await fetch(`/api/admin/discover/${run.id}/cancel`, {
        method: "POST",
      });
      if (!res.ok) {
        cancelError = (await res.text()) || `HTTP ${res.status}`;
      }
      await poll();
    } finally {
      cancelling = false;
    }
  }

  async function poll() {
    const sinceId = logs.length > 0 ? logs[logs.length - 1].id : 0;
    const res = await fetch(`/api/admin/discover/${run.id}?since=${sinceId}`);
    if (!res.ok) return;
    const fresh = await res.json();
    run = fresh.run;
    if (fresh.logs.length > 0) logs = [...logs, ...fresh.logs];
    if (run.status === "success") {
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
    if (!isTerminal(run.status)) pollTimer = setInterval(poll, 2000);
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
      <div class="min-w-0">
        <h1 class="text-xl font-semibold text-[var(--dash-text)] truncate">
          {data.platform?.name ?? "(deleted platform)"}
        </h1>
        <p class="text-xs text-[var(--dash-text-muted)] font-mono truncate">
          {run.target_url}
        </p>
        <div class="flex items-center gap-1.5 text-xs text-[var(--dash-text-muted)] mt-1">
          <span>Run</span>
          <span class="font-mono">#{run.id}</span>
          <button
            type="button"
            onclick={copyId}
            class="p-0.5 cursor-pointer hover:text-[var(--dash-primary)] transition-colors"
            aria-label="Copy run ID"
          >
            <FontAwesomeIcon
              icon={copied ? faCheck : faCopy}
              class="w-3 h-3 {copied ? 'text-green-600' : ''}"
            />
          </button>
          {#if copied}
            <span class="text-green-600">Copied!</span>
          {/if}
        </div>
      </div>
      <span class="text-sm font-medium {statusColor(run.status)}">{run.status}</span>
    </div>
    {#if run.error_message}
      <p class="text-xs text-red-600 dark:text-red-400">{run.error_message}</p>
    {/if}
  </header>

  <div class="flex flex-wrap gap-2 items-center">
    {#if run.live_url}
      <button
        type="button"
        onclick={() => (showBrowser = true)}
        class="px-3 py-1.5 text-xs border border-[var(--dash-border)] rounded hover:bg-[var(--dash-bg)]"
      >Open browser view</button>
    {/if}
    {#if data.platform}
      <a
        href={`/admin/job-platforms/${data.platform.id}#discovery-credentials`}
        class="px-3 py-1.5 text-xs border border-[var(--dash-border)] rounded hover:bg-[var(--dash-bg)]"
      >Configure credentials</a>
    {/if}
    {#if !isTerminal(run.status) && run.status !== "cancelling"}
      <button
        type="button"
        onclick={cancelRun}
        disabled={cancelling}
        class="px-3 py-1.5 text-xs border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 rounded hover:bg-red-50 dark:hover:bg-red-950 disabled:opacity-50"
      >{cancelling ? "Cancelling…" : "Cancel run"}</button>
    {/if}
    {#if run.status === "cancelling"}
      <span class="text-xs text-amber-600 dark:text-amber-400">
        Cancellation requested — waiting for worker to abort…
      </span>
    {/if}
    {#if cancelError}
      <span class="text-xs text-red-600 dark:text-red-400">{cancelError}</span>
    {/if}
  </div>

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

  {#if run.status === "success"}
    <section class="space-y-3">
      <h2 class="text-xs font-medium text-[var(--dash-text-muted)] uppercase tracking-wide">
        Apply to {data.platform?.name ?? "platform"}
      </h2>
      <div class="bg-[var(--dash-card)] rounded-lg border border-[var(--dash-border)] p-4 space-y-3">
        <div>
          <label class="block text-xs font-medium text-[var(--dash-text-secondary)] mb-1" for="flogin">
            Login page URL
            {#if data.platform?.login_page_url}
              <span class="font-normal text-[var(--dash-text-muted)]">
                (current: <span class="font-mono">{data.platform.login_page_url}</span>)
              </span>
            {/if}
          </label>
          <input
            id="flogin"
            type="text"
            bind:value={draftLogin}
            placeholder="(leave empty to keep current)"
            class="w-full px-2 py-1.5 text-sm border border-[var(--dash-border)] rounded bg-[var(--dash-bg)] text-[var(--dash-text)] font-mono"
          />
        </div>
        <div>
          <label class="block text-xs font-medium text-[var(--dash-text-secondary)] mb-1" for="ftpl">
            Search URL template (Generic search preset)
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
            Applied to platform #{applyResult.platform_id}
            {#if applyResult.preset_id}
              — preset #{applyResult.preset_id} written
            {/if}
            ·
            <a href={`/admin/job-platforms/${applyResult.platform_id}`} class="underline">
              Open platform
            </a>
          </p>
        {:else if !run.applied_at}
          <div class="flex justify-end">
            <button
              type="button"
              onclick={applyFindings}
              disabled={applying}
              class="px-4 py-2 text-sm bg-[var(--dash-primary)] text-white rounded hover:bg-[var(--dash-primary-hover)] disabled:opacity-50"
            >{applying ? "Applying…" : "Apply"}</button>
          </div>
        {:else}
          <p class="text-xs text-[var(--dash-text-muted)]">
            Already applied {new Date(run.applied_at).toLocaleString()}.
          </p>
        {/if}
      </div>
    </section>
  {/if}
</div>

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
