<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faRobot, faPlay, faChevronRight } from '@fortawesome/free-solid-svg-icons';
	import SectionHeader from '../../profile/components/SectionHeader.svelte';
	import Card from '../../components/Card.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import { searchTaskDisplayName } from '$lib/format';
	import {
		type Profile,
		type SearchTask,
		type SessionSummary,
		DEFAULT_SYSTEM_PROMPT,
		statusColor,
		statusDot,
		stageLabel,
		stageColor,
		formatTime,
		progressPct
	} from './shared';

	let { data } = $props();

	let sessions = $state<SessionSummary[]>([]);
	let loading = $state(true);
	let errorMsg = $state('');
	let pollInterval: ReturnType<typeof setInterval> | null = null;

	// Create form state
	let showCreateForm = $state(false);
	let createUserId = $state<string | null>(null);
	let createProfileId = $state<number | null>(null);
	let createSearchTaskId = $state<number | null>(null);
	let createMaxIterations = $state(10);
	let createGoal = $state('');
	let createSystemPrompt = $state(DEFAULT_SYSTEM_PROMPT);
	let createRunFirst = $state(false);
	let creating = $state(false);

	let tasksForUser = $derived(
		createUserId
			? (data.searchTasks as SearchTask[]).filter((t) => t.userId === createUserId)
			: (data.searchTasks as SearchTask[])
	);

	let filteredProfiles = $derived(
		createUserId
			? (data.profiles as Profile[]).filter((p) => p.userId === createUserId)
			: (data.profiles as Profile[])
	);

	let filteredSearchTasks = $derived(
		createProfileId ? tasksForUser.filter((t) => t.profileId === createProfileId) : tasksForUser
	);

	async function loadSessions() {
		try {
			const response = await fetch('/api/admin/scraper-agent');
			if (response.ok) {
				const result = await response.json();
				if (JSON.stringify(result.sessions) !== JSON.stringify(sessions)) {
					sessions = result.sessions;
				}
				errorMsg = '';
			} else {
				errorMsg = 'Failed to load sessions';
			}
		} catch {
			errorMsg = 'Failed to load sessions';
		} finally {
			loading = false;
		}
	}

	async function createSession() {
		if (!createSearchTaskId) return;
		creating = true;
		try {
			const response = await fetch('/api/admin/scraper-agent', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					searchTaskId: createSearchTaskId,
					maxIterations: createMaxIterations,
					goal: createGoal,
					systemPrompt: createSystemPrompt || undefined,
					runFirst: createRunFirst
				})
			});
			if (response.ok) {
				const result = await response.json();
				goto(`/admin/scraper-agent/${result.id}`);
			} else {
				const text = await response.text();
				try {
					const err = JSON.parse(text);
					errorMsg = err.message || text;
				} catch {
					errorMsg = text;
				}
			}
		} catch {
			errorMsg = 'Failed to create session';
		} finally {
			creating = false;
		}
	}

	// Handle retry=SESSION_ID from detail page
	async function handleRetryParam() {
		const retryId = $page.url.searchParams.get('retry');
		if (!retryId) return;

		// Clear the param from URL
		const url = new URL($page.url);
		url.searchParams.delete('retry');
		history.replaceState({}, '', url.pathname);

		try {
			const response = await fetch(`/api/admin/scraper-agent/${retryId}`);
			if (response.ok) {
				const result = await response.json();
				const session = result.session;
				const task = (data.searchTasks as SearchTask[]).find((t) => t.id === session.searchTaskId);
				createUserId = task?.userId ?? null;
				createProfileId = task?.profileId ?? null;
				createSearchTaskId = session.searchTaskId;
				createMaxIterations = session.maxIterations;
				createGoal = session.goal;
				createSystemPrompt = session.systemPrompt || DEFAULT_SYSTEM_PROMPT;
				createRunFirst = session.runFirst;
				showCreateForm = true;
			}
		} catch {
			// Ignore - just don't pre-fill
		}
	}

	onMount(() => {
		loadSessions();
		handleRetryParam();
		pollInterval = setInterval(loadSessions, 5000);
	});

	onDestroy(() => {
		if (pollInterval) clearInterval(pollInterval);
	});
</script>

