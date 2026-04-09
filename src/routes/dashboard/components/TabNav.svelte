<script lang="ts">
  import type { Snippet } from "svelte";
  import type { IconDefinition } from "@fortawesome/fontawesome-common-types";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";

  export type Tab = {
    label: string;
    href: string;
    icon?: IconDefinition;
  };

  let {
    tabs,
    isActive,
    children,
  }: {
    tabs: Tab[];
    isActive: (href: string) => boolean;
    children: Snippet;
  } = $props();

  // --- Overflow detection via hidden measurement row ---
  let containerEl = $state<HTMLDivElement | null>(null);
  let measureEl = $state<HTMLDivElement | null>(null);
  let overflows = $state(false);
  let tabWidths = $state<number[]>([]);

  function measure() {
    if (!containerEl || !measureEl) return;
    overflows = measureEl.scrollWidth > containerEl.clientWidth;
    // Measure individual tab widths for row splitting
    if (overflows) {
      const spans = measureEl.children;
      tabWidths = Array.from(spans, (el) => (el as HTMLElement).offsetWidth);
    }
  }

  $effect(() => {
    if (!containerEl) return;
    const ro = new ResizeObserver(measure);
    ro.observe(containerEl);
    return () => ro.disconnect();
  });

  // --- When overflowing, split tabs evenly across rows ---
  let rows = $derived.by(() => {
    if (!overflows || tabWidths.length === 0 || !containerEl) return null;
    // Subtract px-4 (1rem each side = 32px) used by the multi-row wrapper
    const maxWidth = containerEl.clientWidth - 32;
    const gap = -1; // -ml-px: borders overlap by 1px

    // Helper: compute total width of tabs[start..end) in a row
    const rowWidth = (start: number, end: number) => {
      let w = 0;
      for (let i = start; i < end; i++) {
        w += tabWidths[i] + (i > start ? gap : 0);
      }
      return w;
    };

    // First, determine how many rows we need via greedy pass
    let numRows = 1;
    let curWidth = 0;
    for (let i = 0; i < tabs.length; i++) {
      const needed = i > 0 && curWidth > 0 ? gap + tabWidths[i] : tabWidths[i];
      if (curWidth > 0 && curWidth + needed > maxWidth) {
        numRows++;
        curWidth = tabWidths[i];
      } else {
        curWidth += needed;
      }
    }

    // Distribute tabs evenly across numRows using dynamic programming.
    // Find split points that minimize the max row width.
    const n = tabs.length;
    if (numRows >= n) {
      const allRows = tabs.map((t) => [t]);
      return reorderForActiveTab(allRows);
    }

    const INF = 1e9;
    const dp: number[][] = Array.from({ length: n + 1 }, () => Array(numRows + 1).fill(INF));
    const choice: number[][] = Array.from({ length: n + 1 }, () => Array(numRows + 1).fill(0));
    dp[0][0] = 0;

    for (let r = 1; r <= numRows; r++) {
      for (let i = r; i <= n; i++) {
        for (let j = r - 1; j < i; j++) {
          const w = rowWidth(j, i);
          if (w > maxWidth && j < i - 1) continue;
          const cost = Math.max(dp[j][r - 1], w);
          if (cost < dp[i][r]) {
            dp[i][r] = cost;
            choice[i][r] = j;
          }
        }
      }
    }

    // Reconstruct split points
    const allRows: Tab[][] = [];
    let end = n;
    for (let r = numRows; r >= 1; r--) {
      const start = choice[end][r];
      allRows.unshift(tabs.slice(start, end));
      end = start;
    }

    return reorderForActiveTab(allRows);
  });

  // Move the row containing the active tab to the bottom,
  // and reverse the remaining rows so they stack bottom-to-top
  function reorderForActiveTab(allRows: Tab[][]): Tab[][] {
    const activeHref = tabs.find((t) => isActive(t.href))?.href;
    if (activeHref && allRows.length > 1) {
      const activeRowIdx = allRows.findIndex((row) =>
        row.some((t) => t.href === activeHref),
      );
      if (activeRowIdx >= 0) {
        const [activeRow] = allRows.splice(activeRowIdx, 1);
        allRows.reverse();
        allRows.push(activeRow);
      }
    }
    return allRows;
  }
</script>

<!-- Hidden measurement row — rendered offscreen to measure natural tab widths -->
<div bind:this={containerEl} class="relative">
  <div
    bind:this={measureEl}
    class="flex absolute invisible h-0 overflow-hidden"
    aria-hidden="true"
  >
    {#each tabs as tab}
      <span class="flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap">
        {#if tab.icon}<FontAwesomeIcon icon={tab.icon} class="w-4 h-4" />{/if}
        {tab.label}
      </span>
    {/each}
  </div>

  {#if !overflows}
    <!-- Single row: standard underline tabs -->
    <div class="flex border-b border-[var(--dash-border)]">
      {#each tabs as tab}
        <a
          href={tab.href}
          class="
            flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap
            {isActive(tab.href)
            ? 'border-[var(--dash-primary)] text-[var(--dash-primary)]'
            : 'border-transparent text-[var(--dash-text-secondary)] hover:text-[var(--dash-text)] hover:border-[var(--dash-border)]'}
          "
        >
          {#if tab.icon}<FontAwesomeIcon icon={tab.icon} class="w-4 h-4" />{/if}
          {tab.label}
        </a>
      {/each}
    </div>
    <div class="mt-6">
      {@render children()}
    </div>
  {:else if rows}
    <!-- Multi-row: tabs stretch down to bottom border, lower rows overlap upper -->
    {@const rowCount = rows.length}
    {@const rowH = 32}
    <div class="relative">
      {#each rows as row, rowIdx}
        {@const rowsBelow = rowCount - 1 - rowIdx}
        {@const isBottomRow = rowsBelow === 0}
        <div
          class="flex items-start px-4"
          style="margin-bottom: {isBottomRow ? 0 : -rowsBelow * rowH}px;"
        >
          {#each row as tab, tabIdx}
            {@const active = isActive(tab.href)}
            <a
              href={tab.href}
              class="
                flex items-center gap-1.5 px-3 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap relative
                {tabIdx > 0 ? '-ml-px' : ''}
                {active ? 'mb-[-2px]' : ''}
                {active
                ? 'bg-[var(--dash-bg)] border border-[var(--dash-border)] border-b-transparent text-[var(--dash-primary)]'
                : 'bg-[var(--dash-bg)] border-x border-t border-[var(--dash-border)] border-b-transparent text-[var(--dash-text)] hover:bg-[var(--dash-card)]'}
              "
              style="z-index: {active ? rowCount + 2 : rowIdx + 1}; padding-top: 6px; padding-bottom: {rowsBelow * rowH + (active ? 8 : 6)}px;"
            >
              {#if tab.icon}<FontAwesomeIcon icon={tab.icon} class="w-3.5 h-3.5" />{/if}
              {tab.label}
            </a>
          {/each}
        </div>
      {/each}
      <div class="border-b-2 border-[var(--dash-border)] relative" style="z-index: {rowCount};"></div>
    </div>
    <div class="mt-6">
      {@render children()}
    </div>
  {/if}
</div>
