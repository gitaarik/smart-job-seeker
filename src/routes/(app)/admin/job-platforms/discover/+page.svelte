<script lang="ts">
  import type { PageData } from "./$types";
  import { goto, invalidateAll } from "$app/navigation";

  let { data }: { data: PageData } = $props();

  let targetUrl = $state("");
  let submitting = $state(false);
  let formError = $state<string | null>(null);

  async function startDiscovery(e: SubmitEvent) {
    e.preventDefault();
    if (!targetUrl.trim()) return;
    submitting = true;
    formError = null;
    try {
      const res = await fetch("/api/admin/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_url: targetUrl.trim() }),
      });
      if (!res.ok) {
        formError = (await res.text()) || `HTTP ${res.status}`;
        return;
      }
      const json = await res.json();
      await goto(`/admin/job-platforms/discover/${json.run.id}`);
    } finally {
      submitting = false;
    }
  }

  function statusColor(s: string) {
    if (s === "success") return "text-green-600 dark:text-green-400";
    if (s === "error") return "text-red-600 dark:text-red-400";
    if (s === "running" || s === "queued") return "text-blue-600 dark:text-blue-400";
    return "text-[var(--dash-text-muted)]";
  }
</script>

<div class="max-w-4xl mx-auto p-6 space-y-6">
  <header class="space-y-1">
    <h1 class="text-2xl font-semibold text-[var(--dash-text)]">Platform discovery</h1>
    <p class="text-sm text-[var(--dash-text-muted)]">
      Point the discovery scraper at a job-platform's front page. It will navigate, identify
      the login and search entries, run a probe search, and produce a draft URL template for
      review before promoting to a real platform.
    </p>
  </header>

  <form
    onsubmit={startDiscovery}
    class="bg-[var(--dash-card)] rounded-lg border border-[var(--dash-border)] p-4 space-y-3"
  >
    <label class="block text-xs font-medium text-[var(--dash-text-secondary)]" for="target">
      Platform front-page URL
    </label>
    <input
      id="target"
      type="url"
      bind:value={targetUrl}
      placeholder="https://www.linkedin.com"
      required
      class="w-full px-3 py-2 text-sm border border-[var(--dash-border)] rounded bg-[var(--dash-bg)] text-[var(--dash-text)] font-mono"
    />
    {#if formError}
      <p class="text-xs text-red-600 dark:text-red-400">{formError}</p>
    {/if}
    <div class="flex justify-end">
      <button
        type="submit"
        disabled={submitting || !targetUrl.trim()}
        class="px-4 py-2 text-sm bg-[var(--dash-primary)] text-white rounded hover:bg-[var(--dash-primary-hover)] disabled:opacity-50"
      >{submitting ? "Queuing…" : "Start discovery"}</button>
    </div>
  </form>

  <section class="space-y-2">
    <h2 class="text-sm font-medium text-[var(--dash-text-muted)] uppercase tracking-wide">
      Recent runs
    </h2>
    {#if data.runs.length === 0}
      <p class="text-sm text-[var(--dash-text-muted)]">No runs yet.</p>
    {:else}
      <div class="border border-[var(--dash-border)] rounded-lg overflow-hidden">
        {#each data.runs as run (run.id)}
          <a
            href={`/admin/job-platforms/discover/${run.id}`}
            class="flex items-center justify-between gap-3 px-4 py-3 border-b border-[var(--dash-border)] last:border-b-0 hover:bg-[var(--dash-bg)] transition-colors"
          >
            <div class="min-w-0 flex-1">
              <div class="text-sm font-mono text-[var(--dash-text)] truncate">{run.target_url}</div>
              <div class="text-xs text-[var(--dash-text-muted)]">
                {new Date(run.started_at).toLocaleString()}
                {#if run.applied_platform_id}
                  · applied to platform #{run.applied_platform_id}
                {/if}
              </div>
            </div>
            <span class="text-xs font-medium {statusColor(run.status)}">{run.status}</span>
          </a>
        {/each}
      </div>
    {/if}
  </section>
</div>
