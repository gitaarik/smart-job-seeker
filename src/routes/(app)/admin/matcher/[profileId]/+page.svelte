<script lang="ts">
	import type { PageData } from './$types';
	import { onMount, onDestroy } from 'svelte';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faArrowLeft,
		faChartBar,
		faExclamationTriangle
	} from '@fortawesome/free-solid-svg-icons';
	import SectionHeader from '../../../profile/components/SectionHeader.svelte';
	import Card from '../../../components/Card.svelte';
	import Spinner from '$lib/components/Spinner.svelte';

	let { data }: { data: PageData } = $props();

	interface MatcherError {
		jobId: number;
		jobTitle: string;
		message: string;
		timestamp: string;
	}

	interface MatcherState {
		active: boolean;
		profileId: number | null;
		currentJobId: number | null;
		currentJobTitle: string | null;
		cycleProcessed: number;
		cycleBatchSize: number;
		totalCycles: number;
		totalMatched: number;
		totalFailed: number;
		recentErrors: MatcherError[];
		lastUpdated: string;
	}

	interface ProfileInfo {
		id: number;
		name: string;
		matchCommunityJobs: boolean;
		totalJobs: number;
		matchedCount: number;
		noMatchCount: number;
		unmatchedCount: number;
	}

	let state = $state<MatcherState | null>(null);
	let profile = $state<ProfileInfo | null>(null);
	let loading = $state(true);
	let error = $state('');
	let pollInterval: ReturnType<typeof setInterval> | null = null;

	async function loadStatus() {
		try {
			const response = await fetch('/api/admin/matcher/status');
			if (response.ok) {
				const result = await response.json();
				state =
					result.matcherStates.find((s: MatcherState) => s.profileId === data.profileId) ?? null;
				profile = result.profiles.find((p: ProfileInfo) => p.id === data.profileId) ?? null;
				error = '';
			} else {
				error = 'Failed to load matcher status';
			}
		} catch (err) {
			console.error('Failed to load matcher status:', err);
			error = 'Failed to load matcher status';
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		loadStatus();
		pollInterval = setInterval(loadStatus, 5000);
	});

	onDestroy(() => {
		if (pollInterval) clearInterval(pollInterval);
	});

	function formatDateTime(date: string): string {
		const d = new Date(date);
		return d.toLocaleString('en-US', {
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit',
			second: '2-digit'
		});
	}

	function formatRelativeTime(date: string | null): string {
		if (!date) return '';
		const d = new Date(date);
		const now = new Date();
		const diffMs = now.getTime() - d.getTime();
		const diffSecs = Math.floor(diffMs / 1000);
		const diffMins = Math.floor(diffMs / 60000);
		const diffHours = Math.floor(diffMs / 3600000);

		if (diffSecs < 30) return 'Just now';
		if (diffMins < 1) return `${diffSecs}s ago`;
		if (diffMins < 60) return `${diffMins}m ago`;
		if (diffHours < 24) return `${diffHours}h ago`;
		return d.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	let evaluated = $derived((profile?.matchedCount ?? 0) + (profile?.noMatchCount ?? 0));
</script>

<div class="space-y-6">
	<div>
		<a
			href="/admin/matcher"
			class="flex items-center gap-2 text-[var(--dash-text-secondary)] transition-colors hover:text-[var(--dash-primary)]"
		>
			<FontAwesomeIcon icon={faArrowLeft} class="h-4 w-4" />
			<span class="text-sm">All Matchers</span>
		</a>
	</div>
	<SectionHeader
		title="Matcher Detail — {profile?.name ?? `Profile ${data.profileId}`}"
		icon={faChartBar}
	/>

	{#if loading}
		<div class="flex items-center justify-center py-12">
			<Spinner size="w-6 h-6" color="var(--dash-primary)" />
		</div>
	{:else if error}
		<Card padding="responsive">
			<p class="text-sm text-[var(--dash-error)]">{error}</p>
		</Card>
	{:else}
		<!-- Profile Overview -->
		{#if profile}
			<Card padding="responsive">
				<div class="mb-3 flex items-center justify-between">
					<div class="flex items-center gap-2">
						{#if state?.active && state?.currentJobId}
							<span class="relative flex h-2.5 w-2.5">
								<span
									class="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"
								></span>
								<span class="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500"></span>
							</span>
						{:else if state?.active}
							<span class="relative flex h-2.5 w-2.5">
								<span class="relative inline-flex h-2.5 w-2.5 rounded-full bg-yellow-500"></span>
							</span>
						{:else}
							<span class="relative flex h-2.5 w-2.5">
								<span class="relative inline-flex h-2.5 w-2.5 rounded-full bg-gray-400"></span>
							</span>
						{/if}
						<span class="text-xs text-[var(--dash-text-muted)]">ID: {profile.id}</span>
						{#if profile.matchCommunityJobs}
							<span
								class="rounded bg-[var(--dash-primary)]/10 px-1.5 py-0.5 text-xs text-[var(--dash-primary)]"
								>community</span
							>
						{/if}
					</div>
					{#if state?.lastUpdated}
						<span class="text-xs text-[var(--dash-text-muted)]">
							{formatRelativeTime(state.lastUpdated)}
						</span>
					{/if}
				</div>

				<!-- DB stats row -->
				<div class="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--dash-text-secondary)]">
					<span>{profile.totalJobs} jobs</span>
					<span class="text-[var(--dash-success)]">{profile.matchedCount} matched</span>
					<span class="text-[var(--dash-error)]">{profile.noMatchCount} no match</span>
					<span class="text-[var(--dash-text-muted)]">{profile.unmatchedCount} unevaluated</span>
				</div>

				<!-- Progress bar -->
				{#if profile.totalJobs > 0}
					<div class="mb-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--dash-bg)]">
						<div
							class="h-full rounded-full transition-all duration-500 {evaluated >= profile.totalJobs
								? 'bg-[var(--dash-success)]'
								: 'bg-[var(--dash-primary)]'}"
							style="width: {Math.min(100, (evaluated / profile.totalJobs) * 100)}%"
						></div>
					</div>
				{/if}

				<!-- Worker state row -->
				{#if state}
					<div class="flex flex-wrap gap-x-6 gap-y-1 text-xs text-[var(--dash-text-muted)]">
						<span>Cycles: {state.totalCycles}</span>
						<span>Session: {state.totalMatched} matched</span>
						{#if state.totalFailed > 0}
							<span class="text-[var(--dash-error)]">{state.totalFailed} failed</span>
						{/if}
						{#if state.currentJobId}
							<span>
								Processing:
								<a
									href="/jobs/{state.currentJobId}"
									class="text-[var(--dash-primary)] hover:underline"
								>
									{state.currentJobTitle || `Job #${state.currentJobId}`}
								</a>
								({state.cycleProcessed + 1}/{state.cycleBatchSize})
							</span>
						{/if}
					</div>
				{:else}
					<p class="text-xs text-[var(--dash-text-muted)]">No recent session activity</p>
				{/if}
			</Card>
		{/if}

		<!-- Recent Errors -->
		<Card padding="responsive">
			<h3 class="mb-3 text-sm font-medium text-[var(--dash-text)]">
				Recent Errors
				{#if state && state.recentErrors?.length > 0}
					<span class="font-normal text-[var(--dash-text-muted)]"
						>({state.recentErrors.length})</span
					>
				{/if}
			</h3>

			{#if !state?.recentErrors?.length}
				<p class="py-4 text-center text-sm text-[var(--dash-text-muted)]">
					No errors in current session.
				</p>
			{:else}
				<div class="space-y-2">
					{#each [...state.recentErrors].reverse() as err}
						<div class="rounded-lg border border-[var(--dash-error)]/20 bg-[var(--dash-bg)] p-3">
							<div class="flex items-start justify-between gap-2">
								<div class="flex min-w-0 items-start gap-2">
									<FontAwesomeIcon
										icon={faExclamationTriangle}
										class="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--dash-error)]"
									/>
									<div class="min-w-0">
										<a
											href="/jobs/{err.jobId}"
											class="text-sm font-medium text-[var(--dash-primary)] hover:underline"
										>
											{err.jobTitle}
										</a>
										<span class="text-xs text-[var(--dash-text-muted)]">#{err.jobId}</span>
										<p class="mt-0.5 text-xs break-words text-[var(--dash-error)]">{err.message}</p>
									</div>
								</div>
								<span class="shrink-0 text-xs whitespace-nowrap text-[var(--dash-text-muted)]">
									{formatDateTime(err.timestamp)}
								</span>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</Card>
	{/if}
</div>
