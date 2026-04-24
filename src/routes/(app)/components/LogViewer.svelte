<script lang="ts">
  import Spinner from "$lib/components/Spinner.svelte";

  interface LogEntry {
    id: number | string;
    level: string;
    message: string;
    timestamp: string;
  }

  interface Props {
    logs: LogEntry[];
    loading?: boolean;
    maxHeight?: string;
    timezone?: string;
  }

  let { logs, loading = false, maxHeight = "max-h-64", timezone }: Props = $props();

  const LOG_LEVELS = ["debug", "info", "warn", "error"] as const;
  const LOG_LEVEL_RANK: Record<string, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  let minLevel = $state<string>("debug");
  let filteredLogs = $derived(
    logs.filter(
      (log) =>
        (LOG_LEVEL_RANK[log.level] ?? 0) >= (LOG_LEVEL_RANK[minLevel] ?? 0),
    ),
  );

  let containerRef = $state<HTMLElement | null>(null);
  let autoScroll = $state(true);

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
        return "text-[var(--dash-text)]";
    }
  }

  function handleScroll(event: Event) {
    const el = event.target as HTMLElement;
    autoScroll = el.scrollHeight - el.scrollTop - el.clientHeight < 20;
  }

  export function scrollToBottom() {
    if (!autoScroll) return;
    requestAnimationFrame(() => {
      if (containerRef) containerRef.scrollTop = containerRef.scrollHeight;
    });
  }

  // Auto-scroll when logs change
  $effect(() => {
    if (filteredLogs.length > 0) {
      scrollToBottom();
    }
  });
</script>

<div class="flex items-center justify-between mb-2">
  <span class="text-sm font-medium text-[var(--dash-text)]">Logs</span>
  <div class="flex items-center gap-2">
    <select
      bind:value={minLevel}
      class="text-xs px-1.5 py-0.5 border border-[var(--dash-border)] rounded bg-[var(--dash-card)] text-[var(--dash-text)] focus:outline-none focus:ring-1 focus:ring-[var(--dash-primary)]"
    >
      {#each LOG_LEVELS as level}
        <option value={level}>{level.toUpperCase()}+</option>
      {/each}
    </select>
    {#if loading}
      <Spinner size="w-3 h-3" color="var(--dash-text-muted)" />
    {/if}
  </div>
</div>

<div
  bind:this={containerRef}
  onscroll={handleScroll}
  class="bg-[var(--dash-card)] rounded border border-[var(--dash-border)] {maxHeight} overflow-y-auto"
>
  {#if filteredLogs.length === 0}
    <div class="p-4 text-sm text-[var(--dash-text-muted)] text-center">
      {#if loading}
        Loading logs...
      {:else if logs.length > 0}
        No logs at this level
      {:else}
        No logs yet
      {/if}
    </div>
  {:else}
    <div class="p-2 space-y-0.5 font-mono text-xs">
      {#each filteredLogs as log (log.id)}
        <div class="flex gap-2 py-0.5 px-1 hover:bg-[var(--dash-bg)] rounded">
          <span class="text-[var(--dash-text-muted)] whitespace-nowrap">
            {new Date(log.timestamp).toLocaleTimeString("en-US", { timeZone: timezone || undefined })}
          </span>
          <span class="uppercase w-12 {getLogLevelColor(log.level)}">
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
