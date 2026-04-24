<script lang="ts">
  import type { IconDefinition } from "@fortawesome/fontawesome-common-types";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";

  type Filter = { value: string; label: string; icon?: IconDefinition };

  let {
    filters,
    value,
    onchange,
  }: {
    filters: Filter[];
    value: string;
    onchange: (value: string) => void;
  } = $props();
</script>

<div class="flex flex-wrap items-center gap-1.5">
  {#each filters as filter}
    <button
      type="button"
      onclick={() => onchange(filter.value)}
      class="px-2.5 py-1 text-xs rounded-md border transition-colors flex items-center gap-1.5 {value === filter.value
        ? 'bg-[var(--dash-primary)]/10 border-[var(--dash-primary)]/30 text-[var(--dash-primary)] font-medium'
        : 'bg-[var(--dash-bg)] border-[var(--dash-border)] text-[var(--dash-text)] hover:bg-[var(--dash-border)]'}"
    >
      {#if filter.icon}
        <FontAwesomeIcon icon={filter.icon} class="w-3 h-3 opacity-60" />
      {/if}
      {filter.label}
    </button>
  {/each}
</div>
