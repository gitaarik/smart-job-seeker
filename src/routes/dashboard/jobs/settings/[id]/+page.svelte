<script lang="ts">
  import type { PageData } from "./$types";
  import { onMount, onDestroy } from "svelte";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faArrowLeft,
    faCheck,
    faCog,
    faExclamationTriangle,
    faExternalLinkAlt,
    faEye,
    faPlay,
    faSpinner,
    faTimes,
  } from "@fortawesome/free-solid-svg-icons";

  let { data }: { data: PageData } = $props();

  let jobSearch = $state(data.jobSearch);
  let isStarting = $state(false);
  let errorMessage = $state<string | null>(null);
  let showVnc = $state(false);
  let pollInterval: ReturnType<typeof setInterval> | null = null;

  // Computed states
  let isRunning = $derived(jobSearch.last_run_status === "running");
  let isBlocked = $derived(jobSearch.last_run_status === "blocked");
  let needsIntervention = $derived(isRunning || isBlocked);

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

      if (result.status === "queued") {
        errorMessage = result.message;
        return;
      }

      if (result.status === "already_running") {
        errorMessage = "This search is already running";
        return;
      }

      // Started successfully - update local state and show VNC
      jobSearch.last_run_status = "running";
      jobSearch.last_run_error = null;
      showVnc = true;

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

        jobSearch.last_run_status = result.status;
        jobSearch.last_run_error = result.error;
        jobSearch.last_run = result.lastRun;
        jobSearch.last_run_jobs_found = result.jobsFound;

        // Stop polling when scrape is complete
        if (result.status !== "running" && result.status !== "blocked") {
          stopPolling();
        }
      } catch (err) {
        console.error("Failed to poll status:", err);
      }
    }, 3000); // Poll every 3 seconds
  }

  function stopPolling() {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
  }

  onMount(() => {
    // Start polling if already running/blocked
    if (needsIntervention) {
      showVnc = true;
      startPolling();
    }
  });

  onDestroy(() => {
    stopPolling();
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

      {#if !isRunning && !isBlocked}
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
      {#if jobSearch.last_run_status === "running"}
        <div class="w-10 h-10 rounded-full bg-[var(--dash-primary-light)] flex items-center justify-center">
          <FontAwesomeIcon icon={faSpinner} class="w-5 h-5 text-[var(--dash-primary)] animate-spin" />
        </div>
        <div>
          <p class="font-medium text-[var(--dash-text)]">Running...</p>
          <p class="text-sm text-[var(--dash-text-secondary)]">
            Scraping jobs from {jobSearch.job_platforms?.name || "platform"}
          </p>
        </div>
      {:else if jobSearch.last_run_status === "blocked"}
        <div class="w-10 h-10 rounded-full bg-[var(--dash-warning-light)] flex items-center justify-center">
          <FontAwesomeIcon icon={faExclamationTriangle} class="w-5 h-5 text-[var(--dash-warning)]" />
        </div>
        <div>
          <p class="font-medium text-[var(--dash-warning)]">{jobSearch.last_run_error}</p>
          <p class="text-sm text-[var(--dash-text-secondary)]">
            Manual action needed - use the browser view below
          </p>
        </div>
      {:else if jobSearch.last_run_status === "success"}
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
      {:else if jobSearch.last_run_status === "partial"}
        <div class="w-10 h-10 rounded-full bg-[var(--dash-warning-light)] flex items-center justify-center">
          <FontAwesomeIcon icon={faExclamationTriangle} class="w-5 h-5 text-[var(--dash-warning)]" />
        </div>
        <div>
          <p class="font-medium text-[var(--dash-text)]">Completed with issues</p>
          <p class="text-sm text-[var(--dash-text-secondary)]">
            {formatDate(jobSearch.last_run)} • {jobSearch.last_run_error}
          </p>
        </div>
      {:else if jobSearch.last_run_status === "error"}
        <div class="w-10 h-10 rounded-full bg-[var(--dash-error-light)] flex items-center justify-center">
          <FontAwesomeIcon icon={faTimes} class="w-5 h-5 text-[var(--dash-error)]" />
        </div>
        <div>
          <p class="font-medium text-[var(--dash-error)]">Failed</p>
          <p class="text-sm text-[var(--dash-text-secondary)]">
            {jobSearch.last_run_error}
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

  <!-- VNC Browser View -->
  {#if showVnc || needsIntervention}
    <div class="bg-[var(--dash-card)] rounded-lg border border-[var(--dash-border)] overflow-hidden">
      <div class="flex items-center justify-between p-4 border-b border-[var(--dash-border)]">
        <div class="flex items-center gap-2">
          <FontAwesomeIcon icon={faEye} class="w-4 h-4 text-[var(--dash-text-secondary)]" />
          <h2 class="font-medium text-[var(--dash-text)]">Browser View</h2>
        </div>
        {#if isBlocked}
          <span class="text-sm text-[var(--dash-warning)] bg-[var(--dash-warning-light)] px-2 py-1 rounded">
            Action needed
          </span>
        {/if}
        <button
          onclick={() => showVnc = false}
          class="p-1 text-[var(--dash-text-secondary)] hover:text-[var(--dash-text)] transition-colors"
        >
          <FontAwesomeIcon icon={faTimes} class="w-4 h-4" />
        </button>
      </div>
      <div class="relative" style="padding-bottom: 56.25%;">
        <iframe
          src="/vnc/vnc.html?autoconnect=true&resize=scale"
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
      onclick={() => showVnc = true}
      class="w-full p-4 border-2 border-dashed border-[var(--dash-border)] rounded-lg text-[var(--dash-text-secondary)] hover:text-[var(--dash-text)] hover:border-[var(--dash-text-secondary)] transition-colors flex items-center justify-center gap-2"
    >
      <FontAwesomeIcon icon={faEye} class="w-4 h-4" />
      <span>Show Browser View</span>
    </button>
  {/if}

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
