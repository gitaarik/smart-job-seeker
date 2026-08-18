<!--
	What a project's ingested code suggests for its CV entry — Tier 3 of
	`planning/SEMANTIC-MATCHING-AND-RAG.md` § Repo-derived project evidence.

	Used by both project kinds. A side project's corpus usually comes from a
	repository scan and a work-experience project's from an uploaded archive, but
	the reading is identical, so the only differences here are the labels.

	Its sibling `RepoMetadataFetch` offers facts GitHub reports. This one offers
	an LLM's reading of the source, so it is shaped around what source code can
	and cannot support:

	- **Summary and technologies are proposals**, ticked or not, applied the same
	  way as any other.
	- **Achievements are never generated from the code.** Code proves what was
	  built and knows nothing about whether it mattered — no user counts, no load,
	  no incidents, no money. A generated "reduced latency by 40%" would be a
	  fabricated metric on a real CV. So the model asks the applicant instead.

	A question can now be *answered* here, and the answer drafted into a bullet —
	but that is a second call with the applicant's own words in it, and the draft
	comes back with the part of their answer it rests on quoted, so an outcome
	that did not come from them is visible rather than inferred. The questions
	still have no Apply button of their own.
-->
<script lang="ts">
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faCircleNotch,
		faDownload,
		faLightbulb,
		faWandMagicSparkles
	} from '@fortawesome/free-solid-svg-icons';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';
	import { normalizeSkill } from '$lib/skills';

	interface Question {
		question: string;
		evidence: string;
	}

	let {
		kind,
		projectId,
		currentSummary,
		currentTechnologies,
		currentAchievement = '',
		summaryLabel = 'Summary',
		achievementLabel = 'Achievements',
		onApplySummary,
		onApplyTechnologies,
		onApplyAchievement
	}: {
		kind: 'side_project' | 'work_experience_project';
		projectId: number;
		currentSummary: string;
		currentTechnologies: string[];
		/** What is already written where an outcome would land, if anything. */
		currentAchievement?: string;
		/** "Summary" on a side project, "Description" on a work-experience one. */
		summaryLabel?: string;
		/** Where an answered question ends up, named as the user sees it. */
		achievementLabel?: string;
		onApplySummary: (summary: string) => void;
		onApplyTechnologies: (names: string[]) => void;
		onApplyAchievement: (achievement: string) => void;
	} = $props();

	let loading = $state(false);
	let error = $state<string | null>(null);
	let open = $state(false);
	let summary = $state('');
	let outcome = $state('');
	let technologies = $state<string[]>([]);
	let questions = $state<Question[]>([]);
	let scanTitle = $state<string | null>(null);
	let sourceCount = $state(0);
	let applied = $state(false);
	let summarySelected = $state(false);
	let outcomeSelected = $state(false);
	const selectedTech = new SvelteSet<string>();

	/**
	 * Per-question answer state, keyed by the question text.
	 *
	 * A SvelteMap because the template renders from it. Questions are unique
	 * within one response and the panel is rebuilt on every fetch, so the text is
	 * a stable enough key and avoids threading an index through three handlers.
	 */
	const answers = new SvelteMap<string, string>();
	const drafting = new SvelteSet<string>();
	const drafts = new SvelteMap<string, { achievement: string; usedFromAnswer: string }>();
	const answerErrors = new SvelteMap<string, string>();
	const answeringOpen = new SvelteSet<string>();

	let selectedCount = $derived(
		(summarySelected ? 1 : 0) + (outcomeSelected ? 1 : 0) + selectedTech.size
	);

	async function suggest() {
		loading = true;
		error = null;
		applied = false;
		open = false;
		try {
			const response = await fetch(`/api/project-suggestions/${kind}/${projectId}`, {
				method: 'POST'
			});
			const body = await response.json().catch(() => ({}));
			if (!response.ok) {
				throw new Error(body.message || body.error || `Request failed (${response.status})`);
			}
			summary = String(body.description ?? '');
			outcome = String(body.outcome ?? '');
			// The server dedupes against the SAVED chips; this catches one the user
			// has just typed and not yet saved, which the server cannot see.
			const have = new Set(currentTechnologies.map(normalizeSkill).filter(Boolean));
			technologies = ((body.technologies ?? []) as string[]).filter(
				(t) => !have.has(normalizeSkill(t))
			);
			questions = (body.questions ?? []) as Question[];
			scanTitle = body.scan?.title ?? null;
			sourceCount = Number(body.scan?.sourceCount ?? 1);

			// Same rule as the metadata panel: a summary the applicant already wrote
			// is not replaced unless they say so.
			summarySelected = !!summary && !currentSummary.trim();
			// Same rule: never silently replace something already written.
			outcomeSelected = !!outcome && !currentAchievement.trim();
			selectedTech.clear();
			// These are read out of the code rather than off a tag list, so unlike a
			// GitHub topic they start ticked.
			for (const tech of technologies) selectedTech.add(tech);
			answers.clear();
			drafts.clear();
			answerErrors.clear();
			answeringOpen.clear();
			open = true;
		} catch (err) {
			error = (err as Error).message;
		} finally {
			loading = false;
		}
	}

	function toggleTech(name: string) {
		if (selectedTech.has(name)) selectedTech.delete(name);
		else selectedTech.add(name);
	}

	function toggleAnswering(question: string) {
		if (answeringOpen.has(question)) answeringOpen.delete(question);
		else answeringOpen.add(question);
	}

	/**
	 * Draft a bullet from what the applicant just wrote.
	 *
	 * Deliberately a separate round trip from the suggestions above: this is the
	 * only call in the feature allowed to state an outcome, and it is allowed
	 * only because the outcome arrived in the answer it is given.
	 */
	async function draftAchievement(q: Question) {
		const answer = (answers.get(q.question) ?? '').trim();
		if (!answer || drafting.has(q.question)) return;
		drafting.add(q.question);
		answerErrors.delete(q.question);
		try {
			const response = await fetch(`/api/project-suggestions/${kind}/${projectId}/achievement`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ question: q.question, evidence: q.evidence, answer })
			});
			const body = await response.json().catch(() => ({}));
			if (!response.ok) {
				throw new Error(body.message || body.error || `Request failed (${response.status})`);
			}
			drafts.set(q.question, {
				achievement: String(body.achievement ?? ''),
				usedFromAnswer: String(body.usedFromAnswer ?? '')
			});
		} catch (err) {
			answerErrors.set(q.question, (err as Error).message);
		} finally {
			drafting.delete(q.question);
		}
	}

	function acceptDraft(question: string) {
		const draft = drafts.get(question);
		if (!draft?.achievement) return;
		onApplyAchievement(draft.achievement);
		drafts.delete(question);
		answers.delete(question);
		answeringOpen.delete(question);
		questions = questions.filter((q) => q.question !== question);
	}

	function apply() {
		if (summarySelected && summary) onApplySummary(summary);
		if (outcomeSelected && outcome) onApplyAchievement(outcome);
		const names = technologies.filter((name) => selectedTech.has(name));
		if (names.length > 0) onApplyTechnologies(names);
		open = false;
		applied = true;
	}
