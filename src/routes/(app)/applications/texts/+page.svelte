<script lang="ts">
	import type { ActionData, PageData } from './$types';
	import { enhance } from '$app/forms';
	import { goto, invalidateAll } from '$app/navigation';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faCheck,
		faChevronRight,
		faEnvelope,
		faLayerGroup,
		faQuestionCircle,
		faRobot,
		faTimes,
		faTrash,
		faXmark
	} from '@fortawesome/free-solid-svg-icons';
	import Card from '../../components/Card.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import SectionHeader from '../../profile/components/SectionHeader.svelte';
	import EmptyState from '../../profile/components/EmptyState.svelte';
	import FilterTabs from '../../components/FilterTabs.svelte';
	import ConfirmModal from '../../profile/components/ConfirmModal.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let items = $derived(data.items);
	let currentType = $derived(data.currentType);
	let expandedId = $state<string | null>(null);
	let editingId = $state<string | null>(null);
	let deleteItem = $state<{ id: number; type: 'letter' | 'question' } | null>(null);

	// Edit form states
	let editContent = $state('');
	let editStatus = $state('');
	let editAnswer = $state('');

	// AI generation states
	let generatingIds = $state<Set<string>>(new Set());
	let aiError = $state<string | null>(null);
	const typeFilters = [
		{ value: 'all', label: 'All', icon: faLayerGroup },
		{ value: 'letters', label: 'Letters', icon: faEnvelope },
		{ value: 'questions', label: 'Questions', icon: faQuestionCircle }
	];

	const letterTypes: Record<string, string> = {
		cover_letter: 'Cover Letter',
		cheat_sheet: 'Interview Cheat Sheet'
	};

	function getItemId(item: (typeof items)[0]): string {
		return `${item.itemType}-${item.id}`;
	}

	function isGenerating(itemId: string): boolean {
		return generatingIds.has(itemId);
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
		if (editingId === id) return;
		expandedId = expandedId === id ? null : id;
	}

	function startEdit(item: (typeof items)[0]) {
		const id = getItemId(item);
		editingId = id;
		expandedId = id;
		if (item.itemType === 'letter') {
			editContent = item.content || '';
			editStatus = item.status || 'draft';
		} else {
			editAnswer = item.answer || '';
		}
	}

	function cancelEdit() {
		editingId = null;
	}

	function filterByType(type: string) {
		const params = new URLSearchParams();
		if (type !== 'all') {
			params.set('type', type);
		}
		goto(`?${params.toString()}`);
	}

	function handleEditSubmit() {
		return async ({
			result,
			update
		}: {
			result: { type: string };
			update: () => Promise<void>;
		}) => {
			await update();
			if (result.type === 'success') {
				editingId = null;
			}
		};
	}

	async function generateAi(item: (typeof items)[0]) {
		const itemId = getItemId(item);
		const isLetter = item.itemType === 'letter';
		const url = isLetter
			? `/api/ai/letters/${item.id}/generate`
			: `/api/ai/questions/${item.id}/generate`;

		generatingIds.add(itemId);
		generatingIds = new Set(generatingIds);
		aiError = null;

		try {
			const response = await fetch(url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({})
			});
			const result = await response.json();
			if (!result.success) {
				aiError = result.message || 'Generation failed';
				return;
			}
			await invalidateAll();
		} catch {
			aiError = 'Network error. Please try again.';
		} finally {
			generatingIds.delete(itemId);
			generatingIds = new Set(generatingIds);
		}
	}
</script>

<svelte:head>
	<title>Letter Templates - Smart Job Seeker</title>
</svelte:head>

