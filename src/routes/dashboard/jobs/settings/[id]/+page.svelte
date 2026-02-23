<script lang="ts">
  import type { PageData } from "./$types";
  import { onMount, onDestroy } from "svelte";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faArrowLeft,
    faCheck,
    faChevronDown,
    faChevronRight,
    faCloud,
    faCog,
    faDesktop,
    faExclamationTriangle,
    faExternalLinkAlt,
    faEye,
    faHistory,
    faPlay,
    faSpinner,
    faStop,
    faTimes,
  } from "@fortawesome/free-solid-svg-icons";

  let { data }: { data: PageData } = $props();

  let jobSearch = $state(data.jobSearch);
  let isStarting = $state(false);
  let isStopping = $state(false);
  let errorMessage = $state<string | null>(null);
  let showBrowser = $state(false);
  let liveUrl = $state<string | null>(null);
  let pollInterval: ReturnType<typeof setInterval> | null = null;
  let currentRunId = $state<number | null>(null);

  // Runs history
  interface Run {
    id: number;
    status: string;
    started_at: string;
    finished_at: string | null;
    jobs_found: number | null;
    error_message: string | null;
    triggered_by: string;
    live_url: string | null;
  }

  interface LogEntry {
    id: number;
    level: string;
    message: string;
    timestamp: string;
  }

  let runs = $state<Run[]>([]);
  let expandedRunId = $state<number | null>(null);
  let runLogs = $state<Record<number, LogEntry[]>>({});
  let loadingLogs = $state<Record<number, boolean>>({});
  let logPollIntervals = $state<Record<number, ReturnType<typeof setInterval>>>({});

  // Computed states
  let isRunning = $derived(jobSearch.status === "running");
  let isBlocked = $derived(jobSearch.status === "blocked");
  let isQueued = $derived(jobSearch.status === "queued");
  let needsIntervention = $derived(isRunning || isBlocked);
  let isCloudMode = $derived(!!liveUrl);
  let browserViewUrl = $derived(liveUrl || "/vnc/vnc.html?autoconnect=true&resize=scale");

  function formatDate(date: Date | string | null): string {
    if (!date) return "Never";
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function formatRelativeTime(date: Date | string | null): string {
    if (!date) return "";
    const d = typeof date === "string" ? new Date(date) : date;
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDate(date);
  }

  function getRunStatusColor(status: string): string {
    switch (status) {
      case "success":
        return "text-[var(--dash-success)]";
      case "partial":
        return "text-[var(--dash-warning)]";
      case "error":
      case "cancelled":
        return "text-[var(--dash-error)]";
      case "running":
      case "queued":
        return "text-[var(--dash-primary)]";
      case "blocked":
        return "text-[var(--dash-warning)]";
      default:
        return "text-[var(--dash-text-secondary)]";
    }
  }

  function getRunStatusIcon(status: string) {
    switch (status) {
      case "success":
        return faCheck;
      case "partial":
      case "blocked":
        return faExclamationTriangle;
      case "error":
      case "cancelled":
        return faTimes;
      case "running":
      case "queued":
        return faSpinner;
      default:
        return faCog;
    }
  }

  function getLogLevelColor(level: string): string {
    switch (level) {
      case "error":
        return "text-[var(--dash-error)]";
      case "warn":
        return "text-[var(--dash-warning)]";
      case "info":
        return "text-[var(--dash-text)]";
      case "debug":
        return "text-[var(--dash-text-muted)]";
      default:
        return "text-[var(--dash-text-secondary)]";
    }
  }

  async function loadRuns() {
    try {
      const response = await fetch(`/api/job-searches/${jobSearch.id}/runs?limit=10`);
      if (response.ok) {
        const data = await response.json();
        runs = data.runs;
      }
    } catch (err) {
      console.error("Failed to load runs:", err);
    }
  }

  async function loadRunLogs(runId: number) {
    if (loadingLogs[runId]) return;
    loadingLogs[runId] = true;

    try {
      const response = await fetch(`/api/job-searches/${jobSearch.id}/runs/${runId}/logs`);
      if (response.ok) {
        const data = await response.json();
        runLogs[runId] = data.logs;
      }
    } catch (err) {
      console.error("Failed to load logs:", err);
    } finally {
      loadingLogs[runId] = false;
    }
  }

  function toggleRunExpanded(runId: number) {
    if (expandedRunId === runId) {
      expandedRunId = null;
      // Stop polling logs for this run
      if (logPollIntervals[runId]) {
        clearInterval(logPollIntervals[runId]);
        delete logPollIntervals[runId];
      }
    } else {
      expandedRunId = runId;
      loadRunLogs(runId);

      // Start polling logs if run is active
      const run = runs.find((r) => r.id === runId);
      if (run && (run.status === "running" || run.status === "blocked" || run.status === "queued")) {
        startLogPolling(runId);
      }
    }
  }

  function startLogPolling(runId: number) {
    if (logPollIntervals[runId]) return;

    logPollIntervals[runId] = setInterval(async () => {
      const existingLogs = runLogs[runId] || [];
      const lastTimestamp = existingLogs.length > 0 ? existingLogs[existingLogs.length - 1].timestamp : null;

      try {
        const url = lastTimestamp
          ? `/api/job-searches/${jobSearch.id}/runs/${runId}/logs?after=${encodeURIComponent(lastTimestamp)}`
          : `/api/job-searches/${jobSearch.id}/runs/${runId}/logs`;

        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          if (data.logs.length > 0) {
            runLogs[runId] = [...existingLogs, ...data.logs];
          }

          // Stop polling if run is complete
          if (!["running", "blocked", "queued"].includes(data.runStatus)) {
            if (logPollIntervals[runId]) {
              clearInterval(logPollIntervals[runId]);
              delete logPollIntervals[runId];
            }
          }
        }
      } catch (err) {
        console.error("Failed to poll logs:", err);
      }
    }, 2000);
  }

  async function startScrape() {
    isStarting = true;
    errorMessage = null;

    try {
      const response = await fetch(`/api/job-searches/${jobSearch.id}/run`, {
        method: "POST",
      });

      const result = await response.json();

      if (!response.ok) {
        errorMessage = result.message || "Failed to start scrape";
        return;
      }

      if (result.status === "already_queued") {
        errorMessage = "This search is already queued";
        return;
      }

      if (result.status === "already_running") {
        errorMessage = "This search is already running";
        return;
      }

      // Queued successfully
      jobSearch.status = "queued";
      jobSearch.status_message = "Waiting in queue";
      currentRunId = result.runId;
      showBrowser = true;

      // Reload runs to show the new one
      await loadRuns();

      // Expand the new run to show logs
      if (result.runId) {
        expandedRunId = result.runId;
        startLogPolling(result.runId);
      }

      // Start polling for status updates
      startPolling();
    } catch (err) {
      errorMessage = "Failed to start scrape";
      console.error(err);
    } finally {
      isStarting = false;
    }
  }

  function startPolling() {
    if (pollInterval) return;

    pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/job-searches/${jobSearch.id}/run`);
        const result = await response.json();

        jobSearch.status = result.status;
        jobSearch.status_message = result.statusMessage;
        jobSearch.last_run = result.lastRun;
        jobSearch.last_run_jobs_found = result.jobsFound;
        liveUrl = result.liveUrl || null;
        currentRunId = result.currentRunId || null;

        // Update runs list
        await loadRuns();

        // Stop polling when scrape is complete
        if (!["running", "blocked", "queued"].includes(result.status)) {
          stopPolling();
          liveUrl = null;
        }
      } catch (err) {
        console.error("Failed to poll status:", err);
      }
    }, 3000);
  }

  function stopPolling() {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
  }

  async function stopScrape() {
    if (!confirm("Are you sure you want to stop the running scrape? This cannot be undone.")) {
      return;
    }

    isStopping = true;
    errorMessage = null;

    try {
      const response = await fetch(`/api/job-searches/${jobSearch.id}/run`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (!response.ok) {
        errorMessage = result.message || "Failed to stop scrape";
        return;
      }

      if (result.status === "removed_from_queue" || result.status === "cancellation_requested") {
        jobSearch.status = "error";
        jobSearch.status_message = "Cancelled by user";
        stopPolling();
        showBrowser = false;
        liveUrl = null;

        // Reload runs to show updated status
        await loadRuns();
      }
    } catch (err) {
      errorMessage = "Failed to stop scrape";
      console.error(err);
    } finally {
      isStopping = false;
    }
  }

  onMount(() => {
    // Load runs history
    loadRuns();

    // Start polling if already running/blocked/queued
    if (needsIntervention || isQueued) {
      showBrowser = true;
      startPolling();
    }
  });

  onDestroy(() => {
    stopPolling();
    // Clean up all log polling intervals
    Object.values(logPollIntervals).forEach((interval) => clearInterval(interval));
  });
</script>

<div class="space-y-6">
  <!-- Header -->
  <div class="flex items-center gap-4">
    <a
      href="/dashboard/jobs/settings"
      class="p-2 rounded-lg hover:bg-[var(--dash-bg)] text-[var(--dash-text-secondary)] hover:text-[var(--dash-text)] transition-colors"
    >
      <FontAwesomeIcon icon={faArrowLeft} class="w-5 h-5" />
    </a>
    <div class="flex-1">
      <h1 class="text-xl font-semibold text-[var(--dash-text)]">
        {jobSearch.name}
      </h1>
      {#if jobSearch.job_platforms}
        <p class="text-sm text-[var(--dash-text-secondary)]">
          {jobSearch.job_platforms.name}
        </p>
      {/if}
    </div>
  </div>

  <!-- Status Card -->
  <div class="bg-[var(--dash-card)] rounded-lg border border-[var(--dash-border)] p-6">
    <div class="flex items-center justify-between mb-4">
      <h2 class="font-medium text-[var(--dash-text)]">Scrape Status</h2>

      {#if isRunning || isBlocked || isQueued}
        <button
          onclick={stopScrape}
          disabled={isStopping}
          class="flex items-center gap-2 px-4 py-2 bg-[var(--dash-error)] text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {#if isStopping}
            <FontAwesomeIcon icon={faSpinner} class="w-4 h-4 animate-spin" />
            <span>Stopping...</span>
          {:else}
            <FontAwesomeIcon icon={faStop} class="w-4 h-4" />
            <span>Stop Scrape</span>
          {/if}
        </button>
      {:else}
        <button
          onclick={startScrape}
          disabled={isStarting || !jobSearch.search_url || !jobSearch.platform}
          class="flex items-center gap-2 px-4 py-2 bg-[var(--dash-primary)] text-white rounded-lg hover:bg-[var(--dash-primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {#if isStarting}
            <FontAwesomeIcon icon={faSpinner} class="w-4 h-4 animate-spin" />
            <span>Starting...</span>
          {:else}
            <FontAwesomeIcon icon={faPlay} class="w-4 h-4" />
            <span>Run Scrape</span>
          {/if}
        </button>
      {/if}
    </div>

    {#if errorMessage}
      <div class="mb-4 p-3 bg-[var(--dash-error-light)] border border-[var(--dash-error)] rounded-lg">
        <p class="text-[var(--dash-error)] text-sm">{errorMessage}</p>
      </div>
    {/if}

    <!-- Status Display -->
    <div class="flex items-center gap-3 p-4 bg-[var(--dash-bg)] rounded-lg">
      {#if jobSearch.status === "queued"}
        <div class="w-10 h-10 rounded-full bg-[var(--dash-primary-light)] flex items-center justify-center">
          <FontAwesomeIcon icon={faSpinner} class="w-5 h-5 text-[var(--dash-primary)] animate-spin" />
        </div>
        <div>
          <p class="font-medium text-[var(--dash-text)]">Queued</p>
          <p class="text-sm text-[var(--dash-text-secondary)]">
            Waiting in queue to start...
          </p>
        </div>
      {:else if jobSearch.status === "running"}
        <div class="w-10 h-10 rounded-full bg-[var(--dash-primary-light)] flex items-center justify-center">
          <FontAwesomeIcon icon={faSpinner} class="w-5 h-5 text-[var(--dash-primary)] animate-spin" />
        </div>
        <div>
          <p class="font-medium text-[var(--dash-text)]">Running...</p>
          <p class="text-sm text-[var(--dash-text-secondary)]">
            Scraping jobs from {jobSearch.job_platforms?.name || "platform"}
          </p>
        </div>
      {:else if jobSearch.status === "blocked"}
        <div class="w-10 h-10 rounded-full bg-[var(--dash-warning-light)] flex items-center justify-center">
          <FontAwesomeIcon icon={faExclamationTriangle} class="w-5 h-5 text-[var(--dash-warning)]" />
        </div>
        <div>
          <p class="font-medium text-[var(--dash-warning)]">{jobSearch.status_message}</p>
          <p class="text-sm text-[var(--dash-text-secondary)]">
            Manual action needed - use the browser view below
          </p>
        </div>
      {:else if jobSearch.status === "success"}
        <div class="w-10 h-10 rounded-full bg-[var(--dash-success-light)] flex items-center justify-center">
          <FontAwesomeIcon icon={faCheck} class="w-5 h-5 text-[var(--dash-success)]" />
        </div>
        <div>
          <p class="font-medium text-[var(--dash-text)]">Completed</p>
          <p class="text-sm text-[var(--dash-text-secondary)]">
            {formatDate(jobSearch.last_run)}
            {#if jobSearch.last_run_jobs_found}
              • {jobSearch.last_run_jobs_found} jobs found
            {/if}
          </p>
        </div>
      {:else if jobSearch.status === "partial"}
        <div class="w-10 h-10 rounded-full bg-[var(--dash-warning-light)] flex items-center justify-center">
          <FontAwesomeIcon icon={faExclamationTriangle} class="w-5 h-5 text-[var(--dash-warning)]" />
        </div>
        <div>
          <p class="font-medium text-[var(--dash-text)]">Completed with issues</p>
          <p class="text-sm text-[var(--dash-text-secondary)]">
            {formatDate(jobSearch.last_run)} • {jobSearch.status_message}
          </p>
        </div>
      {:else if jobSearch.status === "error"}
        <div class="w-10 h-10 rounded-full bg-[var(--dash-error-light)] flex items-center justify-center">
          <FontAwesomeIcon icon={faTimes} class="w-5 h-5 text-[var(--dash-error)]" />
        </div>
        <div>
          <p class="font-medium text-[var(--dash-error)]">Failed</p>
          <p class="text-sm text-[var(--dash-text-secondary)]">
            {jobSearch.status_message}
          </p>
        </div>
      {:else}
        <div class="w-10 h-10 rounded-full bg-[var(--dash-bg)] flex items-center justify-center border border-[var(--dash-border)]">
          <FontAwesomeIcon icon={faCog} class="w-5 h-5 text-[var(--dash-text-muted)]" />
        </div>
        <div>
          <p class="font-medium text-[var(--dash-text)]">Never run</p>
          <p class="text-sm text-[var(--dash-text-secondary)]">
            Click "Run Scrape" to start importing jobs
          </p>
        </div>
      {/if}
    </div>

    <!-- Missing config warnings -->
    {#if !jobSearch.search_url}
      <p class="mt-3 text-sm text-[var(--dash-warning)]">
        No search URL configured. Please add a search URL to run scrapes.
      </p>
    {/if}
    {#if !jobSearch.platform}
      <p class="mt-3 text-sm text-[var(--dash-warning)]">
        No platform selected. Please select a platform to run scrapes.
      </p>
    {/if}
  </div>

  <!-- Browser View (VNC for local, iframe for cloud) -->
  {#if showBrowser || needsIntervention}
    <div class="bg-[var(--dash-card)] rounded-lg border border-[var(--dash-border)] overflow-hidden">
      <div class="flex items-center justify-between p-4 border-b border-[var(--dash-border)]">
        <div class="flex items-center gap-2">
          <FontAwesomeIcon icon={isCloudMode ? faCloud : faDesktop} class="w-4 h-4 text-[var(--dash-text-secondary)]" />
          <h2 class="font-medium text-[var(--dash-text)]">Browser View</h2>
          {#if isCloudMode}
            <span class="text-xs text-[var(--dash-text-muted)] bg-[var(--dash-bg)] px-2 py-0.5 rounded">
              Cloud
            </span>
          {/if}
        </div>
        <div class="flex items-center gap-2">
          {#if isBlocked}
            <span class="text-sm text-[var(--dash-warning)] bg-[var(--dash-warning-light)] px-2 py-1 rounded">
              Action needed
            </span>
          {/if}
          {#if isCloudMode && liveUrl}
            <a
              href={liveUrl}
              target="_blank"
              rel="noopener"
              class="p-1 text-[var(--dash-text-secondary)] hover:text-[var(--dash-primary)] transition-colors"
              title="Open in new tab"
            >
              <FontAwesomeIcon icon={faExternalLinkAlt} class="w-4 h-4" />
            </a>
          {/if}
          <button
            onclick={() => (showBrowser = false)}
            class="p-1 text-[var(--dash-text-secondary)] hover:text-[var(--dash-text)] transition-colors"
          >
            <FontAwesomeIcon icon={faTimes} class="w-4 h-4" />
          </button>
        </div>
      </div>
      <div class="relative" style="padding-bottom: 56.25%;">
        <iframe
          src={browserViewUrl}
          class="absolute inset-0 w-full h-full border-0"
          title="Browser view for manual intervention"
        ></iframe>
      </div>
      <div class="p-3 bg-[var(--dash-bg)] border-t border-[var(--dash-border)]">
        <p class="text-sm text-[var(--dash-text-secondary)]">
          {#if isBlocked}
            Complete the required action (login, CAPTCHA, or verification) in the browser above.
            The scrape will continue automatically when done.
          {:else if isRunning}
            Watch the scrape progress. You may need to intervene if a CAPTCHA or login is required.
          {:else}
            Browser session view. Start a scrape to see activity.
          {/if}
        </p>
      </div>
    </div>
  {:else}
    <button
      onclick={() => (showBrowser = true)}
      class="w-full p-4 border-2 border-dashed border-[var(--dash-border)] rounded-lg text-[var(--dash-text-secondary)] hover:text-[var(--dash-text)] hover:border-[var(--dash-text-secondary)] transition-colors flex items-center justify-center gap-2"
    >
      <FontAwesomeIcon icon={faEye} class="w-4 h-4" />
      <span>Show Browser View</span>
    </button>
  {/if}

  <!-- Runs History -->
  <div class="bg-[var(--dash-card)] rounded-lg border border-[var(--dash-border)]">
    <div class="flex items-center gap-2 p-4 border-b border-[var(--dash-border)]">
      <FontAwesomeIcon icon={faHistory} class="w-4 h-4 text-[var(--dash-text-secondary)]" />
      <h2 class="font-medium text-[var(--dash-text)]">Run History</h2>
    </div>

    {#if runs.length === 0}
      <div class="p-8 text-center text-[var(--dash-text-secondary)]">
        <p>No runs yet. Click "Run Scrape" to start.</p>
      </div>
    {:else}
      <div class="divide-y divide-[var(--dash-border)]">
        {#each runs as run (run.id)}
          <div class="bg-[var(--dash-card)]">
            <!-- Run header (clickable) -->
            <button
              onclick={() => toggleRunExpanded(run.id)}
              class="w-full flex items-center gap-3 p-4 hover:bg-[var(--dash-bg)] transition-colors text-left"
            >
              <FontAwesomeIcon
                icon={expandedRunId === run.id ? faChevronDown : faChevronRight}
                class="w-3 h-3 text-[var(--dash-text-muted)]"
              />

              <div class={`w-6 h-6 rounded-full flex items-center justify-center ${run.status === "running" || run.status === "queued" ? "bg-[var(--dash-primary-light)]" : run.status === "success" ? "bg-[var(--dash-success-light)]" : run.status === "blocked" || run.status === "partial" ? "bg-[var(--dash-warning-light)]" : "bg-[var(--dash-error-light)]"}`}>
                <FontAwesomeIcon
                  icon={getRunStatusIcon(run.status)}
                  class={`w-3 h-3 ${getRunStatusColor(run.status)} ${run.status === "running" || run.status === "queued" ? "animate-spin" : ""}`}
                />
              </div>

              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <span class={`font-medium capitalize ${getRunStatusColor(run.status)}`}>
                    {run.status}
                  </span>
                  {#if run.jobs_found !== null}
                    <span class="text-sm text-[var(--dash-text-secondary)]">
                      • {run.jobs_found} jobs
                    </span>
                  {/if}
                  {#if run.error_message && run.status !== "success"}
                    <span class="text-sm text-[var(--dash-text-muted)] truncate">
                      • {run.error_message}
                    </span>
                  {/if}
                </div>
                <div class="text-sm text-[var(--dash-text-muted)]">
                  {formatRelativeTime(run.started_at)}
                  <span class="text-[var(--dash-text-muted)]">•</span>
                  <span class="capitalize">{run.triggered_by}</span>
                </div>
              </div>
            </button>

            <!-- Expanded logs -->
            {#if expandedRunId === run.id}
              <div class="border-t border-[var(--dash-border)] bg-[var(--dash-bg)]">
                <div class="p-4">
                  <div class="flex items-center justify-between mb-2">
                    <span class="text-sm font-medium text-[var(--dash-text)]">Logs</span>
                    {#if loadingLogs[run.id]}
                      <FontAwesomeIcon icon={faSpinner} class="w-3 h-3 text-[var(--dash-text-muted)] animate-spin" />
                    {/if}
                  </div>

                  <div class="bg-[var(--dash-card)] rounded border border-[var(--dash-border)] max-h-64 overflow-y-auto">
                    {#if !runLogs[run.id] || runLogs[run.id].length === 0}
                      <div class="p-4 text-sm text-[var(--dash-text-muted)] text-center">
                        {#if loadingLogs[run.id]}
                          Loading logs...
                        {:else}
                          No logs available
                        {/if}
                      </div>
                    {:else}
                      <div class="p-2 space-y-0.5 font-mono text-xs">
                        {#each runLogs[run.id] as log (log.id)}
                          <div class="flex gap-2 py-0.5 px-1 hover:bg-[var(--dash-bg)] rounded">
                            <span class="text-[var(--dash-text-muted)] whitespace-nowrap">
                              {new Date(log.timestamp).toLocaleTimeString()}
                            </span>
                            <span class={`uppercase w-12 ${getLogLevelColor(log.level)}`}>
                              {log.level}
                            </span>
                            <span class="text-[var(--dash-text)] break-all">
                              {log.message}
                            </span>
                          </div>
                        {/each}
                      </div>
                    {/if}
                  </div>
                </div>
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Search URL -->
  {#if jobSearch.search_url}
    <div class="bg-[var(--dash-card)] rounded-lg border border-[var(--dash-border)] p-4">
      <h2 class="font-medium text-[var(--dash-text)] mb-2">Search URL</h2>
      <div class="flex items-center gap-2">
        <code class="flex-1 text-sm bg-[var(--dash-bg)] px-3 py-2 rounded text-[var(--dash-text-secondary)] overflow-x-auto">
          {jobSearch.search_url}
        </code>
        <a
          href={jobSearch.search_url}
          target="_blank"
          rel="noopener"
          class="p-2 text-[var(--dash-text-secondary)] hover:text-[var(--dash-primary)] transition-colors"
        >
          <FontAwesomeIcon icon={faExternalLinkAlt} class="w-4 h-4" />
        </a>
      </div>
    </div>
  {/if}
</div>
