<script lang="ts">
	import type { ActionData, PageData } from './$types';
	import { enhance } from '$app/forms';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faArrowsUpDown,
		faCircleNotch,
		faGripVertical,
		faPencil,
		faQuoteLeft,
		faTrash
	} from '@fortawesome/free-solid-svg-icons';
	import { dragHandleZone, dragHandle } from 'svelte-dnd-action';
	import { flip } from 'svelte/animate';
	import { invalidateAll } from '$app/navigation';
	import SectionHeader from '../../components/SectionHeader.svelte';
	import EmptyState from '../../components/EmptyState.svelte';
	import ConfirmModal from '../../components/ConfirmModal.svelte';
	import ItemCard from '../../components/ItemCard.svelte';
	import Card from '../../../components/Card.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let references = $derived(data.references);
	let expandedId = $state<number | null>(null);
	let showAddForm = $state(false);
	let deleteId = $state<number | null>(null);

	// Form states
	let newAuthor = $state('');
	let newAuthorPosition = $state('');
	let newText = $state('');

	let editAuthor = $state('');
	let editAuthorPosition = $state('');
	let editText = $state('');
	let originalAuthor = $state('');
	let originalAuthorPosition = $state('');
	let originalText = $state('');
	let showDiscardConfirm = $state(false);

	function isEditDirty(): boolean {
		return (
			editAuthor !== originalAuthor ||
			editAuthorPosition !== originalAuthorPosition ||
			editText !== originalText
		);
	}

	function toggleExpand(id: number) {
		if (expandedId === id) {
			if (isEditDirty()) {
				showDiscardConfirm = true;
			} else {
				expandedId = null;
			}
		} else {
			expandedId = id;
			const ref = references.find((r) => r.id === id);
			if (ref) {
				editAuthor = ref.author || '';
				editAuthorPosition = ref.author_position || '';
				editText = ref.text || '';
				originalAuthor = editAuthor;
				originalAuthorPosition = editAuthorPosition;
				originalText = editText;
			}
		}
	}

	function confirmDiscard() {
		expandedId = null;
		showDiscardConfirm = false;
	}

	function resetAddForm() {
		showAddForm = false;
		newAuthor = '';
		newAuthorPosition = '';
		newText = '';
	}

	function handleAddSubmit() {
		return async ({
			result,
			update
		}: {
			result: { type: string };
			update: () => Promise<void>;
		}) => {
			await update();
			if (result.type === 'success') {
				resetAddForm();
			}
		};
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
				expandedId = null;
			}
		};
	}

	// --- Reorder mode ---
	let reorderMode = $state(false);
	let reorderSaving = $state(false);
	interface DndItem {
		id: string;
		ref: (typeof references)[0];
		[key: string]: unknown;
	}
	let dndItems = $state<DndItem[]>([]);
	const flipDurationMs = 150;

	let canReorder = $derived(references.length > 1);

	function startReorder() {
		dndItems = references.map((ref) => ({
			id: String(ref.id),
			ref
		}));
		reorderMode = true;
	}

	function handleDndConsider(e: CustomEvent<{ items: DndItem[] }>) {
		dndItems = e.detail.items;
	}

	function handleDndFinalize(e: CustomEvent<{ items: DndItem[] }>) {
		dndItems = e.detail.items;
	}

	async function confirmReorder() {
		reorderSaving = true;
		const ids = dndItems.map((d) => parseInt(d.id)).filter((id) => !isNaN(id));
		try {
			await fetch('/api/references', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ profile_id: data.profileId, order: ids })
			});
			await invalidateAll();
		} catch {
			// silently fail
		}
		reorderSaving = false;
		reorderMode = false;
	}

	function cancelReorder() {
		reorderMode = false;
	}
</script>

<svelte:head>
	<title>References - Profile - Smart Job Seeker</title>
</svelte:head>

