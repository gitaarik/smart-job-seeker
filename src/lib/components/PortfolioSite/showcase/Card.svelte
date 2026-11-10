<script lang="ts">
	/** One career section as a card: the standalone site's InfoSection. */
	import type { Snippet } from 'svelte';
	import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';

	interface Props {
		title: string;
		icon: IconDefinition;
		id?: string;
		children: Snippet;
		aos?: Record<string, string>;
	}

	let { title, icon, id, children, aos = {} }: Props = $props();
</script>

<article
	{id}
	{...aos}
	class="break-inside-avoid rounded-sm border border-(--pf-line) bg-(--pf-surface-raised) p-6 transition-colors min-[40rem]:p-9 print:border-0 print:bg-transparent print:p-0"
>
	<h2 class="mb-7 flex items-baseline justify-between gap-4 border-b border-(--pf-line) pb-4">
		<span class="pf-display text-[2.25rem] text-(--pf-strong) print:text-lg">{title}</span>
		<span class="text-(--pf-accent-text)"><FontAwesomeIcon {icon} size="lg" /></span>
	</h2>

	{@render children()}
</article>