</script>

<div class="mt-3">
	<div class="flex flex-wrap items-center gap-3">
		<button
			type="button"
			onclick={suggest}
			disabled={loading}
			class="inline-flex items-center gap-2 rounded-md border border-[var(--dash-border)] px-3 py-2 text-sm font-medium text-[var(--dash-text)] transition-colors hover:bg-[var(--dash-bg)] disabled:cursor-not-allowed disabled:opacity-50"
		>
			<FontAwesomeIcon
				icon={loading ? faCircleNotch : faWandMagicSparkles}
				class="h-4 w-4 {loading ? 'animate-spin' : ''}"
			/>
			{loading ? 'Reading the code…' : 'Suggest from scanned code'}
		</button>
		<span class="text-sm text-[var(--dash-text-secondary)]">
			Reads the files and code you added below.
		</span>
	</div>

	{#if error}
		<p class="mt-3 text-sm text-red-500">{error}</p>
	{/if}

	{#if applied}
		<p class="mt-3 text-sm text-[var(--dash-text-secondary)]">
			Applied — the fields above save automatically.
		</p>
	{/if}

	{#if open}
		<div class="mt-3 rounded-md border border-[var(--dash-border)] p-3">
			{#if scanTitle}
				<p class="mb-2 text-sm text-[var(--dash-text-secondary)]">
					{#if sourceCount > 1}
						From the {sourceCount} files you added, including
						<span class="font-medium text-[var(--dash-text)]">{scanTitle}</span>.
					{:else}
						From <span class="font-medium text-[var(--dash-text)]">{scanTitle}</span>.
					{/if}
				</p>
			{/if}

			{#if summary}
				<label class="flex cursor-pointer items-start gap-3 text-sm">
					<input
						type="checkbox"
						bind:checked={summarySelected}
						class="mt-1 h-4 w-4 shrink-0 accent-[var(--dash-primary)]"
					/>
					<span class="min-w-0">
						<span class="font-medium text-[var(--dash-text)]">{summaryLabel}:</span>
						<span class="text-[var(--dash-text)]">{summary}</span>
						{#if currentSummary.trim()}
							<span class="mt-0.5 block text-xs text-amber-500">
								Replaces what you have written.
							</span>
						{/if}
					</span>
				</label>
			{/if}

			{#if outcome}
				<label class="mt-2 flex cursor-pointer items-start gap-3 text-sm">
					<input
						type="checkbox"
						bind:checked={outcomeSelected}
						class="mt-1 h-4 w-4 shrink-0 accent-[var(--dash-primary)]"
					/>
					<span class="min-w-0">
						<span class="font-medium text-[var(--dash-text)]">{achievementLabel}:</span>
						<span class="text-[var(--dash-text)]">{outcome}</span>
						<span class="mt-0.5 block text-xs text-[var(--dash-text-secondary)]">
							Stated in the files you added — not inferred from the code.
						</span>
					</span>
				</label>
			{/if}

			{#if technologies.length > 0}
				<p class="mt-3 mb-2 text-sm font-medium text-[var(--dash-text)]">
					Technologies found in the code
				</p>
				<div class="flex flex-wrap gap-2">
					{#each technologies as tech (tech)}
						<label
							class="flex cursor-pointer items-center gap-2 rounded-full border border-[var(--dash-border)] px-3 py-1 text-sm"
						>
							<input
								type="checkbox"
								checked={selectedTech.has(tech)}
								onchange={() => toggleTech(tech)}
								class="h-3.5 w-3.5 accent-[var(--dash-primary)]"
							/>
							<span class="text-[var(--dash-text)]">{tech}</span>
						</label>
					{/each}
				</div>
			{/if}

			{#if questions.length > 0}
				<div class="mt-4 rounded-md bg-[var(--dash-bg)] p-3">
					<p class="flex items-center gap-2 text-sm font-medium text-[var(--dash-text)]">
						<FontAwesomeIcon icon={faLightbulb} class="h-4 w-4 text-amber-500" />
						{outcome ? `More for ${achievementLabel}` : `${achievementLabel} comes from these`}
					</p>
					<p class="mt-1 text-xs text-[var(--dash-text-secondary)]">
						{#if !outcome}
							Your files don't say what changed because of this work, and code can't tell us — so
							nothing was filled in above.
						{/if}
						Answer one and it becomes {achievementLabel.toLowerCase()} text built from your words, not
						the model's.
					</p>
					<ul class="mt-2 space-y-3">
						{#each questions as q (q.question)}
							{@const draft = drafts.get(q.question)}
							<li class="text-sm">
								<span class="text-[var(--dash-text)]">{q.question}</span>
								{#if q.evidence}
									<span class="mt-0.5 block text-xs text-[var(--dash-text-secondary)]">
										Seen in: {q.evidence}
									</span>
								{/if}

								{#if !answeringOpen.has(q.question)}
									<button
										type="button"
										onclick={() => toggleAnswering(q.question)}
										class="mt-1 text-xs font-medium text-[var(--dash-primary)] hover:underline"
									>
										Answer this
									</button>
								{:else}
									<div class="mt-2 space-y-2">
										<textarea
											rows="3"
											placeholder="In your own words — what problem did it solve, and what changed?"
											value={answers.get(q.question) ?? ''}
											oninput={(e) => answers.set(q.question, e.currentTarget.value)}
											class="w-full rounded-md border border-[var(--dash-border)] px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
										></textarea>

										{#if answerErrors.has(q.question)}
											<p class="text-xs text-red-500">{answerErrors.get(q.question)}</p>
										{/if}

										{#if draft}
											<div
												class="rounded-md border border-[var(--dash-border)] bg-[var(--dash-card)] p-2"
											>
												<p class="text-sm text-[var(--dash-text)]">{draft.achievement}</p>
												{#if draft.usedFromAnswer}
													<p class="mt-1 text-xs text-[var(--dash-text-secondary)]">
														Based on your words: “{draft.usedFromAnswer}”
													</p>
												{:else}
													<p class="mt-1 text-xs text-amber-500">
														No outcome in your answer, so none was claimed.
													</p>
												{/if}
												<div class="mt-2 flex items-center gap-3">
													<button
														type="button"
														onclick={() => acceptDraft(q.question)}
														class="rounded-md bg-[var(--dash-primary)] px-2 py-1 text-xs font-medium text-white hover:opacity-90"
													>
														Add to {achievementLabel}
													</button>
													<button
														type="button"
														onclick={() => draftAchievement(q)}
														class="text-xs text-[var(--dash-text-secondary)] hover:underline"
													>
														Redraft
													</button>
												</div>
											</div>
										{:else}
											<div class="flex items-center gap-3">
												<button
													type="button"
													onclick={() => draftAchievement(q)}
													disabled={!(answers.get(q.question) ?? '').trim() ||
														drafting.has(q.question)}
													class="inline-flex items-center gap-2 rounded-md border border-[var(--dash-border)] px-2 py-1 text-xs font-medium text-[var(--dash-text)] hover:bg-[var(--dash-card)] disabled:cursor-not-allowed disabled:opacity-50"
												>
													{#if drafting.has(q.question)}
														<FontAwesomeIcon icon={faCircleNotch} class="h-3 w-3 animate-spin" />
														Drafting…
													{:else}
														Draft the achievement
													{/if}
												</button>
												<button
													type="button"
													onclick={() => toggleAnswering(q.question)}
													class="text-xs text-[var(--dash-text-secondary)] hover:underline"
												>
													Cancel
												</button>
											</div>
										{/if}
									</div>
								{/if}
							</li>
						{/each}
					</ul>
				</div>
			{/if}

			<div class="mt-3 flex items-center gap-3">
				<button
					type="button"
					onclick={apply}
					disabled={selectedCount === 0}
					class="inline-flex items-center gap-2 rounded-md bg-[var(--dash-primary)] px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
				>
					<FontAwesomeIcon icon={faDownload} class="h-4 w-4" />
					Apply {selectedCount} change{selectedCount === 1 ? '' : 's'}
				</button>
				<button
					type="button"
					onclick={() => (open = false)}
					class="text-sm text-[var(--dash-text-secondary)] hover:underline"
				>
					Close
				</button>
			</div>
		</div>
	{/if}
</div>
