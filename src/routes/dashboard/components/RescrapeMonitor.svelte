<script lang="ts">
  import { onMount } from "svelte";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faCheck,
    faSpinner,
    faTimes,
    faTimesCircle,
    faCheckCircle,
  } from "@fortawesome/free-solid-svg-icons";
  import BrowserView from "./BrowserView.svelte";
  import LogViewer from "./LogViewer.svelte";

  interface Props {
    jobId: number;
    onclose: () => void;
    oncomplete?: () => void;
  }

  let { jobId, onclose, oncomplete }: Props = $props();

  interface LogEntry {
    id: number | string;
    level: string;
    message: string;
    timestamp: string;
  }

  let status = $state<string>("queued");
  let message = $state<string>("Waiting in queue...");
  let liveUrl = $state<string | null>(null);
  let logs = $state<LogEntry[]>([]);
  let pollInterval: ReturnType<typeof setInterval> | null = null;
  let lastMessage = "";
  let logIdCounter = 0;
  let isActive = $derived(status === "queued" || status === "scraping");
  let isComplete = $derived(status === "completed");
  let isError = $derived(status === "error");

  function addLogEntry(msg: string) {
    if (msg === lastMessage || !msg) return;
    lastMessage = msg;
    logs = [
      ...logs,
      {
        id: ++logIdCounter,
        level: "info",
        message: msg,
        timestamp: new Date().toISOString(),
      },
    ];
  }

  async function triggerRescrape() {
    try {
      const response = await fetch(`/api/jobs/${jobId}/rescrape`, {
        method: "POST",
      });
      const result = await response.json();

      if (!response.ok) {
        status = "error";
        message = result.error || "Failed to start rescrape";
        addLogEntry(`Error: ${message}`);
        return;
      }

      if (result.status === "already_queued") {
        addLogEntry("Already queued for rescrape");
      } else {
        addLogEntry("Queued for rescrape");
      }

      startPolling();
    } catch (err) {
      status = "error";
      message = err instanceof Error ? err.message : "Failed to start rescrape";
      addLogEntry(`Error: ${message}`);
    }
  }

  function startPolling() {
    if (pollInterval) return;
    pollInterval = setInterval(pollStatus, 1500);
  }

  function stopPolling() {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
  }

  async function pollStatus() {
    try {
      const response = await fetch(`/api/jobs/${jobId}/rescrape`);
      if (!response.ok) return;

      const result = await response.json();
      status = result.status;
      message = result.message || "";
      liveUrl = result.liveUrl || null;

      // Add progress messages as log entries
      if (result.message && !result.message.startsWith("✓") && !result.message.includes("Extracted data:")) {
        addLogEntry(result.message);
      }

      if (!["queued", "scraping"].includes(result.status)) {
        stopPolling();

        if (result.status === "completed") {
          addLogEntry("Rescrape completed successfully");
          if (oncomplete) {
            setTimeout(oncomplete, 1500);
          }
        } else if (result.status === "error") {
          logs = [
            ...logs,
            {
              id: ++logIdCounter,
              level: "error",
              message: result.message || "Rescrape failed",
              timestamp: new Date().toISOString(),
            },
          ];
        }
      }
    } catch {
      // Ignore polling errors
    }
  }

  onMount(() => {
    triggerRescrape();
    return () => stopPolling();
  });
</script>

<!-- Modal backdrop -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
  onkeydown={(e) => { if (e.key === "Escape") onclose(); }}
>
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div
    class="bg-[var(--dash-bg)] rounded-xl border border-[var(--dash-border)] shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto"
    onclick={(e) => e.stopPropagation()}
  >
    <!-- Header -->
    <div class="flex items-center justify-between p-4 border-b border-[var(--dash-border)]">
      <div class="flex items-center gap-3">
        <h2 class="text-lg font-semibold text-[var(--dash-text)]">Rescrape Job #{jobId}</h2>
        {#if isActive}
          <FontAwesomeIcon icon={faSpinner} class="w-4 h-4 text-[var(--dash-primary)] animate-spin" />
        {:else if isComplete}
          <FontAwesomeIcon icon={faCheckCircle} class="w-4 h-4 text-[var(--dash-success)]" />
        {:else if isError}
          <FontAwesomeIcon icon={faTimesCircle} class="w-4 h-4 text-[var(--dash-error)]" />
        {/if}
      </div>
      <button
        onclick={onclose}
        class="p-1 text-[var(--dash-text-secondary)] hover:text-[var(--dash-text)] transition-colors"
      >
        <FontAwesomeIcon icon={faTimes} class="w-5 h-5" />
      </button>
    </div>

    <!-- Content -->
    <div class="p-4 space-y-4">
      <!-- Status -->
      <div class="flex items-center gap-2 text-sm">
        {#if isActive}
          <span class="text-[var(--dash-primary)]">
            {status === "queued" ? "Waiting in queue..." : message || "Processing..."}
          </span>
        {:else if isComplete}
          <span class="text-[var(--dash-success)]">Completed</span>
        {:else if isError}
          <span class="text-[var(--dash-error)]">{message || "Failed"}</span>
        {/if}
      </div>

      <!-- Browser View -->
      {#if isActive || liveUrl}
        <BrowserView
          {liveUrl}
          statusMessage={isActive ? "Watch the rescrape progress. You may need to intervene if a CAPTCHA or login is required." : ""}
        />
      {/if}

      <!-- Logs -->
      <LogViewer {logs} loading={isActive} maxHeight="max-h-48" />

      <!-- Completed extraction summary -->
      {#if isComplete && message && message.includes("Extracted data:")}
        <div class="p-3 bg-[var(--dash-success-light)] border border-[var(--dash-success)] rounded-lg">
          <p class="text-sm text-[var(--dash-success)] whitespace-pre-line">{message}</p>
        </div>
      {/if}
    </div>

    <!-- Footer -->
    <div class="flex justify-end p-4 border-t border-[var(--dash-border)]">
      <button
        onclick={onclose}
        class="px-4 py-2 rounded-lg text-sm {isActive
          ? 'border border-[var(--dash-border)] text-[var(--dash-text)] hover:bg-[var(--dash-bg)]'
          : 'bg-[var(--dash-primary)] text-white hover:bg-[var(--dash-primary-hover)]'} transition-colors"
      >
        {#if isActive}
          Close
        {:else if isComplete}
          <span class="flex items-center gap-2">
            <FontAwesomeIcon icon={faCheck} class="w-3 h-3" />
            Done
          </span>
        {:else}
          Close
        {/if}
      </button>
    </div>
  </div>
</div>
