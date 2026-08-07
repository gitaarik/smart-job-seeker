<script lang="ts">
	import type { ActionData, PageData } from './$types';
	import { enhance } from '$app/forms';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faCheck,
		faLightbulb,
		faPencil,
		faPlus,
		faStar,
		faTimes,
		faTrash
	} from '@fortawesome/free-solid-svg-icons';
	import SectionHeader from '../../components/SectionHeader.svelte';
	import EmptyState from '../../components/EmptyState.svelte';
	import ConfirmModal from '../../components/ConfirmModal.svelte';
	import Card from '../../../components/Card.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let highlights = $derived(data.highlights);
	let editingId = $state<number | null>(null);
	let showAddForm = $state(false);
	let deleteId = $state<number | null>(null);

	// Form states
	let newText = $state('');
	let newIconName = $state('');

	let editText = $state('');
	let editIconName = $state('');

	function startEdit(highlight: (typeof highlights)[0]) {
		editingId = highlight.id;
		editText = highlight.text || '';
		editIconName = highlight.icon_name || '';
	}

	function cancelEdit() {
		editingId = null;
	}

	function resetAddForm() {
		showAddForm = false;
		newText = '';
		newIconName = '';
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
				editingId = null;
			}
		};
	}

	function handleDeleteSubmit() {
		return async ({
			result,
			update
		}: {
			result: { type: string };
			update: () => Promise<void>;
		}) => {
			await update();
			if (result.type === 'success') {
				deleteId = null;
			}
		};
	}
</script>

<svelte:head>
	<title>Highlights - Profile - Smart Job Seeker</title>
</svelte:head>

<div class="space-y-6">
	<SectionHeader
		title="Highlights"
		icon={faLightbulb}
		showAddButton={!showAddForm && highlights.length > 0}
		addLabel="Add Highlight"
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
			<h3 class="mb-4 font-medium text-[var(--dash-text)]">Add New Highlight</h3>
			<div class="grid grid-cols-1 gap-4 md:grid-cols-4">
				<div class="md:col-span-3">
					<label for="new-text" class="mb-1 block text-sm font-medium text-[var(--dash-text)]">
						Highlight Text <span class="text-[var(--dash-error)]">*</span>
					</label>
					<input
						type="text"
						id="new-text"
						name="text"
						bind:value={newText}
						placeholder="e.g., 10+ years of experience in software development"
						required
						class="w-full rounded-md border border-[var(--dash-border)] px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
					/>
				</div>

				<div>
					<label for="new-icon" class="mb-1 block text-sm font-medium text-[var(--dash-text)]">
						Icon Name
					</label>
					<input
						type="text"
						id="new-icon"
						name="icon_name"
						bind:value={newIconName}
						placeholder="e.g., star"
						class="w-full rounded-md border border-[var(--dash-border)] px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
					/>
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
					Add Highlight
				</button>
			</div>
		</form>
	{/if}

	<!-- Highlights List -->
	{#if highlights.length === 0 && !showAddForm}
		<EmptyState
			icon={faLightbulb}
			title="No highlights yet"
			description="Add key achievements and career highlights to showcase your accomplishments."
			actionLabel="Add First Highlight"
			onAction={() => (showAddForm = true)}
		/>
	{:else}
		<div class="space-y-3">
			{#each highlights as highlight (highlight.id)}
				<Card padding="md">
					{#if editingId === highlight.id}
						<!-- Edit Mode -->
						<form method="POST" action="?/update" use:enhance={handleEditSubmit}>
							<input type="hidden" name="id" value={highlight.id} />
							<div class="grid grid-cols-1 gap-4 md:grid-cols-4">
								<div class="md:col-span-3">
									<label
										for="edit-text-{highlight.id}"
										class="mb-1 block text-sm font-medium text-[var(--dash-text)]"
									>
										Highlight Text <span class="text-[var(--dash-error)]">*</span>
									</label>
									<input
										type="text"
										id="edit-text-{highlight.id}"
										name="text"
										bind:value={editText}
										required
										class="w-full rounded-md border border-[var(--dash-border)] px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
									/>
								</div>

								<div>
									<label
										for="edit-icon-{highlight.id}"
										class="mb-1 block text-sm font-medium text-[var(--dash-text)]"
									>
										Icon Name
									</label>
									<input
										type="text"
										id="edit-icon-{highlight.id}"
										name="icon_name"
										bind:value={editIconName}
										class="w-full rounded-md border border-[var(--dash-border)] px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
									/>
								</div>
							</div>

							<div class="mt-4 flex justify-end gap-2">
								<button
									type="button"
									onclick={cancelEdit}
									class="p-2 text-[var(--dash-text-secondary)] transition-colors hover:text-[var(--dash-text)]"
									aria-label="Cancel"
								>
									<FontAwesomeIcon icon={faTimes} class="h-4 w-4" />
								</button>
								<button
									type="submit"
									class="p-2 text-[var(--dash-primary)] transition-colors hover:text-[var(--dash-primary-hover)]"
									aria-label="Save"
								>
									<FontAwesomeIcon icon={faCheck} class="h-4 w-4" />
								</button>
							</div>
						</form>
					{:else}
						<!-- View Mode -->
						<div class="flex items-center justify-between">
							<div class="flex items-center gap-4">
								<div
									class="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--dash-bg)]"
								>
									<FontAwesomeIcon icon={faStar} class="h-5 w-5 text-[var(--dash-primary)]" />
								</div>
								<div>
									<p class="text-[var(--dash-text)]">{highlight.text}</p>
									{#if highlight.icon_name}
										<p class="text-sm text-[var(--dash-text-secondary)]">
											Icon: {highlight.icon_name}
										</p>
									{/if}
								</div>
							</div>

							<div class="flex items-center gap-2">
								<button
									type="button"
									onclick={() => startEdit(highlight)}
									class="p-2 text-[var(--dash-text-secondary)] transition-colors hover:text-[var(--dash-primary)]"
									aria-label="Edit"
								>
									<FontAwesomeIcon icon={faPencil} class="h-4 w-4" />
								</button>
								<button
									type="button"
									onclick={() => (deleteId = highlight.id)}
									class="p-2 text-[var(--dash-text-secondary)] transition-colors hover:text-[var(--dash-error)]"
									aria-label="Delete"
								>
									<FontAwesomeIcon icon={faTrash} class="h-4 w-4" />
								</button>
							</div>
						</div>
					{/if}
				</Card>
			{/each}
		</div>
	{/if}
</div>

<!-- Delete Confirmation Modal -->
<ConfirmModal
	isOpen={deleteId !== null}
	title="Delete Highlight"
	message="Are you sure you want to delete this highlight? This action cannot be undone."
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
