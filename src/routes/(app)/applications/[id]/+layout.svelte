<script lang="ts">
	import type { LayoutData } from './$types';
	import { page } from '$app/stores';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faArrowLeft,
		faClipboardList,
		faEnvelope,
		faMoneyBillWave,
		faStream
	} from '@fortawesome/free-solid-svg-icons';
	import type { Snippet } from 'svelte';
	import TabNav from '../../components/TabNav.svelte';

	let { data, children }: { data: LayoutData; children: Snippet } = $props();

	let app = $derived(data.application);

	const basePath = $derived(`/applications/${app.id}`);

	// Six tabs became four. Interviews, Documents and Timeline all answered
	// "what happened on this application" and are now one Activity stream; the
	// old paths 308 to it. See planning/APPLICATION-ACTIVITY.md.
	const tabs = $derived([
		{ label: 'Overview', href: basePath, icon: faClipboardList },
		{ label: 'Texts', href: `${basePath}/texts`, icon: faEnvelope },
		{ label: 'Activity', href: `${basePath}/activity`, icon: faStream },
		{ label: 'Salary', href: `${basePath}/salary`, icon: faMoneyBillWave }
	]);

	function isTabActive(href: string): boolean {
		const currentPath = $page.url.pathname;
		if (href === basePath) {
			return currentPath === basePath;
		}
		return currentPath.startsWith(href);
	}
</script>

<svelte:head>
	<title>{app.job?.title || 'Application'} - Applications - Smart Job Seeker</title>
</svelte:head>

<TabNav {tabs} isActive={isTabActive} inset>
	{#snippet header()}
		<!-- Back link + title -->
		<div class="mb-4">
			<a
				href="/applications/active"
				class="inline-flex items-center gap-2 text-[var(--dash-text-secondary)] transition-colors hover:text-[var(--dash-primary)]"
			>
				<FontAwesomeIcon icon={faArrowLeft} class="h-4 w-4" />
				<span class="text-sm">All Applications</span>
			</a>
			{#if app.job?.title}
				<h1 class="mt-1 truncate text-sm font-medium text-[var(--dash-text)]">{app.job.title}</h1>
			{/if}
		</div>
	{/snippet}
	{@render children()}
</TabNav>
