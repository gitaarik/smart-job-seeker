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

  function measure() {
    if (!containerEl || !measureEl) return;
    overflows = measureEl.scrollWidth > containerEl.clientWidth;
  }

  $effect(() => {
    if (!containerEl) return;
    const ro = new ResizeObserver(measure);
    ro.observe(containerEl);
    return () => ro.disconnect();
  });

  // --- When overflowing, split into rows with active row at bottom ---
  let rows = $derived.by(() => {
    if (!overflows) return null;
    // Find where to split: try to balance rows so the wider row is at bottom.
    // Use a simple greedy approach: fill first row until adding the next tab
    // would make it wider than half the total count, then start row 2.
    const split = Math.ceil(tabs.length / 2);
    const row1 = tabs.slice(0, split);
    const row2 = tabs.slice(split);
    // Which row has the active tab?
    const activeIdx = tabs.findIndex((t) => isActive(t.href));
    const activeInRow1 = activeIdx < split;
    // Put the active row at the bottom
    return activeInRow1 ? [row2, row1] : [row1, row2];
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
    <!-- Top row (no active tab) -->
    <div class="flex gap-x-0.5">
      {#each rows[0] as tab}
        <a
          href={tab.href}
          class="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-t-lg border border-transparent text-[var(--dash-text-secondary)] hover:text-[var(--dash-text)] hover:bg-[var(--dash-card)]/50 transition-colors"
        >
          {#if tab.icon}<FontAwesomeIcon icon={tab.icon} class="w-3.5 h-3.5" />{/if}
          {tab.label}
        </a>
      {/each}
    </div>
    <!-- Bottom row (contains active tab) -->
    <div class="flex gap-x-0.5 border-b-2 border-[var(--dash-border)]">
      {#each rows[1] as tab}
        <a
          href={tab.href}
          class="
            flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-t-lg -mb-0.5 transition-colors
            {isActive(tab.href)
            ? 'bg-[var(--dash-card)] border border-[var(--dash-border)] border-b-[var(--dash-card)] text-[var(--dash-primary)]'
            : 'border border-transparent text-[var(--dash-text-secondary)] hover:text-[var(--dash-text)] hover:bg-[var(--dash-card)]/50'}
          "
        >
          {#if tab.icon}<FontAwesomeIcon icon={tab.icon} class="w-3.5 h-3.5" />{/if}
          {tab.label}
        </a>
      {/each}
    </div>
    <!-- Content panel matching the active tab -->
    <div class="bg-[var(--dash-card)] border-x border-b border-[var(--dash-border)] rounded-b-xl p-4">
      {@render children()}
    </div>
  {/if}
</div>
