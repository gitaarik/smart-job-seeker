<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		label: string;
		href?: string | null;
		content?: string | null;
		type?: 'link' | 'email' | 'phone';
		/** Rendered after the value: the location's time zone, say. */
		children?: Snippet;
	}

	let { label, href = null, content = null, type = 'link', children }: Props = $props();
</script>

<span class="mr-[1px] inline-block font-bold whitespace-nowrap">
	<span class="inline-block w-0 opacity-0">-&nbsp;</span>{label}:
</span>

{#if href || content}
	{#if type === 'email'}
		<a href="mailto:{href}" class="underline hover:text-slate-600">{content}</a>
	{:else if type === 'phone'}
		<a href="tel:{href}" class="underline hover:text-slate-600">{content}</a>
	{:else}
		<!-- The href is the caller's: a contact link from the profile, not a route. -->
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
		<a {href} target="_blank" class="underline hover:text-slate-600">{content}</a>
	{/if}
{/if}

{@render children?.()}
