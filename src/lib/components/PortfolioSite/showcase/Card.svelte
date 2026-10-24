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
	class="break-inside-avoid rounded-xl border-[1.2px] border-(--pf-bright) bg-(--pf-surface-raised) p-6 transition-colors print:border-0 print:bg-transparent print:p-0"
>
	<h2 class="relative mb-5 border-b-2 border-(--pf-bright) pb-1">
		<span class="pr-12 text-xl font-semibold print:text-lg">{title}</span>
		<span class="absolute top-1 right-1"><FontAwesomeIcon {icon} size="lg" /></span>
	</h2>

	{@render children()}
</article>
