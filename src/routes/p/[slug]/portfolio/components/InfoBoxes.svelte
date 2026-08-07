<script lang="ts">
	import { getFaIcon } from '$lib/tools/fa-icons';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';

	type Item = {
		title?: string;
		description?: string;
		fa_icon?: any;
	};

	interface Props {
		items?: Array<Item>;
		class?: string;
	}

	let { items = [], class: classNames = '' }: Props = $props();
</script>

<div class="grid grid-cols-1 gap-3 md:grid-cols-2 print:grid-cols-2 print:gap-2 {classNames}">
	{#each items as item, index (index)}
		<div
			class="bg-frost border-aqua hover:bg-cloud/30 rounded-md border transition-colors duration-200"
		>
			{#if item.title}
				<h5
					class="bg-aqua/13 border-aqua mb-1 flex items-center rounded-t-md border-b-1 px-2 py-2 text-sm font-semibold"
				>
					{#if item.fa_icon}
						<FontAwesomeIcon icon={getFaIcon(item.fa_icon)} class="mr-2 h-3 w-3 flex-shrink-0" />
					{/if}
					{item.title}
				</h5>
				<p class="px-2 pb-2 text-sm leading-relaxed">
					{item.description}
				</p>
			{:else}
				<p class="flex items-center px-2 py-2 text-sm leading-relaxed">
					{#if item.fa_icon}
						<FontAwesomeIcon icon={getFaIcon(item.fa_icon)} class="mr-2 h-3 w-3 flex-shrink-0" />
					{/if}
					{item.description}
				</p>
			{/if}
		</div>
	{/each}
</div>