<div class="space-y-6">
	<SectionHeader
		title="Scraper Agent"
		icon={faRobot}
		showAddButton={!showCreateForm}
		addLabel="New Session"
		onAdd={() => (showCreateForm = true)}
	/>

	<!-- Create Form -->
	{#if showCreateForm}
		<Card padding="responsive">
			<div class="space-y-4">
				<h3 class="text-sm font-medium text-[var(--dash-text)]">Create New Session</h3>

				<div class="grid gap-4 sm:grid-cols-2">
					<div>
						<label
							for="user-filter"
							class="mb-1 block text-xs font-medium text-[var(--dash-text-secondary)]"
						>
							User
						</label>
						<select
							id="user-filter"
							bind:value={createUserId}
							onchange={() => {
								createProfileId = null;
								createSearchTaskId = null;
							}}
							class="w-full rounded-lg border border-[var(--dash-border)] bg-[var(--dash-bg)] px-3 py-2 text-sm text-[var(--dash-text)]"
						>
							<option value={null}>All users</option>
							{#each data.users as user}
								<option value={user.id}>{user.name}</option>
							{/each}
						</select>
					</div>

					<div>
						<label
							for="profile-filter"
							class="mb-1 block text-xs font-medium text-[var(--dash-text-secondary)]"
						>
							Profile
						</label>
						<select
							id="profile-filter"
							bind:value={createProfileId}
							onchange={() => (createSearchTaskId = null)}
							class="w-full rounded-lg border border-[var(--dash-border)] bg-[var(--dash-bg)] px-3 py-2 text-sm text-[var(--dash-text)]"
						>
							<option value={null}>All profiles</option>
							{#each filteredProfiles as profile}
								<option value={profile.id}>
									{profile.name}{createUserId ? '' : ` (${profile.userName || 'No user'})`}
								</option>
							{/each}
						</select>
					</div>

					<div>
						<label
							for="search-task"
							class="mb-1 block text-xs font-medium text-[var(--dash-text-secondary)]"
						>
							Search Task
						</label>
						<select
							id="search-task"
							bind:value={createSearchTaskId}
							class="w-full rounded-lg border border-[var(--dash-border)] bg-[var(--dash-bg)] px-3 py-2 text-sm text-[var(--dash-text)]"
						>
							<option value={null}>Select a search task...</option>
							{#each filteredSearchTasks as task}
								<option value={task.id}>
									{searchTaskDisplayName(task.platformName, task.note)}{createProfileId
										? ''
										: ` — ${task.profileName ?? 'No profile'}`}{createUserId
										? ''
										: ` (${task.userName || 'No user'})`}
								</option>
							{/each}
						</select>
					</div>

					<div>
						<label
							for="max-iter"
							class="mb-1 block text-xs font-medium text-[var(--dash-text-secondary)]"
						>
							Max Iterations
						</label>
						<input
							id="max-iter"
							type="number"
							min="1"
							max="50"
							bind:value={createMaxIterations}
							class="w-full max-w-32 rounded-lg border border-[var(--dash-border)] bg-[var(--dash-bg)] px-3 py-2 text-sm text-[var(--dash-text)]"
						/>
					</div>
				</div>

				<label class="flex cursor-pointer items-center gap-2">
					<input
						type="checkbox"
						bind:checked={createRunFirst}
						class="rounded border-[var(--dash-border)] text-[var(--dash-primary)]"
					/>
					<span class="text-xs text-[var(--dash-text-secondary)]"> Run initial scrape first </span>
					<span class="text-xs text-[var(--dash-text-muted)]">
						— runs a baseline scrape before Claude starts analyzing
					</span>
				</label>

				<div>
					<label
						for="goal"
						class="mb-1 block text-xs font-medium text-[var(--dash-text-secondary)]"
					>
						Goal
						<span class="font-normal text-[var(--dash-text-muted)]"
							>— what should the results look like?</span
						>
					</label>
					<textarea
						id="goal"
						bind:value={createGoal}
						rows="4"
						placeholder="e.g. focus on fixing the job description extraction, many jobs have empty descriptions. Also make sure pagination works to scrape at least 3 pages."
						class="min-h-[6rem] w-full rounded-lg border border-[var(--dash-border)] bg-[var(--dash-bg)] px-3 py-2 text-sm text-[var(--dash-text)]"
					></textarea>
				</div>

				<div>
					<div class="mb-1 flex items-center justify-between">
						<label
							for="system-prompt"
							class="block text-xs font-medium text-[var(--dash-text-secondary)]"
						>
							System Prompt
						</label>
						{#if createSystemPrompt !== DEFAULT_SYSTEM_PROMPT}
							<button
								onclick={() => (createSystemPrompt = DEFAULT_SYSTEM_PROMPT)}
								class="text-xs text-[var(--dash-primary)] hover:underline"
							>
								Reset to default
							</button>
						{/if}
					</div>
					<textarea
						id="system-prompt"
						bind:value={createSystemPrompt}
						rows="10"
						class="min-h-[10rem] w-full rounded-lg border border-[var(--dash-border)] bg-[var(--dash-bg)] px-3 py-2 font-mono text-sm text-xs leading-relaxed text-[var(--dash-text)]"
					></textarea>
				</div>

				<div class="flex justify-end gap-2">
					<button
						onclick={() => (showCreateForm = false)}
						class="rounded-lg bg-[var(--dash-bg)] px-3 py-1.5 text-xs text-[var(--dash-text-secondary)] transition-colors hover:bg-[var(--dash-border)]"
					>
						Cancel
					</button>
					<button
						onclick={createSession}
						disabled={!createSearchTaskId || !createGoal.trim() || creating}
						class="flex items-center gap-1.5 rounded-lg bg-[var(--dash-primary)] px-3 py-1.5 text-xs text-white transition-colors hover:bg-[var(--dash-primary)]/90 disabled:opacity-50"
					>
						{#if creating}
							<Spinner size="w-3 h-3" />
						{:else}
							<FontAwesomeIcon icon={faPlay} class="h-3 w-3" />
						{/if}
						Start Session
					</button>
				</div>
			</div>
		</Card>
	{/if}

	{#if loading}
		<div class="flex items-center justify-center py-12">
			<Spinner size="w-6 h-6" color="var(--dash-primary)" />
		</div>
	{:else if errorMsg && sessions.length === 0}
		<Card padding="responsive">
			<p class="text-sm text-[var(--dash-error)]">{errorMsg}</p>
		</Card>
	{:else if sessions.length === 0}
		<Card padding="responsive">
			<p class="py-4 text-center text-sm text-[var(--dash-text-muted)]">
				No scraper agent sessions yet. Create one to start improving a scraper automatically.
			</p>
		</Card>
	{:else}
		{#if errorMsg}
			<Card padding="responsive">
				<p class="text-sm text-[var(--dash-error)]">{errorMsg}</p>
			</Card>
		{/if}
		<div class="space-y-2">
			{#each sessions as session (session.id)}
				<a href="/admin/scraper-agent/{session.id}" class="block">
					<Card
						padding="responsive"
						class="transition-colors hover:border-[var(--dash-primary)]/40"
					>
						<div class="mb-1 flex items-center gap-2">
							{#if session.status === 'active'}
								<span class="relative flex h-2 w-2 flex-shrink-0">
									<span
										class="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"
									></span>
									<span class="relative inline-flex h-2 w-2 rounded-full bg-green-500"></span>
								</span>
							{:else}
								<span class="h-2 w-2 flex-shrink-0 rounded-full {statusDot(session.status)}"></span>
							{/if}
							<span class="text-xs font-medium {statusColor(session.status)} uppercase"
								>{session.status}</span
							>
							<span class="truncate text-sm font-medium text-[var(--dash-text)]">
								{session.searchTaskName}
							</span>
							<FontAwesomeIcon
								icon={faChevronRight}
								class="ml-auto h-3 w-3 flex-shrink-0 text-[var(--dash-text-muted)]"
							/>
						</div>

						<!-- Progress -->
						<div class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--dash-text-secondary)]">
							<span>
								Iteration {session.currentIteration}/{session.maxIterations}
							</span>
							{#if session.status === 'active' && session.latestStage && session.latestStage !== 'done'}
								<span class={stageColor(session.latestStage)}>
									{stageLabel(session.latestStage)}
								</span>
							{/if}
							{#if session.latestSuccessPct !== null}
								<span class="text-[var(--dash-text-muted)]">
									{session.latestSuccessPct.toFixed(1)}%
								</span>
							{/if}
							{#if session.latestGoalMet === true}
								<span class="text-green-600">Goal met</span>
							{:else if session.latestGoalMet === false}
								<span class="text-amber-600">Goal not met</span>
							{/if}
							<span>{formatTime(session.createdAt)}</span>
						</div>

						<!-- Progress bar -->
						{#if session.currentIteration > 0}
							<div class="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--dash-border)]">
								<div
									class="h-full rounded-full transition-all duration-300 {session.status ===
									'completed'
										? 'bg-[var(--dash-primary)]'
										: session.status === 'failed'
											? 'bg-[var(--dash-error)]'
											: 'bg-green-500'}"
									style="width: {progressPct(session)}%"
								></div>
							</div>
						{/if}

						<!-- Error message -->
						{#if session.errorMessage && session.status !== 'active'}
							<p
								class="mt-1 truncate text-xs text-[var(--dash-text-muted)]"
								title={session.errorMessage}
							>
								{session.errorMessage}
							</p>
						{/if}
					</Card>
				</a>
			{/each}
		</div>
	{/if}
</div>
