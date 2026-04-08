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

  // --- When overflowing, split tabs into as many rows as needed ---
  let rows = $derived.by(() => {
    if (!overflows || tabWidths.length === 0 || !containerEl) return null;
    const maxWidth = containerEl.clientWidth;
    const gap = 2; // gap-x-0.5 = 2px
    const allRows: Tab[][] = [];
    let currentRow: Tab[] = [];
    let currentWidth = 0;

    for (let i = 0; i < tabs.length; i++) {
      const w = tabWidths[i] ?? 0;
      const needed = currentRow.length > 0 ? gap + w : w;
      if (currentRow.length > 0 && currentWidth + needed > maxWidth) {
        allRows.push(currentRow);
        currentRow = [tabs[i]];
        currentWidth = w;
      } else {
        currentRow.push(tabs[i]);
        currentWidth += needed;
      }
    }
    if (currentRow.length > 0) allRows.push(currentRow);

    // Move the row containing the active tab to the bottom
    const activeHref = tabs.find((t) => isActive(t.href))?.href;
    if (activeHref && allRows.length > 1) {
      const activeRowIdx = allRows.findIndex((row) =>
        row.some((t) => t.href === activeHref),
      );
      if (activeRowIdx >= 0 && activeRowIdx < allRows.length - 1) {
        const [activeRow] = allRows.splice(activeRowIdx, 1);
        allRows.push(activeRow);
      }
    }

    return allRows;
  });
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
    <!-- Multi-row: bookmark tabs with active row at bottom -->
    {#each rows as row, rowIdx}
      {@const isBottomRow = rowIdx === rows.length - 1}
      <div class="flex gap-x-0.5 {isBottomRow ? 'border-b-2 border-[var(--dash-border)]' : ''}">
        {#each row as tab}
          {@const active = isActive(tab.href)}
          <a
            href={tab.href}
            class="
              flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-t-lg transition-colors
              {isBottomRow ? '-mb-0.5' : ''}
              {active
              ? 'bg-[var(--dash-card)] border border-[var(--dash-border)] border-b-[var(--dash-card)] text-[var(--dash-primary)]'
              : 'border border-transparent text-[var(--dash-text-secondary)] hover:text-[var(--dash-text)] hover:bg-[var(--dash-card)]/50'}
            "
          >
            {#if tab.icon}<FontAwesomeIcon icon={tab.icon} class="w-3.5 h-3.5" />{/if}
            {tab.label}
          </a>
        {/each}
      </div>
    {/each}
    <!-- Content panel matching the active tab -->
    <div class="bg-[var(--dash-card)] border-x border-b border-[var(--dash-border)] rounded-b-xl p-4">
      {@render children()}
    </div>
  {/if}
</div>
