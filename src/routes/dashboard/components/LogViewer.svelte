<script lang="ts">
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import { faSpinner } from "@fortawesome/free-solid-svg-icons";

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
  }

  let { logs, loading = false, maxHeight = "max-h-64" }: Props = $props();

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
    if (logs.length > 0) {
      scrollToBottom();
    }
  });
</script>

<div class="flex items-center justify-between mb-2">
  <span class="text-sm font-medium text-[var(--dash-text)]">Logs</span>
  {#if loading}
    <FontAwesomeIcon icon={faSpinner} class="w-3 h-3 text-[var(--dash-text-muted)] animate-spin" />
  {/if}
</div>

<div
  bind:this={containerRef}
  onscroll={handleScroll}
  class="bg-[var(--dash-card)] rounded border border-[var(--dash-border)] {maxHeight} overflow-y-auto"
>
  {#if logs.length === 0}
    <div class="p-4 text-sm text-[var(--dash-text-muted)] text-center">
      {#if loading}
        Loading logs...
      {:else}
        No logs yet
      {/if}
    </div>
  {:else}
    <div class="p-2 space-y-0.5 font-mono text-xs">
      {#each logs as log (log.id)}
        <div class="flex gap-2 py-0.5 px-1 hover:bg-[var(--dash-bg)] rounded">
          <span class="text-[var(--dash-text-muted)] whitespace-nowrap">
            {new Date(log.timestamp).toLocaleTimeString()}
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
