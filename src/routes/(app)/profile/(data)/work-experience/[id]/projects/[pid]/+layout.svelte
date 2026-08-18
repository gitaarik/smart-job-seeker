<script lang="ts">
	/**
	 * The shell around one role project: where it came from, what it is called,
	 * and its tabs.
	 *
	 * The tabs are routes rather than local state, like the application detail
	 * pages — so a tab is linkable, survives a reload, and each one loads only
	 * what it renders. `inset` is left off: the profile's own section tabs are
	 * the inset bar above this, and a second full-bleed one would read as a
	 * second navigation rather than a division of this page.
	 */
	import type { Snippet } from 'svelte';
	import type { LayoutData } from './$types';
	import { page } from '$app/stores';
	import { resolve } from '$app/paths';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faArrowLeft, faFolderOpen, faListCheck } from '@fortawesome/free-solid-svg-icons';
	import TabNav from '../../../../../../components/TabNav.svelte';

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
		return resolve('/(app)/profile/(data)/work-experience/[id]/projects/[pid]', {
			id: String(data.experience.id),
			pid: String(data.project.id)
		});
	});
	const rolePath = $derived.by(() => {
		void $page.url.pathname;
		return resolve('/(app)/profile/(data)/work-experience/[id]', {
			id: String(data.experience.id)
		});
	});
	const roleName = $derived(data.experience.name || data.experience.position || 'this role');

	const tabs = $derived([
		{ label: 'Details', href: basePath, icon: faListCheck },
		{ label: 'Files & code', href: `${basePath}/sources`, icon: faFolderOpen }
	]);

	function isTabActive(href: string): boolean {
		const current = $page.url.pathname;
		return href === basePath ? current === basePath : current.startsWith(href);
	}
</script>

<svelte:head>
	<title>{data.project.name || 'Project'} - {roleName} - Smart Job Seeker</title>
</svelte:head>

<div class="space-y-6">
	<div>
		<a
			href={rolePath}
			class="inline-flex items-center gap-2 text-[var(--dash-text-secondary)] transition-colors hover:text-[var(--dash-primary)]"
		>
			<FontAwesomeIcon icon={faArrowLeft} class="h-4 w-4" />
			<span class="text-sm">{roleName}</span>
		</a>
		<h1 class="mt-1 text-xl font-semibold text-[var(--dash-text)]">
			{data.project.name || 'Untitled project'}
		</h1>
	</div>

	<TabNav {tabs} isActive={isTabActive}>
		{@render children()}
	</TabNav>
</div>
