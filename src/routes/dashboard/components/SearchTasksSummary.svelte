<script lang="ts">
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faArrowRight,
    faClock,
    faPlay,
    faSearch,
  } from "@fortawesome/free-solid-svg-icons";
  import Card from "./Card.svelte";

  interface SearchTask {
    id: number;
    name: string;
    is_active: boolean;
    status: string | null;
    last_run: Date | string | null;
    last_run_jobs_found: number | null;
    job_platforms: { name: string } | null;
  }

  interface SearchTasksData {
    tasks: SearchTask[];
    totalCount: number;
    activeCount: number;
    lastRun: Date | string | null;
    totalJobsFound: number;
  }

  interface Props {
    searchTasks: SearchTasksData;
  }

  let { searchTasks }: Props = $props();

  function timeAgo(date: Date | string | null): string {
    if (!date) return "Never";
    const d = typeof date === "string" ? new Date(date) : date;
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 30) return `${diffDays}d ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  const hasRunning = $derived(
    searchTasks.tasks.some((t) => t.status === "running"),
  );
</script>

{#if searchTasks.totalCount === 0}
  <!-- No search tasks -->
  <Card padding="md">
    <div class="flex items-center gap-4">
      <div
        class="w-10 h-10 rounded-lg bg-[var(--dash-bg)] flex items-center justify-center shrink-0"
      >
        <FontAwesomeIcon
          icon={faSearch}
          class="w-5 h-5 text-[var(--dash-text-muted)]"
        />
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-sm font-medium text-[var(--dash-text)]">
          No search tasks configured
        </p>
        <p class="text-xs text-[var(--dash-text-secondary)] mt-0.5">
          Set up automated job searches to find matching positions
        </p>
      </div>
      <a
        href="/dashboard/jobs/settings"
        class="px-3 py-1.5 text-xs bg-[var(--dash-primary)] text-white rounded-lg hover:bg-[var(--dash-primary-hover)] transition-colors whitespace-nowrap flex items-center gap-1.5 shrink-0"
      >
        Add Search
        <FontAwesomeIcon icon={faArrowRight} class="w-3 h-3" />
      </a>
    </div>
  </Card>
{:else}
  <!-- Search tasks summary -->
  <Card padding="md">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-4 flex-1 min-w-0">
        <div
          class="w-10 h-10 rounded-lg bg-[var(--dash-bg)] flex items-center justify-center shrink-0"
        >
          <FontAwesomeIcon
            icon={hasRunning ? faPlay : faSearch}
            class="w-5 h-5 {hasRunning
              ? 'text-green-500 animate-pulse'
              : 'text-[var(--dash-text-muted)]'}"
          />
        </div>
        <div>
          <p class="text-sm font-medium text-[var(--dash-text)]">Search Tasks</p>
          <div class="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-[var(--dash-text-secondary)] mt-0.5">
            <span>
              <span class="font-semibold text-[var(--dash-text)]">{searchTasks.activeCount}</span>
              active / {searchTasks.totalCount} total
            </span>
            {#if searchTasks.lastRun}
              <span class="flex items-center gap-1">
                <FontAwesomeIcon icon={faClock} class="w-3 h-3" />
                Last run {timeAgo(searchTasks.lastRun)}
              </span>
            {/if}
            {#if searchTasks.totalJobsFound > 0}
              <span>
                {searchTasks.totalJobsFound} jobs found
              </span>
            {/if}
          </div>
        </div>
      </div>
      <a
        href="/dashboard/jobs/settings"
        class="px-3 py-1.5 text-xs bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-lg text-[var(--dash-text)] hover:border-[var(--dash-primary)] hover:text-[var(--dash-primary)] transition-colors whitespace-nowrap shrink-0 ml-3"
      >
        Manage
      </a>
    </div>
  </Card>
{/if}
