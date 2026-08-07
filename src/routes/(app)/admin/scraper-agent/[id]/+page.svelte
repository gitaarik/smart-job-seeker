<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faRobot,
		faPlay,
		faPause,
		faStop,
		faRotateRight,
		faCodeCommit,
		faExternalLinkAlt
	} from '@fortawesome/free-solid-svg-icons';
	import SectionHeader from '../../../profile/components/SectionHeader.svelte';
	import Card from '../../../components/Card.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import {
		type SessionDetail,
		type Iteration,
		statusColor,
		statusDot,
		stageLabel,
		stageColor,
		formatTime,
		progressPct,
		isActive
	} from '../shared';

	let { data } = $props();

	let session = $state<SessionDetail | null>(null);
	let iterations = $state<Iteration[]>([]);
	let loading = $state(true);
	let errorMsg = $state('');
	let pollInterval: ReturnType<typeof setInterval> | null = null;
	let actionInProgress = $state<string | null>(null);
	let confirmCommit = $state(false);
	let committing = $state(false);

	// Hint input
	let hintInput = $state('');
	let hintSending = $state(false);

	async function loadSession() {
		try {
			const response = await fetch(`/api/admin/scraper-agent/${data.sessionId}`);
			if (response.ok) {
				const result = await response.json();
				if (JSON.stringify(result.session) !== JSON.stringify(session)) {
					session = result.session;
				}
				if (JSON.stringify(result.iterations) !== JSON.stringify(iterations)) {
					iterations = result.iterations;
				}
				errorMsg = '';
			} else if (response.status === 404) {
				errorMsg = 'Session not found';
			} else {
				errorMsg = 'Failed to load session';
			}
		} catch {
			errorMsg = 'Failed to load session';
		} finally {
			loading = false;
		}
	}

	async function performAction(action: 'pause' | 'cancel' | 'resume') {
		actionInProgress = action;
		try {
			const response = await fetch(`/api/admin/scraper-agent/${data.sessionId}/${action}`, {
				method: 'POST'
			});
			if (!response.ok) {
				console.error(`Action ${action} failed:`, await response.text());
			}
			await loadSession();
		} catch {
			console.error(`Action ${action} failed`);
		} finally {
			actionInProgress = null;
		}
	}

	async function skipRun() {
		try {
			const response = await fetch(`/api/admin/scraper-agent/${data.sessionId}/skip-run`, {
				method: 'POST'
			});
			if (response.ok) {
				await loadSession();
			}
		} catch {
			// Ignore
		}
	}

	async function updateMaxIterations(value: number) {
		try {
			const response = await fetch(`/api/admin/scraper-agent/${data.sessionId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ maxIterations: value })
			});
			if (response.ok) {
				await loadSession();
			}
		} catch {
			// Ignore
		}
	}

	async function submitHint() {
		const hint = hintInput.trim() || null;
		hintSending = true;
		try {
			const response = await fetch(`/api/admin/scraper-agent/${data.sessionId}/hint`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ hint })
			});
			if (response.ok) {
				hintInput = '';
				await loadSession();
			}
		} catch {
			// Ignore
		} finally {
			hintSending = false;
		}
	}

	async function commitAndPush() {
		committing = true;
		try {
			const response = await fetch(`/api/admin/scraper-agent/${data.sessionId}/commit`, {
				method: 'POST'
			});
			const result = await response.json();
			if (!response.ok) {
				errorMsg = result.message || 'Commit failed';
			} else if (!result.committed) {
				errorMsg = result.message;
			}
		} catch {
			errorMsg = 'Commit & push failed';
		} finally {
			committing = false;
			confirmCommit = false;
		}
	}

	function retrySession() {
		if (!session) return;
		goto(`/admin/scraper-agent?retry=${data.sessionId}`);
	}

	// Derived: latest stage for header display
	let latestStage = $derived(
		iterations.length > 0 ? iterations[iterations.length - 1].stage : null
	);

	let latestSuccessPct = $derived(
		iterations.length > 0 ? iterations[iterations.length - 1].successPct : null
	);

	onMount(() => {
		loadSession();
		pollInterval = setInterval(loadSession, 5000);
	});

	onDestroy(() => {
		if (pollInterval) clearInterval(pollInterval);
	});
</script>

<div class="space-y-6">
	<SectionHeader
		title="Scraper Agent Session"
		icon={faRobot}
		backHref="/admin/scraper-agent"
		backLabel="All Sessions"
	/>

	{#if loading}
		<div class="flex items-center justify-center py-12">
			<Spinner size="w-6 h-6" color="var(--dash-primary)" />
		</div>
	{:else if errorMsg && !session}
		<Card padding="responsive">
			<p class="text-sm text-[var(--dash-error)]">{errorMsg}</p>
		</Card>
	{:else if session}
		{#if errorMsg}
			<Card padding="responsive">
				<p class="text-sm text-[var(--dash-error)]">{errorMsg}</p>
			</Card>
		{/if}

		<!-- Session overview -->
		<Card padding="responsive">
			<!-- Status + search task link -->
			<div class="mb-4 flex items-start justify-between gap-4">
				<div class="min-w-0">
					<div class="mb-1 flex items-center gap-2">
						{#if session.status === 'active'}
							<span class="relative flex h-2.5 w-2.5 flex-shrink-0">
								<span
									class="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"
								></span>
								<span class="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500"></span>
							</span>
						{:else}
							<span class="h-2.5 w-2.5 flex-shrink-0 rounded-full {statusDot(session.status)}"
							></span>
						{/if}
						<span class="text-sm font-semibold {statusColor(session.status)} uppercase"
							>{session.status}</span
						>
						{#if session.status === 'active' && latestStage && latestStage !== 'done'}
							<span class="text-xs {stageColor(latestStage)}">
								— {stageLabel(latestStage)}
							</span>
						{/if}
					</div>
					<a
						href="/jobs/import/tasks/{session.searchTaskId}"
						class="inline-flex items-center gap-1.5 text-sm text-[var(--dash-primary)] hover:underline"
					>
						{session.searchTaskName}
						<FontAwesomeIcon icon={faExternalLinkAlt} class="h-3 w-3 opacity-60" />
					</a>
				</div>

				<!-- Action buttons -->
				<div class="flex flex-shrink-0 flex-wrap items-center gap-2">
					{#if session.status === 'active'}
						<button
							onclick={() => performAction('pause')}
							disabled={!!actionInProgress}
							class="flex items-center gap-1.5 rounded-lg bg-amber-500/10 px-3 py-1.5 text-xs text-amber-600 transition-colors hover:bg-amber-500/20 disabled:opacity-50"
						>
							{#if actionInProgress === 'pause'}
								<Spinner size="w-3 h-3" />
							{:else}
								<FontAwesomeIcon icon={faPause} class="h-3 w-3" />
							{/if}
							Pause
						</button>
						<button
							onclick={() => performAction('cancel')}
							disabled={!!actionInProgress}
							class="flex items-center gap-1.5 rounded-lg bg-[var(--dash-error)]/10 px-3 py-1.5 text-xs text-[var(--dash-error)] transition-colors hover:bg-[var(--dash-error)]/20 disabled:opacity-50"
						>
							{#if actionInProgress === 'cancel'}
								<Spinner size="w-3 h-3" />
							{:else}
								<FontAwesomeIcon icon={faStop} class="h-3 w-3" />
							{/if}
							Cancel
						</button>
					{:else if session.status === 'paused'}
						<button
							onclick={() => performAction('resume')}
							disabled={!!actionInProgress}
							class="flex items-center gap-1.5 rounded-lg bg-[var(--dash-primary)]/10 px-3 py-1.5 text-xs text-[var(--dash-primary)] transition-colors hover:bg-[var(--dash-primary)]/20 disabled:opacity-50"
						>
							{#if actionInProgress === 'resume'}
								<Spinner size="w-3 h-3" />
							{:else}
								<FontAwesomeIcon icon={faPlay} class="h-3 w-3" />
							{/if}
							Resume
						</button>
						<button
							onclick={() => performAction('cancel')}
							disabled={!!actionInProgress}
							class="flex items-center gap-1.5 rounded-lg bg-[var(--dash-error)]/10 px-3 py-1.5 text-xs text-[var(--dash-error)] transition-colors hover:bg-[var(--dash-error)]/20 disabled:opacity-50"
						>
							{#if actionInProgress === 'cancel'}
								<Spinner size="w-3 h-3" />
							{:else}
								<FontAwesomeIcon icon={faStop} class="h-3 w-3" />
							{/if}
							Cancel
						</button>
					{/if}
					{#if ['completed', 'failed', 'cancelled'].includes(session.status)}
						{#if session.status === 'completed'}
							{#if confirmCommit}
								<button
									onclick={() => commitAndPush()}
									disabled={committing}
									class="flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs text-white transition-colors hover:bg-green-700 disabled:opacity-50"
								>
									{#if committing}
										<Spinner size="w-3 h-3" />
									{:else}
										<FontAwesomeIcon icon={faCodeCommit} class="h-3 w-3" />
									{/if}
									Confirm push
								</button>
								<button
									onclick={() => (confirmCommit = false)}
									class="rounded-lg bg-[var(--dash-bg)] px-3 py-1.5 text-xs text-[var(--dash-text-muted)] transition-colors hover:bg-[var(--dash-border)]"
								>
									Cancel
								</button>
							{:else}
								<button
									onclick={() => (confirmCommit = true)}
									class="flex items-center gap-1.5 rounded-lg bg-green-500/10 px-3 py-1.5 text-xs text-green-600 transition-colors hover:bg-green-500/20"
								>
									<FontAwesomeIcon icon={faCodeCommit} class="h-3 w-3" />
									Commit & push
								</button>
							{/if}
						{/if}
						<button
							onclick={retrySession}
							class="flex items-center gap-1.5 rounded-lg bg-[var(--dash-primary)]/10 px-3 py-1.5 text-xs text-[var(--dash-primary)] transition-colors hover:bg-[var(--dash-primary)]/20"
						>
							<FontAwesomeIcon icon={faRotateRight} class="h-3 w-3" />
							Retry
						</button>
					{/if}
				</div>
			</div>

			<!-- Progress bar -->
			{#if session.currentIteration > 0}
				<div class="mb-4">
					<div
						class="mb-1 flex items-center justify-between text-xs text-[var(--dash-text-secondary)]"
					>
						<span>Iteration {session.currentIteration} / {session.maxIterations}</span>
						{#if latestSuccessPct !== null}
							<span>{latestSuccessPct.toFixed(1)}% success</span>
						{/if}
					</div>
					<div class="h-2 overflow-hidden rounded-full bg-[var(--dash-border)]">
						<div
							class="h-full rounded-full transition-all duration-300 {session.status === 'completed'
								? 'bg-[var(--dash-primary)]'
								: session.status === 'failed'
									? 'bg-[var(--dash-error)]'
									: 'bg-green-500'}"
							style="width: {progressPct(session)}%"
						></div>
					</div>
				</div>
			{/if}

			<!-- Error message -->
			{#if session.errorMessage && session.status !== 'active'}
				<div
					class="mb-4 rounded-lg border border-[var(--dash-error)]/20 bg-[var(--dash-error)]/5 p-3"
				>
					<p class="text-sm text-[var(--dash-error)]">{session.errorMessage}</p>
				</div>
			{/if}

			<!-- Blocked by manual intervention -->
			{#if latestStage === 'blocked'}
				<div class="mb-4 rounded-lg border border-orange-500/30 bg-orange-500/10 p-3">
					<p class="mb-1 text-xs font-medium text-orange-700">Run is waiting for manual action</p>
					{#if session.blockedMessage}
						<p class="mb-2 text-sm text-[var(--dash-text)]">{session.blockedMessage}</p>
					{/if}
					<p class="mb-2 text-xs text-[var(--dash-text-muted)]">
						You can complete the action manually and let the run continue, or skip the run to move
						on to evaluation.
					</p>
					<button
						onclick={skipRun}
						class="flex items-center gap-1.5 rounded-lg bg-orange-500/10 px-3 py-1.5 text-xs text-orange-600 transition-colors hover:bg-orange-500/20"
					>
						Skip run
					</button>
				</div>
			{/if}

			<!-- Agent question (needs input) -->
			{#if session.needsInput}
				<div class="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
					<p class="mb-1 text-xs font-medium text-amber-700">Agent is asking for input:</p>
					<p class="text-sm text-[var(--dash-text)]">{session.needsInput}</p>
				</div>
			{/if}

			<!-- Hint input for active/paused sessions -->
			{#if ['active', 'paused'].includes(session.status)}
				{@const currentHint = hintInput || session.pendingHint || ''}
				{@const hintChanged = currentHint.trim() !== (session.pendingHint ?? '').trim()}
				<div class="mb-4">
					<div class="flex items-end gap-2">
						<textarea
							placeholder={session.needsInput
								? "Reply to the agent's question..."
								: 'Add a hint for the next iteration...'}
							value={currentHint}
							oninput={(e) => (hintInput = (e.currentTarget as HTMLTextAreaElement).value)}
							onkeydown={(e) => {
								if (e.key === 'Enter' && !e.shiftKey && hintChanged) {
									e.preventDefault();
									submitHint();
								}
							}}
							rows="1"
							class="flex-1 rounded-lg border {session.pendingHint && !hintChanged
								? 'border-purple-400'
								: 'border-[var(--dash-border)]'} resize-none bg-[var(--dash-bg)] px-3 py-2 text-sm text-[var(--dash-text)] transition-all placeholder:text-[var(--dash-text-muted)]"
							onfocus={(e) => ((e.currentTarget as HTMLTextAreaElement).rows = 3)}
							onblur={(e) => {
								if (!(e.currentTarget as HTMLTextAreaElement).value.trim())
									(e.currentTarget as HTMLTextAreaElement).rows = 1;
							}}></textarea>
						{#if session.pendingHint && !hintChanged}
							<button
								onclick={() => {
									hintInput = '';
									submitHint();
								}}
								disabled={hintSending}
								class="rounded-lg bg-[var(--dash-error)]/10 px-3 py-2 text-xs text-[var(--dash-error)] transition-colors hover:bg-[var(--dash-error)]/20 disabled:opacity-50"
							>
								Clear
							</button>
						{:else}
							<button
								onclick={submitHint}
								disabled={!hintChanged || hintSending}
								class="rounded-lg bg-purple-500/10 px-3 py-2 text-xs text-purple-600 transition-colors hover:bg-purple-500/20 disabled:opacity-50"
							>
								{#if hintSending}
									<Spinner size="w-3 h-3" />
								{:else}
									{session.pendingHint ? 'Update' : 'Send'}
								{/if}
							</button>
						{/if}
					</div>
					{#if session.pendingHint && !hintChanged}
						<p class="mt-1 text-xs text-purple-600">
							Queued — will be sent at the start of the next iteration
						</p>
					{/if}
				</div>
			{/if}

			<!-- Session details -->
			<div class="grid gap-3 text-xs sm:grid-cols-2">
				<!-- Max iterations (editable for active/paused) -->
				{#if ['active', 'paused'].includes(session.status)}
					<div class="flex items-center gap-2">
						<span class="font-medium text-[var(--dash-text-muted)]">Max iterations:</span>
						<input
							type="number"
							min={session.currentIteration + 1}
							max="50"
							value={session.maxIterations}
							onchange={(e) =>
								updateMaxIterations(parseInt((e.currentTarget as HTMLInputElement).value))}
							class="w-16 rounded border border-[var(--dash-border)] bg-[var(--dash-bg)] px-2 py-0.5 text-center text-sm text-[var(--dash-text)]"
						/>
						<span class="text-[var(--dash-text-muted)]">
							({session.maxIterations - session.currentIteration} remaining)
						</span>
					</div>
				{/if}

				<div class="sm:col-span-2">
					<span class="font-medium text-[var(--dash-text-muted)]">Goal:</span>
					<span class="ml-1 text-[var(--dash-text-secondary)]">{session.goal}</span>
				</div>

				<div class="text-[var(--dash-text-muted)] sm:col-span-2">
					Started {formatTime(session.createdAt)}
					{#if session.finishedAt}
						— finished {formatTime(session.finishedAt)}
					{/if}
				</div>

				{#if session.claudeSessionId}
					<div class="sm:col-span-2">
						<span class="font-medium text-[var(--dash-text-muted)]">Continue session:</span>
						<code
							class="ml-1 cursor-pointer rounded bg-[var(--dash-border)]/30 px-1.5 py-0.5 text-[10px] text-[var(--dash-text-secondary)] select-all"
							title="Click to select, then copy">claude --resume {session.claudeSessionId}</code
						>
					</div>
				{/if}

				{#if session.systemPrompt}
					<details class="sm:col-span-2">
						<summary
							class="cursor-pointer font-medium text-[var(--dash-text-muted)] hover:text-[var(--dash-text-secondary)]"
						>
							System prompt
						</summary>
						<p
							class="mt-1 max-h-48 overflow-y-auto rounded bg-[var(--dash-border)]/30 p-2 font-mono text-[10px] leading-relaxed whitespace-pre-wrap text-[var(--dash-text-secondary)]"
						>
							{session.systemPrompt}
						</p>
					</details>
				{/if}
			</div>
		</Card>

		<!-- Iterations -->
		<Card padding="responsive">
			<h3 class="mb-3 text-sm font-medium text-[var(--dash-text)]">Iterations</h3>
			{#if iterations.length === 0}
				<p class="py-4 text-center text-xs text-[var(--dash-text-muted)]">
					No iterations yet — waiting for agent to start...
				</p>
			{:else}
				<div class="space-y-3">
					{#each iterations as iter, idx (iter.id)}
						{@const prevIter = idx > 0 ? iterations[idx - 1] : null}
						{@const delta =
							iter.successPct !== null && prevIter?.successPct !== null
								? iter.successPct - (prevIter?.successPct ?? 0)
								: null}
						<div class="rounded-lg bg-[var(--dash-bg)] p-3 text-xs">
							<!-- Iteration header -->
							<div class="mb-2 flex items-center justify-between">
								<span class="font-medium text-[var(--dash-text)]">
									Iteration {iter.iteration}
								</span>
								<div class="flex items-center gap-3 text-[var(--dash-text-muted)]">
									{#if iter.runId}
										<span>Run #{iter.runId}</span>
									{/if}
									{#if iter.runStatus}
										<span
											class={iter.runStatus === 'success'
												? 'text-green-600'
												: iter.runStatus === 'error'
													? 'text-[var(--dash-error)]'
													: 'text-amber-600'}
										>
											{iter.runStatus}
										</span>
									{/if}
									{#if iter.successPct !== null}
										<span class="text-[var(--dash-text-secondary)]">
											{iter.successPct.toFixed(1)}%
										</span>
										{#if delta !== null && prevIter}
											<span
												class={delta > 0
													? 'text-green-600'
													: delta < 0
														? 'text-[var(--dash-error)]'
														: 'text-[var(--dash-text-muted)]'}
											>
												{delta > 0 ? '+' : ''}{delta.toFixed(1)}pp
											</span>
										{/if}
									{/if}
									{#if iter.goalMet === true}
										<span class="font-medium text-green-600">Goal met</span>
									{/if}
								</div>
							</div>

							<!-- Items stats -->
							{#if iter.itemsTotal}
								<div class="mb-2 flex gap-4 text-[var(--dash-text-secondary)]">
									<span>{iter.itemsCompleted || 0} completed</span>
									<span>{iter.itemsError || 0} errors</span>
									<span>{iter.itemsTotal} total</span>
									{#if prevIter?.itemsTotal}
										{@const completedDelta =
											(iter.itemsCompleted || 0) - (prevIter.itemsCompleted || 0)}
										{@const errorDelta = (iter.itemsError || 0) - (prevIter.itemsError || 0)}
										<span class="text-[var(--dash-text-muted)]">
											(vs prev: {completedDelta > 0 ? '+' : ''}{completedDelta} completed, {errorDelta >
											0
												? '+'
												: ''}{errorDelta} errors)
										</span>
									{/if}
								</div>
							{/if}

							<!-- Goal evaluation -->
							{#if iter.goalMet !== null}
								<div class="mt-2 flex items-start gap-2">
									<span
										class={iter.goalMet
											? 'font-medium text-green-600'
											: 'font-medium text-amber-600'}
									>
										{iter.goalMet ? 'Goal met' : 'Goal not met'}
									</span>
									{#if iter.goalEvaluation}
										<span class="text-[var(--dash-text-secondary)]">— {iter.goalEvaluation}</span>
									{/if}
								</div>
							{/if}

							<!-- Prompt sent to Claude -->
							{#if iter.prompt}
								<details class="mt-2">
									<summary
										class="cursor-pointer font-medium text-[var(--dash-text-muted)] hover:text-[var(--dash-text-secondary)]"
									>
										Prompt sent
									</summary>
									<p
										class="mt-1 max-h-48 overflow-y-auto rounded bg-[var(--dash-border)]/30 p-2 font-mono text-[10px] leading-relaxed whitespace-pre-wrap text-[var(--dash-text-secondary)]"
									>
										{iter.prompt}
									</p>
								</details>
							{/if}

							<!-- Claude response -->
							{#if iter.claudeAnalysis}
								<details class="mt-2" open={!iter.finishedAt}>
									<summary
										class="cursor-pointer font-medium text-[var(--dash-text-muted)] hover:text-[var(--dash-text-secondary)]"
									>
										Claude response
									</summary>
									<p
										class="mt-1 max-h-64 overflow-y-auto whitespace-pre-wrap text-[var(--dash-text-secondary)]"
									>
										{iter.claudeAnalysis}
									</p>
								</details>
							{/if}

							<!-- Timestamp + Stage -->
							<div class="mt-2 text-[var(--dash-text-muted)]">
								{formatTime(iter.startedAt)}
								{#if iter.finishedAt}
									— finished {formatTime(iter.finishedAt)}
								{:else if iter.stage}
									— <span class={stageColor(iter.stage)}>{stageLabel(iter.stage)}</span>
								{:else}
									— starting...
								{/if}
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</Card>
	{/if}
</div>
