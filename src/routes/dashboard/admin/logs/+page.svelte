<script lang="ts">
  import type { PageData } from "./$types";
  import { onMount, onDestroy } from "svelte";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faTerminal,
    faFilter,
    faTrash,
    faPause,
    faPlay,
    faDownload,
    faCopy,
    faCheck,
  } from "@fortawesome/free-solid-svg-icons";

  let { data }: { data: PageData } = $props();

  interface LogEntry {
    id: number;
    level: string;
    message: string;
    timestamp: string;
    jobSearchId: number | null;
    jobSearchName: string | null;
  }

  let logs = $state<LogEntry[]>(data.initialLogs);
  let selectedJobSearch = $state<string>("");
  let isPaused = $state(false);
  let autoScroll = $state(true);
  let copied = $state(false);
  let eventSource: EventSource | null = null;
  let logContainer: HTMLDivElement | null = null;

  function formatTime(timestamp: string): string {
    const d = new Date(timestamp);
    return d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  }

  function getLevelColor(level: string): string {
    switch (level) {
      case "error":
        return "text-red-400";
      case "warn":
        return "text-yellow-400";
      case "info":
        return "text-blue-400";
      case "debug":
        return "text-gray-500";
      default:
        return "text-[var(--dash-text)]";
    }
  }

  function getLevelBg(level: string): string {
    switch (level) {
      case "error":
        return "bg-red-500/10";
      case "warn":
        return "bg-yellow-500/10";
      default:
        return "";
    }
  }

  function connectSSE() {
    if (eventSource) {
      eventSource.close();
    }

    const params = new URLSearchParams();
    if (selectedJobSearch) {
      params.set("jobSearchId", selectedJobSearch);
    }

    const url = `/api/admin/logs/stream${params.toString() ? "?" + params.toString() : ""}`;
    eventSource = new EventSource(url);

    eventSource.onmessage = (event) => {
      if (isPaused) return;

      const data = JSON.parse(event.data);

      if (data.type === "log") {
        logs = [...logs, data];

        // Keep only last 1000 logs in UI
        if (logs.length > 1000) {
          logs = logs.slice(-1000);
        }

        // Auto-scroll to bottom
        if (autoScroll && logContainer) {
          requestAnimationFrame(() => {
            if (logContainer) {
              logContainer.scrollTop = logContainer.scrollHeight;
            }
          });
        }
      }
    };

    eventSource.onerror = () => {
      // Reconnect after 5 seconds
      setTimeout(connectSSE, 5000);
    };
  }

  async function clearLogs() {
    if (!confirm("Are you sure you want to clear all logs?")) return;

    const params = new URLSearchParams();
    if (selectedJobSearch) {
      params.set("jobSearchId", selectedJobSearch);
    }

    await fetch(`/api/admin/logs?${params.toString()}`, {
      method: "DELETE",
    });

    logs = [];
  }

  function formatLogsAsText(): string {
    return logs
      .map((log) => {
        const prefix = log.jobSearchName ? `[${log.jobSearchName}]` : "";
        return `${log.timestamp} [${log.level.toUpperCase()}] ${prefix} ${log.message}`;
      })
      .join("\n");
  }

  function downloadLogs() {
    const content = formatLogsAsText();
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `scraper-logs-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copyLogs() {
    const content = formatLogsAsText();
    await navigator.clipboard.writeText(content);
    copied = true;
    setTimeout(() => {
      copied = false;
    }, 2000);
  }

  function handleScroll() {
    if (!logContainer) return;
    const { scrollTop, scrollHeight, clientHeight } = logContainer;
    // Disable auto-scroll if user scrolls up
    autoScroll = scrollHeight - scrollTop - clientHeight < 50;
  }

  $effect(() => {
    // Reconnect when filter changes
    connectSSE();
  });

  onMount(() => {
    connectSSE();

    // Scroll to bottom initially
    if (logContainer) {
      logContainer.scrollTop = logContainer.scrollHeight;
    }
  });

  onDestroy(() => {
    if (eventSource) {
      eventSource.close();
    }
  });
</script>

<div class="h-full flex flex-col">
  <!-- Header -->
  <div class="flex items-center justify-between p-4 border-b border-[var(--dash-border)]">
    <div class="flex items-center gap-3">
      <FontAwesomeIcon icon={faTerminal} class="w-5 h-5 text-[var(--dash-text-secondary)]" />
      <h1 class="text-xl font-semibold text-[var(--dash-text)]">Scraper Logs</h1>
      <span class="text-sm text-[var(--dash-text-muted)]">
        {logs.length} entries
      </span>
    </div>

    <div class="flex items-center gap-3">
      <!-- Filter dropdown -->
      <div class="flex items-center gap-2">
        <FontAwesomeIcon icon={faFilter} class="w-4 h-4 text-[var(--dash-text-secondary)]" />
        <select
          bind:value={selectedJobSearch}
          class="bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded px-3 py-1.5 text-sm text-[var(--dash-text)]"
        >
          <option value="">All job searches</option>
          {#each data.jobSearches as search}
            <option value={String(search.id)}>
              {search.name}
              {#if search.status === "running"}
                (running)
              {/if}
            </option>
          {/each}
        </select>
      </div>

      <!-- Pause/Resume -->
      <button
        onclick={() => isPaused = !isPaused}
        class="flex items-center gap-2 px-3 py-1.5 rounded text-sm {isPaused
          ? 'bg-green-500/20 text-green-400'
          : 'bg-[var(--dash-bg)] text-[var(--dash-text-secondary)]'} hover:bg-[var(--dash-bg)] transition-colors"
        title={isPaused ? "Resume" : "Pause"}
      >
        <FontAwesomeIcon icon={isPaused ? faPlay : faPause} class="w-3 h-3" />
        {isPaused ? "Resume" : "Pause"}
      </button>

      <!-- Copy -->
      <button
        onclick={copyLogs}
        class="flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors {copied
          ? 'bg-green-500/20 text-green-400'
          : 'bg-[var(--dash-bg)] text-[var(--dash-text-secondary)] hover:text-[var(--dash-text)]'}"
        title="Copy logs to clipboard"
      >
        <FontAwesomeIcon icon={copied ? faCheck : faCopy} class="w-3 h-3" />
        {copied ? "Copied!" : "Copy"}
      </button>

      <!-- Download -->
      <button
        onclick={downloadLogs}
        class="flex items-center gap-2 px-3 py-1.5 bg-[var(--dash-bg)] rounded text-sm text-[var(--dash-text-secondary)] hover:text-[var(--dash-text)] transition-colors"
        title="Download logs"
      >
        <FontAwesomeIcon icon={faDownload} class="w-3 h-3" />
        Download
      </button>

      <!-- Clear -->
      <button
        onclick={clearLogs}
        class="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 rounded text-sm text-red-400 hover:bg-red-500/20 transition-colors"
        title="Clear logs"
      >
        <FontAwesomeIcon icon={faTrash} class="w-3 h-3" />
        Clear
      </button>
    </div>
  </div>

  <!-- Log viewer -->
  <div
    bind:this={logContainer}
    onscroll={handleScroll}
    class="flex-1 overflow-auto bg-[#0d1117] font-mono text-sm"
  >
    {#if logs.length === 0}
      <div class="flex items-center justify-center h-full text-[var(--dash-text-muted)]">
        No logs yet. Start a scrape to see logs here.
      </div>
    {:else}
      <div class="p-4 space-y-0.5">
        {#each logs as log (log.id)}
          <div class="flex gap-3 py-0.5 px-2 rounded {getLevelBg(log.level)} hover:bg-white/5">
            <span class="text-gray-500 shrink-0">{formatTime(log.timestamp)}</span>
            <span class="{getLevelColor(log.level)} shrink-0 w-12 uppercase text-xs font-bold">
              {log.level}
            </span>
            {#if log.jobSearchName}
              <span class="text-purple-400 shrink-0">[{log.jobSearchName}]</span>
            {/if}
            <span class="text-gray-300 whitespace-pre-wrap break-all">{log.message}</span>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Status bar -->
  <div class="flex items-center justify-between px-4 py-2 border-t border-[var(--dash-border)] bg-[var(--dash-card)] text-xs text-[var(--dash-text-muted)]">
    <div class="flex items-center gap-4">
      <span class="flex items-center gap-1.5">
        <span class="w-2 h-2 rounded-full {isPaused ? 'bg-yellow-400' : 'bg-green-400'} animate-pulse"></span>
        {isPaused ? "Paused" : "Live"}
      </span>
      {#if autoScroll}
        <span>Auto-scroll enabled</span>
      {:else}
        <button onclick={() => { autoScroll = true; if (logContainer) logContainer.scrollTop = logContainer.scrollHeight; }} class="text-[var(--dash-primary)] hover:underline">
          Jump to bottom
        </button>
      {/if}
    </div>
    <span>
      Showing last {logs.length} logs
    </span>
  </div>
</div>
