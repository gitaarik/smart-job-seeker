<script lang="ts">
	import type { DiffSegment } from '$lib/utils/word-diff';

	/**
	 * A word diff as inline marks: added in green, removed in red and struck
	 * through, unchanged as plain text.
	 *
	 * Renders inside whatever text container the caller has — a `<pre>` for a
	 * full document, a `<dd>` for a one-line value — so a change reads the same
	 * everywhere it is reviewed. No wrapper element and no whitespace of its own:
	 * inside a `<pre>` either would print.
	 */
	let { segments }: { segments: DiffSegment[] } = $props();
</script>

{#each segments as seg, i (i)}{#if seg.type === 'added'}<span
			class="bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">{seg.text}</span
		>{:else if seg.type === 'removed'}<span
			class="bg-red-500/20 text-red-700 line-through dark:text-red-300">{seg.text}</span
		>{:else}{seg.text}{/if}{/each}
