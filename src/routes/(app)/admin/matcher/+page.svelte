<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { resolve } from '$app/paths';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faChartBar, faCircle } from '@fortawesome/free-solid-svg-icons';
	import SectionHeader from '../../profile/components/SectionHeader.svelte';
	import Card from '../../components/Card.svelte';
	import Spinner from '$lib/components/Spinner.svelte';

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
		recentErrors: { jobId: number; jobTitle: string; message: string; timestamp: string }[];
		backoff?: {
			until: string | null;
			reason: string | null;
			benchedJobs: number;
		} | null;
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

	let matcherStates = $state<MatcherState[]>([]);
	let matcherAlive = $state(false);
	let profiles = $state<ProfileInfo[]>([]);
	let pollInterval: ReturnType<typeof setInterval> | null = null;
	let loading = $state(true);
	let error = $state('');

	async function loadStatus() {
		try {
			const response = await fetch('/api/admin/matcher/status');
			if (response.ok) {
				const result = await response.json();
				matcherStates = result.matcherStates;
				matcherAlive = result.matcherAlive;
				profiles = result.profiles;
				error = '';
			} else {
				error = 'Failed to load matcher status';
			}
		} catch (err) {
			console.error('Failed to load admin matcher status:', err);
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
		if (pollInterval) {
			clearInterval(pollInterval);
		}
	});

	function getProfileState(profileId: number): MatcherState | undefined {
		return matcherStates.find((s) => s.profileId === profileId);
	}

	/**
	 * True only while the pause is still in force. `backoff` is also set when
	 * nothing is paused but some jobs are benched, and those are different
	 * things: one stops the profile, the other stops a handful of jobs.
	 */
	function isPaused(state: MatcherState | undefined): boolean {
		const until = state?.backoff?.until;
		return !!until && new Date(until).getTime() > Date.now();
	}

	/** "2m", "45s" — how much of the pause is left. */
	function remaining(until: string | null | undefined): string {
		if (!until) return '';
		const secs = Math.max(0, Math.ceil((new Date(until).getTime() - Date.now()) / 1000));
		return secs >= 60 ? `${Math.ceil(secs / 60)}m` : `${secs}s`;
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
</script>

<div class="space-y-6">
	<SectionHeader title="Matcher Status" icon={faChartBar} />

	{#if loading}
		<div class="flex items-center justify-center py-12">
			<Spinner size="w-6 h-6" color="var(--dash-primary)" />
		</div>
	{:else if error}
		<Card padding="responsive">
			<p class="text-sm text-[var(--dash-error)]">{error}</p>
		</Card>
	{:else}
		<!-- Global Status -->
		<Card padding="responsive">
			<div class="flex items-center gap-3">
				{#if matcherAlive}
					<span class="relative flex h-3 w-3">
						<span
							class="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"
						></span>
						<span class="relative inline-flex h-3 w-3 rounded-full bg-green-500"></span>
					</span>
					<span class="text-sm font-medium text-[var(--dash-success)]">Worker is running</span>
				{:else}
					<FontAwesomeIcon icon={faCircle} class="h-3 w-3 text-[var(--dash-text-muted)]" />
					<span class="text-sm font-medium text-[var(--dash-text-secondary)]"
						>Worker is not running</span
					>
				{/if}
				<span class="text-xs text-[var(--dash-text-muted)]">
					{profiles.length} profile{profiles.length === 1 ? '' : 's'} with match config
				</span>
			</div>
		</Card>

		<!-- Per-Profile Status -->
		{#if profiles.length === 0}
			<Card padding="responsive">
				<p class="py-4 text-center text-sm text-[var(--dash-text-muted)]">
					No profiles have a match config configured.
				</p>
			</Card>
		{:else}
			<div class="space-y-3">
				{#each profiles as profile (profile.id)}
					{@const state = getProfileState(profile.id)}
					{@const evaluated = profile.matchedCount + profile.noMatchCount}
					<a
						href={resolve('/(app)/admin/matcher/[profileId]', { profileId: String(profile.id) })}
						class="block no-underline"
					>
						<Card
							padding="responsive"
							class="cursor-pointer transition-colors hover:border-[var(--dash-primary)]/50"
						>
							<div class="mb-2 flex items-center justify-between">
								<div class="flex items-center gap-2">
									{#if isPaused(state)}
										<span
											class="relative flex h-2.5 w-2.5"
											title="Paused after an AI provider failure"
										>
											<span class="relative inline-flex h-2.5 w-2.5 rounded-full bg-orange-500"
											></span>
										</span>
									{:else if state?.active && state?.currentJobId}
										<span class="relative flex h-2.5 w-2.5">
											<span
												class="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"
											></span>
											<span class="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500"
											></span>
										</span>
									{:else if state?.active}
										<span class="relative flex h-2.5 w-2.5">
											<span class="relative inline-flex h-2.5 w-2.5 rounded-full bg-yellow-500"
											></span>
										</span>
									{:else}
										<span class="relative flex h-2.5 w-2.5">
											<span class="relative inline-flex h-2.5 w-2.5 rounded-full bg-gray-400"
											></span>
										</span>
									{/if}
									<span class="text-sm font-medium text-[var(--dash-text)]">{profile.name}</span>
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
							<div
								class="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--dash-text-secondary)]"
							>
								<span>{profile.totalJobs} jobs</span>
								<span class="text-[var(--dash-success)]">{profile.matchedCount} matched</span>
								<span class="text-[var(--dash-error)]">{profile.noMatchCount} no match</span>
								<span class="text-[var(--dash-text-muted)]"
									>{profile.unmatchedCount} unevaluated</span
								>
							</div>

							<!-- Progress bar -->
							{#if profile.totalJobs > 0}
								<div class="mb-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--dash-bg)]">
									<div
										class="h-full rounded-full transition-all duration-500 {evaluated >=
										profile.totalJobs
											? 'bg-[var(--dash-success)]'
											: 'bg-[var(--dash-primary)]'}"
										style="width: {Math.min(100, (evaluated / profile.totalJobs) * 100)}%"
									></div>
								</div>
							{/if}

							<!-- Worker state row -->
							{#if state}
								{#if isPaused(state)}
									<p class="mb-1 text-xs text-orange-600 dark:text-orange-400">
										Paused {remaining(state.backoff?.until)} — AI provider unavailable{state.backoff
											?.reason
											? `: ${state.backoff.reason}`
											: ''}
									</p>
								{/if}
								<div class="flex flex-wrap gap-x-6 gap-y-1 text-xs text-[var(--dash-text-muted)]">
									<span>Cycles: {state.totalCycles}</span>
									<span>Session: {state.totalMatched} matched</span>
									{#if state.totalFailed > 0}
										<span class="text-[var(--dash-error)]">{state.totalFailed} failed</span>
									{/if}
									{#if state.backoff?.benchedJobs}
										<span title="Failed repeatedly; left out of the batch for an hour">
											{state.backoff.benchedJobs} benched
										</span>
									{/if}
									{#if state.currentJobId}
										<span>
											Processing: {state.currentJobTitle || `Job #${state.currentJobId}`}
											({state.cycleProcessed + 1}/{state.cycleBatchSize})
										</span>
									{/if}
								</div>
							{:else}
								<p class="text-xs text-[var(--dash-text-muted)]">
									{matcherAlive ? 'Waiting for next cycle' : 'No recent activity'}
								</p>
							{/if}
						</Card>
					</a>
				{/each}
			</div>
		{/if}
	{/if}
</div>
