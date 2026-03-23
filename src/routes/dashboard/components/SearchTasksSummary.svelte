<script lang="ts">
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import { faPlay, faSearch } from "@fortawesome/free-solid-svg-icons";
  import { getSearchTaskStatusIcon } from "$lib/search-task-status";
  import Card from "./Card.svelte";

  interface SearchTask {
    id: number;
    name: string;
    is_active: boolean;
    status: string | null;
    status_message: string | null;
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

  // Show the 5 most recently run tasks
  const recentTasks = $derived(
    [...searchTasks.tasks]
      .sort((a, b) => {
        const aTime = a.last_run ? new Date(a.last_run).getTime() : 0;
        const bTime = b.last_run ? new Date(b.last_run).getTime() : 0;
        return bTime - aTime;
      })
      .slice(0, 4),
  );
</script>

<Card padding="md">
  <div class="flex items-start justify-between gap-3 mb-3">
    <div class="flex items-center gap-2.5">
      <div
        class="w-8 h-8 rounded-lg bg-[var(--dash-bg)] flex items-center justify-center shrink-0"
      >
        <FontAwesomeIcon
          icon={hasRunning ? faPlay : faSearch}
          class="w-4 h-4 {hasRunning
            ? 'text-green-500 animate-pulse'
            : 'text-[var(--dash-text-muted)]'}"
        />
      </div>
      <div>
        <p class="text-sm font-medium text-[var(--dash-text)]">Search Tasks</p>
        <p class="text-xs text-[var(--dash-text-secondary)]">
          {searchTasks.activeCount} active / {searchTasks.totalCount} total
        </p>
      </div>
    </div>
    <a
      href="/dashboard/jobs/settings"
      class="px-2.5 py-1 text-xs bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-lg text-[var(--dash-text)] hover:border-[var(--dash-primary)] hover:text-[var(--dash-primary)] transition-colors whitespace-nowrap shrink-0"
    >
      {searchTasks.totalCount === 0 ? "Add" : "Manage"}
    </a>
  </div>

  {#if searchTasks.totalCount === 0}
    <p class="text-xs text-[var(--dash-text-secondary)]">
      No search tasks configured yet. Set up automated job searches to find matching positions.
    </p>
  {:else}
    <div class="space-y-2">
      {#each recentTasks as task (task.id)}
        {@const statusIcon = getSearchTaskStatusIcon(task)}
        <div class="flex items-center gap-2 text-xs">
          <FontAwesomeIcon
            icon={statusIcon.icon}
            class="{statusIcon.iconSize} {statusIcon.colorClass} {statusIcon.animate ? 'spin-pulse' : ''} shrink-0"
          />

          <!-- Name @ platform -->
          <span class="text-[var(--dash-text)] truncate flex-1 min-w-0">
            {task.name || "Search task"}{#if task.job_platforms}<span class="text-[var(--dash-text-secondary)] ml-1">@ {task.job_platforms.name}</span>{/if}
          </span>

          <!-- Jobs found -->
          {#if task.last_run_jobs_found != null && task.last_run_jobs_found > 0}
            <span class="text-[var(--dash-text-secondary)] whitespace-nowrap shrink-0">
              {task.last_run_jobs_found} jobs
            </span>
          {/if}

          <!-- Time -->
          {#if task.last_run}
            <span class="text-[var(--dash-text-muted)] whitespace-nowrap shrink-0">
              {timeAgo(task.last_run)}
            </span>
          {:else}
            <span class="text-[var(--dash-text-muted)] whitespace-nowrap shrink-0">
              Not run yet
            </span>
          {/if}
        </div>
      {/each}
      {#if searchTasks.totalCount > 4}
        <a
          href="/dashboard/jobs/settings"
          class="text-xs text-[var(--dash-primary)] hover:underline"
        >
          +{searchTasks.totalCount - 4} more
        </a>
      {/if}
    </div>
  {/if}
</Card>
