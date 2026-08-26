<script lang="ts">
	import { useSvelteFlow } from '@xyflow/svelte';
	import { getGraphHighlight } from './highlight.svelte';

	let { labels }: { labels: { id: string; label: string }[] } = $props();

	const hl = getGraphHighlight();
	// Not destructured: the hook's members are getters over a $derived store, and
	// pulling `fitView` out by value detaches it from that.
	const flow = useSvelteFlow();

	const hits = $derived(
		hl.needle === '' ? [] : labels.filter((n) => n.label.toLowerCase().includes(hl.needle))
	);

	/**
	 * Typing dims; only Enter moves the viewport.
	 *
	 * Flying on every keystroke means the graph lurches once per character and
	 * lands somewhere useless for every prefix of what you meant to type.
	 */
	async function fly(event: SubmitEvent) {
		event.preventDefault();
		if (hits.length === 0) return;
		await flow.fitView({ nodes: hits.map((n) => ({ id: n.id })), duration: 400, maxZoom: 1.4 });
	}
</script>

<form class="flex items-center gap-2" onsubmit={fly}>
	<input
		type="search"
		bind:value={hl.query}
		placeholder="Find a concept…"
		aria-label="Find a concept in the graph"
		class="w-48 rounded-md border border-[var(--dash-border-input)] bg-[var(--dash-card)] px-2.5 py-1.5 text-sm text-[var(--dash-text)] placeholder:text-[var(--dash-text-muted)] focus:border-[var(--dash-primary)] focus:outline-none"
	/>
	{#if hl.needle !== ''}
		<span class="text-xs whitespace-nowrap text-[var(--dash-text-secondary)]" aria-live="polite">
			{#if hits.length === 0}
				no match
			{:else}
				{hits.length} shown · Enter to zoom
			{/if}
		</span>
	{/if}
</form>
