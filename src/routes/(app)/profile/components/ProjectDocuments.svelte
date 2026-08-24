<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { ResolvedPathname } from '$app/types';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faArrowsRotate,
		faBriefcase,
		faChevronDown,
		faChevronRight,
		faCloudArrowUp,
		faFileLines,
		faFileZipper,
		faNoteSticky,
		faPenToSquare,
		faTrash
	} from '@fortawesome/free-solid-svg-icons';
	import { faGithub } from '@fortawesome/free-brands-svg-icons';
	import ConfirmModal from './ConfirmModal.svelte';
	import { type ApplicationRecordSource, applicationRecordSource } from '$lib/document-sources';

	interface DocRow {
		id: number;
		kind: string;
		title: string | null;
		original_filename: string | null;
		status: string;
		summary: string | null;
		keywords: unknown;
		skipped: unknown;
		file_count: number;
		total_bytes: number;
		/** Provenance jsonb; only an application copy is read here. */
		source?: unknown;
	}

	let {
		profileId,
		workExperienceProjectId = null,
		sideProjectId = null,
		repoUrl = null,
		documents
	}: {
		profileId: number;
		workExperienceProjectId?: number | null;
		sideProjectId?: number | null;
		/** Enables the repo scan. Both project kinds carry one. */
		repoUrl?: string | null;
		documents: DocRow[];
	} = $props();

	let uploading = $state(false);
	let error = $state<string | null>(null);
	let isDragging = $state(false);
	let deleteId = $state<number | null>(null);
	let reparsingId = $state<number | null>(null);
	let importing = $state(false);
	let importMessage = $state<string | null>(null);
	let projectKind = $derived(sideProjectId != null ? 'side_project' : 'work_experience_project');
	let projectRef = $derived(sideProjectId ?? workExperienceProjectId);
	let canImportRepo = $derived(projectRef != null && !!repoUrl?.trim());
	let expanded = $state<Set<number>>(new Set());

	/**
	 * The note composer.
	 *
	 * One surface for both writing and editing: `noteId` null means a new note.
	 * Two composers would be two places to fix the same bug, and the states are
	 * mutually exclusive anyway — you cannot be writing a new note and editing an
	 * old one at once.
	 */
	let noteOpen = $state(false);
	let noteId = $state<number | null>(null);
	let noteTitle = $state('');
	let noteText = $state('');
	let noteSaving = $state(false);
	let noteLoadingId = $state<number | null>(null);

	function openNewNote() {
		noteId = null;
		noteTitle = '';
		noteText = '';
		noteOpen = true;
		error = null;
	}

	function closeNote() {
		noteOpen = false;
		noteId = null;
		noteTitle = '';
		noteText = '';
	}

	/** Load a note's stored text — the list rows carry summaries, not content. */
	async function editNote(id: number) {
		if (noteLoadingId !== null) return;
		noteLoadingId = id;
		error = null;
		try {
			const res = await fetch(`/api/profile/${profileId}/documents/${id}`);
			const body = await res.json().catch(() => null);
			if (!res.ok) {
				error = body?.message ?? 'Could not open that note.';
				return;
			}
			noteId = id;
			noteTitle = body?.title ?? '';
			noteText = body?.text ?? '';
			noteOpen = true;
		} catch {
			error = 'Could not open that note.';
		} finally {
			noteLoadingId = null;
		}
	}

	async function saveNote() {
		if (noteSaving || !noteText.trim()) return;
		noteSaving = true;
		error = null;
		try {
			let res: Response;
			if (noteId === null) {
				const fd = new FormData();
				fd.append('text', noteText);
				if (noteTitle.trim()) fd.append('title', noteTitle.trim());
				if (workExperienceProjectId != null) {
					fd.append('work_experience_project_id', String(workExperienceProjectId));
				}
				if (sideProjectId != null) {
					fd.append('side_project_id', String(sideProjectId));
				}
				res = await fetch(`/api/profile/${profileId}/documents`, { method: 'POST', body: fd });
			} else {
				res = await fetch(`/api/profile/${profileId}/documents/${noteId}`, {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ text: noteText, title: noteTitle.trim() || null })
				});
			}
			const body = await res.json().catch(() => null);
			if (!res.ok) {
				error = body?.message ?? 'Could not save the note.';
				return;
			}
			// A create reports per-item failures in `errors` rather than a status.
			const errs: Array<{ filename: string; error: string }> = body?.errors ?? [];
			if (errs.length > 0) {
				error = errs.map((e) => e.error).join('; ');
				return;
			}
			closeNote();
			await invalidateAll();
		} catch {
			error = 'Could not save the note.';
		} finally {
			noteSaving = false;
		}
	}

	/** Deleting a note loses the only copy; deleting an upload loses a copy. */
	let deletingNote = $derived(documents.some((d) => d.id === deleteId && d.kind === 'note'));

	/**
	 * The entry this copy came from, on its application's activity tab. The
	 * anchor is the tab's own (`r<id>`); `resolve()` takes a hash only as a
	 * literal, so it is appended to the resolved route and typed as what
	 * `resolve('…#…')` would have returned.
	 */
	function entryHref(origin: ApplicationRecordSource): ResolvedPathname {
		const base = resolve('/(app)/applications/[id]/activity', {
			id: String(origin.application_id)
		});
		return `${base}#r${origin.record_id}` as ResolvedPathname;
	}

	function docIcon(kind: string) {
		if (kind === 'note') return faNoteSticky;
		return kind === 'archive' ? faFileZipper : faFileLines;
	}

	function formatSize(bytes: number): string {
		if (!bytes) return '0 KB';
		if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
		return `${Math.max(1, Math.round(bytes / 1024))} KB`;
	}

	function statusClass(status: string): string {
		switch (status) {
			case 'extracted':
				return 'bg-green-500/10 text-green-600 border-green-500/30';
			case 'partial':
				return 'bg-amber-500/10 text-amber-600 border-amber-500/30';
			case 'failed':
				return 'bg-red-500/10 text-red-600 border-red-500/30';
			default:
				return 'bg-[var(--dash-bg)] text-[var(--dash-text-muted)] border-[var(--dash-border)]';
		}
	}

	const kw = (v: unknown): string[] => (Array.isArray(v) ? (v as string[]) : []);
	const skippedCount = (v: unknown): number => (Array.isArray(v) ? v.length : 0);

	function toggle(id: number) {
		const next = new Set(expanded);
		next.has(id) ? next.delete(id) : next.add(id);
		expanded = next;
	}

	async function uploadFiles(files: FileList | File[]) {
		const list = Array.from(files);
		if (list.length === 0 || uploading) return;
		uploading = true;
		error = null;
		try {
			const fd = new FormData();
			for (const f of list) fd.append('files', f);
			if (workExperienceProjectId != null) {
				fd.append('work_experience_project_id', String(workExperienceProjectId));
			}
			if (sideProjectId != null) {
				fd.append('side_project_id', String(sideProjectId));
			}

			const res = await fetch(`/api/profile/${profileId}/documents`, {
				method: 'POST',
				body: fd
			});
			const body = await res.json().catch(() => null);
			if (!res.ok) {
				error = body?.message ?? 'Upload failed.';
				return;
			}
			const errs: Array<{ filename: string; error: string }> = body?.errors ?? [];
			error = errs.length > 0 ? errs.map((e) => `${e.filename}: ${e.error}`).join('; ') : null;
			await invalidateAll();
		} catch {
			error = 'Upload failed.';
		} finally {
			uploading = false;
		}
	}

	/**
	 * Pull the linked repository in as an attachment.
	 *
	 * Slow by nature — download, unpack, summarize — so this reports its own
	 * progress rather than borrowing the upload spinner, and an unchanged HEAD
	 * says so instead of storing a second identical document.
	 */
	async function importRepo() {
		if (!canImportRepo || importing) return;
		importing = true;
		error = null;
		importMessage = null;
		try {
			const res = await fetch(`/api/project-repo/${projectKind}/${projectRef}/import`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ repo_url: repoUrl })
			});
			const body = await res.json().catch(() => null);
			if (!res.ok) {
				error = body?.message ?? 'Could not scan the repository.';
				return;
			}
			importMessage = body?.unchanged
				? 'Already scanned at this commit — nothing to re-read.'
				: null;
			await invalidateAll();
		} catch {
			error = 'Could not scan the repository.';
		} finally {
			importing = false;
		}
	}

	async function reparse(id: number) {
		if (reparsingId !== null) return;
		reparsingId = id;
		error = null;
		try {
			const res = await fetch(`/api/profile/${profileId}/documents/${id}/reparse`, {
				method: 'POST'
			});
			if (!res.ok) {
				const body = await res.json().catch(() => null);
				error = body?.message ?? 'Could not regenerate notes.';
				return;
			}
			await invalidateAll();
		} catch {
			error = 'Could not regenerate notes.';
		} finally {
			reparsingId = null;
		}
	}

	async function doDelete() {
		if (deleteId === null) return;
		const id = deleteId;
		deleteId = null;
		try {
			const res = await fetch(`/api/profile/${profileId}/documents/${id}`, {
				method: 'DELETE'
			});
			if (res.ok) await invalidateAll();
			else error = 'Could not delete document.';
		} catch {
			error = 'Could not delete document.';
		}
	}