<div class="space-y-6">
	<SectionHeader title="Texts" icon={faEnvelope} />

	{#if form?.error || aiError}
		<div class="rounded-lg border border-[var(--dash-error)] bg-[var(--dash-error-light)] p-4">
			<p class="text-sm text-[var(--dash-error)]">{form?.error || aiError}</p>
		</div>
	{/if}

	<!-- Type Filter -->
	<FilterTabs filters={typeFilters} value={currentType} onchange={filterByType} />

	<!-- Items List -->
	{#if items.length === 0}
		<EmptyState
			icon={faEnvelope}
			title="No texts yet"
			description={currentType === 'all'
				? 'Cover letters and question answers will appear here as you apply for jobs.'
				: currentType === 'letters'
					? "No letters found. Create letters from the application's Texts tab."
					: 'No questions found.'}
		/>
	{:else}
		<div class="space-y-3">
			{#each items as item (getItemId(item))}
				{@const itemId = getItemId(item)}
				{@const isLetter = item.itemType === 'letter'}
				{@const hasAiChat = !!item.ai_chat_id}
				{@const hasContent = isLetter ? !!item.content : !!item.answer}
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
								<FontAwesomeIcon
									icon={isLetter ? faEnvelope : faQuestionCircle}
									class="h-5 w-5 {isLetter ? 'text-blue-600' : 'text-purple-600'}"
								/>
							</div>

							<div class="min-w-0 flex-1">
								<div class="flex flex-wrap items-center gap-2">
									<h3 class="truncate font-medium text-[var(--dash-text)]">
										{#if isLetter}
											{letterTypes[item.letter_type] || item.letter_type}
										{:else}
											{item.question}
										{/if}
									</h3>
									{#if isLetter}
										<span
											class="
                        rounded-full px-2 py-0.5 text-xs capitalize {item.status === 'ready'
												? 'bg-[var(--dash-success-light)] text-[var(--dash-success)]'
												: item.status === 'sent'
													? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
													: 'bg-[var(--dash-bg)] text-[var(--dash-text-muted)]'}
                      "
										>
											{item.status}
										</span>
									{/if}
								</div>
								<p class="truncate text-sm text-[var(--dash-text-secondary)]">
									{item.application.job?.title || 'Unknown Position'} •
									{formatDate(item.date_updated || item.date_created)}
								</p>
							</div>
						</div>

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
					</button>

					<!-- Expanded Content -->
					{#if expandedId === itemId}
						<div class="border-t border-[var(--dash-border)] p-4">
							{#if editingId === itemId}
								<!-- Edit Mode -->
								{#if isLetter}
									<form method="POST" action="?/updateLetter" use:enhance={handleEditSubmit}>
										<input type="hidden" name="id" value={item.id} />
										<div class="space-y-4">
											<div>
												<label
													for="edit-content-{item.id}"
													class="mb-1 block text-sm font-medium text-[var(--dash-text)]"
												>
													Content
												</label>
												<textarea
													id="edit-content-{item.id}"
													name="content"
													bind:value={editContent}
													rows={10}
													class="w-full resize-y rounded-md border border-[var(--dash-border)] px-3 py-2 font-mono text-sm focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
												></textarea>
											</div>
											<div>
												<label
													for="edit-status-{item.id}"
													class="mb-1 block text-sm font-medium text-[var(--dash-text)]"
												>
													Status
												</label>
												<select
													id="edit-status-{item.id}"
													name="status"
													bind:value={editStatus}
													class="w-full rounded-md border border-[var(--dash-border)] px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
												>
													<option value="draft">Draft</option>
													<option value="ready">Ready</option>
													<option value="sent">Sent</option>
													<option value="archived">Archived</option>
												</select>
											</div>
										</div>
										<div class="mt-4 flex items-center justify-between">
											<button
												type="button"
												onclick={() => (deleteItem = { id: item.id, type: item.itemType })}
												class="flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs text-red-500 transition-colors hover:border-red-500/50 hover:bg-red-500/20 hover:text-red-600"
											>
												<FontAwesomeIcon icon={faTrash} class="h-3 w-3" />
												Delete
											</button>
											<div class="flex gap-1.5">
												<button
													type="button"
													onclick={cancelEdit}
													class="flex items-center gap-1.5 rounded-lg border border-[var(--dash-border)] bg-[var(--dash-bg)] px-3 py-1.5 text-xs text-[var(--dash-text-secondary)] transition-colors hover:border-[var(--dash-text-muted)] hover:text-[var(--dash-text)]"
												>
													<FontAwesomeIcon icon={faXmark} class="h-3 w-3" />
													Cancel
												</button>
												<button
													type="submit"
													class="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-600 transition-colors hover:border-emerald-500/50 hover:bg-emerald-500/20 hover:text-emerald-700"
												>
													<FontAwesomeIcon icon={faCheck} class="h-3 w-3" />
													Save
												</button>
											</div>
										</div>
									</form>
								{:else}
									<form method="POST" action="?/updateQuestion" use:enhance={handleEditSubmit}>
										<input type="hidden" name="id" value={item.id} />
										<div class="space-y-4">
											<div>
												<p class="mb-2 text-sm font-medium text-[var(--dash-text)]">Question</p>
												<p class="rounded-lg bg-[var(--dash-bg)] p-3 text-[var(--dash-text)]">
													{item.question}
												</p>
											</div>
											<div>
												<label
													for="edit-answer-{item.id}"
													class="mb-1 block text-sm font-medium text-[var(--dash-text)]"
												>
													Answer
												</label>
												<textarea
													id="edit-answer-{item.id}"
													name="answer"
													bind:value={editAnswer}
													rows={6}
													class="w-full resize-y rounded-md border border-[var(--dash-border)] px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
												></textarea>
											</div>
										</div>
										<div class="mt-4 flex items-center justify-between">
											<button
												type="button"
												onclick={() => (deleteItem = { id: item.id, type: item.itemType })}
												class="flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs text-red-500 transition-colors hover:border-red-500/50 hover:bg-red-500/20 hover:text-red-600"
											>
												<FontAwesomeIcon icon={faTrash} class="h-3 w-3" />
												Delete
											</button>
											<div class="flex gap-1.5">
												<button
													type="button"
													onclick={cancelEdit}
													class="flex items-center gap-1.5 rounded-lg border border-[var(--dash-border)] bg-[var(--dash-bg)] px-3 py-1.5 text-xs text-[var(--dash-text-secondary)] transition-colors hover:border-[var(--dash-text-muted)] hover:text-[var(--dash-text)]"
												>
													<FontAwesomeIcon icon={faXmark} class="h-3 w-3" />
													Cancel
												</button>
												<button
													type="submit"
													class="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-600 transition-colors hover:border-emerald-500/50 hover:bg-emerald-500/20 hover:text-emerald-700"
												>
													<FontAwesomeIcon icon={faCheck} class="h-3 w-3" />
													Save
												</button>
											</div>
										</div>
									</form>
								{/if}
							{:else}
								<!-- View Mode -->
								<div class="space-y-4">
									{#if isLetter}
										{#if item.content}
											<div class="prose prose-sm max-w-none">
												<pre
													class="overflow-x-auto rounded-lg bg-[var(--dash-bg)] p-4 text-sm whitespace-pre-wrap text-[var(--dash-text)]">{item.content}</pre>
											</div>
										{:else}
											<p class="text-[var(--dash-text-secondary)] italic">No content yet</p>
										{/if}
									{:else}
										<div>
											<p class="mb-1 text-sm font-medium text-[var(--dash-text-secondary)]">
												Question
											</p>
											<p class="text-[var(--dash-text)]">{item.question}</p>
										</div>
										{#if item.answer}
											<div>
												<p class="mb-1 text-sm font-medium text-[var(--dash-text-secondary)]">
													Answer
												</p>
												<p class="whitespace-pre-wrap text-[var(--dash-text)]">
													{item.answer}
												</p>
											</div>
										{:else}
											<p class="text-[var(--dash-text-secondary)] italic">No answer yet</p>
										{/if}
									{/if}

									<!-- Action Buttons -->
									<div
										class="flex items-center justify-end gap-2 border-t border-[var(--dash-border)] pt-2"
									>
										<button
											type="button"
											onclick={() => startEdit(item)}
											class="rounded-lg bg-[var(--dash-primary)] px-3 py-1.5 text-sm text-white transition-colors hover:bg-[var(--dash-primary-hover)]"
										>
											Edit
										</button>
										<button
											type="button"
											onclick={() => generateAi(item)}
											disabled={isGenerating(itemId)}
											class="flex items-center gap-1.5 rounded-lg border border-[var(--dash-border)] px-3 py-1.5 text-sm text-[var(--dash-text)] transition-colors hover:bg-[var(--dash-bg)] disabled:cursor-not-allowed disabled:opacity-50"
										>
											{#if isGenerating(itemId)}
												<Spinner size="w-3.5 h-3.5" />
											{:else}
												<FontAwesomeIcon icon={faRobot} class="h-3.5 w-3.5" />
											{/if}
											{isGenerating(itemId)
												? 'Generating...'
												: hasAiChat
													? 'Regenerate'
													: 'Generate'}
										</button>
									</div>
								</div>
							{/if}
						</div>
					{/if}
				</Card>
			{/each}
		</div>
	{/if}
</div>

<!-- Delete Confirmation Modal -->
<ConfirmModal
	isOpen={deleteItem !== null}
	title="Delete {deleteItem?.type === 'letter' ? 'Text' : 'Question'}"
	message="Are you sure you want to delete this {deleteItem?.type === 'letter'
		? 'text'
		: 'question'}? This action cannot be undone."
	onCancel={() => (deleteItem = null)}
	onConfirm={() => {
		if (deleteItem !== null) {
			const form = document.createElement('form');
			form.method = 'POST';
			form.action = deleteItem.type === 'letter' ? '?/deleteLetter' : '?/deleteQuestion';
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
