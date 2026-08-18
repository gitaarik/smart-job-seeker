<script lang="ts">
	/**
	 * The shell around one side project: where it came from, what it is called,
	 * and its tabs.
	 *
	 * The same shell as a role project's, deliberately — the two pages had been
	 * drifting apart while doing the same job, and a reader who learns one should
	 * not have to learn the other. `inset` is left off because the profile's own
	 * section tabs are the inset bar above this.
	 */
	import type { Snippet } from 'svelte';
	import type { LayoutData } from './$types';
	import { page } from '$app/stores';
	import { resolve } from '$app/paths';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faArrowLeft,
		faBook,
		faFolderOpen,
		faLightbulb,
		faListCheck
	} from '@fortawesome/free-solid-svg-icons';
	import TabNav from '../../../../components/TabNav.svelte';

	let { data, children }: { data: LayoutData; children: Snippet } = $props();

	/**
	 * Every path here is recomputed when the URL changes, and that is not
	 * ceremony.
	 *
	 * `resolve()` returns a path relative to the page being rendered (SvelteKit
	 * resolves paths relatively unless told otherwise), and this layout survives
	 * the move between its own tabs — the component is not re-rendered, so a
	 * derived that depended only on the project id would keep the hrefs computed
	 * for whichever tab was server-rendered first. They would then be relative to
	 * the wrong directory, and the back link that worked on Details would 404
	 * from Files & code.
	 */
	const basePath = $derived.by(() => {
		void $page.url.pathname;
		return resolve('/(app)/profile/(data)/side-projects/[id]', { id: String(data.project.id) });
	});
	const listPath = $derived.by(() => {
		void $page.url.pathname;
		return resolve('/(app)/profile/(data)/side-projects');
	});

	const tabs = $derived([
		{ label: 'Details', href: basePath, icon: faListCheck },
		{ label: 'Files & code', href: `${basePath}/sources`, icon: faFolderOpen },
		{ label: 'Stories', href: `${basePath}/stories`, icon: faBook }
	]);

	function isTabActive(href: string): boolean {
		const current = $page.url.pathname;
		return href === basePath ? current === basePath : current.startsWith(href);
	}
</script>

<svelte:head>
	<title>{data.project.name || 'Project'} - Side Projects - Smart Job Seeker</title>
</svelte:head>

<div class="space-y-6">
	<div>
		<a
			href={listPath}
			class="inline-flex items-center gap-2 text-[var(--dash-text-secondary)] transition-colors hover:text-[var(--dash-primary)]"
		>
			<FontAwesomeIcon icon={faArrowLeft} class="h-4 w-4" />
			<span class="text-sm">All Side Projects</span>
		</a>
		<div class="mt-2 flex items-center gap-3">
			{#if data.imageUrl}
				<img
					src={data.imageUrl}
					alt="{data.project.name} image"
					class="h-10 w-10 rounded-lg object-cover"
				/>
			{:else}
				<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--dash-bg)]">
					<FontAwesomeIcon icon={faLightbulb} class="h-5 w-5 text-[var(--dash-primary)]" />
				</div>
			{/if}
			<h1 class="min-w-0 truncate text-xl font-semibold text-[var(--dash-text)]">
				{data.project.name || 'Untitled project'}
			</h1>
		</div>
	</div>

	<TabNav {tabs} isActive={isTabActive}>
		{@render children()}
	</TabNav>
</div>
