<script lang="ts">
	import ExternalLink from '$lib/components/ExternalLink.svelte';
	import TechnologyTagsEditor from '$lib/components/TechnologyTagsEditor.svelte';
	import { resolve } from '$app/paths';
	import type { ResolvedPathname } from '$app/types';
	import {
		CERTIFICATE_FILE_ACCEPT,
		MAX_CERTIFICATE_FILE_BYTES,
		formatFileSize
	} from '$lib/certificate-files';
	import type { ActionData, PageData } from './$types';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { enhance } from '$app/forms';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faArrowsUpDown,
		faCertificate,
		faCircleNotch,
		faFileArrowUp,
		faGripVertical,
		faPaperclip,
		faPencil,
		faTrash,
		faXmark
	} from '@fortawesome/free-solid-svg-icons';
	import { dragHandleZone, dragHandle } from 'svelte-dnd-action';
	import { flip } from 'svelte/animate';
	import { invalidate, invalidateAll } from '$app/navigation';
	import SectionHeader from '../../components/SectionHeader.svelte';
	import EmptyState from '../../components/EmptyState.svelte';
	import ConfirmModal from '../../components/ConfirmModal.svelte';
	import ItemCard from '../../components/ItemCard.svelte';
	import CertificateSkills from '../../components/CertificateSkills.svelte';
	import CertificateFile from '../../components/CertificateFile.svelte';
	import Card from '../../../components/Card.svelte';
	import { CERTIFICATES_DEP } from './certificates-dep';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let certificates = $derived(data.certificates);
	let expandedId = $state<number | null>(null);
	let showAddForm = $state(false);
	let deleteId = $state<number | null>(null);

	// Form states
	let newName = $state('');
	let newIssuer = $state('');
	let newDate = $state('');
	let newExpiryDate = $state('');
	let newCredentialId = $state('');
	let newUrl = $state('');
	let newSkills = $state<string[]>([]);
	let newFile = $state<File | null>(null);
	let newFileError = $state<string | null>(null);
	let followUpError = $state<string | null>(null);

	let editName = $state('');
	let editIssuer = $state('');
	let editDate = $state('');
	let editExpiryDate = $state('');
	let editCredentialId = $state('');
	let editUrl = $state('');
	let originalName = $state('');
	let originalIssuer = $state('');
	let originalDate = $state('');
	let originalExpiryDate = $state('');
	let originalCredentialId = $state('');
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
		// UTC, because a date column arrives as midnight UTC: read in a zone west
		// of it, the first of a month would print as the month before.
		return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', timeZone: 'UTC' });
	}

	/** Past its expiry date. No expiry date means it does not expire. */
	function isExpired(expiry: Date | string | null): boolean {
		return !!expiry && formatDateForInput(expiry) < new Date().toISOString().slice(0, 10);
	}

	function isEditDirty(): boolean {
		return (
			editName !== originalName ||
			editIssuer !== originalIssuer ||
			editDate !== originalDate ||
			editExpiryDate !== originalExpiryDate ||
			editCredentialId !== originalCredentialId ||
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
				editExpiryDate = formatDateForInput(cert.expiry_date);
				editCredentialId = cert.credential_id || '';
				editUrl = cert.url || '';
				originalName = editName;
				originalIssuer = editIssuer;
				originalDate = editDate;
				originalExpiryDate = editExpiryDate;
				originalCredentialId = editCredentialId;
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
		newExpiryDate = '';
		newCredentialId = '';
		newUrl = '';
		newSkills = [];
		newFile = null;
		newFileError = null;
	}

	/** The stored document, through the route that checks who is asking. */
	function fileHref(certificateId: number, inline: boolean): ResolvedPathname {
		const base = resolve('/api/certificates/[id]/file', { id: String(certificateId) });
		return (inline ? `${base}?inline=1` : base) as ResolvedPathname;
	}

	function pickNewFile(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const chosen = input.files?.[0] ?? null;
		input.value = '';
		newFileError =
			chosen && chosen.size > MAX_CERTIFICATE_FILE_BYTES
				? `The file is larger than ${MAX_CERTIFICATE_FILE_BYTES / (1024 * 1024)} MB.`
				: null;
		newFile = newFileError ? null : chosen;
	}

	/**
	 * A new certificate's skills and file, sent once it exists.
	 *
	 * Both need its id, which is why the add form holds them locally rather than
	 * saving them as it does in an open card. Skills go one at a time, so they
	 * keep the order they were typed in: each is appended as it lands.
	 */
	async function addExtras(certificateId: number, names: string[], file: File | null) {
		const failed: string[] = [];
		for (const name of names.map((n) => n.trim()).filter(Boolean)) {
			const response = await fetch('/api/profile-section/certificate_skill', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name, certificate_id: certificateId })
			}).catch(() => null);
			if (!response?.ok) failed.push(name);
		}

		let fileFailed: string | null = null;
		if (file) {
			const body = new FormData();
			body.set('file', file);
			const response = await fetch(
				resolve('/api/certificates/[id]/file', { id: String(certificateId) }),
				{
					method: 'POST',
					body
				}
			).catch(() => null);
			if (!response?.ok) {
				const reason = (await response?.json().catch(() => null)) as { message?: string } | null;
				fileFailed = reason?.message ?? 'the upload failed';
			}
		}

		const problems = [
			failed.length ? `these skills were not saved: ${failed.join(', ')}` : null,
			fileFailed ? `the file was not saved (${fileFailed})` : null
		].filter(Boolean);
		followUpError = problems.length
			? `The certificate was added, but ${problems.join(', and ')}. Open it to add them again.`
			: null;
	}

	const handleAddSubmit: SubmitFunction = () => {
		return async ({ result, update }) => {
			if (result.type === 'success') {
				const id = Number(result.data?.id);
				if (Number.isInteger(id) && id > 0) await addExtras(id, newSkills, newFile);
			}
			await update();
			if (result.type === 'success') {
				resetAddForm();
			}
		};
	};

	const handleEditSubmit: SubmitFunction = () => {
		return async ({ result, update }) => {
			await update();
			if (result.type === 'success') {
				expandedId = null;
			}
		};
	};

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

	{#if followUpError}
		<div class="rounded-lg border border-[var(--dash-error)] bg-[var(--dash-error-light)] p-4">
			<p class="text-sm text-[var(--dash-error)]">{followUpError}</p>
		</div>
	{/if}

	<!-- Add Form -->
	{#if showAddForm}
		<div class="rounded-lg border border-[var(--dash-primary)] bg-[var(--dash-card)] p-4">
			<h3 class="mb-4 font-medium text-[var(--dash-text)]">Add New Certificate</h3>
			<form
				id="add-certificate"
				method="POST"
				action="?/create"
				use:enhance={handleAddSubmit}
				class="space-y-4"
			>
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
							Issue Date
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
						<label
							for="new-expiry-date"
							class="mb-1 block text-sm font-medium text-[var(--dash-text)]"
						>
							Expiration Date
						</label>
						<input
							type="date"
							id="new-expiry-date"
							name="expiry_date"
							bind:value={newExpiryDate}
							min={newDate || undefined}
							aria-describedby="new-expiry-date-hint"
							class="w-full rounded-md border border-[var(--dash-border)] px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
						/>
						<p id="new-expiry-date-hint" class="mt-1 text-xs text-[var(--dash-text-muted)]">
							Leave empty if it does not expire.
						</p>
					</div>
				</div>

				<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
					<div>
						<label
							for="new-credential-id"
							class="mb-1 block text-sm font-medium text-[var(--dash-text)]"
						>
							Credential ID
						</label>
						<input
							type="text"
							id="new-credential-id"
							name="credential_id"
							bind:value={newCredentialId}
							placeholder="e.g., the certification number"
							class="w-full rounded-md border border-[var(--dash-border)] px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
						/>
					</div>

					<div>
						<label for="new-url" class="mb-1 block text-sm font-medium text-[var(--dash-text)]">
							Credential URL
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
			</form>

			<!-- Outside the form, which Enter in a chip would otherwise submit. -->
			<div class="mt-4">
				<h4 class="mb-2 text-sm font-medium text-[var(--dash-text)]">Skills</h4>
				<TechnologyTagsEditor bind:technologies={newSkills} itemLabel="Skill" />
			</div>

			<!-- Sent after the certificate exists, like the skills: it needs the id. -->
			<div class="mt-4">
				<h4 class="mb-2 text-sm font-medium text-[var(--dash-text)]">Certificate File</h4>
				<div class="flex flex-wrap items-center gap-2">
					{#if newFile}
						<span
							class="inline-flex min-w-0 items-center gap-1.5 rounded-lg bg-[var(--dash-bg)] px-3 py-1.5 text-sm text-[var(--dash-text)]"
						>
							<FontAwesomeIcon icon={faPaperclip} class="h-3 w-3 flex-shrink-0" />
							<span class="truncate">{newFile.name}</span>
							<span class="flex-shrink-0 text-xs text-[var(--dash-text-muted)]"
								>{formatFileSize(newFile.size)}</span
							>
						</span>
						<button
							type="button"
							onclick={() => (newFile = null)}
							class="p-1 text-[var(--dash-text-secondary)] transition-colors hover:text-[var(--dash-error)]"
							aria-label="Remove the chosen file"
						>
							<FontAwesomeIcon icon={faXmark} class="h-3 w-3" />
						</button>
					{/if}
					<label
						class="inline-flex cursor-pointer items-center gap-1.5 px-3 py-1 text-sm text-[var(--dash-primary)] hover:text-[var(--dash-primary-hover)]"
					>
						<FontAwesomeIcon icon={faFileArrowUp} class="h-3 w-3" />
						{newFile ? 'Choose another' : 'Choose PDF or image'}
						<input
							type="file"
							accept={CERTIFICATE_FILE_ACCEPT}
							onchange={pickNewFile}
							class="sr-only"
						/>
					</label>
				</div>
				<p class="mt-1 text-xs text-[var(--dash-text-muted)]">
					Optional. Up to {MAX_CERTIFICATE_FILE_BYTES / (1024 * 1024)} MB. Only you can open it; it is
					not shown on your CV or public pages.
				</p>
				{#if newFileError}
					<p class="mt-1 text-sm text-[var(--dash-error)]">{newFileError}</p>
				{/if}
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
					form="add-certificate"
					class="rounded-lg bg-[var(--dash-primary)] px-4 py-2 text-white transition-colors hover:bg-[var(--dash-primary-hover)]"
				>
					Add Certificate
				</button>
			</div>
		</div>
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

					{#snippet badges()}
						{#if isExpired(cert.expiry_date)}
							<span
								class="ml-2 rounded-full bg-[var(--dash-warning-light)] px-2 py-0.5 align-middle text-xs font-medium text-[var(--dash-warning)]"
								>Expired</span
							>
						{/if}
					{/snippet}

					{#snippet subtitle()}
						{#if cert.issuer}
							{cert.issuer}
						{/if}
					{/snippet}

					{#snippet dateline()}
						{#if cert.date}
							<span class="text-sm text-[var(--dash-text-muted)]"
								>Issued {formatDateForDisplay(cert.date)}</span
							>
						{/if}
						{#if cert.expiry_date}
							<span class="text-sm text-[var(--dash-text-muted)]"
								>{cert.date ? ' · ' : ''}{isExpired(cert.expiry_date) ? 'Expired' : 'Expires'}
								{formatDateForDisplay(cert.expiry_date)}</span
							>
						{/if}
						{#if cert.credential_id}
							<span class="text-sm text-[var(--dash-text-muted)]"
								>{cert.date || cert.expiry_date ? ' · ' : ''}ID {cert.credential_id}</span
							>
						{/if}
						{#if cert.url}
							<ExternalLink
								href={cert.url}
								target="_blank"
								rel="noopener noreferrer"
								onclick={(e) => e.stopPropagation()}
								class="text-sm text-[var(--dash-primary)] hover:underline">{cert.url}</ExternalLink
							>
						{/if}
						{#if cert.certificate_skills.length > 0}
							<span class="mt-1 block text-sm text-[var(--dash-text-secondary)]">
								{cert.certificate_skills.map((s) => s.name).join(', ')}
							</span>
						{/if}
					{/snippet}

					{#snippet headerActions()}
						{#if cert.file}
							{@const image = !!cert.file.type?.startsWith('image/')}
							<a
								href={fileHref(cert.id, image)}
								target={image ? '_blank' : undefined}
								rel={image ? 'noopener' : undefined}
								onclick={(e) => e.stopPropagation()}
								class="p-1.5 text-[var(--dash-text-secondary)] transition-colors hover:text-[var(--dash-primary)]"
								aria-label="Open the certificate file"
								title={cert.file.filename_download}
							>
								<FontAwesomeIcon icon={faPaperclip} class="h-4 w-4" />
							</a>
						{/if}
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
						<form
							id="edit-certificate-{cert.id}"
							method="POST"
							action="?/update"
							use:enhance={handleEditSubmit}
						>
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
											Issue Date
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
											for="edit-expiry-date-{cert.id}"
											class="mb-1 block text-sm font-medium text-[var(--dash-text)]"
										>
											Expiration Date
										</label>
										<input
											type="date"
											id="edit-expiry-date-{cert.id}"
											name="expiry_date"
											bind:value={editExpiryDate}
											min={editDate || undefined}
											aria-describedby="edit-expiry-date-hint-{cert.id}"
											class="w-full rounded-md border border-[var(--dash-border)] px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
										/>
										<p
											id="edit-expiry-date-hint-{cert.id}"
											class="mt-1 text-xs text-[var(--dash-text-muted)]"
										>
											Leave empty if it does not expire.
										</p>
									</div>
								</div>

								<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
									<div>
										<label
											for="edit-credential-id-{cert.id}"
											class="mb-1 block text-sm font-medium text-[var(--dash-text)]"
										>
											Credential ID
										</label>
										<input
											type="text"
											id="edit-credential-id-{cert.id}"
											name="credential_id"
											bind:value={editCredentialId}
											class="w-full rounded-md border border-[var(--dash-border)] px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
										/>
									</div>

									<div>
										<label
											for="edit-url-{cert.id}"
											class="mb-1 block text-sm font-medium text-[var(--dash-text)]"
										>
											Credential URL
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
						</form>

						<!-- Outside the form: the chips save themselves, and Enter in one must not submit it. -->
						<CertificateSkills
							certificateId={cert.id}
							profileId={data.profileId}
							skills={cert.certificate_skills}
							onChanged={() => invalidate(CERTIFICATES_DEP)}
						/>

						<CertificateFile
							certificateId={cert.id}
							file={cert.file
								? {
										name: cert.file.filename_download,
										type: cert.file.type,
										size: cert.file.filesize
									}
								: null}
							onChanged={() => invalidate(CERTIFICATES_DEP)}
						/>

						<div class="flex items-center">
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
									form="edit-certificate-{cert.id}"
									class="rounded-lg bg-[var(--dash-primary)] px-4 py-2 text-white transition-colors hover:bg-[var(--dash-primary-hover)]"
								>
									Save
								</button>
							</div>
						</div>
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
	message="Are you sure you want to delete this certificate, its skills and its file? This action cannot be undone."
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
