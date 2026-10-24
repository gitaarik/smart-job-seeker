<script lang="ts">
	/**
	 * A two-column grid of small boxes: achievements, skill groups, a side
	 * project's highlights. A box with a title gets a header strip; one without
	 * (an achievement is a single line in the profile) puts its icon by the text.
	 */
	import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';

	interface Item {
		key: string | number;
		title?: string | null;
		description: string;
		icon?: IconDefinition | null;
	}

	let { items }: { items: Item[] } = $props();
</script>

<div class="grid grid-cols-1 gap-3 min-[50rem]:grid-cols-2 print:grid-cols-2 print:gap-2">
	{#each items as item (item.key)}
		<div
			class="rounded-md border border-(--pf-bright-hover) bg-(--pf-surface-raised) transition-colors duration-200 hover:bg-(--pf-line)/30"
		>
			{#if item.title}
				<h5
					class="mb-1 flex items-center rounded-t-md border-b border-(--pf-bright-hover) bg-(--pf-bright-hover)/13 px-2 py-2 text-sm font-semibold"
				>
					{#if item.icon}
						<FontAwesomeIcon icon={item.icon} class="mr-2 h-3 w-3 flex-shrink-0" />
					{/if}
					{item.title}
				</h5>
				<p class="px-2 pb-2 text-sm leading-relaxed">{item.description}</p>
			{:else}
				<p class="flex items-start p-2 text-sm leading-relaxed">
					{#if item.icon}
						<FontAwesomeIcon icon={item.icon} class="mt-1 mr-2 h-3 w-3 flex-shrink-0" />
					{/if}
					<span>{item.description}</span>
				</p>
			{/if}
		</div>
	{/each}
</div>
