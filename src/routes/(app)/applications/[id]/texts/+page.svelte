<script lang="ts">
	import type { ActionData, PageData } from './$types';
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { normalizeQuestion } from '$lib/utils/normalize-question';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faCheck,
		faChevronRight,
		faEnvelope,
		faLayerGroup,
		faPaste,
		faPen,
		faPencil,
		faPlus,
		faQuestionCircle,
		faRobot,
		faTrash
	} from '@fortawesome/free-solid-svg-icons';
	import Card from '../../../components/Card.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import EmptyState from '../../../profile/components/EmptyState.svelte';
	import FilterTabs from '../../../components/FilterTabs.svelte';
	import ConfirmModal from '../../../profile/components/ConfirmModal.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let app = $derived(data.application);
	let letters = $derived(app.application_letters || []);
	let questions = $derived(app.application_questions || []);

	let currentType = $state('all');
	let expandedId = $state<string | null>(null);
	let deleteItem = $state<{ id: number; type: 'letter' | 'question' } | null>(null);
	let showAddQuestion = $state(false);
	let showAddMenu = $state(false);

	// Add form states
	let newQuestion = $state('');
	let newAnswer = $state('');
	// When set, jump to the new question's dedicated editor after adding.
	let openAfterAdd = $state(false);

	// Paste-and-extract states
	type DupChoice = 'skip' | 'add' | 'fill';
	type Pair = {
		question: string;
		answer: string;
		confidence: 'high' | 'low';
		// Explicit user decision when the question duplicates an existing one;
		// null means "use the default" (skip). Ignored when there's no match.
		choice: DupChoice | null;
	};
	let showPaste = $state(false);
	let pasteText = $state('');
	let extracting = $state(false);
	let extractError = $state<string | null>(null);
	let previewPairs = $state<Pair[] | null>(null);

	// Exact-match dedup: normalize away trivial differences (case, whitespace,
	// trailing punctuation) so "Why us?" and "why us" collide, but never fuzzy-
	// match — a wrong match would silently file an answer under the wrong
	// question, worse than a visible duplicate.
	function findExistingMatch(q: string) {
		const n = normalizeQuestion(q);
		if (!n) return undefined;
		return questions.find((eq) => normalizeQuestion(eq.question) === n);
	}
	// A pasted answer can fill an existing question only when that question has
	// no answer yet and the pasted pair actually carries one.
	function canFill(pair: Pair): boolean {
		const match = findExistingMatch(pair.question);
		return !!match && !match.answer?.trim() && !!pair.answer.trim();
	}
	function effectiveChoice(pair: Pair): DupChoice {
		const match = findExistingMatch(pair.question);
		if (!match) return 'add';
		if (pair.choice === 'add') return 'add';
		if (pair.choice === 'fill') return canFill(pair) ? 'fill' : 'skip';
		return 'skip'; // duplicates are excluded by default
	}

	// What actually gets sent on save, split by action.
	let saveAdds = $derived(
		(previewPairs ?? [])
			.filter((p) => effectiveChoice(p) === 'add')
			.map((p) => ({ question: p.question, answer: p.answer }))
	);
	let saveFills = $derived(
		(previewPairs ?? [])
			.filter((p) => effectiveChoice(p) === 'fill')
			.map((p) => {
				const match = findExistingMatch(p.question);
				return match ? { id: match.id, answer: p.answer } : null;
			})
			.filter((f): f is { id: number; answer: string } => f !== null)
	);
	let skipCount = $derived((previewPairs?.length ?? 0) - saveAdds.length - saveFills.length);

	let canSavePairs = $derived.by(() => {
		if (!previewPairs || previewPairs.length === 0) return false;
		// Every row that will be inserted needs a question (NOT NULL guard).
		for (const p of previewPairs) {
			if (effectiveChoice(p) === 'add' && !p.question.trim()) return false;
		}
		return saveAdds.length > 0 || saveFills.length > 0;
	});

	let saveLabel = $derived.by(() => {
		const parts: string[] = [];
		if (saveAdds.length) parts.push(`Add ${saveAdds.length}`);
		if (saveFills.length) parts.push(`fill ${saveFills.length}`);
		if (parts.length === 0) return 'Nothing to save';
		let label = parts.join(' · ');
		if (skipCount) label += ` · skip ${skipCount}`;
		return label;
	});

	function openPaste() {
		showPaste = true;
		showAddMenu = false;
		showAddQuestion = false;
		pasteText = '';
		previewPairs = null;
		extractError = null;
	}

	function cancelPaste() {
		showPaste = false;
		pasteText = '';
		previewPairs = null;
		extractError = null;
	}

	async function runExtract() {
		if (!pasteText.trim()) return;
		extracting = true;
		extractError = null;
		try {
			const response = await fetch('/api/ai/questions/extract', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ text: pasteText })
			});
			const result = await response.json();
			if (!result.success) {
				extractError = result.message || 'Extraction failed';
				return;
			}
			if (!result.pairs?.length) {
				extractError = 'No questions and answers found in that text.';
				return;
			}
			previewPairs = (result.pairs as Omit<Pair, 'choice'>[]).map((p) => ({
				...p,
				choice: null
			}));
		} catch {
			extractError = 'Network error. Please try again.';
		} finally {
			extracting = false;
		}
	}

	function addPair() {
		previewPairs = [
			...(previewPairs ?? []),
			{
				question: '',
				answer: '',
				confidence: 'high',
				choice: null
			}
		];
	}

	function removePair(index: number) {
		if (!previewPairs) return;
		previewPairs = previewPairs.filter((_, i) => i !== index);
	}

	function handleSavePairs() {
		return async ({
			result,
			update
		}: {
			result: { type: string };
			update: () => Promise<void>;
		}) => {
			await update();
			if (result.type === 'success') {
				cancelPaste();
			}
		};
	}

	type LetterItem = (typeof letters)[0] & { itemType: 'letter' };
	type QuestionItem = (typeof questions)[0] & { itemType: 'question' };
	type Item = LetterItem | QuestionItem;

	let items = $derived.by((): Item[] => {
		const letterItems: Item[] = letters.map((l) => ({
			...l,
			itemType: 'letter' as const
		}));
		const questionItems: Item[] = questions.map((q) => ({
			...q,
			itemType: 'question' as const
		}));

		if (currentType === 'letters') return letterItems;
		if (currentType === 'questions') return questionItems;

		return [...letterItems, ...questionItems].sort((a, b) => {
			const dateA = a.date_updated || a.date_created || new Date(0);
			const dateB = b.date_updated || b.date_created || new Date(0);
			return new Date(dateB).getTime() - new Date(dateA).getTime();
		});
	});

	const letterTypes: Record<string, string> = {
		cover_letter: 'Cover Letter',
		cheat_sheet: 'Interview Cheat Sheet'
	};

	const typeFilters = [
		{ value: 'all', label: 'All', icon: faLayerGroup },
		{ value: 'letters', label: 'Letters', icon: faEnvelope },
		{ value: 'questions', label: 'Questions', icon: faQuestionCircle }
	];

	function getItemId(item: Item): string {
		return `${item.itemType}-${item.id}`;
	}

	function formatDate(date: Date | string | null): string {
		if (!date) return '';
		const d = typeof date === 'string' ? new Date(date) : date;
		return d.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	function toggleExpand(id: string) {
		expandedId = expandedId === id ? null : id;
	}

	function handleAddSubmit() {
		return async ({
			result,
			update
		}: {
			result: { type: string; data?: { questionId?: number } };
			update: () => Promise<void>;
		}) => {
			const wantOpen = openAfterAdd;
			await update();
			if (result.type === 'success') {
				const qid = result.data?.questionId;
				showAddQuestion = false;
				newQuestion = '';
				newAnswer = '';
				openAfterAdd = false;
				// "Add & open editor" jumps straight to the dedicated page so the user
				// can iterate on the answer there rather than on this list.
				if (wantOpen && qid) {
					goto(`/applications/${app.id}/texts/questions/${qid}`);
				}
			} else {
				openAfterAdd = false;
			}
		};
	}

	function handleClickOutside(e: MouseEvent) {
		if (showAddMenu && !(e.target as HTMLElement).closest('[data-add-menu]')) {
			showAddMenu = false;
		}
	}
</script>

<svelte:window onclick={handleClickOutside} />

<div class="space-y-6">
	{#if form?.error}
		<div class="rounded-lg border border-[var(--dash-error)] bg-[var(--dash-error-light)] p-4">
			<p class="text-sm text-[var(--dash-error)]">{form.error}</p>
		</div>
	{/if}

	<!-- Header with title, filter + add button -->
	<div class="flex flex-wrap items-center justify-between gap-3">
		<div class="flex items-center gap-3">
			<FontAwesomeIcon icon={faEnvelope} class="h-7 w-7 text-[var(--dash-primary)]" />
			<h2 class="text-2xl font-bold text-[var(--dash-text)]">Texts</h2>
			{#if letters.length > 0 && questions.length > 0}
				<FilterTabs filters={typeFilters} value={currentType} onchange={(v) => (currentType = v)} />
			{/if}
		</div>
		{#if letters.length > 0 || questions.length > 0}
			<div class="flex items-center gap-2">
				<div class="relative" data-add-menu>
					<button
						type="button"
						onclick={() => (showAddMenu = !showAddMenu)}
						class="flex items-center justify-center gap-2 rounded-lg bg-[var(--dash-primary)] p-3 text-white transition-colors hover:bg-[var(--dash-primary-hover)] sm:px-4 sm:py-2"
					>
						<FontAwesomeIcon icon={faPlus} class="h-5 w-5 sm:h-4 sm:w-4" />
						<span class="hidden sm:inline">Add</span>
					</button>
					{#if showAddMenu}
						<div
							class="absolute top-full right-0 z-20 mt-1 min-w-[220px] rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)] py-1 shadow-lg"
						>
							{#each Object.entries(letterTypes) as [value, label]}
								<a
									href="/applications/{app.id}/texts/new?type={value}"
									class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[var(--dash-text)] transition-colors hover:bg-[var(--dash-bg)]"
									onclick={() => (showAddMenu = false)}
								>
									<FontAwesomeIcon icon={faEnvelope} class="h-3.5 w-3.5 opacity-50" />
									{label}
								</a>
							{/each}
							<div class="my-1 border-t border-[var(--dash-border)]"></div>
							<button
								type="button"
								onclick={() => {
									showAddQuestion = true;
									showAddMenu = false;
								}}
								class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[var(--dash-text)] transition-colors hover:bg-[var(--dash-bg)]"
							>
								<FontAwesomeIcon icon={faQuestionCircle} class="h-3.5 w-3.5 opacity-50" />
								Application Question
							</button>
							<button
								type="button"
								onclick={openPaste}
								class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[var(--dash-text)] transition-colors hover:bg-[var(--dash-bg)]"
							>
								<FontAwesomeIcon icon={faPaste} class="h-3.5 w-3.5 opacity-50" />
								Paste questions (and answers)
							</button>
						</div>
					{/if}
				</div>
			</div>
		{/if}
	</div>

	<!-- Add Question Form -->
	{#if showAddQuestion}
		<Card padding="md">
			<form method="POST" action="?/createQuestion" use:enhance={handleAddSubmit}>
				<h3 class="mb-3 font-medium text-[var(--dash-text)]">Add Question</h3>
				<div class="space-y-3">
					<div>
						<label for="new-question" class="mb-1 block text-sm text-[var(--dash-text-secondary)]"
							>Question</label
						>
						<input
							type="text"
							id="new-question"
							name="question"
							bind:value={newQuestion}
							placeholder="e.g., Why do you want to work at our company?"
							required
							class="w-full rounded-md border border-[var(--dash-border)] px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
						/>
					</div>
					<div>
						<label for="new-answer" class="mb-1 block text-sm text-[var(--dash-text-secondary)]">
							Answer <span class="text-[var(--dash-text-muted)]">(optional)</span>
						</label>
						<textarea
							id="new-answer"
							name="answer"
							bind:value={newAnswer}
							rows={4}
							placeholder="Write your answer now, or leave blank and come back to it."
							class="w-full resize-y rounded-md border border-[var(--dash-border)] px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
						></textarea>
					</div>
					<div class="flex flex-wrap justify-end gap-2">
						<button
							type="button"
							onclick={() => {
								showAddQuestion = false;
								newAnswer = '';
							}}
							class="rounded-lg border border-[var(--dash-border)] px-4 py-2 text-[var(--dash-text)] transition-colors hover:bg-[var(--dash-bg)]"
						>
							Cancel
						</button>
						<button
							type="submit"
							onclick={() => (openAfterAdd = false)}
							class="rounded-lg bg-[var(--dash-primary)] px-4 py-2 text-white transition-colors hover:bg-[var(--dash-primary-hover)]"
						>
							Add Question
						</button>
						<button
							type="submit"
							onclick={() => (openAfterAdd = true)}
							class="flex items-center gap-2 rounded-lg border border-[var(--dash-primary)] px-4 py-2 text-[var(--dash-primary)] transition-colors hover:bg-[var(--dash-primary-light)]"
						>
							<FontAwesomeIcon icon={faPencil} class="h-4 w-4" />
							Add &amp; open editor
						</button>
					</div>
				</div>
			</form>
		</Card>
	{/if}

	<!-- Paste & Extract Panel -->
	{#if showPaste}
		<Card padding="md">
			{#if !previewPairs}
				<!-- Step 1: paste the blob -->
				<div class="mb-3 flex items-center gap-2">
					<FontAwesomeIcon icon={faPaste} class="h-4 w-4 text-[var(--dash-primary)]" />
					<h3 class="font-medium text-[var(--dash-text)]">Paste questions</h3>
				</div>
				<p class="mb-3 text-sm text-[var(--dash-text-secondary)]">
					Paste your application questions — with or without the answers you've already written. AI
					will split them into separate question/answer pairs for you to review before they're
					added.
				</p>
				<textarea
					bind:value={pasteText}
					rows={10}
					placeholder="Paste your questions here — include answers if you have them…"
					class="w-full resize-y rounded-md border border-[var(--dash-border)] px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
				></textarea>
				{#if extractError}
					<p class="mt-2 text-sm text-[var(--dash-error)]">{extractError}</p>
				{/if}
				<div class="mt-3 flex justify-end gap-2">
					<button
						type="button"
						onclick={cancelPaste}
						class="rounded-lg border border-[var(--dash-border)] px-4 py-2 text-[var(--dash-text)] transition-colors hover:bg-[var(--dash-bg)]"
					>
						Cancel
					</button>
					<button
						type="button"
						onclick={runExtract}
						disabled={extracting || !pasteText.trim()}
						class="flex items-center gap-2 rounded-lg bg-[var(--dash-primary)] px-4 py-2 text-white transition-colors hover:bg-[var(--dash-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
					>
						{#if extracting}
							<Spinner size="w-4 h-4" />
						{:else}
							<FontAwesomeIcon icon={faRobot} class="h-4 w-4" />
						{/if}
						{extracting ? 'Extracting…' : 'Extract with AI'}
					</button>
				</div>
			{:else}
				<!-- Step 2: editable preview -->
				<div class="mb-1 flex items-center justify-between">
					<div class="flex items-center gap-2">
						<FontAwesomeIcon icon={faQuestionCircle} class="h-4 w-4 text-[var(--dash-primary)]" />
						<h3 class="font-medium text-[var(--dash-text)]">Review extracted questions</h3>
					</div>
					<span class="text-sm text-[var(--dash-text-secondary)]">{previewPairs.length} found</span>
				</div>
				<p class="mb-4 text-sm text-[var(--dash-text-secondary)]">
					Edit anything that looks off. Pairs marked <span class="text-[var(--dash-warning)]"
						>needs review</span
					>
					had an unclear split. Questions <span class="text-[var(--dash-info)]">already added</span> to
					this application are skipped by default — you can add them anyway or use a pasted answer to
					fill an empty one.
				</p>
				<div class="space-y-4">
					{#each previewPairs as pair, i (i)}
						{@const match = findExistingMatch(pair.question)}
						{@const eff = effectiveChoice(pair)}
						<div
							class="space-y-2 rounded-lg border border-[var(--dash-border)] p-3 {eff === 'skip'
								? 'opacity-60'
								: ''}"
						>
							<div class="flex items-center justify-between">
								<span class="text-xs text-[var(--dash-text-muted)]">#{i + 1}</span>
								<div class="flex items-center gap-2">
									{#if match}
										<span
											class="rounded-full bg-[var(--dash-info-light)] px-2 py-0.5 text-xs text-[var(--dash-info)]"
										>
											already added
										</span>
									{/if}
									{#if pair.confidence === 'low'}
										<span
											class="rounded-full bg-[var(--dash-warning-light)] px-2 py-0.5 text-xs text-[var(--dash-warning)]"
										>
											needs review
										</span>
									{/if}
									<button
										type="button"
										onclick={() => removePair(i)}
										aria-label="Remove pair"
										class="p-1 text-[var(--dash-text-secondary)] transition-colors hover:text-red-500"
									>
										<FontAwesomeIcon icon={faTrash} class="h-3.5 w-3.5" />
									</button>
								</div>
							</div>
							<div>
								<label
									class="mb-1 block text-xs font-medium text-[var(--dash-text-secondary)]"
									for="pair-q-{i}">Question</label
								>
								<input
									id="pair-q-{i}"
									type="text"
									bind:value={pair.question}
									placeholder="Enter the question…"
									class="w-full rounded-md border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none {pair.question.trim()
										? 'border-[var(--dash-border)]'
										: 'border-[var(--dash-warning)]'}"
								/>
							</div>
							<div>
								<label
									class="mb-1 block text-xs font-medium text-[var(--dash-text-secondary)]"
									for="pair-a-{i}">Answer</label
								>
								<textarea
									id="pair-a-{i}"
									bind:value={pair.answer}
									rows={4}
									class="w-full resize-y rounded-md border border-[var(--dash-border)] px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
								></textarea>
							</div>
							{#if match}
								<div class="space-y-2 rounded-md bg-[var(--dash-bg)] p-2 text-xs">
									<p class="text-[var(--dash-text-secondary)]">
										Already on this application{match.answer?.trim()
											? ' with an answer'
											: ' (no answer yet)'}.
									</p>
									<div class="flex flex-wrap gap-1.5">
										<button
											type="button"
											onclick={() => (pair.choice = 'skip')}
											class="rounded border px-2 py-1 transition-colors {eff === 'skip'
												? 'border-[var(--dash-primary)] bg-[var(--dash-primary-light)] text-[var(--dash-primary)]'
												: 'border-[var(--dash-border)] text-[var(--dash-text-secondary)] hover:bg-[var(--dash-bg-hover)]'}"
										>
											Skip
										</button>
										<button
											type="button"
											onclick={() => (pair.choice = 'add')}
											class="rounded border px-2 py-1 transition-colors {eff === 'add'
												? 'border-[var(--dash-primary)] bg-[var(--dash-primary-light)] text-[var(--dash-primary)]'
												: 'border-[var(--dash-border)] text-[var(--dash-text-secondary)] hover:bg-[var(--dash-bg-hover)]'}"
										>
											Add anyway
										</button>
										{#if canFill(pair)}
											<button
												type="button"
												onclick={() => (pair.choice = 'fill')}
												class="rounded border px-2 py-1 transition-colors {eff === 'fill'
													? 'border-[var(--dash-primary)] bg-[var(--dash-primary-light)] text-[var(--dash-primary)]'
													: 'border-[var(--dash-border)] text-[var(--dash-text-secondary)] hover:bg-[var(--dash-bg-hover)]'}"
											>
												Fill in existing answer
											</button>
										{/if}
									</div>
								</div>
							{/if}
						</div>
					{/each}
				</div>
				<button
					type="button"
					onclick={addPair}
					class="mt-3 flex items-center gap-1.5 text-sm text-[var(--dash-primary)] hover:underline"
				>
					<FontAwesomeIcon icon={faPlus} class="h-3 w-3" /> Add another
				</button>
				<form
					method="POST"
					action="?/createQuestions"
					use:enhance={handleSavePairs}
					class="mt-4 flex items-center justify-between border-t border-[var(--dash-border)] pt-4"
				>
					<input type="hidden" name="questions" value={JSON.stringify(saveAdds)} />
					<input type="hidden" name="fills" value={JSON.stringify(saveFills)} />
					<button
						type="button"
						onclick={cancelPaste}
						class="rounded-lg border border-[var(--dash-border)] px-4 py-2 text-[var(--dash-text)] transition-colors hover:bg-[var(--dash-bg)]"
					>
						Cancel
					</button>
					<button
						type="submit"
						disabled={!canSavePairs}
						class="flex items-center gap-2 rounded-lg bg-[var(--dash-primary)] px-4 py-2 text-white transition-colors hover:bg-[var(--dash-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
					>
						<FontAwesomeIcon icon={faCheck} class="h-4 w-4" />
						{saveLabel}
					</button>
				</form>
			{/if}
		</Card>
	{/if}

	<!-- Items List -->
	{#if items.length === 0 && !showAddQuestion && !showPaste}
		<div class="flex flex-col items-center justify-center px-4 py-12 text-center">
			<div class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--dash-bg)]">
				<FontAwesomeIcon icon={faEnvelope} class="h-8 w-8 text-[var(--dash-text-muted)]" />
			</div>
			<h3 class="mb-2 text-lg font-medium text-[var(--dash-text)]">No texts yet</h3>
			<p class="mb-6 max-w-md text-sm text-[var(--dash-text-secondary)]">
				Add a cover letter or answer application questions to prepare your application.
			</p>
			<div class="relative inline-block" data-add-menu>
				<button
					type="button"
					onclick={() => (showAddMenu = !showAddMenu)}
					class="flex items-center gap-2 rounded-lg bg-[var(--dash-primary)] px-4 py-2 text-sm text-white transition-colors hover:bg-[var(--dash-primary-hover)]"
				>
					<FontAwesomeIcon icon={faPlus} class="h-3.5 w-3.5" />
					Add
				</button>
				{#if showAddMenu}
					<div
						class="absolute top-full left-1/2 z-20 mt-1 min-w-[220px] -translate-x-1/2 rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)] py-1 shadow-lg"
					>
						{#each Object.entries(letterTypes) as [value, label]}
							<a
								href="/applications/{app.id}/texts/new?type={value}"
								class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[var(--dash-text)] transition-colors hover:bg-[var(--dash-bg)]"
								onclick={() => (showAddMenu = false)}
							>
								<FontAwesomeIcon icon={faEnvelope} class="h-3.5 w-3.5 opacity-50" />
								{label}
							</a>
						{/each}
						<div class="my-1 border-t border-[var(--dash-border)]"></div>
						<button
							type="button"
							onclick={() => {
								showAddQuestion = true;
								showAddMenu = false;
							}}
							class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[var(--dash-text)] transition-colors hover:bg-[var(--dash-bg)]"
						>
							<FontAwesomeIcon icon={faQuestionCircle} class="h-3.5 w-3.5 opacity-50" />
							Application Question
						</button>
						<button
							type="button"
							onclick={openPaste}
							class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[var(--dash-text)] transition-colors hover:bg-[var(--dash-bg)]"
						>
							<FontAwesomeIcon icon={faPaste} class="h-3.5 w-3.5 opacity-50" />
							Paste questions (and answers)
						</button>
					</div>
				{/if}
			</div>
		</div>
	{:else}
		<div class="space-y-3">
			{#each items as item (getItemId(item))}
				{@const itemId = getItemId(item)}
				{@const isLetter = item.itemType === 'letter'}

				{#if isLetter}
					{@const letterItem = item as LetterItem}
					{@const versions = letterItem.letter_versions || []}
					{@const versionCount = versions.filter(
						(v: { content: string | null }) => v.content
					).length}
					{@const firstContentVersion = versions.find((v: { content: string | null }) => v.content)}
					{@const isAiStarted = firstContentVersion
						? firstContentVersion.source === 'ai_generation'
						: !!letterItem.ai_chat_id}
					{@const latestContent = (() => {
						for (let i = versions.length - 1; i >= 0; i--) {
							if (versions[i].content) return versions[i].content;
						}
						return letterItem.content;
					})()}
					{@const isExpanded = expandedId === itemId}
					<!-- Letter Card: expandable with text preview -->
					<Card class="overflow-hidden">
						<button
							type="button"
							onclick={() => toggleExpand(itemId)}
							class="w-full p-4 text-left {latestContent
								? 'hover:bg-[var(--dash-bg)]'
								: ''} transition-colors"
							disabled={!latestContent}
						>
							<div class="flex items-center gap-4">
								<div
									class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[var(--dash-bg)]"
								>
									<FontAwesomeIcon icon={faEnvelope} class="h-5 w-5 text-blue-600" />
								</div>
								<div class="min-w-0 flex-1">
									<div class="flex flex-wrap items-center gap-2">
										<h3 class="truncate font-medium text-[var(--dash-text)]">
											{letterTypes[letterItem.letter_type] || letterItem.letter_type}
										</h3>
										<span
											class="rounded-full px-2 py-0.5 text-xs capitalize {letterItem.status ===
											'ready'
												? 'bg-[var(--dash-success-light)] text-[var(--dash-success)]'
												: letterItem.status === 'sent'
													? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
													: 'bg-[var(--dash-bg)] text-[var(--dash-text-muted)]'}"
										>
											{letterItem.status}
										</span>
									</div>
									<p class="text-sm text-[var(--dash-text-secondary)]">
										{formatDate(item.date_updated || item.date_created)}
										{#if latestContent}
											<span class="mx-1">&middot;</span>
											<span class="inline-flex items-center gap-1">
												<FontAwesomeIcon icon={isAiStarted ? faRobot : faPen} class="h-3 w-3" />
												{isAiStarted ? 'AI assisted' : 'Self-written'}
											</span>
											{#if versionCount > 1}
												<span class="mx-1">&middot;</span>
												<span>{versionCount} versions</span>
											{/if}
										{:else}
											<span class="mx-1">&middot;</span>
											<span class="text-[var(--dash-text-muted)] italic">No content yet</span>
										{/if}
									</p>
								</div>
								<div class="flex flex-shrink-0 items-center gap-1">
									<a
										href="/applications/{app.id}/texts/{item.id}"
										class="cursor-pointer p-1.5 text-[var(--dash-text-secondary)] transition-colors hover:text-[var(--dash-primary)]"
										aria-label="Edit"
										onclick={(e) => e.stopPropagation()}
									>
										<FontAwesomeIcon icon={faPencil} class="h-4 w-4" />
									</a>
									{#if latestContent}
										<span
											class="inline-block transition-transform duration-200 {isExpanded
												? 'rotate-90'
												: ''}"
										>
											<FontAwesomeIcon
												icon={faChevronRight}
												class="h-4 w-4 text-[var(--dash-text-secondary)]"
											/>
										</span>
									{/if}
								</div>
							</div>
						</button>

						{#if isExpanded && latestContent}
							<div class="max-h-96 overflow-y-auto border-t border-[var(--dash-border)] px-4 py-3">
								<p class="text-sm break-words whitespace-pre-wrap text-[var(--dash-text)]">
									{latestContent}
								</p>
							</div>
						{/if}
					</Card>
				{:else}
					<!-- Question Card: expandable with inline editing -->
					<Card class="overflow-hidden">
						<!-- Header -->
						<button
							type="button"
							onclick={() => toggleExpand(itemId)}
							class="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-[var(--dash-bg)]"
						>
							<div class="flex min-w-0 flex-1 items-center gap-4">
								<div
									class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[var(--dash-bg)]"
								>
									<FontAwesomeIcon icon={faQuestionCircle} class="h-5 w-5 text-purple-600" />
								</div>
								<div class="min-w-0 flex-1">
									<h3 class="truncate font-medium text-[var(--dash-text)]">
										{(item as QuestionItem).question}
									</h3>
									<p class="text-sm text-[var(--dash-text-secondary)]">
										{formatDate(item.date_updated || item.date_created)}
										{#if (item as QuestionItem).answer}
											<span class="mx-1">&middot;</span>
											<span class="text-[var(--dash-success)]">Answered</span>
										{/if}
									</p>
								</div>
							</div>
							<div class="flex flex-shrink-0 items-center gap-1">
								<a
									href="/applications/{app.id}/texts/questions/{item.id}"
									onclick={(e) => e.stopPropagation()}
									class="cursor-pointer p-1.5 text-[var(--dash-text-secondary)] transition-colors hover:text-[var(--dash-primary)]"
									aria-label="Open answer editor"
									title="Open editor — write, review, and iterate on this answer with AI"
								>
									<FontAwesomeIcon icon={faPencil} class="h-4 w-4" />
								</a>
								<span
									role="button"
									tabindex="0"
									onclick={(e) => {
										e.stopPropagation();
										deleteItem = { id: item.id, type: 'question' };
									}}
									onkeydown={(e) => {
										if (e.key === 'Enter' || e.key === ' ') {
											e.preventDefault();
											e.stopPropagation();
											deleteItem = { id: item.id, type: 'question' };
										}
									}}
									class="cursor-pointer p-1.5 text-[var(--dash-text-secondary)] transition-colors hover:text-red-500"
									aria-label="Delete question"
								>
									<FontAwesomeIcon icon={faTrash} class="h-4 w-4" />
								</span>
								<span
									class="inline-block transition-transform duration-200 {expandedId === itemId
										? 'rotate-90'
										: ''}"
								>
									<FontAwesomeIcon
										icon={faChevronRight}
										class="h-4 w-4 text-[var(--dash-text-secondary)]"
									/>
								</span>
							</div>
						</button>

						<!-- Expanded Content: read-only preview. Writing, AI generate,
                 review and iteration all live on the dedicated editor page. -->
						{#if expandedId === itemId}
							<div class="space-y-3 border-t border-[var(--dash-border)] p-4">
								<div class="rounded-lg border-l-2 border-purple-500 bg-[var(--dash-bg)] px-3 py-2">
									<p
										class="mb-1 text-xs font-semibold tracking-wide text-[var(--dash-text-muted)] uppercase"
									>
										Question
									</p>
									<p class="font-medium text-[var(--dash-text)]">
										{(item as QuestionItem).question}
									</p>
								</div>
								{#if (item as QuestionItem).answer}
									<div class="px-3 py-1">
										<p
											class="mb-1 text-xs font-semibold tracking-wide text-[var(--dash-text-muted)] uppercase"
										>
											Answer
										</p>
										<p class="break-words whitespace-pre-wrap text-[var(--dash-text)]">
											{(item as QuestionItem).answer}
										</p>
									</div>
								{:else}
									<p class="px-3 text-[var(--dash-text-secondary)] italic">No answer yet.</p>
								{/if}
								<div class="flex justify-end border-t border-[var(--dash-border)] pt-2">
									<a
										href="/applications/{app.id}/texts/questions/{item.id}"
										class="flex items-center gap-1.5 rounded-lg bg-[var(--dash-primary)] px-3 py-1.5 text-sm text-white transition-colors hover:bg-[var(--dash-primary-hover)]"
									>
										<FontAwesomeIcon icon={faPencil} class="h-3.5 w-3.5" />
										{(item as QuestionItem).answer ? 'Open editor' : 'Write / generate answer'}
									</a>
								</div>
							</div>
						{/if}
					</Card>
				{/if}
			{/each}
		</div>
	{/if}
</div>

<!-- Delete Confirmation Modal -->
<ConfirmModal
	isOpen={deleteItem !== null}
	title="Delete Question"
	message="Are you sure you want to delete this question? This action cannot be undone."
	onCancel={() => (deleteItem = null)}
	onConfirm={() => {
		if (deleteItem !== null) {
			const form = document.createElement('form');
			form.method = 'POST';
			form.action = '?/deleteQuestion';
			const input = document.createElement('input');
			input.type = 'hidden';
			input.name = 'id';
			input.value = String(deleteItem.id);
			form.appendChild(input);
			document.body.appendChild(form);
			form.submit();
		}
	}}
/>
