<script lang="ts">
	import type { ActionData, PageData } from './$types';
	import { enhance } from '$app/forms';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faCheck,
		faEnvelope,
		faLightbulb,
		faPencil,
		faPlus,
		faStar,
		faTimes,
		faTrash
	} from '@fortawesome/free-solid-svg-icons';
	import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
	import { iconFor } from '$lib/components/PortfolioSite/showcase/icons';
	import SectionHeader from '../../components/SectionHeader.svelte';
	import EmptyState from '../../components/EmptyState.svelte';
	import ConfirmModal from '../../components/ConfirmModal.svelte';
	import Card from '../../../components/Card.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	type Row = PageData['highlights'][number];
	type Kind = 'highlight' | 'contact_for';

	/**
	 * The page keeps two lists in one table, each printed somewhere else on a
	 * portfolio site: highlights on its Highlights section, and Contact for lines
	 * in the box beside a showcase's About me. A row's `type` says which, and the
	 * add form posts the kind of the list it opened under. A row of any other
	 * kind (the retired `key_skill`) is listed with the highlights, so it can
	 * still be found and deleted.
	 */
	const KINDS: Record<Kind, { noun: string; placeholder: string; iconPlaceholder: string }> = {
		highlight: {
			noun: 'Highlight',
			placeholder: 'e.g., 10+ years of experience in software development',
			iconPlaceholder: 'e.g., star'
		},
		contact_for: {
			noun: 'Line',
			placeholder: 'e.g., Application development',
			iconPlaceholder: 'e.g., code'
		}
	};

	let highlights = $derived(data.highlights.filter((h) => h.type !== 'contact_for'));
	let contactFor = $derived(data.highlights.filter((h) => h.type === 'contact_for'));
	let editingId = $state<number | null>(null);
	/** The list whose add form is open, one at a time. */
	let adding = $state<Kind | null>(null);
	let deleteId = $state<number | null>(null);
	let deleteNoun = $derived(
		data.highlights.find((h) => h.id === deleteId)?.type === 'contact_for' ? 'line' : 'highlight'
	);

	// Form states
	let newText = $state('');
	let newIconName = $state('');

	let editText = $state('');
	let editIconName = $state('');

	function startEdit(highlight: Row) {
		editingId = highlight.id;
		editText = highlight.text || '';
		editIconName = highlight.icon_name || '';
	}

	function cancelEdit() {
		editingId = null;
	}

	function openAddForm(kind: Kind) {
		adding = kind;
		newText = '';
		newIconName = '';
	}

	function resetAddForm() {
		adding = null;
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
</script>

<svelte:head>
	<title>Highlights - Profile - Smart Job Seeker</title>
</svelte:head>

{#snippet addForm(kind: Kind)}
	<form
		method="POST"
		action="?/create"
		use:enhance={handleAddSubmit}
		class="rounded-lg border border-[var(--dash-primary)] bg-[var(--dash-card)] p-4"
	>
		<input type="hidden" name="type" value={kind} />
		<h3 class="mb-4 font-medium text-[var(--dash-text)]">Add New {KINDS[kind].noun}</h3>
		<div class="grid grid-cols-1 gap-4 md:grid-cols-4">
			<div class="md:col-span-3">
				<label for="new-text" class="mb-1 block text-sm font-medium text-[var(--dash-text)]">
					{KINDS[kind].noun} Text <span class="text-[var(--dash-error)]">*</span>
				</label>
				<input
					type="text"
					id="new-text"
					name="text"
					bind:value={newText}
					placeholder={KINDS[kind].placeholder}
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
					placeholder={KINDS[kind].iconPlaceholder}
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
				Add {KINDS[kind].noun}
			</button>
		</div>
	</form>
{/snippet}

{#snippet rowList(rows: Row[], fallbackIcon: IconDefinition)}
	<div class="space-y-3">
		{#each rows as highlight (highlight.id)}
			{@const icon = iconFor(highlight.icon_name || highlight.fa_icon)}
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
									Text <span class="text-[var(--dash-error)]">*</span>
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
								class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--dash-bg)]"
							>
								<FontAwesomeIcon
									icon={icon ?? fallbackIcon}
									class="h-5 w-5 text-[var(--dash-primary)]"
								/>
							</div>
							<div>
								<p class="text-[var(--dash-text)]">{highlight.text}</p>
								{#if highlight.icon_name}
									<p class="text-sm text-[var(--dash-text-secondary)]">
										Icon: {highlight.icon_name}
										{#if !icon}
											<span>(not one the portfolio site has, so it shows no icon there)</span>
										{/if}
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
{/snippet}

<div class="space-y-6">
	<SectionHeader
		title="Highlights"
		icon={faLightbulb}
		showAddButton={adding !== 'highlight' && highlights.length > 0}
		addLabel="Add Highlight"
		onAdd={() => openAddForm('highlight')}
	/>

	{#if form?.error}
		<div class="rounded-lg border border-[var(--dash-error)] bg-[var(--dash-error-light)] p-4">
			<p class="text-sm text-[var(--dash-error)]">{form.error}</p>
		</div>
	{/if}

	{#if adding === 'highlight'}
		{@render addForm('highlight')}
	{/if}

	<!-- Highlights List -->
	{#if highlights.length === 0 && adding !== 'highlight'}
		<EmptyState
			icon={faLightbulb}
			title="No highlights yet"
			description="Add key achievements and career highlights to showcase your accomplishments."
			actionLabel="Add First Highlight"
			onAction={() => openAddForm('highlight')}
		/>
	{:else}
		{@render rowList(highlights, faStar)}
	{/if}

	<!-- Contact For List -->
	<section aria-labelledby="contact-for-heading" class="space-y-4 pt-6">
		<div class="flex items-start justify-between gap-4">
			<div>
				<h2 id="contact-for-heading" class="text-xl font-semibold text-[var(--dash-text)]">
					Contact for
				</h2>
				<p class="mt-1 text-sm text-[var(--dash-text-secondary)]">
					What visitors can get in touch with you about, a few words each. A portfolio site in the
					Showcase layout prints them in a box beside your About me.
				</p>
			</div>
			{#if adding !== 'contact_for'}
				<button
					type="button"
					onclick={() => openAddForm('contact_for')}
					class="flex shrink-0 items-center justify-center gap-2 rounded-lg bg-[var(--dash-primary)] p-3 text-white transition-colors hover:bg-[var(--dash-primary-hover)] sm:px-4 sm:py-2"
				>
					<FontAwesomeIcon icon={faPlus} class="h-5 w-5 sm:h-4 sm:w-4" />
					<span class="hidden sm:inline">Add Line</span>
				</button>
			{/if}
		</div>

		{#if adding === 'contact_for'}
			{@render addForm('contact_for')}
		{/if}

		{#if contactFor.length > 0}
			{@render rowList(contactFor, faEnvelope)}
		{:else if adding !== 'contact_for'}
			<p class="text-sm text-[var(--dash-text-secondary)]">
				None yet, so the site shows no Contact for box.
			</p>
		{/if}
	</section>
</div>

<!-- Delete Confirmation Modal -->
<ConfirmModal
	isOpen={deleteId !== null}
	title={deleteNoun === 'line' ? 'Delete Line' : 'Delete Highlight'}
	message="Are you sure you want to delete this {deleteNoun}? This action cannot be undone."
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
