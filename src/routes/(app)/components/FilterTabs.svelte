<script lang="ts">
	import type { IconDefinition } from '@fortawesome/fontawesome-common-types';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';

	type Filter = { value: string; label: string; icon?: IconDefinition };

	let {
		filters,
		value,
		onchange
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
			class="flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors {value ===
			filter.value
				? 'border-[var(--dash-primary)]/30 bg-[var(--dash-primary)]/10 font-medium text-[var(--dash-primary)]'
				: 'border-[var(--dash-border)] bg-[var(--dash-bg)] text-[var(--dash-text)] hover:bg-[var(--dash-border)]'}"
		>
			{#if filter.icon}
				<FontAwesomeIcon icon={filter.icon} class="h-3 w-3 opacity-60" />
			{/if}
			{filter.label}
		</button>
	{/each}
</div>