</script>

<div class="space-y-3">
	<!-- Upload -->
	<div
		role="button"
		tabindex="0"
		ondrop={(e) => {
			e.preventDefault();
			isDragging = false;
			if (e.dataTransfer?.files?.length) uploadFiles(e.dataTransfer.files);
		}}
		ondragover={(e) => {
			e.preventDefault();
			isDragging = true;
		}}
		ondragleave={() => (isDragging = false)}
		class="relative rounded-lg border-2 border-dashed p-4 text-center transition-colors {isDragging
			? 'border-[var(--dash-primary)] bg-[var(--dash-primary)]/5'
			: 'border-[var(--dash-border)] hover:border-[var(--dash-primary)]/50'}"
	>
		<FontAwesomeIcon icon={faCloudArrowUp} class="h-5 w-5 text-[var(--dash-text-muted)]" />
		<p class="mt-1 text-sm text-[var(--dash-text)]">
			{uploading
				? 'Uploading and analyzing…'
				: 'Drop source code, docs, or a ZIP here — or click to choose'}
		</p>
		<p class="mt-0.5 text-xs text-[var(--dash-text-muted)]">
			We extract the text and summarize it; original files aren't stored, secrets are redacted.
		</p>
		<input
			type="file"
			multiple
			disabled={uploading}
			onchange={(e) => {
				const el = e.currentTarget as HTMLInputElement;
				if (el.files?.length) uploadFiles(el.files);
				el.value = '';
			}}
			class="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-default"
		/>
	</div>

	{#if noteOpen}
		<div class="space-y-2 rounded-lg border border-[var(--dash-border)] p-3">
			<input
				type="text"
				bind:value={noteTitle}
				placeholder="Title (optional — the first line is used if you leave this empty)"
				class="w-full rounded-md border border-[var(--dash-border)] px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
			/>
			<textarea
				bind:value={noteText}
				rows="6"
				placeholder="Anything the code doesn't say: what the project was for, what changed because of it, numbers you remember, why a decision went the way it did."
				class="w-full rounded-md border border-[var(--dash-border)] px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
			></textarea>
			<div class="flex items-center gap-2">
				<button
					type="button"
					onclick={saveNote}
					disabled={noteSaving || !noteText.trim()}
					class="rounded-md bg-[var(--dash-primary)] px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-[var(--dash-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
				>
					{noteSaving ? 'Saving…' : noteId === null ? 'Save note' : 'Save changes'}
				</button>
				<button
					type="button"
					onclick={closeNote}
					disabled={noteSaving}
					class="rounded-md border border-[var(--dash-border)] px-3 py-1.5 text-sm text-[var(--dash-text)] transition-colors hover:bg-[var(--dash-bg)] disabled:opacity-50"
				>
					Cancel
				</button>
				<span class="text-xs text-[var(--dash-text-muted)]">
					Read alongside the files, and ahead of them.
				</span>
			</div>
		</div>
	{:else}
		<button
			type="button"
			onclick={openNewNote}
			class="inline-flex items-center gap-2 rounded-md border border-[var(--dash-border)] px-3 py-2 text-sm font-medium text-[var(--dash-text)] transition-colors hover:bg-[var(--dash-bg)]"
		>
			<FontAwesomeIcon icon={faNoteSticky} class="h-4 w-4" />
			Write a note
		</button>
	{/if}

	{#if canImportRepo}
		<div class="flex flex-wrap items-center gap-3">
			<button
				type="button"
				onclick={importRepo}
				disabled={importing}
				class="inline-flex items-center gap-2 rounded-md border border-[var(--dash-border)] px-3 py-2 text-sm font-medium text-[var(--dash-text)] transition-colors hover:bg-[var(--dash-bg)] disabled:cursor-not-allowed disabled:opacity-50"
			>
				<FontAwesomeIcon
					icon={importing ? faArrowsRotate : faGithub}
					class="h-4 w-4 {importing ? 'animate-spin' : ''}"
				/>
				{importing ? 'Scanning repository…' : 'Scan the linked repository'}
			</button>
			<span class="text-sm text-[var(--dash-text-secondary)]">
				Reads the public repo's code the same way an upload would. Public repos only.
			</span>
		</div>
	{/if}

	{#if importMessage}
		<p class="text-sm text-[var(--dash-text-secondary)]">{importMessage}</p>
	{/if}

	{#if error}
		<p class="text-sm text-[var(--dash-error)]">{error}</p>
	{/if}

	{#each documents as doc (doc.id)}
		{@const keywords = kw(doc.keywords)}
		{@const skipped = skippedCount(doc.skipped)}
		{@const isOpen = expanded.has(doc.id)}
		{@const origin = applicationRecordSource(doc.source)}
		<div class="rounded-lg border border-[var(--dash-border)] p-3">
			<div class="flex items-start gap-3">
				<FontAwesomeIcon
					icon={docIcon(doc.kind)}
					class="mt-0.5 h-4 w-4 text-[var(--dash-text-muted)]"
				/>
				<div class="min-w-0 flex-1">
					<div class="flex flex-wrap items-center gap-2">
						<span class="truncate text-sm font-medium text-[var(--dash-text)]">
							{doc.title || doc.original_filename || 'Untitled'}
						</span>
						<span
							class="rounded border px-1.5 py-0.5 text-[10px] font-medium tracking-wide uppercase {statusClass(
								doc.status
							)}">{doc.status}</span
						>
					</div>
					<p class="mt-0.5 text-xs text-[var(--dash-text-secondary)]">
						{doc.file_count}
						{doc.file_count === 1 ? 'file' : 'files'} · {formatSize(doc.total_bytes)}
						{#if skipped > 0}· {skipped} skipped{/if}
					</p>
					{#if origin}
						<p class="mt-1 flex flex-wrap items-center gap-1 text-xs text-[var(--dash-text-muted)]">
							<FontAwesomeIcon icon={faBriefcase} class="h-3 w-3" />
							<span>
								Copied from your application{origin.company
									? ` at ${origin.company}`
									: ''}{origin.job_title ? ` — ${origin.job_title}` : ''}.
							</span>
							<a href={entryHref(origin)} class="text-[var(--dash-primary)] hover:underline">
								Open the entry
							</a>
						</p>
					{/if}

					{#if keywords.length > 0}
						<div class="mt-2 flex flex-wrap gap-1.5">
							{#each keywords as k}
								<span
									class="rounded-full border border-[var(--dash-primary)]/20 bg-[var(--dash-primary)]/10 px-2 py-0.5 text-xs text-[var(--dash-primary)]"
									>{k}</span
								>
							{/each}
						</div>
					{/if}

					{#if doc.summary}
						<button
							type="button"
							onclick={() => toggle(doc.id)}
							class="mt-2 flex items-center gap-1.5 text-xs text-[var(--dash-text-secondary)] transition-colors hover:text-[var(--dash-primary)]"
						>
							<FontAwesomeIcon icon={isOpen ? faChevronDown : faChevronRight} class="h-3 w-3" />
							{isOpen ? 'Hide' : 'Show'} reference notes
						</button>
						{#if isOpen}
							<p
								class="mt-2 border-l-2 border-[var(--dash-border)] pl-3 text-sm whitespace-pre-line text-[var(--dash-text)]"
							>
								{doc.summary}
							</p>
						{/if}
					{/if}
				</div>

				<div class="flex items-center gap-0.5">
					{#if doc.kind === 'note'}
						<button
							type="button"
							onclick={() => editNote(doc.id)}
							disabled={noteLoadingId === doc.id}
							class="p-1.5 text-[var(--dash-text-secondary)] transition-colors hover:text-[var(--dash-primary)] disabled:opacity-50"
							aria-label="Edit note"
							title="Edit this note"
						>
							<FontAwesomeIcon icon={faPenToSquare} class="h-3.5 w-3.5" />
						</button>
					{/if}
					<button
						type="button"
						onclick={() => reparse(doc.id)}
						disabled={reparsingId === doc.id}
						class="p-1.5 text-[var(--dash-text-secondary)] transition-colors hover:text-[var(--dash-primary)] disabled:opacity-50"
						aria-label="Regenerate notes"
						title="Regenerate reference notes"
					>
						<FontAwesomeIcon
							icon={faArrowsRotate}
							spin={reparsingId === doc.id}
							class="h-3.5 w-3.5"
						/>
					</button>
					<button
						type="button"
						onclick={() => (deleteId = doc.id)}
						class="p-1.5 text-[var(--dash-text-secondary)] transition-colors hover:text-[var(--dash-error)]"
						aria-label="Delete document"
					>
						<FontAwesomeIcon icon={faTrash} class="h-3.5 w-3.5" />
					</button>
				</div>
			</div>
		</div>
	{/each}
</div>

<ConfirmModal
	isOpen={deleteId !== null}
	title={deletingNote ? 'Delete note' : 'Delete document'}
	message={deletingNote
		? 'Permanently delete this note? Nothing else holds this text — it was written here, not uploaded — so it cannot be recovered.'
		: 'Permanently delete this document and its extracted notes? This cannot be undone.'}
	confirmLabel="Delete"
	onCancel={() => (deleteId = null)}
	onConfirm={doDelete}
/>
