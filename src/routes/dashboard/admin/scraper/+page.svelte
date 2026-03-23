<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faSearch,
    faStop,
    faPlay,
    faExternalLinkAlt,
    faDesktop,
    faCloud,
    faExclamationTriangle,
  } from "@fortawesome/free-solid-svg-icons";
  import SectionHeader from "../../profile/components/SectionHeader.svelte";
  import Card from "../../components/Card.svelte";
  import Spinner from "$lib/components/Spinner.svelte";

  interface Run {
    id: number;
    status: string;
    startedAt: string;
    finishedAt: string | null;
    jobsFound: number | null;
    errorMessage: string | null;
    triggeredBy: string;
    liveUrl: string | null;
    searchTask: {
      id: number;
      name: string;
      status: string;
      browserProvider: string | null;
      searchUrl: string | null;
      platform: string | null;
    };
    profile: {
      id: number;
      name: string | null;
    };
    user: {
      id: string;
      name: string | null;
      email: string;
    };
  }

  interface QueueStats {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    hosted: { waiting: number; active: number; completed: number; failed: number };
    desktop: { waiting: number; active: number; completed: number; failed: number };
  }

  interface HealthIssue {
    severity: "warning" | "error";
    label: string;
    count: number;
    details?: string;
    fixAction?: string;
  }

  let runs = $state<Run[]>([]);
  let totalCount = $state(0);
  let queueStats = $state<QueueStats | null>(null);
  let healthChecks = $state<HealthIssue[]>([]);
  let loading = $state(true);
  let errorMsg = $state("");
  let pollInterval: ReturnType<typeof setInterval> | null = null;
  let statusFilter = $state<string>(""); // "", "active", "failed"
  let actionInProgress = $state<Record<number, string>>({}); // runId -> action

  async function loadRuns() {
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (statusFilter) params.set("status", statusFilter);
      const response = await fetch(`/api/admin/scraper?${params}`);
      if (response.ok) {
        const result = await response.json();
        runs = result.runs;
        totalCount = result.totalCount;
        queueStats = result.queueStats;
        healthChecks = result.healthChecks || [];
        errorMsg = "";
      } else {
        errorMsg = "Failed to load scraper runs";
      }
    } catch (err) {
      console.error("Failed to load admin scraper runs:", err);
      errorMsg = "Failed to load scraper runs";
    } finally {
      loading = false;
    }
  }

  let fixingIssue = $state<string | null>(null);

  async function fixHealthIssue(action: string) {
    fixingIssue = action;
    try {
      const response = await fetch("/api/admin/scraper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!response.ok) {
        console.error(`Fix action ${action} failed:`, await response.text());
      }
      await loadRuns();
    } catch (err) {
      console.error(`Fix action ${action} failed:`, err);
    } finally {
      fixingIssue = null;
    }
  }

  async function performAction(action: "stop" | "restart", run: Run) {
    actionInProgress = { ...actionInProgress, [run.id]: action };
    try {
      const response = await fetch("/api/admin/scraper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          runId: run.id,
          searchTaskId: run.searchTask.id,
        }),
      });
      if (!response.ok) {
        const text = await response.text();
        console.error(`Action ${action} failed:`, text);
      }
      // Refresh immediately
      await loadRuns();
    } catch (err) {
      console.error(`Action ${action} failed:`, err);
    } finally {
      const { [run.id]: _, ...rest } = actionInProgress;
      actionInProgress = rest;
    }
  }

  function formatDuration(startedAt: string, finishedAt: string | null): string {
    const start = new Date(startedAt).getTime();
    const end = finishedAt ? new Date(finishedAt).getTime() : Date.now();
    const diffMs = end - start;
    const secs = Math.floor(diffMs / 1000);
    const mins = Math.floor(secs / 60);
    const hours = Math.floor(mins / 60);

    if (hours > 0) return `${hours}h ${mins % 60}m`;
    if (mins > 0) return `${mins}m ${secs % 60}s`;
    return `${secs}s`;
  }

  function formatTime(date: string): string {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function isActive(status: string): boolean {
    return ["running", "queued", "blocked", "stopping"].includes(status);
  }

  function statusColor(status: string): string {
    switch (status) {
      case "running":
        return "text-green-600";
      case "queued":
        return "text-blue-600";
      case "blocked":
        return "text-amber-600";
      case "stopping":
        return "text-orange-600";
      case "finished":
        return "text-[var(--dash-text-secondary)]";
      case "failed":
        return "text-[var(--dash-error)]";
      case "cancelled":
        return "text-[var(--dash-text-muted)]";
      default:
        return "text-[var(--dash-text-secondary)]";
    }
  }

  function statusDot(status: string): string {
    switch (status) {
      case "running":
        return "bg-green-500";
      case "queued":
        return "bg-blue-500";
      case "blocked":
        return "bg-amber-500";
      case "stopping":
        return "bg-orange-500";
      case "finished":
        return "bg-[var(--dash-text-muted)]";
      case "failed":
        return "bg-[var(--dash-error)]";
      case "cancelled":
        return "bg-gray-400";
      default:
        return "bg-gray-400";
    }
  }

  onMount(() => {
    loadRuns();
    pollInterval = setInterval(loadRuns, 5000);
  });

  onDestroy(() => {
    if (pollInterval) clearInterval(pollInterval);
  });
</script>

<div class="space-y-6">
  <SectionHeader title="Scraper Runs" icon={faSearch} />

  {#if loading}
    <div class="flex items-center justify-center py-12">
      <Spinner size="w-6 h-6" color="var(--dash-primary)" />
    </div>
  {:else if errorMsg}
    <Card padding="responsive">
      <p class="text-[var(--dash-error)] text-sm">{errorMsg}</p>
    </Card>
  {:else}
    <!-- Queue Stats -->
    {#if queueStats}
      <Card padding="responsive">
        <div class="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <div class="flex items-center gap-2">
            <span class="text-[var(--dash-text-muted)]">Queue:</span>
            {#if queueStats.active > 0}
              <span class="relative flex h-2 w-2">
                <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span class="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              <span class="font-medium text-green-600">{queueStats.active} active</span>
            {:else}
              <span class="text-[var(--dash-text-secondary)]">idle</span>
            {/if}
            {#if queueStats.waiting > 0}
              <span class="text-blue-600">{queueStats.waiting} waiting</span>
            {/if}
          </div>
          <div class="flex items-center gap-4 text-xs text-[var(--dash-text-muted)]">
            <span>
              <FontAwesomeIcon icon={faDesktop} class="w-3 h-3" />
              {queueStats.desktop.active}a / {queueStats.desktop.waiting}w
            </span>
            <span>
              <FontAwesomeIcon icon={faCloud} class="w-3 h-3" />
              {queueStats.hosted.active}a / {queueStats.hosted.waiting}w
            </span>
          </div>
        </div>
      </Card>
    {/if}

    <!-- Health Checks -->
    {#if healthChecks.length > 0}
      <Card padding="responsive">
        <div class="space-y-2">
          <div class="flex items-center gap-2 text-sm font-medium text-[var(--dash-text)]">
            <FontAwesomeIcon icon={faExclamationTriangle} class="w-4 h-4 text-amber-500" />
            System Health
          </div>
          {#each healthChecks as issue}
            <div class="flex items-center justify-between gap-4">
              <div class="flex items-start gap-2 text-sm {issue.severity === 'error' ? 'text-[var(--dash-error)]' : 'text-amber-600'}">
                <span class="w-2 h-2 rounded-full mt-1.5 flex-shrink-0 {issue.severity === 'error' ? 'bg-[var(--dash-error)]' : 'bg-amber-500'}"></span>
                <div>
                  <span class="font-medium">{issue.count}</span> {issue.label}
                  {#if issue.details}
                    <p class="text-xs text-[var(--dash-text-muted)] mt-0.5">{issue.details}</p>
                  {/if}
                </div>
              </div>
              {#if issue.fixAction}
                <button
                  onclick={() => fixHealthIssue(issue.fixAction!)}
                  disabled={fixingIssue === issue.fixAction}
                  class="flex-shrink-0 px-2.5 py-1 text-xs rounded-lg bg-[var(--dash-primary)]/10 text-[var(--dash-primary)] hover:bg-[var(--dash-primary)]/20 transition-colors disabled:opacity-50"
                >
                  {#if fixingIssue === issue.fixAction}
                    <Spinner size="w-3 h-3" />
                  {:else}
                    Fix
                  {/if}
                </button>
              {/if}
            </div>
          {/each}
        </div>
      </Card>
    {/if}

    <!-- Filters -->
    <div class="flex gap-2">
      <button
        onclick={() => { statusFilter = ""; loadRuns(); }}
        class="px-3 py-1.5 text-xs rounded-lg transition-colors {statusFilter === ''
          ? 'bg-[var(--dash-primary)] text-white'
          : 'bg-[var(--dash-bg)] text-[var(--dash-text-secondary)] hover:bg-[var(--dash-border)]'}"
      >
        All ({totalCount})
      </button>
      <button
        onclick={() => { statusFilter = "active"; loadRuns(); }}
        class="px-3 py-1.5 text-xs rounded-lg transition-colors {statusFilter === 'active'
          ? 'bg-[var(--dash-primary)] text-white'
          : 'bg-[var(--dash-bg)] text-[var(--dash-text-secondary)] hover:bg-[var(--dash-border)]'}"
      >
        Active
      </button>
      <button
        onclick={() => { statusFilter = "failed"; loadRuns(); }}
        class="px-3 py-1.5 text-xs rounded-lg transition-colors {statusFilter === 'failed'
          ? 'bg-[var(--dash-primary)] text-white'
          : 'bg-[var(--dash-bg)] text-[var(--dash-text-secondary)] hover:bg-[var(--dash-border)]'}"
      >
        Failed / Cancelled
      </button>
    </div>

    <!-- Runs List -->
    {#if runs.length === 0}
      <Card padding="responsive">
        <p class="text-sm text-[var(--dash-text-muted)] text-center py-4">
          No runs found.
        </p>
      </Card>
    {:else}
      <div class="space-y-2">
        {#each runs as run (run.id)}
          <Card padding="responsive">
            <div class="flex items-start justify-between gap-4">
              <!-- Left: Run info -->
              <div class="min-w-0 flex-1">
                <!-- Status + Task Name -->
                <div class="flex items-center gap-2 mb-1">
                  {#if run.status === "running"}
                    <span class="relative flex h-2 w-2 flex-shrink-0">
                      <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span class="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </span>
                  {:else}
                    <span class="w-2 h-2 rounded-full flex-shrink-0 {statusDot(run.status)}"></span>
                  {/if}
                  <span class="text-xs font-medium {statusColor(run.status)} uppercase">{run.status}</span>
                  <a
                    href="/dashboard/jobs/settings/{run.searchTask.id}"
                    class="text-sm font-medium text-[var(--dash-text)] hover:text-[var(--dash-primary)] truncate"
                  >
                    {run.searchTask.name}
                  </a>
                </div>

                <!-- Details row -->
                <div class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--dash-text-secondary)]">
                  <span title={run.user.email}>
                    {run.user.name || run.user.email}
                  </span>
                  <span>{run.profile.name || `Profile ${run.profile.id}`}</span>
                  {#if run.searchTask.platform}
                    <span>{run.searchTask.platform}</span>
                  {/if}
                  <span>
                    {#if run.searchTask.browserProvider === "hosted"}
                      <FontAwesomeIcon icon={faCloud} class="w-3 h-3" /> Hosted
                    {:else}
                      <FontAwesomeIcon icon={faDesktop} class="w-3 h-3" /> Desktop
                    {/if}
                  </span>
                  <span>via {run.triggeredBy}</span>
                </div>

                <!-- Time + duration -->
                <div class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--dash-text-muted)] mt-1">
                  <span>{formatTime(run.startedAt)}</span>
                  <span>{formatDuration(run.startedAt, run.finishedAt)}{isActive(run.status) ? " (running)" : ""}</span>
                  {#if run.jobsFound !== null}
                    <span>{run.jobsFound} jobs found</span>
                  {/if}
                </div>

                <!-- Error message -->
                {#if run.errorMessage && run.status !== "cancelled"}
                  <p class="text-xs text-[var(--dash-error)] mt-1 truncate" title={run.errorMessage}>
                    {run.errorMessage}
                  </p>
                {/if}
              </div>

              <!-- Right: Actions -->
              <div class="flex items-center gap-2 flex-shrink-0">
                {#if run.liveUrl}
                  <a
                    href={run.liveUrl}
                    target="_blank"
                    rel="noopener"
                    class="p-1.5 rounded text-[var(--dash-text-muted)] hover:text-[var(--dash-primary)] hover:bg-[var(--dash-bg)] transition-colors"
                    title="Open live view"
                  >
                    <FontAwesomeIcon icon={faExternalLinkAlt} class="w-3.5 h-3.5" />
                  </a>
                {/if}

                {#if isActive(run.status)}
                  <button
                    onclick={() => performAction("stop", run)}
                    disabled={!!actionInProgress[run.id] || run.status === "stopping"}
                    class="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg bg-[var(--dash-error)]/10 text-[var(--dash-error)] hover:bg-[var(--dash-error)]/20 transition-colors disabled:opacity-50"
                    title={run.status === "stopping" ? "Stop signal sent, waiting for scraper to finish" : "Stop this run"}
                  >
                    {#if actionInProgress[run.id] === "stop" || run.status === "stopping"}
                      <Spinner size="w-3 h-3" />
                    {:else}
                      <FontAwesomeIcon icon={faStop} class="w-3 h-3" />
                    {/if}
                    {run.status === "stopping" ? "Stopping" : "Stop"}
                  </button>
                {:else}
                  <button
                    onclick={() => performAction("restart", run)}
                    disabled={!!actionInProgress[run.id]}
                    class="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg bg-[var(--dash-primary)]/10 text-[var(--dash-primary)] hover:bg-[var(--dash-primary)]/20 transition-colors disabled:opacity-50"
                    title="Restart this search task"
                  >
                    {#if actionInProgress[run.id] === "restart"}
                      <Spinner size="w-3 h-3" />
                    {:else}
                      <FontAwesomeIcon icon={faPlay} class="w-3 h-3" />
                    {/if}
                    Restart
                  </button>
                {/if}
              </div>
            </div>
          </Card>
        {/each}
      </div>
    {/if}
  {/if}
</div>