<div class="space-y-6">
	<SectionHeader
		title="References"
		icon={faQuoteLeft}
		showAddButton={!showAddForm && references.length > 0}
		addLabel="Add Reference"
		onAdd={() => (showAddForm = true)}
	/>

	{#if form?.error}
		<div class="rounded-lg border border-[var(--dash-error)] bg-[var(--dash-error-light)] p-4">
			<p class="text-sm text-[var(--dash-error)]">{form.error}</p>
		</div>
	{/if}

	<!-- Add Form -->
	{#if showAddForm}
		<form
			method="POST"
			action="?/create"
			use:enhance={handleAddSubmit}
			class="rounded-lg border border-[var(--dash-primary)] bg-[var(--dash-card)] p-4"
		>
			<h3 class="mb-4 font-medium text-[var(--dash-text)]">Add New Reference</h3>
			<div class="space-y-4">
				<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
					<div>
						<label for="new-author" class="mb-1 block text-sm font-medium text-[var(--dash-text)]">
							Author Name <span class="text-[var(--dash-error)]">*</span>
						</label>
						<input
							type="text"
							id="new-author"
							name="author"
							bind:value={newAuthor}
							placeholder="e.g., John Smith"
							required
							class="w-full rounded-md border border-[var(--dash-border)] px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
						/>
					</div>

					<div>
						<label
							for="new-position"
							class="mb-1 block text-sm font-medium text-[var(--dash-text)]"
						>
							Position
						</label>
						<input
							type="text"
							id="new-position"
							name="author_position"
							bind:value={newAuthorPosition}
							placeholder="e.g., CTO at Company Inc."
							class="w-full rounded-md border border-[var(--dash-border)] px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
						/>
					</div>
				</div>

				<div>
					<label for="new-text" class="mb-1 block text-sm font-medium text-[var(--dash-text)]">
						Reference Text
					</label>
					<textarea
						id="new-text"
						name="text"
						bind:value={newText}
						rows={4}
						placeholder="Write the reference text..."
						class="w-full resize-y rounded-md border border-[var(--dash-border)] px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
					></textarea>
				</div>
			</div>

			<div class="mt-4 flex justify-end gap-2">
				<button
					type="button"
					onclick={resetAddForm}
					class="rounded-lg border border-[var(--dash-border)] px-4 py-2 text-[var(--dash-text)] transition-colors hover:bg-[var(--dash-bg)]"
				>
					Cancel
				</button>
				<button
					type="submit"
					class="rounded-lg bg-[var(--dash-primary)] px-4 py-2 text-white transition-colors hover:bg-[var(--dash-primary-hover)]"
				>
					Add Reference
				</button>
			</div>
		</form>
	{/if}

	{#if canReorder && !reorderMode && !showAddForm}
		<div class="flex justify-end">
			<button
				type="button"
				onclick={startReorder}
				class="inline-flex items-center gap-1.5 rounded-lg border border-[var(--dash-border)] bg-[var(--dash-bg)] px-3 py-1.5 text-xs font-medium text-[var(--dash-text-muted)] transition-colors hover:text-[var(--dash-text-secondary)]"
			>
				<FontAwesomeIcon icon={faArrowsUpDown} class="h-3 w-3" />
				Reorder
			</button>
		</div>
	{/if}

	<!-- References List -->
	{#if references.length === 0 && !showAddForm}
		<EmptyState
			icon={faQuoteLeft}
			title="No references yet"
			description="Add professional references and recommendations to strengthen your profile."
			actionLabel="Add First Reference"
			onAction={() => (showAddForm = true)}
		/>
	{:else if reorderMode}
		{#snippet reorderConfirmCancel()}
			<div class="flex items-center justify-end gap-2">
				<span class="text-xs text-[var(--dash-text-muted)]">Reorder References</span>
				<button
					type="button"
					onclick={cancelReorder}
					class="rounded-lg border border-[var(--dash-border)] px-3 py-1 text-xs text-[var(--dash-text)] transition-colors hover:bg-[var(--dash-bg)]"
				>
					Cancel
				</button>
				<button
					type="button"
					onclick={confirmReorder}
					disabled={reorderSaving}
					class="inline-flex items-center gap-1.5 rounded-lg bg-[var(--dash-success)] px-3 py-1 text-xs text-white transition-colors hover:opacity-90 disabled:opacity-70"
				>
					{#if reorderSaving}<FontAwesomeIcon icon={faCircleNotch} spin class="h-3 w-3" />{/if}
					Save
				</button>
			</div>
		{/snippet}

		{@render reorderConfirmCancel()}
		<div
			class="mt-2 space-y-2"
			use:dragHandleZone={{ items: dndItems, flipDurationMs, type: 'references' }}
			onconsider={handleDndConsider}
			onfinalize={handleDndFinalize}
		>
			{#each dndItems as dndItem (dndItem.id)}
				<div animate:flip={{ duration: flipDurationMs }}>
					<Card class="p-3 sm:p-4">
						<div class="flex items-center gap-3">
							<div use:dragHandle class="-m-1 cursor-grab touch-none p-1 active:cursor-grabbing">
								<FontAwesomeIcon
									icon={faGripVertical}
									class="h-4 w-4 flex-shrink-0 text-[var(--dash-text-muted)]"
								/>
							</div>
							<FontAwesomeIcon
								icon={faQuoteLeft}
								class="h-4 w-4 flex-shrink-0 text-[var(--dash-primary)]"
							/>
							<h3 class="truncate text-base font-semibold text-[var(--dash-text)]">
								{dndItem.ref.author || 'Untitled'}
							</h3>
							{#if dndItem.ref.author_position}
								<span class="flex-shrink-0 text-xs text-[var(--dash-text-muted)]">
									{dndItem.ref.author_position}
								</span>
							{/if}
						</div>
					</Card>
				</div>
			{/each}
		</div>
		<div class="mt-2">
			{@render reorderConfirmCancel()}
		</div>
	{:else}
		<div class="space-y-4">
			{#each references as ref (ref.id)}
				<ItemCard id={ref.id} {expandedId} onToggle={toggleExpand} icon={faQuoteLeft}>
					{#snippet title()}
						{ref.author}
					{/snippet}

					{#snippet subtitle()}
						{#if ref.author_position}
							{ref.author_position}
						{/if}
					{/snippet}

					{#snippet dateline()}
						{#if ref.text}
							<span class="text-sm text-[var(--dash-text)] italic">"{ref.text}"</span>
						{/if}
					{/snippet}

					{#snippet headerActions()}
						<button
							type="button"
							onclick={(e) => {
								e.stopPropagation();
								if (expandedId !== ref.id) toggleExpand(ref.id);
							}}
							class="cursor-pointer p-1.5 text-[var(--dash-text-secondary)] transition-colors hover:text-[var(--dash-primary)]"
							aria-label="Edit"
						>
							<FontAwesomeIcon icon={faPencil} class="h-4 w-4" />
						</button>
					{/snippet}

					{#snippet expandedContent()}
						<form method="POST" action="?/update" use:enhance={handleEditSubmit}>
							<input type="hidden" name="id" value={ref.id} />
							<div class="space-y-4">
								<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
									<div>
										<label
											for="edit-author-{ref.id}"
											class="mb-1 block text-sm font-medium text-[var(--dash-text)]"
										>
											Author Name <span class="text-[var(--dash-error)]">*</span>
										</label>
										<input
											type="text"
											id="edit-author-{ref.id}"
											name="author"
											bind:value={editAuthor}
											required
											class="w-full rounded-md border border-[var(--dash-border)] px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
										/>
									</div>

									<div>
										<label
											for="edit-position-{ref.id}"
											class="mb-1 block text-sm font-medium text-[var(--dash-text)]"
										>
											Position
										</label>
										<input
											type="text"
											id="edit-position-{ref.id}"
											name="author_position"
											bind:value={editAuthorPosition}
											class="w-full rounded-md border border-[var(--dash-border)] px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
										/>
									</div>
								</div>

								<div>
									<label
										for="edit-text-{ref.id}"
										class="mb-1 block text-sm font-medium text-[var(--dash-text)]"
									>
										Reference Text
									</label>
									<textarea
										id="edit-text-{ref.id}"
										name="text"
										bind:value={editText}
										rows={4}
										class="w-full resize-y rounded-md border border-[var(--dash-border)] px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
									></textarea>
								</div>
							</div>

							<div class="mt-4 flex items-center">
								<button
									type="button"
									onclick={() => {
										expandedId = null;
										deleteId = ref.id;
									}}
									class="flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-500 transition-colors hover:border-red-500/50 hover:bg-red-500/20"
								>
									<FontAwesomeIcon icon={faTrash} class="h-3 w-3" /> Delete
								</button>
								<div class="ml-auto flex gap-2">
									<button
										type="button"
										onclick={() => (expandedId = null)}
										class="rounded-lg border border-[var(--dash-border)] px-4 py-2 text-[var(--dash-text)] transition-colors hover:bg-[var(--dash-bg)]"
									>
										Cancel
									</button>
									<button
										type="submit"
										class="rounded-lg bg-[var(--dash-primary)] px-4 py-2 text-white transition-colors hover:bg-[var(--dash-primary-hover)]"
									>
										Save
									</button>
								</div>
							</div>
						</form>
					{/snippet}
				</ItemCard>
			{/each}
		</div>
	{/if}
</div>

<!-- Delete Confirmation Modal -->
<ConfirmModal
	isOpen={deleteId !== null}
	title="Delete Reference"
	message="Are you sure you want to delete this reference? This action cannot be undone."
	onCancel={() => (deleteId = null)}
	onConfirm={() => {
		if (deleteId !== null) {
			const form = document.createElement('form');
			form.method = 'POST';
			form.action = '?/delete';
			const input = document.createElement('input');
			input.type = 'hidden';
			input.name = 'id';
			input.value = String(deleteId);
			form.appendChild(input);
			document.body.appendChild(form);
			form.submit();
		}
	}}
/>

<ConfirmModal
	isOpen={showDiscardConfirm}
	title="Discard Changes"
	message="You have unsaved changes. Are you sure you want to discard them?"
	onCancel={() => (showDiscardConfirm = false)}
	onConfirm={confirmDiscard}
/>
