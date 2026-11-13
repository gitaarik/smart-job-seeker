<script lang="ts">
	/*
	 * A published legal text (/terms, /privacy). The words are the
	 * deployment's, read from its legal directory (server/legal/texts.ts);
	 * this only lays them out.
	 */
	import { resolve } from '$app/paths';

	let { title, html, draft }: { title: string; html: string; draft: boolean } = $props();
</script>

<svelte:head>
	<title>{title} - Smart Job Seeker</title>
</svelte:head>

<main class="min-h-screen bg-[var(--dash-bg)] px-6 py-16 text-[var(--dash-text)] transition-colors">
	<div class="mx-auto max-w-3xl">
		<a href={resolve('/')} class="text-sm text-[var(--dash-primary)] hover:underline"
			>← Smart Job Seeker</a
		>
		{#if draft}
			<div
				class="mt-6 rounded-md border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-[var(--dash-text)]"
			>
				<strong>Draft.</strong> This text is a placeholder and not yet in force.
			</div>
		{/if}
		<!-- eslint-disable-next-line svelte/no-at-html-tags -- the operator's own text -->
		<article class="legal-prose mt-6">{@html html}</article>
	</div>
</main>

<style>
	.legal-prose :global(h1) {
		font-size: 1.875rem;
		font-weight: 800;
		line-height: 1.2;
		margin-bottom: 1rem;
	}
	.legal-prose :global(h2) {
		font-size: 1.25rem;
		font-weight: 700;
		margin-top: 2rem;
		margin-bottom: 0.75rem;
	}
	.legal-prose :global(p),
	.legal-prose :global(li) {
		color: var(--dash-text-secondary);
		line-height: 1.7;
	}
	.legal-prose :global(p) {
		margin-bottom: 1rem;
	}
	.legal-prose :global(ul),
	.legal-prose :global(ol) {
		margin: 0.5rem 0 1rem 1.25rem;
		list-style: revert;
	}
	.legal-prose :global(a) {
		color: var(--dash-primary);
		text-decoration: underline;
	}
	.legal-prose :global(strong) {
		color: var(--dash-text);
		font-weight: 600;
	}
</style>
