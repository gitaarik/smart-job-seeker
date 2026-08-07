<script lang="ts">
	import type { PageData } from './$types';
	import { onMount, onDestroy } from 'svelte';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faCircle, faQuestionCircle, faRotate } from '@fortawesome/free-solid-svg-icons';
	import ScoreBadge from '../../components/ScoreBadge.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import { portalToBody } from '$lib/actions/portal';

	let { data }: { data: PageData } = $props();

	// Data state
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
		lastUpdated: string;
	}

	interface RecentMatch {
		id: number;
		job_id: number;
		score: number;
		recommendation: string;
		status: string;
		date_created: string | null;
		skill_match_percentage: number | null;
		match_summary: string | null;
		job: {
			id: number;
			title: string | null;
			company: string | null;
			office_location: string | null;
			job_types: string[] | null;
			work_location: string[] | null;
		} | null;
	}

	let totalJobs = $state(0);
	let matchedCount = $state(0);
	let noMatchCount = $state(0);
	let notRecommendedCount = $state(0);
	let ineligibleCount = $state(0);
	let unmatchedCount = $state(0);
	let matcherState = $state<MatcherState | null>(null);
	let matcherAlive = $state(false);
	let recentMatches = $state<RecentMatch[]>([]);
	let pollInterval: ReturnType<typeof setInterval> | null = null;
	let loading = $state(true);
	let showNoMatch = $state(false);
	let rematching = $state(false);
	let rematchType = $state<'no_match' | 'matched'>('no_match');
	let rematchDateFilter = $state('');
	let showRematchModal = $state(false);

	// Derived
	let evaluatedCount = $derived(matchedCount + noMatchCount);
	let evaluatedProgress = $derived(totalJobs > 0 ? (evaluatedCount / totalJobs) * 100 : 0);

	// Matcher status states
	let isProcessingThisProfile = $derived(
		matcherState?.active === true && matcherState?.profileId === data.profileId
	);
	let isProcessingJob = $derived(isProcessingThisProfile && matcherState?.currentJobId != null);
	let isWaitingForMatcher = $derived(!matcherState?.active && matcherAlive);

	async function loadStatus() {
		try {
			const params = new URLSearchParams({ profileId: String(data.profileId) });
			if (showNoMatch) params.set('includeIneligible', 'true');
			const response = await fetch(`/api/matcher/status?${params}`);
			if (response.ok) {
				const result = await response.json();
				totalJobs = result.totalJobs;
				matchedCount = result.matchedCount;
				noMatchCount = result.noMatchCount;
				notRecommendedCount = result.notRecommendedCount;
				ineligibleCount = result.ineligibleCount;
				unmatchedCount = result.unmatchedCount;
				matcherState = result.matcherState;
				matcherAlive = result.matcherAlive ?? false;
				recentMatches = result.recentMatches;
			}
		} catch (err) {
			console.error('Failed to load matcher status:', err);
		} finally {
			loading = false;
		}
	}

	function startPolling() {
		if (pollInterval) return;
		pollInterval = setInterval(loadStatus, 3000);
	}

	function stopPolling() {
		if (pollInterval) {
			clearInterval(pollInterval);
			pollInterval = null;
		}
	}

	function openRematchModal(type: 'no_match' | 'matched') {
		rematchType = type;
		rematchDateFilter = '1';
		showRematchModal = true;
	}

	async function doRematch() {
		if (rematching) return;
		showRematchModal = false;
		rematching = true;
		try {
			const body: Record<string, unknown> = {
				profileId: data.profileId,
				type: rematchType
			};
			if (rematchDateFilter) body.datePostedDays = rematchDateFilter;
			const response = await fetch('/api/matcher/rematch', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});
			if (response.ok) {
				await loadStatus();
			}
		} catch (err) {
			console.error('Failed to trigger rematch:', err);
		} finally {
			rematching = false;
		}
	}

	onMount(() => {
		loadStatus();
		startPolling();
	});

	onDestroy(() => {
		stopPolling();
	});

	function formatDate(date: string | null): string {
		if (!date) return 'Never';
		const d = new Date(date);
		return d.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
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
		return formatDate(date);
	}

	function getRecommendationLabel(rec: string): { text: string; class: string } {
		switch (rec) {
			case 'highly_recommend':
				return { text: 'Highly recommended', class: 'text-[var(--dash-success)]' };
			case 'recommend':
				return { text: 'Recommended', class: 'text-emerald-500' };
			case 'consider':
				return { text: 'Consider', class: 'text-[var(--dash-text-secondary)]' };
			case 'not_recommended':
				return { text: 'Not recommended', class: 'text-[var(--dash-warning)]' };
			case 'ineligible':
				return { text: 'No match', class: 'text-[var(--dash-error)]' };
			default:
				return { text: rec.replace(/_/g, ' '), class: 'text-[var(--dash-text-secondary)]' };
		}
	}
