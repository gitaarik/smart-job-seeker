<script lang="ts">
  import type { PageData } from "./$types";
  import { onMount, onDestroy } from "svelte";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faArrowLeft,
    faBuilding,
    faCheck,
    faChevronDown,
    faChevronRight,
    faChevronUp,
    faCloud,
    faCog,
    faDesktop,
    faExclamationTriangle,
    faExternalLinkAlt,
    faEye,
    faForward,
    faHistory,
    faMapMarkerAlt,
    faMoneyBillWave,
    faPlay,
    faSpinner,
    faStop,
    faSync,
    faTerminal,
    faTimes,
  } from "@fortawesome/free-solid-svg-icons";

  let { data }: { data: PageData } = $props();

  let jobSearch = $state(data.jobSearch);
  let isStarting = $state(false);
  let isStopping = $state(false);
  let isSendingFeedback = $state(false);
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

  interface JobDetails {
    id: number;
    title: string | null;
    company: string | null;
    office_location: string | null;
    salary_min: number | null;
    salary_max: number | null;
    salary_currency: string | null;
    salary_period: string | null;
    job_types: string[] | null;
    work_location: string[] | null;
    skills_required: string[] | null;
    skills_preferred: string[] | null;
    job_description: string | null;
    source_url: string | null;
  }

  interface RunItem {
    id: number;
    position: number;
    title: string | null;
    company: string | null;
    location: string | null;
    status: string;
    status_message: string | null;
    job_id: number | null;
    was_created: boolean | null;
    jobs: JobDetails | null;
  }

  interface RunItemsData {
    items: RunItem[];
    stats: {
      total: number;
      pending: number;
      processing: number;
      completed: number;
      skipped: number;
      error: number;
    };
  }

  let runs = $state<Run[]>([]);
  let expandedRunId = $state<number | null>(null);
  let expandedItemId = $state<number | null>(null);
  let runLogs = $state<Record<number, LogEntry[]>>({});
  let runItems = $state<Record<number, RunItemsData>>({});
  let loadingLogs = $state<Record<number, boolean>>({});
  let loadingItems = $state<Record<number, boolean>>({});
  let logPollIntervals = $state<Record<number, ReturnType<typeof setInterval>>>({});
  let itemPollIntervals = $state<Record<number, ReturnType<typeof setInterval>>>({});
  let runTabView = $state<Record<number, "jobs" | "logs" | "browser-use">>({}); // Tab view per run
  let logLevelFilter = $state<"debug" | "info" | "warn" | "error">("info");

  // Browser-Use logs (staff only)
  interface BrowserUseLogEntry {
    timestamp: string;
    level: string;
    logger: string;
    message: string;
  }
  let browserUseLogs = $state<BrowserUseLogEntry[]>([]);
  let loadingBrowserUseLogs = $state(false);
  let browserUseLogPollInterval: ReturnType<typeof setInterval> | null = null;
  let browserUseLogLevelFilter = $state<"debug" | "info" | "warn" | "error">("debug");
  let showBrowserUseLogs = $state(false);
  let isRestartingBrowserUse = $state(false);

  // Browser-Use health status (staff only)
  interface BrowserUseHealth {
    service_healthy: boolean;
    chrome_running: boolean;
    chrome_pid?: number;
    cdp_responsive: boolean;
    cdp_port: number;
    current_url?: string;
    page_count: number;
    socat_running: boolean;
    memory_mb?: number;
    error?: string;
  }
  let browserUseHealth = $state<BrowserUseHealth | null>(null);
  let loadingHealth = $state(false);

  // CDP debug info (staff only)
  interface CDPDebugInfo {
    timestamp: string;
    chrome_processes: Array<{
      pid: string;
      cpu: string;
      mem: string;
      rss: string;
      stat: string;
      cmd: string;
    }>;
    socat_processes: Array<{ pid: string; cmd: string }>;
    cdp_version_check: { success: boolean; error?: string; time_ms: number };
    cdp_pages_check: { success: boolean; error?: string; time_ms: number; data?: { count: number } };
    websocket_test: { success: boolean; error?: string; time_ms: number };
    port_listening: { "9222": boolean; "9223": boolean };
  }
  let cdpDebugInfo = $state<CDPDebugInfo | null>(null);
  let loadingCDPDebug = $state(false);
  let showCDPDebug = $state(false);

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
        // Spread each run object to ensure Svelte 5 reactivity detects changes
        // This forces re-render even when only nested properties change
        runs = data.runs.map((run: Run) => ({ ...run }));
      }
    } catch (err) {
      console.error("Failed to load runs:", err);
    }
  }

  async function loadRunLogs(runId: number) {
    if (loadingLogs[runId]) return;
    loadingLogs[runId] = true;

    try {
      const response = await fetch(`/api/job-searches/${jobSearch.id}/runs/${runId}/logs?level=${logLevelFilter}`);
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

  async function loadRunItems(runId: number) {
    if (loadingItems[runId]) return;
    loadingItems[runId] = true;

    try {
      const response = await fetch(`/api/job-searches/${jobSearch.id}/runs/${runId}/items`);
      if (response.ok) {
        const data = await response.json();
        runItems[runId] = data;
      } else {
        console.error("Failed to load items:", response.status, await response.text());
      }
    } catch (err) {
      console.error("Failed to load items:", err);
    } finally {
      loadingItems[runId] = false;
    }
  }

  function startItemPolling(runId: number) {
    if (itemPollIntervals[runId]) return;

    itemPollIntervals[runId] = setInterval(async () => {
      await loadRunItems(runId);

      // Stop polling if run is complete
      const run = runs.find((r) => r.id === runId);
      if (run && !["running", "blocked", "queued"].includes(run.status)) {
        stopItemPolling(runId);
      }
    }, 2000);
  }

  function stopItemPolling(runId: number) {
    if (itemPollIntervals[runId]) {
      clearInterval(itemPollIntervals[runId]);
      delete itemPollIntervals[runId];
    }
  }

  function getItemStatusColor(status: string): string {
    switch (status) {
      case "completed":
        return "text-[var(--dash-success)]";
      case "processing":
        return "text-[var(--dash-primary)]";
      case "pending":
        return "text-[var(--dash-text-muted)]";
      case "skipped":
        return "text-[var(--dash-warning)]";
      case "error":
        return "text-[var(--dash-error)]";
      default:
        return "text-[var(--dash-text-secondary)]";
    }
  }

  function toggleItemExpanded(itemId: number) {
    expandedItemId = expandedItemId === itemId ? null : itemId;
  }

  function formatSalary(
    min: number | null,
    max: number | null,
    currency: string | null,
    period: string | null,
  ): string {
    if (!min && !max) return "";
    const curr = currency || "USD";
    const formatter = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: curr,
      maximumFractionDigits: 0,
    });
    let result = "";
    if (min && max) {
      result = `${formatter.format(min)} - ${formatter.format(max)}`;
    } else if (min) {
      result = `From ${formatter.format(min)}`;
    } else if (max) {
      result = `Up to ${formatter.format(max)}`;
    }
    if (period) {
      result += ` / ${period}`;
    }
    return result;
  }

  function truncateText(text: string | null, maxLength: number): string {
    if (!text) return "";
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  }

  function getItemStatusBg(status: string): string {
    switch (status) {
      case "completed":
        return "bg-[var(--dash-success-light)]";
      case "processing":
        return "bg-[var(--dash-primary-light)]";
      case "pending":
        return "bg-[var(--dash-bg)]";
      case "skipped":
        return "bg-[var(--dash-warning-light)]";
      case "error":
        return "bg-[var(--dash-error-light)]";
      default:
        return "bg-[var(--dash-bg)]";
    }
  }

  function toggleRunExpanded(runId: number) {
    if (expandedRunId === runId) {
      expandedRunId = null;
      // Stop polling logs and items for this run
      stopItemPolling(runId);
      stopBrowserUseLogPolling();
      if (logPollIntervals[runId]) {
        clearInterval(logPollIntervals[runId]);
        delete logPollIntervals[runId];
      }
    } else {
      expandedRunId = runId;
      runTabView[runId] = runTabView[runId] || "jobs"; // Default to jobs tab
      loadRunLogs(runId);
      loadRunItems(runId);

      // Start polling if run is active
      const run = runs.find((r) => r.id === runId);
      if (run && (run.status === "running" || run.status === "blocked" || run.status === "queued")) {
        startLogPolling(runId);
        startItemPolling(runId);
      }
    }
  }

  // Browser-Use log functions (staff only)
  async function loadBrowserUseLogs() {
    if (!data.isStaff || loadingBrowserUseLogs) return;
    loadingBrowserUseLogs = true;

    try {
      const lastTimestamp = browserUseLogs.length > 0 ? browserUseLogs[browserUseLogs.length - 1].timestamp : null;
      let url = `/api/staff/browser-use/logs?level=${browserUseLogLevelFilter}&limit=200`;
      if (lastTimestamp) {
        url += `&after=${encodeURIComponent(lastTimestamp)}`;
      }

      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        if (lastTimestamp && data.logs.length > 0) {
          browserUseLogs = [...browserUseLogs, ...data.logs];
        } else if (!lastTimestamp) {
          browserUseLogs = data.logs;
        }
      }
    } catch (err) {
      console.error("Failed to load browser-use logs:", err);
    } finally {
      loadingBrowserUseLogs = false;
    }
  }

  async function loadBrowserUseHealth() {
    if (!data.isStaff || loadingHealth) return;
    loadingHealth = true;

    try {
      const response = await fetch("/api/staff/browser-use/health");
      if (response.ok) {
        browserUseHealth = await response.json();
      }
    } catch (err) {
      console.error("Failed to load browser-use health:", err);
    } finally {
      loadingHealth = false;
    }
  }

  async function loadCDPDebug() {
    if (!data.isStaff || loadingCDPDebug) return;
    loadingCDPDebug = true;

    try {
      const response = await fetch("/api/staff/browser-use/debug");
      if (response.ok) {
        cdpDebugInfo = await response.json();
      }
    } catch (err) {
      console.error("Failed to load CDP debug info:", err);
    } finally {
      loadingCDPDebug = false;
    }
  }

  function startBrowserUseLogPolling() {
    if (!data.isStaff || browserUseLogPollInterval) return;

    loadBrowserUseLogs();
    loadBrowserUseHealth();
    browserUseLogPollInterval = setInterval(() => {
      loadBrowserUseLogs();
      loadBrowserUseHealth();
    }, 2000);
  }

  function stopBrowserUseLogPolling() {
    if (browserUseLogPollInterval) {
      clearInterval(browserUseLogPollInterval);
      browserUseLogPollInterval = null;
    }
  }

  async function restartBrowserUse() {
    if (!data.isStaff || isRestartingBrowserUse) return;

    if (!confirm("Restart the browser-use service? This will interrupt any running scrapes.")) {
      return;
    }

    isRestartingBrowserUse = true;
    try {
      const response = await fetch("/api/staff/browser-use/restart", {
        method: "POST",
      });

      if (response.ok) {
        // Clear logs and reload after restart
        browserUseLogs = [];
        await loadBrowserUseLogs();
      } else {
        const result = await response.json();
        alert(result.message || "Failed to restart browser-use service");
      }
    } catch (err) {
      console.error("Failed to restart browser-use:", err);
      alert("Failed to restart browser-use service");
    } finally {
      isRestartingBrowserUse = false;
    }
  }

  function startLogPolling(runId: number) {
    if (logPollIntervals[runId]) return;

    logPollIntervals[runId] = setInterval(async () => {
      const existingLogs = runLogs[runId] || [];
      const lastTimestamp = existingLogs.length > 0 ? existingLogs[existingLogs.length - 1].timestamp : null;

      try {
        let url = `/api/job-searches/${jobSearch.id}/runs/${runId}/logs?level=${logLevelFilter}`;
        if (lastTimestamp) {
          url += `&after=${encodeURIComponent(lastTimestamp)}`;
        }

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

  async function sendFeedback(response: "continue" | "skip" | "cancel") {
    if (!currentRunId) {
      errorMessage = "No active run to respond to";
      return;
    }

    isSendingFeedback = true;
    errorMessage = null;

    try {
      const res = await fetch(`/api/job-searches/${jobSearch.id}/runs/${currentRunId}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response }),
      });

      const result = await res.json();

      if (!res.ok) {
        errorMessage = result.message || `Failed to send ${response} response`;
        return;
      }

      // If cancelled, update UI immediately
      if (response === "cancel") {
        jobSearch.status = "cancelled";
        jobSearch.status_message = "Cancelled by user";
        stopPolling();
        showBrowser = false;
        liveUrl = null;
        await loadRuns();
      }
      // For continue/skip, the scraper will pick it up and status will update via polling
    } catch (err) {
      errorMessage = `Failed to send ${response} response`;
      console.error(err);
    } finally {
      isSendingFeedback = false;
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
    stopBrowserUseLogPolling();
    // Clean up all log and item polling intervals
    Object.values(logPollIntervals).forEach((interval) => clearInterval(interval));
    Object.values(itemPollIntervals).forEach((interval) => clearInterval(interval));
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
        <div class="flex-1">
          <p class="font-medium text-[var(--dash-warning)]">{jobSearch.status_message}</p>
          <p class="text-sm text-[var(--dash-text-secondary)]">
            Complete the action in the browser view, then click Continue
          </p>
        </div>
        <div class="flex items-center gap-2">
          <button
            onclick={() => sendFeedback("continue")}
            disabled={isSendingFeedback}
            class="flex items-center gap-2 px-4 py-2 bg-[var(--dash-success)] text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {#if isSendingFeedback}
              <FontAwesomeIcon icon={faSpinner} class="w-4 h-4 animate-spin" />
            {:else}
              <FontAwesomeIcon icon={faCheck} class="w-4 h-4" />
            {/if}
            <span>Continue</span>
          </button>
          <button
            onclick={() => sendFeedback("skip")}
            disabled={isSendingFeedback}
            class="flex items-center gap-2 px-3 py-2 bg-[var(--dash-bg)] text-[var(--dash-text)] border border-[var(--dash-border)] rounded-lg hover:bg-[var(--dash-border)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Skip current action and move to next"
          >
            <FontAwesomeIcon icon={faForward} class="w-4 h-4" />
            <span>Skip</span>
          </button>
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
      {:else if jobSearch.status === "cancelled"}
        <div class="w-10 h-10 rounded-full bg-[var(--dash-error-light)] flex items-center justify-center">
          <FontAwesomeIcon icon={faTimes} class="w-5 h-5 text-[var(--dash-error)]" />
        </div>
        <div>
          <p class="font-medium text-[var(--dash-text)]">Cancelled</p>
          <p class="text-sm text-[var(--dash-text-secondary)]">
            {jobSearch.status_message || "Cancelled by user"}
          </p>
        </div>
      {:else if jobSearch.last_run}
        <!-- Idle but has run before -->
        <div class="w-10 h-10 rounded-full bg-[var(--dash-bg)] flex items-center justify-center border border-[var(--dash-border)]">
          <FontAwesomeIcon icon={faCog} class="w-5 h-5 text-[var(--dash-text-muted)]" />
        </div>
        <div>
          <p class="font-medium text-[var(--dash-text)]">Idle</p>
          <p class="text-sm text-[var(--dash-text-secondary)]">
            Last run: {formatDate(jobSearch.last_run)}
            {#if jobSearch.last_run_jobs_found}
              • {jobSearch.last_run_jobs_found} jobs found
            {/if}
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
        {#if isBlocked}
          <div class="flex items-center justify-between">
            <p class="text-sm text-[var(--dash-text-secondary)]">
              Complete the required action (login, CAPTCHA, or verification) in the browser above, then click Continue.
            </p>
            <div class="flex items-center gap-2 ml-4">
              <button
                onclick={() => sendFeedback("continue")}
                disabled={isSendingFeedback}
                class="flex items-center gap-2 px-4 py-2 bg-[var(--dash-success)] text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                {#if isSendingFeedback}
                  <FontAwesomeIcon icon={faSpinner} class="w-3 h-3 animate-spin" />
                {:else}
                  <FontAwesomeIcon icon={faCheck} class="w-3 h-3" />
                {/if}
                <span>Continue</span>
              </button>
              <button
                onclick={() => sendFeedback("skip")}
                disabled={isSendingFeedback}
                class="flex items-center gap-2 px-3 py-2 bg-[var(--dash-card)] text-[var(--dash-text)] border border-[var(--dash-border)] rounded-lg hover:bg-[var(--dash-border)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                title="Skip current action"
              >
                <FontAwesomeIcon icon={faForward} class="w-3 h-3" />
                <span>Skip</span>
              </button>
            </div>
          </div>
        {:else if isRunning}
          <p class="text-sm text-[var(--dash-text-secondary)]">
            Watch the scrape progress. You may need to intervene if a CAPTCHA or login is required.
          </p>
        {:else}
          <p class="text-sm text-[var(--dash-text-secondary)]">
            Browser session view. Start a scrape to see activity.
          </p>
        {/if}
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
                icon={faChevronRight}
                class="w-3 h-3 text-[var(--dash-text-muted)] transition-transform duration-200 {expandedRunId === run.id ? 'rotate-90' : ''}"
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

            <!-- Expanded details (tabs: Items / Logs) -->
            {#if expandedRunId === run.id}
              <div class="border-t border-[var(--dash-border)] bg-[var(--dash-bg)]">
                <!-- Tab buttons -->
                <div class="flex border-b border-[var(--dash-border)]">
                  <button
                    onclick={() => runTabView[run.id] = "jobs"}
                    class={`px-4 py-2 text-sm font-medium transition-colors ${!runTabView[run.id] || runTabView[run.id] === "jobs" ? "text-[var(--dash-primary)] border-b-2 border-[var(--dash-primary)]" : "text-[var(--dash-text-secondary)] hover:text-[var(--dash-text)]"}`}
                  >
                    Jobs
                    {#if runItems[run.id]?.stats}
                      <span class="ml-1 text-xs text-[var(--dash-text-muted)]">
                        ({runItems[run.id].stats.completed}/{runItems[run.id].stats.total})
                      </span>
                    {/if}
                  </button>
                  <button
                    onclick={() => runTabView[run.id] = "logs"}
                    class={`px-4 py-2 text-sm font-medium transition-colors ${runTabView[run.id] === "logs" ? "text-[var(--dash-primary)] border-b-2 border-[var(--dash-primary)]" : "text-[var(--dash-text-secondary)] hover:text-[var(--dash-text)]"}`}
                  >
                    Logs
                  </button>
                  {#if data.isStaff}
                    <button
                      onclick={() => {
                        runTabView[run.id] = "browser-use";
                        startBrowserUseLogPolling();
                      }}
                      class={`px-4 py-2 text-sm font-medium transition-colors flex items-center gap-1 ${runTabView[run.id] === "browser-use" ? "text-[var(--dash-primary)] border-b-2 border-[var(--dash-primary)]" : "text-[var(--dash-text-secondary)] hover:text-[var(--dash-text)]"}`}
                    >
                      <FontAwesomeIcon icon={faTerminal} class="w-3 h-3" />
                      Browser-Use
                    </button>
                  {/if}
                </div>

                <div class="p-4">
                  <!-- Jobs view -->
                  {#if !runTabView[run.id] || runTabView[run.id] === "jobs"}
                    <div class="flex items-center justify-between mb-2">
                      <span class="text-sm font-medium text-[var(--dash-text)]">Discovered Jobs</span>
                      {#if loadingItems[run.id]}
                        <FontAwesomeIcon icon={faSpinner} class="w-3 h-3 text-[var(--dash-text-muted)] animate-spin" />
                      {/if}
                    </div>

                    <!-- Stats bar -->
                    {#if runItems[run.id]?.stats}
                      {@const stats = runItems[run.id].stats}
                      <div class="flex gap-3 mb-3 text-xs">
                        <span class="text-[var(--dash-text-muted)]">{stats.total} total</span>
                        {#if stats.completed > 0}
                          <span class="text-[var(--dash-success)]">{stats.completed} imported</span>
                        {/if}
                        {#if stats.processing > 0}
                          <span class="text-[var(--dash-primary)]">{stats.processing} processing</span>
                        {/if}
                        {#if stats.pending > 0}
                          <span class="text-[var(--dash-text-muted)]">{stats.pending} pending</span>
                        {/if}
                        {#if stats.skipped > 0}
                          <span class="text-[var(--dash-warning)]">{stats.skipped} skipped</span>
                        {/if}
                        {#if stats.error > 0}
                          <span class="text-[var(--dash-error)]">{stats.error} errors</span>
                        {/if}
                      </div>
                    {/if}

                    <div class="bg-[var(--dash-card)] rounded border border-[var(--dash-border)] max-h-80 overflow-y-auto">
                      {#if !runItems[run.id]?.items || runItems[run.id].items.length === 0}
                        <div class="p-4 text-sm text-[var(--dash-text-muted)] text-center">
                          {#if loadingItems[run.id]}
                            Loading jobs...
                          {:else}
                            No jobs discovered yet
                          {/if}
                        </div>
                      {:else}
                        <div class="divide-y divide-[var(--dash-border)]">
                          {#each runItems[run.id].items as item (item.id)}
                            <div class={`${getItemStatusBg(item.status)}`}>
                              <!-- Item header (clickable for completed items with job details) -->
                              <button
                                type="button"
                                onclick={() => item.jobs && toggleItemExpanded(item.id)}
                                class={`w-full flex items-center gap-3 px-3 py-2 text-left transition-all ${item.jobs ? "cursor-pointer hover:bg-black/5 dark:hover:bg-white/5" : "cursor-default"}`}
                                disabled={!item.jobs}
                              >
                                <!-- Position -->
                                <span class="text-xs text-[var(--dash-text-muted)] w-5 text-right">
                                  {item.position}
                                </span>

                                <!-- Status indicator -->
                                <div class={`w-2 h-2 rounded-full flex-shrink-0 ${item.status === "completed" ? "bg-[var(--dash-success)]" : item.status === "processing" ? "bg-[var(--dash-primary)] animate-pulse" : item.status === "skipped" ? "bg-[var(--dash-warning)]" : item.status === "error" ? "bg-[var(--dash-error)]" : "bg-[var(--dash-text-muted)]"}`}></div>

                                <!-- Job info -->
                                <div class="flex-1 min-w-0">
                                  <div class="flex items-center gap-2">
                                    {#if item.job_id && item.status === "completed"}
                                      <span class="text-sm font-medium text-[var(--dash-primary)] truncate">
                                        {item.jobs?.title || item.title || "Untitled"}
                                      </span>
                                    {:else}
                                      <span class="text-sm font-medium text-[var(--dash-text)] truncate">
                                        {item.title || "Untitled"}
                                      </span>
                                    {/if}
                                    {#if item.was_created === true}
                                      <span class="text-xs px-1.5 py-0.5 rounded bg-[var(--dash-success-light)] text-[var(--dash-success)]">new</span>
                                    {:else if item.was_created === false && item.status === "completed"}
                                      <span class="text-xs px-1.5 py-0.5 rounded bg-[var(--dash-bg)] text-[var(--dash-text-muted)]">updated</span>
                                    {/if}
                                  </div>
                                  <div class="flex items-center gap-2 text-xs text-[var(--dash-text-secondary)]">
                                    {#if item.jobs?.company || item.company}
                                      <span class="flex items-center gap-1">
                                        <FontAwesomeIcon icon={faBuilding} class="w-3 h-3" />
                                        {item.jobs?.company || item.company}
                                      </span>
                                    {/if}
                                    {#if item.jobs?.office_location || item.location}
                                      <span class="flex items-center gap-1">
                                        <FontAwesomeIcon icon={faMapMarkerAlt} class="w-3 h-3" />
                                        {item.jobs?.office_location || item.location}
                                      </span>
                                    {/if}
                                  </div>
                                  {#if item.status_message && (item.status === "skipped" || item.status === "error")}
                                    <div class={`text-xs mt-0.5 ${getItemStatusColor(item.status)}`}>
                                      {item.status_message}
                                    </div>
                                  {/if}
                                </div>

                                <!-- Status badge and expand icon -->
                                <span class={`text-xs capitalize ${getItemStatusColor(item.status)}`}>
                                  {item.status}
                                </span>
                                {#if item.jobs}
                                  <FontAwesomeIcon
                                    icon={expandedItemId === item.id ? faChevronUp : faChevronDown}
                                    class="w-3 h-3 text-[var(--dash-text-muted)]"
                                  />
                                {/if}
                              </button>

                              <!-- Expanded job details -->
                              {#if expandedItemId === item.id && item.jobs}
                                {@const job = item.jobs}
                                <div class="border-t border-[var(--dash-border)] p-4 space-y-4 {getItemStatusBg(item.status)}">
                                  <!-- Job Info Grid -->
                                  <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {#if job.salary_min || job.salary_max}
                                      <div>
                                        <p class="text-xs text-[var(--dash-text-secondary)] uppercase tracking-wide mb-1">
                                          Salary
                                        </p>
                                        <p class="font-medium text-[var(--dash-text)] flex items-center gap-1">
                                          <FontAwesomeIcon icon={faMoneyBillWave} class="w-4 h-4 text-[var(--dash-success)]" />
                                          {formatSalary(job.salary_min, job.salary_max, job.salary_currency, job.salary_period)}
                                        </p>
                                      </div>
                                    {/if}
                                    {#if job.job_types && Array.isArray(job.job_types) && job.job_types.length > 0}
                                      <div>
                                        <p class="text-xs text-[var(--dash-text-secondary)] uppercase tracking-wide mb-1">
                                          Job Type
                                        </p>
                                        <p class="font-medium text-[var(--dash-text)]">
                                          {job.job_types.join(", ")}
                                        </p>
                                      </div>
                                    {/if}
                                    {#if job.work_location && Array.isArray(job.work_location) && job.work_location.length > 0}
                                      <div>
                                        <p class="text-xs text-[var(--dash-text-secondary)] uppercase tracking-wide mb-1">
                                          Work Location
                                        </p>
                                        <p class="font-medium text-[var(--dash-text)]">
                                          {job.work_location.join(", ")}
                                        </p>
                                      </div>
                                    {/if}
                                  </div>

                                  <!-- Skills -->
                                  {#if job.skills_required && Array.isArray(job.skills_required) && job.skills_required.length > 0}
                                    <div>
                                      <p class="text-xs text-[var(--dash-text-secondary)] uppercase tracking-wide mb-2">
                                        Required Skills
                                      </p>
                                      <div class="flex flex-wrap gap-1">
                                        {#each job.skills_required.slice(0, 10) as skill}
                                          <span class="px-2 py-1 text-xs bg-[var(--dash-bg)] text-[var(--dash-text)] rounded">
                                            {skill}
                                          </span>
                                        {/each}
                                        {#if job.skills_required.length > 10}
                                          <span class="px-2 py-1 text-xs text-[var(--dash-text-muted)]">
                                            +{job.skills_required.length - 10} more
                                          </span>
                                        {/if}
                                      </div>
                                    </div>
                                  {/if}

                                  {#if job.skills_preferred && Array.isArray(job.skills_preferred) && job.skills_preferred.length > 0}
                                    <div>
                                      <p class="text-xs text-[var(--dash-text-secondary)] uppercase tracking-wide mb-2">
                                        Preferred Skills
                                      </p>
                                      <div class="flex flex-wrap gap-1">
                                        {#each job.skills_preferred.slice(0, 10) as skill}
                                          <span class="px-2 py-1 text-xs bg-[var(--dash-primary-light)] text-[var(--dash-primary)] rounded">
                                            {skill}
                                          </span>
                                        {/each}
                                        {#if job.skills_preferred.length > 10}
                                          <span class="px-2 py-1 text-xs text-[var(--dash-text-muted)]">
                                            +{job.skills_preferred.length - 10} more
                                          </span>
                                        {/if}
                                      </div>
                                    </div>
                                  {/if}

                                  <!-- Description Preview -->
                                  {#if job.job_description}
                                    <div>
                                      <p class="text-xs text-[var(--dash-text-secondary)] uppercase tracking-wide mb-1">
                                        Description
                                      </p>
                                      <p class="text-sm text-[var(--dash-text)] whitespace-pre-wrap">
                                        {truncateText(job.job_description, 500)}
                                      </p>
                                      {#if job.job_description.length > 500}
                                        <a
                                          href="/dashboard/jobs/{job.id}"
                                          class="text-sm text-[var(--dash-primary)] hover:underline mt-2 inline-block"
                                        >
                                          View full description →
                                        </a>
                                      {/if}
                                    </div>
                                  {/if}

                                  <!-- Footer with links -->
                                  <div class="pt-2 border-t border-[var(--dash-border)] flex items-center gap-4 text-xs text-[var(--dash-text-muted)]">
                                    <span>ID: {job.id}</span>
                                    <a
                                      href="/dashboard/jobs/{job.id}"
                                      class="text-[var(--dash-primary)] hover:underline flex items-center gap-1"
                                    >
                                      <FontAwesomeIcon icon={faEye} class="w-3 h-3" />
                                      View details
                                    </a>
                                    {#if job.source_url}
                                      <a
                                        href={job.source_url}
                                        target="_blank"
                                        rel="noopener"
                                        class="hover:text-[var(--dash-primary)] flex items-center gap-1"
                                      >
                                        <FontAwesomeIcon icon={faExternalLinkAlt} class="w-3 h-3" />
                                        Source
                                      </a>
                                    {/if}
                                  </div>
                                </div>
                              {/if}
                            </div>
                          {/each}
                        </div>
                      {/if}
                    </div>
                  {:else if runTabView[run.id] === "logs"}
                    <!-- Logs view -->
                    <div class="flex items-center justify-between mb-2">
                      <div class="flex items-center gap-2">
                        <span class="text-sm font-medium text-[var(--dash-text)]">Logs</span>
                        <select
                          bind:value={logLevelFilter}
                          onchange={() => {
                            // Clear and reload logs with new filter
                            runLogs[run.id] = [];
                            loadRunLogs(run.id);
                          }}
                          class="text-xs px-2 py-1 rounded border border-[var(--dash-border)] bg-[var(--dash-card)] text-[var(--dash-text)]"
                        >
                          <option value="debug">Debug</option>
                          <option value="info">Info</option>
                          <option value="warn">Warn</option>
                          <option value="error">Error</option>
                        </select>
                      </div>
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
                  {:else if runTabView[run.id] === "browser-use"}
                    <!-- Browser-Use Logs view (Staff only) -->
                    <div class="flex items-center justify-between mb-2">
                      <div class="flex items-center gap-2">
                        <span class="text-sm font-medium text-[var(--dash-text)]">Browser-Use Logs</span>
                        <select
                          bind:value={browserUseLogLevelFilter}
                          onchange={() => {
                            browserUseLogs = [];
                            loadBrowserUseLogs();
                          }}
                          class="text-xs px-2 py-1 rounded border border-[var(--dash-border)] bg-[var(--dash-card)] text-[var(--dash-text)]"
                        >
                          <option value="debug">Debug</option>
                          <option value="info">Info</option>
                          <option value="warn">Warn</option>
                          <option value="error">Error</option>
                        </select>
                      </div>
                      <div class="flex items-center gap-2">
                        {#if loadingBrowserUseLogs}
                          <FontAwesomeIcon icon={faSpinner} class="w-3 h-3 text-[var(--dash-text-muted)] animate-spin" />
                        {/if}
                        <button
                          onclick={() => {
                            browserUseLogs = [];
                            loadBrowserUseLogs();
                          }}
                          class="text-xs px-2 py-1 rounded border border-[var(--dash-border)] bg-[var(--dash-card)] text-[var(--dash-text-secondary)] hover:text-[var(--dash-text)] hover:bg-[var(--dash-bg)]"
                        >
                          Clear
                        </button>
                        <button
                          onclick={restartBrowserUse}
                          disabled={isRestartingBrowserUse}
                          class="text-xs px-2 py-1 rounded border border-[var(--dash-warning)] bg-[var(--dash-warning-light)] text-[var(--dash-warning)] hover:bg-[var(--dash-warning)] hover:text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                          title="Restart browser-use service (clears zombie processes)"
                        >
                          {#if isRestartingBrowserUse}
                            <FontAwesomeIcon icon={faSpinner} class="w-3 h-3 animate-spin" />
                          {:else}
                            <FontAwesomeIcon icon={faSync} class="w-3 h-3" />
                          {/if}
                          Restart
                        </button>
                      </div>
                    </div>

                    <div class="bg-[var(--dash-card)] rounded border border-[var(--dash-border)] max-h-64 overflow-y-auto">
                      {#if browserUseLogs.length === 0}
                        <div class="p-4 text-sm text-[var(--dash-text-muted)] text-center">
                          {#if loadingBrowserUseLogs}
                            Loading browser-use logs...
                          {:else}
                            No logs available. Logs appear when the scraper uses browser automation.
                          {/if}
                        </div>
                      {:else}
                        <div class="p-2 space-y-0.5 font-mono text-xs">
                          {#each browserUseLogs as log}
                            <div class="flex gap-2 py-0.5 px-1 hover:bg-[var(--dash-bg)] rounded">
                              <span class="text-[var(--dash-text-muted)] whitespace-nowrap">
                                {new Date(log.timestamp).toLocaleTimeString()}
                              </span>
                              <span class={`uppercase w-12 flex-shrink-0 ${getLogLevelColor(log.level)}`}>
                                {log.level}
                              </span>
                              <span class="text-[var(--dash-primary)] flex-shrink-0 max-w-20 truncate" title={log.logger}>
                                {log.logger.split('.').pop()}
                              </span>
                              <span class="text-[var(--dash-text)] break-all">
                                {log.message}
                              </span>
                            </div>
                          {/each}
                        </div>
                      {/if}
                    </div>
                    <!-- Health Status Panel -->
                    {#if browserUseHealth}
                      <div class="mt-3 p-3 rounded border {browserUseHealth.service_healthy ? 'border-[var(--dash-success)] bg-[var(--dash-success-light)]' : 'border-[var(--dash-error)] bg-[var(--dash-error-light)]'}">
                        <div class="flex items-center justify-between mb-2">
                          <span class="text-sm font-medium {browserUseHealth.service_healthy ? 'text-[var(--dash-success)]' : 'text-[var(--dash-error)]'}">
                            {browserUseHealth.service_healthy ? '✓ Service Healthy' : '✗ Service Unhealthy'}
                          </span>
                          {#if loadingHealth}
                            <FontAwesomeIcon icon={faSpinner} class="w-3 h-3 text-[var(--dash-text-muted)] animate-spin" />
                          {/if}
                        </div>
                        <div class="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                          <div>
                            <span class="text-[var(--dash-text-muted)]">Chrome:</span>
                            <span class={browserUseHealth.chrome_running ? 'text-[var(--dash-success)]' : 'text-[var(--dash-text-secondary)]'}>
                              {browserUseHealth.chrome_running ? `Running (PID ${browserUseHealth.chrome_pid})` : 'Not running'}
                            </span>
                          </div>
                          <div>
                            <span class="text-[var(--dash-text-muted)]">CDP:</span>
                            <span class={browserUseHealth.cdp_responsive ? 'text-[var(--dash-success)]' : browserUseHealth.chrome_running ? 'text-[var(--dash-error)]' : 'text-[var(--dash-text-secondary)]'}>
                              {browserUseHealth.cdp_responsive ? 'Responsive' : browserUseHealth.chrome_running ? 'NOT RESPONDING' : 'N/A'}
                            </span>
                          </div>
                          <div>
                            <span class="text-[var(--dash-text-muted)]">Pages:</span>
                            <span class="text-[var(--dash-text)]">{browserUseHealth.page_count}</span>
                          </div>
                          <div>
                            <span class="text-[var(--dash-text-muted)]">Memory:</span>
                            <span class="text-[var(--dash-text)]">{browserUseHealth.memory_mb ? `${browserUseHealth.memory_mb} MB` : 'N/A'}</span>
                          </div>
                        </div>
                        {#if browserUseHealth.current_url}
                          <div class="mt-2 text-xs">
                            <span class="text-[var(--dash-text-muted)]">URL:</span>
                            <span class="text-[var(--dash-text)] break-all">{browserUseHealth.current_url}</span>
                          </div>
                        {/if}
                        {#if browserUseHealth.error}
                          <div class="mt-2 text-xs text-[var(--dash-error)]">
                            <strong>Error:</strong> {browserUseHealth.error}
                          </div>
                        {/if}
                        <!-- CDP Debug toggle -->
                        <div class="mt-2 pt-2 border-t border-[var(--dash-border)]">
                          <button
                            onclick={() => {
                              showCDPDebug = !showCDPDebug;
                              if (showCDPDebug) loadCDPDebug();
                            }}
                            class="text-xs text-[var(--dash-primary)] hover:underline"
                          >
                            {showCDPDebug ? 'Hide' : 'Show'} CDP Debug Info
                          </button>
                        </div>
                      </div>
                    {/if}

                    <!-- CDP Debug Panel -->
                    {#if showCDPDebug}
                      <div class="mt-3 p-3 rounded border border-[var(--dash-border)] bg-[var(--dash-bg)]">
                        <div class="flex items-center justify-between mb-2">
                          <span class="text-sm font-medium text-[var(--dash-text)]">CDP Debug Info</span>
                          <button
                            onclick={loadCDPDebug}
                            disabled={loadingCDPDebug}
                            class="text-xs px-2 py-1 rounded border border-[var(--dash-border)] bg-[var(--dash-card)] text-[var(--dash-text-secondary)] hover:text-[var(--dash-text)] disabled:opacity-50"
                          >
                            {#if loadingCDPDebug}
                              <FontAwesomeIcon icon={faSpinner} class="w-3 h-3 animate-spin" />
                            {:else}
                              Refresh
                            {/if}
                          </button>
                        </div>

                        {#if cdpDebugInfo}
                          <div class="space-y-3 text-xs font-mono">
                            <!-- Connection Tests -->
                            <div>
                              <div class="font-semibold text-[var(--dash-text)] mb-1">Connection Tests</div>
                              <div class="grid grid-cols-3 gap-2">
                                <div class="p-2 rounded {cdpDebugInfo.cdp_version_check.success ? 'bg-[var(--dash-success-light)]' : 'bg-[var(--dash-error-light)]'}">
                                  <div class="font-medium">Version Check</div>
                                  <div class={cdpDebugInfo.cdp_version_check.success ? 'text-[var(--dash-success)]' : 'text-[var(--dash-error)]'}>
                                    {cdpDebugInfo.cdp_version_check.success ? `OK (${cdpDebugInfo.cdp_version_check.time_ms}ms)` : cdpDebugInfo.cdp_version_check.error}
                                  </div>
                                </div>
                                <div class="p-2 rounded {cdpDebugInfo.cdp_pages_check.success ? 'bg-[var(--dash-success-light)]' : 'bg-[var(--dash-error-light)]'}">
                                  <div class="font-medium">Pages Check</div>
                                  <div class={cdpDebugInfo.cdp_pages_check.success ? 'text-[var(--dash-success)]' : 'text-[var(--dash-error)]'}>
                                    {cdpDebugInfo.cdp_pages_check.success ? `${cdpDebugInfo.cdp_pages_check.data?.count || 0} pages (${cdpDebugInfo.cdp_pages_check.time_ms}ms)` : cdpDebugInfo.cdp_pages_check.error}
                                  </div>
                                </div>
                                <div class="p-2 rounded {cdpDebugInfo.websocket_test.success ? 'bg-[var(--dash-success-light)]' : 'bg-[var(--dash-error-light)]'}">
                                  <div class="font-medium">WebSocket Test</div>
                                  <div class={cdpDebugInfo.websocket_test.success ? 'text-[var(--dash-success)]' : 'text-[var(--dash-error)]'}>
                                    {cdpDebugInfo.websocket_test.success ? `OK (${cdpDebugInfo.websocket_test.time_ms}ms)` : cdpDebugInfo.websocket_test.error}
                                  </div>
                                </div>
                              </div>
                            </div>

                            <!-- Ports -->
                            <div>
                              <div class="font-semibold text-[var(--dash-text)] mb-1">Port Status</div>
                              <div class="flex gap-4">
                                <span>9222 (external): <span class={cdpDebugInfo.port_listening["9222"] ? 'text-[var(--dash-success)]' : 'text-[var(--dash-error)]'}>{cdpDebugInfo.port_listening["9222"] ? 'Listening' : 'Not listening'}</span></span>
                                <span>9223 (internal): <span class={cdpDebugInfo.port_listening["9223"] ? 'text-[var(--dash-success)]' : 'text-[var(--dash-error)]'}>{cdpDebugInfo.port_listening["9223"] ? 'Listening' : 'Not listening'}</span></span>
                              </div>
                            </div>

                            <!-- Chrome Processes -->
                            {#if cdpDebugInfo.chrome_processes.length > 0}
                              <div>
                                <div class="font-semibold text-[var(--dash-text)] mb-1">Chrome Processes ({cdpDebugInfo.chrome_processes.length})</div>
                                <div class="max-h-32 overflow-y-auto bg-[var(--dash-card)] rounded p-2">
                                  {#each cdpDebugInfo.chrome_processes as proc}
                                    <div class="text-[var(--dash-text-secondary)]">
                                      PID {proc.pid} | CPU {proc.cpu}% | MEM {proc.mem}% | RSS {proc.rss}KB | {proc.stat}
                                    </div>
                                  {/each}
                                </div>
                              </div>
                            {/if}

                            <!-- Socat Processes -->
                            {#if cdpDebugInfo.socat_processes.length > 0}
                              <div>
                                <div class="font-semibold text-[var(--dash-text)] mb-1">Socat Processes ({cdpDebugInfo.socat_processes.length})</div>
                                <div class="text-[var(--dash-text-secondary)]">
                                  {#each cdpDebugInfo.socat_processes as proc}
                                    <div>PID {proc.pid}: {proc.cmd}</div>
                                  {/each}
                                </div>
                              </div>
                            {/if}

                            <div class="text-[var(--dash-text-muted)]">
                              Last updated: {new Date(cdpDebugInfo.timestamp).toLocaleTimeString()}
                            </div>
                          </div>
                        {:else if loadingCDPDebug}
                          <div class="text-center text-[var(--dash-text-muted)]">Loading...</div>
                        {:else}
                          <div class="text-center text-[var(--dash-text-muted)]">Click refresh to load debug info</div>
                        {/if}
                      </div>
                    {/if}

                    <p class="mt-2 text-xs text-[var(--dash-text-muted)]">
                      Live logs from browser automation service. Auto-refreshes every 2s.
                    </p>
                  {/if}
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
