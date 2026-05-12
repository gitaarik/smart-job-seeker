<script lang="ts">
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  function statusColor(s: string) {
    if (s === "success") return "text-green-600 dark:text-green-400";
    if (s === "error") return "text-red-600 dark:text-red-400";
    if (s === "running" || s === "queued" || s === "cancelling") {
      return "text-blue-600 dark:text-blue-400";
    }
    if (s === "draft") return "text-amber-600 dark:text-amber-400";
    if (s === "cancelled") return "text-[var(--dash-text-muted)]";
    return "text-[var(--dash-text-muted)]";
  }
</script>

<div class="max-w-4xl mx-auto p-6 space-y-6">
  <header class="space-y-1">
    <h1 class="text-2xl font-semibold text-[var(--dash-text)]">All discovery runs</h1>
    <p class="text-sm text-[var(--dash-text-muted)]">
      Recent platform-discovery activity across all platforms. To start a
      new run, open the platform on
      <a href="/admin/job-platforms" class="underline">Job Platforms</a>
      and click "New discovery".
    </p>
  </header>

  <section class="space-y-2">
    {#if data.runs.length === 0}
      <p class="text-sm text-[var(--dash-text-muted)]">No runs yet.</p>
    {:else}
      <div class="border border-[var(--dash-border)] rounded-lg overflow-hidden">
        {#each data.runs as { run, platform_name } (run.id)}
          <a
            href={`/admin/job-platforms/discover/${run.id}`}
            class="flex items-center justify-between gap-3 px-4 py-3 border-b border-[var(--dash-border)] last:border-b-0 hover:bg-[var(--dash-bg)] transition-colors"
          >
            <div class="min-w-0 flex-1">
              <div class="text-sm font-medium text-[var(--dash-text)] truncate">
                {platform_name ?? "(deleted platform)"}
              </div>
              <div class="text-xs text-[var(--dash-text-muted)] font-mono truncate">
                {run.target_url}
              </div>
              <div class="text-xs text-[var(--dash-text-muted)]">
                Run #{run.id} · {new Date(run.started_at).toLocaleString()}
                {#if run.applied_at}
                  · applied
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