</script>

<svelte:head>
	<title>Match Progress - Job Import - Smart Job Seeker</title>
</svelte:head>

<div>
	{#if loading}
		<div class="flex items-center justify-center py-12">
			<Spinner size="w-6 h-6" color="var(--dash-primary)" />
		</div>
	{:else}
		<!-- Stats Overview -->
		<div class="mt-4 mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
			<!-- Matched (score > 0) -->
			<div class="rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)] p-4">
				<div class="mb-1 text-sm text-[var(--dash-text-secondary)]">Matched</div>
				<div class="text-2xl font-bold text-[var(--dash-success)]">{matchedCount}</div>
				<div class="text-xs text-[var(--dash-text-muted)]">scored by AI</div>
				{#if matchedCount > 0}
					<div class="mt-2 flex flex-wrap items-center gap-2">
						<a
							href="/jobs?minScore=1"
							class="inline-flex rounded border border-[var(--dash-border)] px-2 py-0.5 text-xs whitespace-nowrap text-[var(--dash-primary)] transition-colors hover:bg-[var(--dash-bg)]"
							>View</a
						>
						<button
							onclick={() => openRematchModal('matched')}
							disabled={rematching}
							class="inline-flex items-center gap-1 rounded border border-[var(--dash-border)] px-2 py-0.5 text-xs whitespace-nowrap text-[var(--dash-primary)] transition-colors hover:bg-[var(--dash-bg)] disabled:opacity-50"
						>
							{#if rematching}<Spinner size="w-3 h-3" />{:else}<FontAwesomeIcon
									icon={faRotate}
									class="h-3 w-3"
								/>{/if}
							Re-score
						</button>
					</div>
				{/if}
			</div>

			<!-- No Match (score = 0: not recommended + filtered out) -->
			<div class="rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)] p-4">
				<div class="mb-1 text-sm text-[var(--dash-text-secondary)]">No Match</div>
				<div class="text-2xl font-bold text-[var(--dash-error)]">{noMatchCount}</div>
				<div class="mt-1 space-y-0.5 text-xs text-[var(--dash-text-muted)]">
					{#if notRecommendedCount > 0}
						<div>{notRecommendedCount} not recommended</div>
					{/if}
					{#if ineligibleCount > 0}
						<div>{ineligibleCount} filtered out</div>
					{/if}
				</div>
				{#if noMatchCount > 0}
					<div class="mt-2 flex flex-wrap items-center gap-2">
						<a
							href="/jobs?minScore=0"
							class="inline-flex rounded border border-[var(--dash-border)] px-2 py-0.5 text-xs whitespace-nowrap text-[var(--dash-primary)] transition-colors hover:bg-[var(--dash-bg)]"
							>View</a
						>
						<button
							onclick={() => openRematchModal('no_match')}
							disabled={rematching}
							class="inline-flex items-center gap-1 rounded border border-[var(--dash-border)] px-2 py-0.5 text-xs whitespace-nowrap text-[var(--dash-primary)] transition-colors hover:bg-[var(--dash-bg)] disabled:opacity-50"
						>
							{#if rematching}<Spinner size="w-3 h-3" />{:else}<FontAwesomeIcon
									icon={faRotate}
									class="h-3 w-3"
								/>{/if}
							Re-score
						</button>
					</div>
				{/if}
			</div>

			<!-- Not yet matched -->
			<div class="rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)] p-4">
				<div class="mb-1 text-sm text-[var(--dash-text-secondary)]">Not Yet Scored</div>
				<div class="text-2xl font-bold text-[var(--dash-warning)]">{unmatchedCount}</div>
				<div class="text-xs text-[var(--dash-text-muted)]">waiting to be processed</div>
				{#if unmatchedCount > 0}
					<a
						href="/jobs?minScore=unmatched"
						class="mt-2 inline-flex rounded border border-[var(--dash-border)] px-2 py-0.5 text-xs whitespace-nowrap text-[var(--dash-primary)] transition-colors hover:bg-[var(--dash-bg)]"
						>View</a
					>
				{/if}
			</div>

			<!-- Total Jobs -->
			<div class="rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)] p-4">
				<div class="mb-1 text-sm text-[var(--dash-text-secondary)]">Total Jobs</div>
				<div class="text-2xl font-bold text-[var(--dash-text)]">{totalJobs}</div>
				<a
					href="/jobs"
					class="mt-2 inline-flex rounded border border-[var(--dash-border)] px-2 py-0.5 text-xs whitespace-nowrap text-[var(--dash-primary)] transition-colors hover:bg-[var(--dash-bg)]"
					>View</a
				>
			</div>
		</div>

		<!-- Progress Bar -->
		<div class="mb-6 rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)] p-4">
			<div class="mb-2 flex items-center justify-between">
				<span class="text-sm font-medium text-[var(--dash-text)]">Match Progress</span>
				<span class="text-sm text-[var(--dash-text-secondary)]">
					{evaluatedProgress.toFixed(0)}%
					{#if unmatchedCount > 0}
						<span class="text-[var(--dash-text-muted)]">({unmatchedCount} remaining)</span>
					{/if}
				</span>
			</div>
			<div class="h-3 w-full overflow-hidden rounded-full bg-[var(--dash-bg)]">
				<div
					class="h-full rounded-full transition-all duration-500 ease-out {evaluatedProgress >= 100
						? 'bg-[var(--dash-success)]'
						: 'bg-[var(--dash-primary)]'}"
					style="width: {evaluatedProgress}%"
				></div>
			</div>
			<div class="mt-1 text-xs text-[var(--dash-text-muted)]">
				{evaluatedCount} of {totalJobs} jobs processed
			</div>
		</div>

		<!-- Matcher Status -->
		<div class="mb-6 rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)] p-4">
			<h3 class="mb-3 text-sm font-medium text-[var(--dash-text)]">Matcher Status</h3>

			{#if isProcessingThisProfile}
				<div class="mb-3 flex items-center gap-2">
					<span class="relative flex h-3 w-3">
						<span
							class="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"
						></span>
						<span class="relative inline-flex h-3 w-3 rounded-full bg-green-500"></span>
					</span>
					<span class="text-sm text-[var(--dash-success)]">Matcher is running</span>
					{#if matcherState?.lastUpdated}
						<span class="text-xs text-[var(--dash-text-muted)]">
							(updated {formatRelativeTime(matcherState.lastUpdated)})
						</span>
					{/if}
				</div>

				{#if isProcessingJob}
					<!-- Currently Processing -->
					<div class="rounded-lg border border-[var(--dash-primary)]/20 bg-[var(--dash-bg)] p-3">
						<div class="mb-1 flex items-center gap-2">
							<Spinner size="w-4 h-4" color="var(--dash-primary)" />
							<span class="text-sm font-medium text-[var(--dash-text)]">Currently scoring:</span>
						</div>
						<div class="ml-6">
							<a
								href="/jobs/{matcherState?.currentJobId}"
								class="text-sm text-[var(--dash-primary)] hover:underline"
							>
								{matcherState?.currentJobTitle || 'Unknown job'}
							</a>
							{#if matcherState && matcherState.cycleBatchSize > 0}
								<div class="mt-0.5 text-xs text-[var(--dash-text-muted)]">
									Job {matcherState.cycleProcessed + 1} of {matcherState.cycleBatchSize} in this batch
								</div>
							{/if}
						</div>
					</div>
				{:else}
					<!-- Idle between cycles -->
					<div class="text-sm text-[var(--dash-text-secondary)]">Waiting for next batch...</div>
				{/if}

				<!-- Cycle stats -->
				{#if matcherState}
					<div class="mt-3 flex gap-4 text-xs text-[var(--dash-text-muted)]">
						<span>Cycles: {matcherState.totalCycles}</span>
						<span>Scored this session: {matcherState.totalMatched}</span>
					</div>
				{/if}
			{:else if isWaitingForMatcher}
				<div class="flex items-center gap-2">
					<span class="relative flex h-3 w-3">
						<span
							class="absolute inline-flex h-full w-full animate-ping rounded-full bg-yellow-400 opacity-75"
						></span>
						<span class="relative inline-flex h-3 w-3 rounded-full bg-yellow-500"></span>
					</span>
					<span class="text-sm text-[var(--dash-warning)]">Waiting for matcher</span>
				</div>
				<p class="mt-2 text-xs text-[var(--dash-text-muted)]">
					The matcher is currently processing another profile. Your jobs will be scored in the next
					cycle.
				</p>
			{:else if matcherAlive}
				<div class="flex items-center gap-2">
					<span class="relative flex h-3 w-3">
						<span
							class="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"
						></span>
						<span class="relative inline-flex h-3 w-3 rounded-full bg-green-500"></span>
					</span>
					<span class="text-sm text-[var(--dash-text-secondary)]"
						>Matcher is active, waiting for next cycle...</span
					>
				</div>
			{:else}
				<div class="flex items-center gap-2">
					<FontAwesomeIcon icon={faCircle} class="h-3 w-3 text-[var(--dash-text-muted)]" />
					<span class="text-sm text-[var(--dash-text-secondary)]">Matcher is not running</span>
				</div>
				<p class="mt-2 text-xs text-[var(--dash-text-muted)]">
					The matcher runs automatically in the background when the worker is active. It picks up
					new unscored jobs every 30 seconds.
				</p>
			{/if}
		</div>

		<!-- Recently Matched Jobs -->
		<div class="rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)] p-4">
			<div class="mb-3 flex items-center justify-between">
				<h3 class="text-sm font-medium text-[var(--dash-text)]">Recently Scored Jobs</h3>
				<div class="flex items-center gap-4">
					<label class="flex cursor-pointer items-center gap-1.5">
						<input
							type="checkbox"
							bind:checked={showNoMatch}
							onchange={loadStatus}
							class="rounded border-[var(--dash-border)] text-[var(--dash-primary)] focus:ring-[var(--dash-primary)]"
						/>
						<span class="text-xs text-[var(--dash-text-secondary)]">Show no-match</span>
					</label>
					<a href="/jobs/matches" class="text-xs text-[var(--dash-primary)] hover:underline"
						>View all matches</a
					>
				</div>
			</div>

			{#if recentMatches.length === 0}
				<p class="py-4 text-center text-sm text-[var(--dash-text-muted)]">
					No scored jobs yet. Jobs will appear here as they're scored against your profile.
				</p>
			{:else}
				<div class="max-h-[600px] space-y-2 overflow-y-auto">
					{#each recentMatches as match (match.id)}
						{@const rec = getRecommendationLabel(match.recommendation)}
						<a
							href="/jobs/{match.job_id}"
							class="flex items-center gap-3 rounded-lg bg-[var(--dash-bg)] p-3 transition-colors hover:bg-[var(--dash-bg)]/80"
						>
							<!-- Score Badge -->
							<ScoreBadge score={match.score} matched={match.recommendation !== null} size="sm" />

							<!-- Job Info -->
							<div class="min-w-0 flex-1">
								<div class="truncate text-sm font-medium text-[var(--dash-text)]">
									{match.job?.title || 'Untitled Job'}
								</div>
								<div class="flex items-center gap-2 text-xs text-[var(--dash-text-secondary)]">
									{#if match.job?.company}
										<span>{match.job.company}</span>
									{/if}
									{#if match.job?.office_location}
										<span class="text-[var(--dash-text-muted)]">
											{match.job.office_location}
										</span>
									{/if}
								</div>
								{#if match.match_summary}
									<div class="mt-0.5 truncate text-xs text-[var(--dash-text-muted)]">
										{match.match_summary}
									</div>
								{/if}
							</div>

							<!-- Recommendation + Time -->
							<div class="shrink-0 text-right">
								<div class="text-xs font-medium {rec.class}">{rec.text}</div>
								<div class="text-xs text-[var(--dash-text-muted)]">
									{formatRelativeTime(match.date_created)}
								</div>
							</div>
						</a>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</div>

{#if showRematchModal}
	<!-- Backdrop -->
	<div
		use:portalToBody
		class="fixed inset-0 z-40 bg-black/50"
		onclick={() => (showRematchModal = false)}
		role="button"
		tabindex="-1"
		aria-label="Close modal"
	></div>

	<!-- Rematch Modal -->
	<div
		use:portalToBody={{ onClose: () => (showRematchModal = false) }}
		class="fixed inset-0 z-50 flex items-center justify-center p-4"
		role="dialog"
		aria-modal="true"
		aria-labelledby="rematch-modal-title"
	>
		<div
			class="w-full max-w-md rounded-xl bg-[var(--dash-card)] p-6 shadow-xl"
			onclick={(e) => e.stopPropagation()}
			onkeydown={() => {}}
			role="document"
		>
			<div class="flex items-start gap-4">
				<div
					class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[var(--dash-primary)]/10"
				>
					<FontAwesomeIcon icon={faQuestionCircle} class="h-5 w-5 text-[var(--dash-primary)]" />
				</div>
				<div class="flex-1">
					<h3 id="rematch-modal-title" class="mb-2 text-lg font-semibold text-[var(--dash-text)]">
						{rematchType === 'matched' ? 'Re-score Matched Jobs' : 'Re-score Unmatched Jobs'}
					</h3>
					<p class="mb-4 text-sm text-[var(--dash-text-secondary)]">
						{rematchType === 'matched'
							? 'This will re-run AI scoring for jobs that currently have a score. Existing scores will be replaced.'
							: 'This will re-run AI scoring for jobs that currently have no match.'}
						This uses AI usage and may take a while.
					</p>

					<label class="mb-1.5 block text-sm font-medium text-[var(--dash-text)]">
						Date posted filter
					</label>
					<select
						bind:value={rematchDateFilter}
						class="w-full rounded-lg border border-[var(--dash-border)] bg-[var(--dash-bg)] px-3 py-2 text-sm text-[var(--dash-text)]"
					>
						<option value="">All time</option>
						<option value="1">Last 24 hours</option>
						<option value="3">Last 3 days</option>
						<option value="7">Last 7 days</option>
						<option value="30">Last 30 days</option>
						<option value="90">Last 3 months</option>
					</select>
				</div>
			</div>

			<div class="mt-6 flex justify-end gap-3">
				<button
					type="button"
					onclick={() => (showRematchModal = false)}
					class="rounded-lg border border-[var(--dash-border)] px-4 py-2 text-[var(--dash-text)] transition-colors hover:bg-[var(--dash-bg)]"
				>
					Cancel
				</button>
				<button
					type="button"
					onclick={doRematch}
					class="rounded-lg bg-[var(--dash-primary)] px-4 py-2 text-white transition-colors hover:opacity-90"
				>
					Re-score
				</button>
			</div>
		</div>
	</div>
{/if}
