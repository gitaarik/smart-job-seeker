<script lang="ts">
	import type { PageData } from './$types';
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { track } from '$lib/tools/analytics';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faArrowRight,
		faCheckCircle,
		faPaperPlane,
		faTimes
	} from '@fortawesome/free-solid-svg-icons';
	import MatchStatsGrid from '../components/MatchStatsGrid.svelte';
	import SearchTasksSummary from '../components/SearchTasksSummary.svelte';
	import MatchConfigSummary from '../components/MatchConfigSummary.svelte';
	import GettingStartedFlow from '../components/GettingStartedFlow.svelte';
	import JobCardList from '../jobs/components/JobCardList.svelte';
	import Card from '../components/Card.svelte';
	import { getStatusColor, getStatusLabel } from '$lib/application-status';

	let { data }: { data: PageData } = $props();

	let showCreatedBanner = $state($page.url.searchParams.get('created') === 'true');

	// Track profile-creation as an activation event. onMount keeps this client-
	// side only — the banner state is the trigger.
	onMount(() => {
		if (showCreatedBanner) {
			track('profile_created');
		}
	});

	const completeness = $derived(data.profileCompleteness);
	const matchConfig = $derived(data.matchConfig);
	const matchStats = $derived(data.matchStats);
	const searchTasks = $derived(data.searchTasks);
	const topMatches = $derived(data.topMatches);
	const profileSkillLevels = $derived(data.profileSkillLevels);
	const activeApplications = $derived(data.activeApplications);

	const hasMatches = $derived((matchStats?.total ?? 0) > 0);

	function formatDate(date: Date | string | null): string {
		if (!date) return '';
		const d = typeof date === 'string' ? new Date(date) : date;
		return d.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}
</script>

<svelte:head>
	<title>Overview - Smart Job Seeker</title>
</svelte:head>

<div class="space-y-5">
	<!-- Header -->
	<div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
		<div>
			<h1 class="text-lg font-semibold text-[var(--dash-text)]">Dashboard</h1>
			<p class="mt-1 text-[var(--dash-text-secondary)]">
				{#if hasMatches}
					Your job search overview
				{:else}
					Get started with your job search
				{/if}
			</p>
		</div>
	</div>

	<!-- Profile Created Banner -->
	{#if showCreatedBanner}
		<div
			class="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950/30"
		>
			<FontAwesomeIcon
				icon={faCheckCircle}
				class="mt-0.5 h-5 w-5 flex-shrink-0 text-green-600 dark:text-green-400"
			/>
			<div class="min-w-0 flex-1">
				<p class="text-sm font-medium text-green-800 dark:text-green-200">
					Profile created successfully!
				</p>
				<p class="mt-1 text-sm text-green-700 dark:text-green-300">
					You can review and add more details on the
					<a
						href="/profile/edit"
						class="font-medium underline hover:text-green-900 dark:hover:text-green-100"
						>profile data page</a
					>.
				</p>
			</div>
			<button
				type="button"
				onclick={() => (showCreatedBanner = false)}
				class="flex-shrink-0 text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-200"
			>
				<FontAwesomeIcon icon={faTimes} class="h-4 w-4" />
			</button>
		</div>
	{/if}

	<!-- Getting Started (shown when not fully set up yet) -->
	{#if completeness && !hasMatches}
		<GettingStartedFlow
			{completeness}
			hasSearchTasks={(searchTasks?.totalCount ?? 0) > 0}
			{hasMatches}
		/>
	{/if}

	<!-- Match Stats Grid -->
	{#if matchStats}
		<MatchStatsGrid stats={matchStats} />
	{/if}

	<!-- Active Applications -->
	{#if activeApplications && activeApplications.length > 0}
		<div>
			<div class="mb-3 flex items-center justify-between">
				<h3 class="text-base font-semibold text-[var(--dash-text)]">Active Applications</h3>
				<a
					href="/applications/active?group=active"
					class="flex items-center gap-1 text-sm text-[var(--dash-primary)] hover:underline"
				>
					View all
					<FontAwesomeIcon icon={faArrowRight} class="h-3 w-3" />
				</a>
			</div>
			<div class="space-y-2">
				{#each activeApplications as app (app.id)}
					{@const job = app.job}
					<a href="/applications/{app.id}" class="block">
						<Card class="transition-colors hover:bg-[var(--dash-bg)]">
							<div class="flex items-center gap-3 p-3">
								<div
									class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full {getStatusColor(
										app.status
									)}"
								>
									<FontAwesomeIcon icon={faPaperPlane} class="h-3.5 w-3.5" />
								</div>
								<div class="min-w-0 flex-1">
									<h4 class="truncate text-sm font-medium text-[var(--dash-text)]">
										{job?.title || 'Unknown Position'}
									</h4>
									{#if job?.company}
										<p class="truncate text-xs text-[var(--dash-text-secondary)]">
											{job.company}
										</p>
									{/if}
								</div>
								<div class="flex-shrink-0 text-right">
									<span
										class="rounded-full px-2 py-0.5 text-xs font-medium {getStatusColor(
											app.status
										)}"
									>
										{getStatusLabel(app.status)}
									</span>
									{#if app.status_step}
										<p class="mt-2 text-xs text-[var(--dash-text-secondary)] italic">
											{app.status_step}
										</p>
									{/if}
									{#if app.status_action}
										<p class="mt-2 text-xs font-medium text-[var(--dash-primary)]">
											→ {app.status_action}
											{#if app.status_action === 'Scheduled' && app.status_action_date}
												— {formatDate(app.status_action_date)}
											{/if}
										</p>
									{/if}
								</div>
							</div>
						</Card>
					</a>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Top Matches -->
	{#if hasMatches && topMatches && topMatches.length > 0}
		<div>
			<div class="mb-3 flex items-center justify-between">
				<h3 class="text-base font-semibold text-[var(--dash-text)]">Top Matches</h3>
				<a
					href="/jobs?sort=top"
					class="flex items-center gap-1 text-sm text-[var(--dash-primary)] hover:underline"
				>
					View all
					<FontAwesomeIcon icon={faArrowRight} class="h-3 w-3" />
				</a>
			</div>
			<JobCardList items={topMatches} {profileSkillLevels} />
		</div>
	{/if}

	<!-- Import Tasks & Match Config -->
	<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
		{#if searchTasks}
			<SearchTasksSummary {searchTasks} />
		{/if}
		<MatchConfigSummary {matchConfig} />
	</div>
</div>
