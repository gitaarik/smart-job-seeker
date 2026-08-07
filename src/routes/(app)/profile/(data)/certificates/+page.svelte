<script lang="ts">
	import type { ActionData, PageData } from './$types';
	import { enhance } from '$app/forms';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faArrowsUpDown,
		faCertificate,
		faCircleNotch,
		faGripVertical,
		faPencil,
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

	let certificates = $derived(data.certificates);
	let expandedId = $state<number | null>(null);
	let showAddForm = $state(false);
	let deleteId = $state<number | null>(null);

	// Form states
	let newName = $state('');
	let newIssuer = $state('');
	let newDate = $state('');
	let newUrl = $state('');

	let editName = $state('');
	let editIssuer = $state('');
	let editDate = $state('');
	let editUrl = $state('');
	let originalName = $state('');
	let originalIssuer = $state('');
	let originalDate = $state('');
	let originalUrl = $state('');
	let showDiscardConfirm = $state(false);

	function formatDateForInput(date: Date | string | null): string {
		if (!date) return '';
		const d = new Date(date);
		return d.toISOString().split('T')[0];
	}

	function formatDateForDisplay(date: Date | string | null): string {
		if (!date) return '';
		const d = new Date(date);
		return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
	}

	function isEditDirty(): boolean {
		return (
			editName !== originalName ||
			editIssuer !== originalIssuer ||
			editDate !== originalDate ||
			editUrl !== originalUrl
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
			const cert = certificates.find((c) => c.id === id);
			if (cert) {
				editName = cert.name || '';
				editIssuer = cert.issuer || '';
				editDate = formatDateForInput(cert.date);
				editUrl = cert.url || '';
				originalName = editName;
				originalIssuer = editIssuer;
				originalDate = editDate;
				originalUrl = editUrl;
			}
		}
	}

	function confirmDiscard() {
		expandedId = null;
		showDiscardConfirm = false;
	}

	function resetAddForm() {
		showAddForm = false;
		newName = '';
		newIssuer = '';
		newDate = '';
		newUrl = '';
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
		cert: (typeof certificates)[0];
		[key: string]: unknown;
	}
	let dndItems = $state<DndItem[]>([]);
	const flipDurationMs = 150;

	let canReorder = $derived(certificates.length > 1);

	function startReorder() {
		dndItems = certificates.map((cert) => ({
			id: String(cert.id),
			cert
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
			await fetch('/api/certificates', {
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
	<title>Certificates - Profile - Smart Job Seeker</title>
</svelte:head>

<div class="space-y-6">
	<SectionHeader
		title="Certificates"
		icon={faCertificate}
		showAddButton={!showAddForm && certificates.length > 0}
		addLabel="Add Certificate"
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
			<h3 class="mb-4 font-medium text-[var(--dash-text)]">Add New Certificate</h3>
			<div class="space-y-4">
				<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
					<div>
						<label for="new-name" class="mb-1 block text-sm font-medium text-[var(--dash-text)]">
							Certificate Name <span class="text-[var(--dash-error)]">*</span>
						</label>
						<input
							type="text"
							id="new-name"
							name="name"
							bind:value={newName}
							placeholder="e.g., AWS Solutions Architect"
							required
							class="w-full rounded-md border border-[var(--dash-border)] px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
						/>
					</div>

					<div>
						<label for="new-issuer" class="mb-1 block text-sm font-medium text-[var(--dash-text)]">
							Issuer
						</label>
						<input
							type="text"
							id="new-issuer"
							name="issuer"
							bind:value={newIssuer}
							placeholder="e.g., Amazon Web Services"
							class="w-full rounded-md border border-[var(--dash-border)] px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
						/>
					</div>
				</div>

				<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
					<div>
						<label for="new-date" class="mb-1 block text-sm font-medium text-[var(--dash-text)]">
							Date Obtained
						</label>
						<input
							type="date"
							id="new-date"
							name="date"
							bind:value={newDate}
							class="w-full rounded-md border border-[var(--dash-border)] px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
						/>
					</div>

					<div>
						<label for="new-url" class="mb-1 block text-sm font-medium text-[var(--dash-text)]">
							URL
						</label>
						<input
							type="url"
							id="new-url"
							name="url"
							bind:value={newUrl}
							placeholder="e.g., https://www.credly.com/..."
							class="w-full rounded-md border border-[var(--dash-border)] px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
						/>
					</div>
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
					Add Certificate
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

	<!-- Certificates List -->
	{#if certificates.length === 0 && !showAddForm}
		<EmptyState
			icon={faCertificate}
			title="No certificates yet"
			description="Add professional certifications to strengthen your profile and improve scoring for jobs that require them."
			actionLabel="Add First Certificate"
			onAction={() => (showAddForm = true)}
		/>
	{:else if reorderMode}
		{#snippet reorderConfirmCancel()}
			<div class="flex items-center justify-end gap-2">
				<span class="text-xs text-[var(--dash-text-muted)]">Reorder Certificates</span>
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
			use:dragHandleZone={{ items: dndItems, flipDurationMs, type: 'certificates' }}
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
								icon={faCertificate}
								class="h-4 w-4 flex-shrink-0 text-[var(--dash-primary)]"
							/>
							<h3 class="truncate text-base font-semibold text-[var(--dash-text)]">
								{dndItem.cert.name || 'Untitled'}
							</h3>
							{#if dndItem.cert.issuer}
								<span class="flex-shrink-0 text-xs text-[var(--dash-text-muted)]">
									{dndItem.cert.issuer}
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
			{#each certificates as cert (cert.id)}
				<ItemCard id={cert.id} {expandedId} onToggle={toggleExpand} icon={faCertificate}>
					{#snippet title()}
						{cert.name}
					{/snippet}

					{#snippet subtitle()}
						{#if cert.issuer}
							{cert.issuer}
						{/if}
					{/snippet}

					{#snippet dateline()}
						{#if cert.date}
							<span class="text-sm text-[var(--dash-text-muted)]"
								>{formatDateForDisplay(cert.date)}</span
							>
						{/if}
						{#if cert.url}
							<a
								href={cert.url}
								target="_blank"
								rel="noopener noreferrer"
								onclick={(e) => e.stopPropagation()}
								class="text-sm text-[var(--dash-primary)] hover:underline">{cert.url}</a
							>
						{/if}
					{/snippet}

					{#snippet headerActions()}
						<button
							type="button"
							onclick={(e) => {
								e.stopPropagation();
								if (expandedId !== cert.id) toggleExpand(cert.id);
							}}
							class="cursor-pointer p-1.5 text-[var(--dash-text-secondary)] transition-colors hover:text-[var(--dash-primary)]"
							aria-label="Edit"
						>
							<FontAwesomeIcon icon={faPencil} class="h-4 w-4" />
						</button>
					{/snippet}

					{#snippet expandedContent()}
						<form method="POST" action="?/update" use:enhance={handleEditSubmit}>
							<input type="hidden" name="id" value={cert.id} />
							<div class="space-y-4">
								<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
									<div>
										<label
											for="edit-name-{cert.id}"
											class="mb-1 block text-sm font-medium text-[var(--dash-text)]"
										>
											Certificate Name <span class="text-[var(--dash-error)]">*</span>
										</label>
										<input
											type="text"
											id="edit-name-{cert.id}"
											name="name"
											bind:value={editName}
											required
											class="w-full rounded-md border border-[var(--dash-border)] px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
										/>
									</div>

									<div>
										<label
											for="edit-issuer-{cert.id}"
											class="mb-1 block text-sm font-medium text-[var(--dash-text)]"
										>
											Issuer
										</label>
										<input
											type="text"
											id="edit-issuer-{cert.id}"
											name="issuer"
											bind:value={editIssuer}
											class="w-full rounded-md border border-[var(--dash-border)] px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
										/>
									</div>
								</div>

								<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
									<div>
										<label
											for="edit-date-{cert.id}"
											class="mb-1 block text-sm font-medium text-[var(--dash-text)]"
										>
											Date Obtained
										</label>
										<input
											type="date"
											id="edit-date-{cert.id}"
											name="date"
											bind:value={editDate}
											class="w-full rounded-md border border-[var(--dash-border)] px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
										/>
									</div>

									<div>
										<label
											for="edit-url-{cert.id}"
											class="mb-1 block text-sm font-medium text-[var(--dash-text)]"
										>
											URL
										</label>
										<input
											type="url"
											id="edit-url-{cert.id}"
											name="url"
											bind:value={editUrl}
											placeholder="e.g., https://www.credly.com/..."
											class="w-full rounded-md border border-[var(--dash-border)] px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
										/>
									</div>
								</div>
							</div>

							<div class="mt-4 flex items-center">
								<button
									type="button"
									onclick={() => {
										expandedId = null;
										deleteId = cert.id;
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
	title="Delete Certificate"
	message="Are you sure you want to delete this certificate? This action cannot be undone."
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
