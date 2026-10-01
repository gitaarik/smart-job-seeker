<script lang="ts">
	import type { LayoutData } from './$types';
	import { resolve } from '$app/paths';
	import { page } from '$app/stores';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faArrowLeft,
		faClipboardList,
		faEnvelope,
		faFileLines,
		faMoneyBillWave,
		faStream
	} from '@fortawesome/free-solid-svg-icons';
	import type { Snippet } from 'svelte';
	import { getStepperPhase } from '$lib/application-status';
	import TabNav from '../../components/TabNav.svelte';

	let { data, children }: { data: LayoutData; children: Snippet } = $props();

	let app = $derived(data.application);

	const basePath = $derived(`/applications/${app.id}`);

	// Six tabs became four. Interviews, Documents and Timeline all answered
	// "what happened on this application" and are now one Activity stream; the
	// old paths 308 to it. See planning/APPLICATION-ACTIVITY.md.
	//
	// Resume is the fifth, and not a reversal of that: those three answered the
	// same question through different windows, while this one answers a question
	// nothing else does — which document goes to this job, and what it says about
	// you. It earned a tab by outgrowing a card, and moving it also takes its
	// analysis off the Overview's load.
	//
	// The counts took over from the Overview's Workbench card, which listed the
	// letters, questions and documents and then linked to these same tabs. Each
	// counts what its tab lists: Texts its letters and questions, Activity its
	// entries, the same number as the Activity header. That header leaves the
	// status changes out too, as context rather than content.
	//
	// Resume gets a dot instead. Its count could only be 0 or 1, and a count
	// shows only above zero, so it would light up once a document is recorded
	// and stay dark while none is: the wrong way round. The dot marks the gap,
	// the "not chosen yet" the Workbench card used to show, and only until the
	// application leaves Applying. Past that, a missing record is history
	// rather than something to do.
	const cvToRecord = $derived(
		!app.cv_sent_through && (app.status === 'draft' || getStepperPhase(app.status) === 'applying')
	);

	const tabs = $derived([
		{ label: 'Overview', href: basePath, icon: faClipboardList },
		{
			label: 'Resume',
			href: `${basePath}/resume`,
			icon: faFileLines,
			attention: cvToRecord ? 'No resume or CV recorded yet' : undefined
		},
		{
			label: 'Texts',
			href: `${basePath}/texts`,
			icon: faEnvelope,
			count: (app.application_letters?.length ?? 0) + (app.application_questions?.length ?? 0)
		},
		{
			label: 'Activity',
			href: `${basePath}/activity`,
			icon: faStream,
			count: app.application_records?.length ?? 0
		},
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
	<title
		>{app.job?.title || 'Application'}{app.job?.company ? ` at ${app.job.company}` : ''} - Applications
		- Smart Job Seeker</title
	>
</svelte:head>

<TabNav {tabs} isActive={isTabActive} inset>
	{#snippet header()}
		<!-- Back link + title -->
		<div class="mb-4">
			<a
				href={resolve('/applications/active')}
				class="inline-flex items-center gap-2 text-[var(--dash-text-secondary)] transition-colors hover:text-[var(--dash-primary)]"
			>
				<FontAwesomeIcon icon={faArrowLeft} class="h-4 w-4" />
				<span class="text-sm">All Applications</span>
			</a>
			{#if app.job?.title || app.job?.company}
				<!-- Title and company on one line: the title alone doesn't say which
				     application you're looking at when two employers advertise the
				     same role. The title truncates first; the company is the shorter
				     half and the one that disambiguates. -->
				<h1 class="mt-1 flex min-w-0 items-baseline gap-1.5 text-sm font-medium">
					{#if app.job?.title}
						<span class="truncate text-[var(--dash-text)]">{app.job.title}</span>
					{/if}
					{#if app.job?.title && app.job?.company}
						<span class="flex-shrink-0 text-[var(--dash-text-muted)]" aria-hidden="true">·</span>
					{/if}
					{#if app.job?.company}
						<span
							class="max-w-[45%] flex-shrink-0 truncate font-normal text-[var(--dash-text-secondary)]"
							>{app.job.company}</span
						>
					{/if}
				</h1>
			{/if}
		</div>
	{/snippet}
	{@render children()}
</TabNav>
