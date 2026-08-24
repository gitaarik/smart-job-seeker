<script lang="ts">
	import type { ActionData, PageData } from './$types';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { ResolvedPathname } from '$app/types';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faChevronDown,
		faChevronUp,
		faDownload,
		faEllipsisVertical,
		faFolderPlus,
		faPaperclip,
		faPencil,
		faStream,
		faTimes,
		faTrash,
		faTriangleExclamation
	} from '@fortawesome/free-solid-svg-icons';
	import Card from '../../../components/Card.svelte';
	import EmptyState from '../../../profile/components/EmptyState.svelte';
	import ConfirmModal from '../../../profile/components/ConfirmModal.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import {
		getContactRoleLabel,
		getRecordTypeColor,
		getRecordTypeLabel,
		recordTypes
	} from '$lib/application-records';
	import { getStatusBgColor, getStatusLabel } from '$lib/application-status';
	import { formatDate as fmtDate } from '$lib/format-date';
	import { renderSafeMarkdown } from '$lib/utils/safe-markdown';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let app = $derived(data.application);
	const basePath = $derived(`/applications/${app.id}`);

	/**
	 * One row of the stream. Records and status transitions share an axis but not
	 * a shape — a transition is context, not content — so they stay distinct
	 * variants rather than being flattened into a lowest-common-denominator row.
	 */
	type Entry =
		| {
				kind: 'record';
				id: string;
				at: Date | null;
				record_type: string | null;
				title: string;
				content: string;
				step: string | null;
				contacts: { name: string; role: string | null }[];
				fileId: string | null;
				fromFile: boolean;
				/** "pending" while the attached file is still being read. */
				extractionStatus: string;
		  }
		| {
				kind: 'status';
				id: string;
				at: Date | null;
				to_status: string;
				step: string | null;
				action: string | null;
				description: string | null;
		  };

	const toDate = (v: unknown): Date | null => {
		if (!v) return null;
		const d = v instanceof Date ? v : new Date(String(v));
		return isNaN(d.getTime()) ? null : d;
	};

	const records = $derived<Entry[]>(
		(app.application_records ?? []).map((r) => ({
			kind: 'record' as const,
			id: `r${r.id}`,
			// event_date is when it HAPPENED; date_created is when it was written
			// down. A pasted email logged a week late belongs at the former.
			at: toDate(r.event_date) ?? toDate(r.date_created),
			record_type: r.record_type,
			title: r.title || 'Untitled',
			content: data.recordContent?.[r.id] ?? '',
			step: r.step,
			contacts: (r.contacts ?? []) as { name: string; role: string | null }[],
			fileId: r.file_id ?? null,
			fromFile: !!r.file_id,
			extractionStatus: r.extraction_status
		}))
	);

	const statusEntries = $derived<Entry[]>(
		(app.application_status_logs ?? []).map((s) => ({
			kind: 'status' as const,
			id: `s${s.id}`,
			at: toDate(s.date_created),
			to_status: s.to_status,
			step: s.step,
			action: s.action,
			description: s.description
		}))
	);

	let showStatusEvents = $state(true);
	let typeFilter = $state<string | null>(null);

	const stream = $derived(
		[...records, ...(showStatusEvents ? statusEntries : [])]
			.filter((e) => !typeFilter || (e.kind === 'record' && e.record_type === typeFilter))
			// Newest first. Undated entries sort last rather than to the top, where
			// a missing date would otherwise read as "just happened".
			.sort((a, b) => (b.at?.getTime() ?? 0) - (a.at?.getTime() ?? 0))
	);

	const recordCount = $derived(records.length);
	const shownRecordCount = $derived(stream.filter((e) => e.kind === 'record').length);

	/** Types actually present, so the filter never offers an empty result. */
	const presentTypes = $derived(
		recordTypes.filter((t) => records.some((e) => e.kind === 'record' && e.record_type === t.value))
	);

	let expanded = $state<Record<string, boolean>>({});

	/** Long enough that collapsing earns its keep — roughly three lines. */
	const PREVIEW_CHARS = 220;

	function preview(text: string): string {
		const flat = text.replace(/\s+/g, ' ').trim();
		return flat.length > PREVIEW_CHARS ? flat.slice(0, PREVIEW_CHARS).trimEnd() + '…' : flat;
	}

	function formatDate(d: Date | null): string {
		return d ? fmtDate(d, { fallback: '' }) : '';
	}

	/**
	 * Built in JS rather than markup because Svelte trims whitespace at a block
	 * boundary: `{name}{#if role}\n · {label}{/if}` renders as "Anna Cooper·
	 * Technical interviewer", losing the leading space. Joining here sidesteps
	 * the rule entirely instead of fighting it with &nbsp;.
	 */
	const contactLabel = (c: { name: string; role: string | null }) =>
		[c.name, c.role ? getContactRoleLabel(c.role) : ''].filter(Boolean).join(' · ');

	const statusLabel = (e: Extract<Entry, { kind: 'status' }>) =>
		[getStatusLabel(e.to_status), e.step, e.action].filter(Boolean).join(' · ');

	// ---------------------------------------------------------------------
	// Composer
	// ---------------------------------------------------------------------

	let composerText = $state('');
	let stagedFile = $state<File | null>(null);
	let saving = $state(false);
	let dragging = $state(false);
	let fileInput = $state<HTMLInputElement | null>(null);

	/**
	 * Route a File into the hidden input so the ordinary form submission carries
	 * it. A file arriving by paste or drop is not in any input, and assigning
	 * `.files` needs a DataTransfer — this is the only way to hand it to
	 * `use:enhance` without hand-rolling the whole request.
	 */
	function stageFile(file: File) {
		if (!fileInput) return;
		const dt = new DataTransfer();
		dt.items.add(file);
		fileInput.files = dt.files;
		stagedFile = file;
	}

	function clearFile() {
		if (fileInput) fileInput.value = '';
		stagedFile = null;
	}

	/**
	 * One handler for every input method. `clipboardData` carries both files and
	 * text on the same event, so Ctrl+V covers an email body, a chat message, a
	 * screenshot and a PDF without the user choosing a mode first — which is the
	 * whole point of merging the two tabs.
	 */
	function onPaste(event: ClipboardEvent) {
		const file = event.clipboardData?.files?.[0];
		if (!file) return; // plain text: let the textarea handle it normally
		event.preventDefault();
		stageFile(file);
	}

	function onDrop(event: DragEvent) {
		event.preventDefault();
		dragging = false;
		const file = event.dataTransfer?.files?.[0];
		if (file) stageFile(file);
	}

	function handleCreate() {
		saving = true;
		return async ({
			result,
			update
		}: {
			result: { type: string; data?: Record<string, unknown> };
			update: (opts?: { reset?: boolean }) => Promise<void>;
		}) => {
			await update({ reset: false });
			saving = false;
			if (result.type !== 'success') return;

			composerText = '';
			clearFile();

			// The entry is already written and on screen. Reading the file is a
			// second request so a large PDF never holds the composer open — see the
			// create action.
			// The stream already shows the entry with "Reading the file…", because
			// the row exists with extraction_status "pending" — no separate spinner
			// state is needed here.
			if (result.data?.needsExtraction && result.data?.createdId) {
				const body = new FormData();
				body.set('id', String(result.data.createdId));
				await fetch('?/extract', { method: 'POST', body });
				await invalidateAll();
			}
		};
	}

	// ---------------------------------------------------------------------
	// Per-entry edit / delete
	// ---------------------------------------------------------------------

	let menuOpenId = $state<string | null>(null);
	let editingId = $state<string | null>(null);
	let deleteTarget = $state<{ id: string; title: string } | null>(null);

	let editTitle = $state('');
	let editType = $state('');
	let editDate = $state('');
	let editContent = $state('');

	function startEdit(entry: Extract<Entry, { kind: 'record' }>) {
		editingId = entry.id;
		editTitle = entry.title;
		editType = entry.record_type ?? 'note';
		editDate = entry.at ? entry.at.toISOString().slice(0, 10) : '';
		editContent = entry.content;
		menuOpenId = null;
	}

	function handleMutation(onDone: () => void) {
		return async ({
			result,
			update
		}: {
			result: { type: string };
			update: () => Promise<void>;
		}) => {
			await update();
			if (result.type === 'success') onDone();
		};
	}

	/** Status markers are not editable; records are. */
	const isEditable = (id: string) => id.startsWith('r');

	/** The numeric record id the actions expect, from the stream's prefixed key. */
	const rawId = (id: string) => id.slice(1);

	let deleteForm = $state<HTMLFormElement | null>(null);

	// ---------------------------------------------------------------------
	// Copy an entry into a project's Files & code
	// ---------------------------------------------------------------------

	/**
	 * A copy, not a link: the entry stays here and stays editable, and the
	 * project keeps what was true when it was copied. The picker offers every
	 * project of both kinds; a role project's page lives under its role's, which
	 * is why a target carries its role id.
	 */
	let promotingId = $state<string | null>(null);
	let promoteTarget = $state('');
	let promoting = $state(false);
	type ProjectTarget = (typeof data.projectTargets)[number];
	let promoteResult = $state<
		{ ok: true; message: string; target: ProjectTarget } | { ok: false; message: string } | null
	>(null);

	const sideTargets = $derived(data.projectTargets.filter((t) => t.kind === 'side_project'));
	const roleTargets = $derived(
		data.projectTargets.filter((t) => t.kind === 'work_experience_project')
	);

	function startPromote(id: string) {
		promotingId = id;
		editingId = null;
		promoteTarget = '';
		promoteResult = null;
		menuOpenId = null;
	}

	function sourcesHref(target: ProjectTarget): ResolvedPathname {
		return target.kind === 'side_project'
			? resolve('/(app)/profile/(data)/side-projects/[id]/sources', { id: String(target.id) })
			: resolve('/(app)/profile/(data)/work-experience/[id]/projects/[pid]/sources', {
					id: String(target.workExperienceId),
					pid: String(target.id)
				});
	}

	async function promoteEntry(entryId: string) {
		const target = data.projectTargets.find((t) => `${t.kind}:${t.id}` === promoteTarget);
		if (!target || promoting) return;
		promoting = true;
		promoteResult = null;
		try {
			const res = await fetch(`/api/project-sources/${target.kind}/${target.id}/from-record`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ record_id: Number(rawId(entryId)) })
			});
			const body = await res.json().catch(() => ({}));
			if (!res.ok) {
				promoteResult = { ok: false, message: body?.message ?? 'Could not copy this entry.' };
				return;
			}
			promoteResult = {
				ok: true,
				message: body?.unchanged
					? `${target.name} already has this entry.`
					: `Copied to ${target.name}.`,
				target
			};
		} catch {
			promoteResult = { ok: false, message: 'Could not copy this entry.' };
		} finally {
			promoting = false;
		}
	}
</script>

<svelte:window
	onclick={() => {
		if (menuOpenId !== null) menuOpenId = null;
	}}
/>

<div class="space-y-5">
	<div class="flex flex-wrap items-center justify-between gap-3">
		<div class="flex items-center gap-2">
			<FontAwesomeIcon icon={faStream} class="h-5 w-5 text-[var(--dash-primary)]" />
			<h2 class="text-lg font-semibold text-[var(--dash-text)]">Activity</h2>
			{#if recordCount > 0}
				<span class="text-sm text-[var(--dash-text-muted)]">
					<!--
            Shows "1 of 3" while filtered. A bare total next to a single visible
            card reads as a rendering bug rather than as a filter being active.
          -->
					{shownRecordCount === recordCount
						? `${recordCount} ${recordCount === 1 ? 'entry' : 'entries'}`
						: `${shownRecordCount} of ${recordCount}`}
				</span>
			{/if}
		</div>

		<label class="flex cursor-pointer items-center gap-2 text-xs text-[var(--dash-text-secondary)]">
			<input
				type="checkbox"
				bind:checked={showStatusEvents}
				class="rounded border-[var(--dash-border)]"
			/>
			Show status changes
		</label>
	</div>

	{#if form?.error}
		<p
			class="flex items-start gap-2 rounded-lg border border-[var(--dash-error)] bg-[var(--dash-error-light)] px-3 py-2 text-sm text-[var(--dash-error)]"
		>
			<FontAwesomeIcon icon={faTriangleExclamation} class="mt-0.5 h-4 w-4 shrink-0" />
			{form.error}
		</p>
	{/if}

	<!--
    The composer sits at the TOP because the stream is newest-first — what you
    just added should appear directly beneath it. There is no type picker, no
    stage picker, no date field and no title field: every one of those is
    derived and stays editable afterwards.
  -->
	<form method="POST" action="?/create" enctype="multipart/form-data" use:enhance={handleCreate}>
		<div
			role="presentation"
			ondragover={(e) => {
				e.preventDefault();
				dragging = true;
			}}
			ondragleave={() => (dragging = false)}
			ondrop={onDrop}
			class="rounded-lg border transition-colors {dragging
				? 'border-[var(--dash-primary)] bg-[var(--dash-primary)]/5'
				: 'border-[var(--dash-border)] bg-[var(--dash-card)]'}"
		>
			{#if stagedFile}
				<div class="flex items-center gap-2 px-3 pt-2.5 text-xs text-[var(--dash-text-secondary)]">
					<FontAwesomeIcon icon={faPaperclip} class="h-3 w-3 shrink-0" />
					<span class="truncate">{stagedFile.name}</span>
					<button
						type="button"
						onclick={clearFile}
						class="ml-auto shrink-0 p-1 text-[var(--dash-text-muted)] transition-colors hover:text-[var(--dash-error)]"
						aria-label="Remove attachment"
					>
						<FontAwesomeIcon icon={faTimes} class="h-3 w-3" />
					</button>
				</div>
			{/if}

			<textarea
				name="content"
				bind:value={composerText}
				onpaste={onPaste}
				rows={composerText || stagedFile ? 4 : 2}
				placeholder="Paste an email, drop a file, or write an update…"
				class="w-full resize-y bg-transparent px-3 py-2.5 text-sm text-[var(--dash-text)] placeholder:text-[var(--dash-text-muted)] focus:outline-none"
			></textarea>

			<!-- Carries a pasted or dropped File into the ordinary form submission. -->
			<input
				bind:this={fileInput}
				type="file"
				name="file"
				class="hidden"
				onchange={(e) => {
					const f = (e.currentTarget as HTMLInputElement).files?.[0];
					if (f) stagedFile = f;
				}}
			/>

			<div
				class="flex items-center justify-between gap-2 border-t border-[var(--dash-border)] px-3 pt-2 pb-2.5"
			>
				<button
					type="button"
					onclick={() => fileInput?.click()}
					class="flex items-center gap-1.5 text-xs text-[var(--dash-text-secondary)] transition-colors hover:text-[var(--dash-primary)]"
				>
					<FontAwesomeIcon icon={faPaperclip} class="h-3 w-3" />
					Attach a file
				</button>
				<button
					type="submit"
					disabled={saving || (!composerText.trim() && !stagedFile)}
					class="flex items-center gap-1.5 rounded-md bg-[var(--dash-primary)] px-3 py-1.5 text-xs text-white transition-colors hover:bg-[var(--dash-primary-hover)] disabled:opacity-50"
				>
					{#if saving}
						<Spinner size="w-3 h-3" />
					{/if}
					{saving ? 'Saving…' : 'Save'}
				</button>
			</div>
		</div>
	</form>

	{#if presentTypes.length > 1}
		<div class="flex flex-wrap gap-1.5">
			<button
				type="button"
				onclick={() => (typeFilter = null)}
				class="rounded-full px-2.5 py-1 text-xs font-medium transition-colors {typeFilter === null
					? 'bg-[var(--dash-primary)] text-white'
					: 'bg-[var(--dash-bg)] text-[var(--dash-text-secondary)] hover:bg-[var(--dash-border)]'}"
			>
				All
			</button>
			{#each presentTypes as type}
				<button
					type="button"
					onclick={() => (typeFilter = typeFilter === type.value ? null : type.value)}
					class="rounded-full px-2.5 py-1 text-xs font-medium transition-colors {typeFilter ===
					type.value
						? 'bg-[var(--dash-primary)] text-white'
						: getRecordTypeColor(type.value)}"
				>
					{type.label}
				</button>
			{/each}
		</div>
	{/if}

	{#if stream.length === 0}
		{#if typeFilter}
			<!--
        Deliberately distinct from the "nothing here yet" state below. The user
        has to be able to tell "there is none" from "your filter excluded it" —
        the same empty-vs-never-looked distinction the prompt context draws.
      -->
			<EmptyState
				icon={faStream}
				title="Nothing of this type yet"
				description="No entries match the filter you picked. Clear it to see everything on this application."
				actionLabel="Clear filter"
				onAction={() => (typeFilter = null)}
			/>
		{:else}
			<EmptyState
				icon={faStream}
				title="Nothing recorded yet"
				description="Paste an email, a message, or notes from a call. Anything you keep here feeds your AI cheat sheets and your application writing."
			/>
		{/if}
	{:else}
		<div class="space-y-2.5">
			{#each stream as entry (entry.id)}
				{#if entry.kind === 'status'}
					<!--
            Status transitions read deliberately unlike records: no card, no
            pill, just a rule. They are context for the entries around them,
            not content in their own right.
          -->
					<div class="flex items-center gap-2.5 px-1 py-1">
						<div class="h-2 w-2 shrink-0 rounded-full {getStatusBgColor(entry.to_status)}"></div>
						<span class="text-xs text-[var(--dash-text-secondary)]">
							{statusLabel(entry)}
						</span>
						<div class="h-px flex-1 bg-[var(--dash-border)]"></div>
						<span class="shrink-0 text-[11px] text-[var(--dash-text-muted)]">
							{formatDate(entry.at)}
						</span>
					</div>
					{#if entry.description}
						<p class="-mt-1 pl-[18px] text-xs text-[var(--dash-text-secondary)]">
							{entry.description}
						</p>
					{/if}
				{:else}
					<!--
            Anchor target for the "source" links on the overview page's details
            card. `scroll-mt` keeps the entry clear of the sticky tab bar rather
            than landing underneath it.
          -->
					<div id={entry.id} class="scroll-mt-24">
						<Card padding="sm">
							<div class="flex flex-wrap items-start gap-2">
								<span
									class="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium {getRecordTypeColor(
										entry.record_type
									)}"
								>
									{getRecordTypeLabel(entry.record_type)}
								</span>
								<span
									class="min-w-0 flex-1 text-sm font-medium break-words text-[var(--dash-text)]"
								>
									{entry.title}
								</span>
								{#if entry.at}
									<span class="mt-0.5 shrink-0 text-[11px] text-[var(--dash-text-muted)]">
										{formatDate(entry.at)}
									</span>
								{/if}

								{#if isEditable(entry.id)}
									<div class="relative shrink-0">
										<button
											type="button"
											onclick={(e) => {
												e.stopPropagation();
												menuOpenId = menuOpenId === entry.id ? null : entry.id;
											}}
											class="-mt-0.5 p-1 text-[var(--dash-text-muted)] transition-colors hover:text-[var(--dash-text)]"
											aria-label="Actions"
										>
											<FontAwesomeIcon icon={faEllipsisVertical} class="h-3 w-3" />
										</button>
										{#if menuOpenId === entry.id}
											<div
												class="absolute top-7 right-0 z-20 min-w-[120px] rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)] py-1 shadow-lg"
											>
												<button
													type="button"
													onclick={() => startEdit(entry)}
													class="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-[var(--dash-text)] transition-colors hover:bg-[var(--dash-bg)]"
												>
													<FontAwesomeIcon icon={faPencil} class="h-3 w-3" />
													Edit
												</button>
												<button
													type="button"
													onclick={() => startPromote(entry.id)}
													class="flex w-full items-center gap-2 px-3 py-1.5 text-xs whitespace-nowrap text-[var(--dash-text)] transition-colors hover:bg-[var(--dash-bg)]"
												>
													<FontAwesomeIcon icon={faFolderPlus} class="h-3 w-3" />
													Copy to a project
												</button>
												<button
													type="button"
													onclick={() => {
														deleteTarget = { id: entry.id, title: entry.title };
														menuOpenId = null;
													}}
													class="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-[var(--dash-error)] transition-colors hover:bg-[var(--dash-bg)]"
												>
													<FontAwesomeIcon icon={faTrash} class="h-3 w-3" />
													Delete
												</button>
											</div>
										{/if}
									</div>
								{/if}
							</div>

							{#if entry.contacts.length > 0 || entry.fromFile || entry.step}
								<div
									class="mt-1.5 flex flex-wrap items-center gap-3 text-[11px] text-[var(--dash-text-muted)]"
								>
									{#each entry.contacts as contact}
										<span>{contactLabel(contact)}</span>
									{/each}
									{#if entry.step}
										<span class="italic">{entry.step}</span>
									{/if}
									{#if entry.fromFile && entry.fileId}
										<a
											href="{basePath}/activity/download?fileId={entry.fileId}"
											class="inline-flex items-center gap-1 transition-colors hover:text-[var(--dash-primary)]"
										>
											<FontAwesomeIcon icon={faPaperclip} class="h-2.5 w-2.5" />
											Attached file
											<FontAwesomeIcon icon={faDownload} class="h-2.5 w-2.5" />
										</a>
									{/if}
								</div>
							{/if}

							{#if promotingId === entry.id}
								<!--
                The success line links to where the copy landed: it is
                invisible from this page, and a change you cannot see land is
                one you go and check.
              -->
								<div class="mt-2 rounded-md border border-[var(--dash-border)] p-2.5">
									<p class="text-xs text-[var(--dash-text-secondary)]">
										Copy this entry's text into a project's Files &amp; code, so it counts as
										evidence for that project in every letter, answer and cheat sheet — not only on
										this application.
									</p>
									{#if data.projectTargets.length === 0}
										<p class="mt-2 text-xs text-[var(--dash-text-muted)] italic">
											You have no projects yet. Add one under Work experience or Side projects
											first.
										</p>
									{:else}
										<div class="mt-2 flex flex-wrap items-center gap-2">
											<select
												bind:value={promoteTarget}
												class="min-w-0 flex-1 rounded-md border border-[var(--dash-border)] bg-[var(--dash-card)] px-2 py-1.5 text-xs text-[var(--dash-text)]"
											>
												<option value="">Choose a project…</option>
												{#if sideTargets.length > 0}
													<optgroup label="Side projects">
														{#each sideTargets as target (target.id)}
															<option value={`${target.kind}:${target.id}`}>{target.name}</option>
														{/each}
													</optgroup>
												{/if}
												{#if roleTargets.length > 0}
													<optgroup label="Work experience">
														{#each roleTargets as target (target.id)}
															<option value={`${target.kind}:${target.id}`}>
																{target.context} · {target.name}
															</option>
														{/each}
													</optgroup>
												{/if}
											</select>
											<button
												type="button"
												onclick={() => promoteEntry(entry.id)}
												disabled={!promoteTarget || promoting}
												class="rounded-md bg-[var(--dash-primary)] px-3 py-1.5 text-xs text-white transition-colors hover:bg-[var(--dash-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
											>
												{promoting ? 'Copying…' : 'Copy to project'}
											</button>
											<button
												type="button"
												onclick={() => (promotingId = null)}
												class="rounded-md border border-[var(--dash-border)] px-3 py-1.5 text-xs text-[var(--dash-text)] transition-colors hover:bg-[var(--dash-bg)]"
											>
												{promoteResult?.ok ? 'Done' : 'Cancel'}
											</button>
										</div>
									{/if}
									{#if promoteResult}
										<p
											class="mt-2 text-xs {promoteResult.ok
												? 'text-[var(--dash-text-secondary)]'
												: 'text-[var(--dash-error)]'}"
										>
											{promoteResult.message}
											{#if promoteResult.ok}
												<a
													href={sourcesHref(promoteResult.target)}
													class="text-[var(--dash-primary)] hover:underline"
												>
													Open its Files &amp; code
												</a>
											{/if}
										</p>
									{/if}
								</div>
							{/if}

							{#if editingId === entry.id}
								<!--
                Editing is where the derived metadata becomes correctable. The
                form deliberately omits `step`: the update action treats an
                absent field as "leave alone" rather than "clear", so the stage
                derived at save time survives an edit that never mentions it.
              -->
								<form
									method="POST"
									action="?/update"
									use:enhance={() => handleMutation(() => (editingId = null))}
									class="mt-2 space-y-2"
								>
									<input type="hidden" name="id" value={rawId(entry.id)} />
									<input
										name="title"
										bind:value={editTitle}
										class="w-full rounded-md border border-[var(--dash-border)] bg-[var(--dash-card)] px-2 py-1.5 text-sm text-[var(--dash-text)] focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
									/>
									<div class="flex gap-2">
										<select
											name="record_type"
											bind:value={editType}
											class="rounded-md border border-[var(--dash-border)] bg-[var(--dash-card)] px-2 py-1.5 text-xs text-[var(--dash-text)]"
										>
											{#each recordTypes as type}
												<option value={type.value}>{type.label}</option>
											{/each}
										</select>
										<input
											type="date"
											name="event_date"
											bind:value={editDate}
											class="rounded-md border border-[var(--dash-border)] bg-[var(--dash-card)] px-2 py-1.5 text-xs text-[var(--dash-text)]"
										/>
									</div>
									<textarea
										name="content"
										bind:value={editContent}
										rows={8}
										class="w-full resize-y rounded-md border border-[var(--dash-border)] bg-[var(--dash-card)] px-2 py-1.5 text-xs text-[var(--dash-text)] focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
									></textarea>
									<div class="flex justify-end gap-2">
										<button
											type="button"
											onclick={() => (editingId = null)}
											class="rounded-md border border-[var(--dash-border)] px-3 py-1.5 text-xs text-[var(--dash-text)] transition-colors hover:bg-[var(--dash-bg)]"
										>
											Cancel
										</button>
										<button
											type="submit"
											class="rounded-md bg-[var(--dash-primary)] px-3 py-1.5 text-xs text-white transition-colors hover:bg-[var(--dash-primary-hover)]"
										>
											Save
										</button>
									</div>
								</form>
							{:else if !entry.content && entry.extractionStatus === 'pending'}
								<!--
                The entry was written before its file was read, so the stream
                can show it immediately. Blocking the composer on a 40-page PDF
                would make dropping a file feel worse than pasting text, which
                is exactly the split this page exists to remove.
              -->
								<p class="mt-1.5 flex items-center gap-1.5 text-xs text-[var(--dash-text-muted)]">
									<Spinner size="w-3 h-3" />
									Reading the file…
								</p>
							{:else if !entry.content && entry.extractionStatus === 'skipped'}
								<p class="mt-1.5 text-xs text-[var(--dash-text-muted)] italic">
									No text could be read from this file — it is still attached and downloadable.
								</p>
							{:else if entry.content}
								{#if expanded[entry.id]}
									<div
										class="prose prose-sm mt-2 max-h-96 max-w-none overflow-y-auto rounded-md bg-[var(--dash-bg)] px-2.5 py-2 text-[var(--dash-text)]"
									>
										{@html renderSafeMarkdown(entry.content)}
									</div>
								{:else}
									<p class="mt-1.5 text-xs break-words text-[var(--dash-text-secondary)]">
										{preview(entry.content)}
									</p>
								{/if}

								<!--
                Every entry gets the toggle, including short ones. A control
                that appears on some rows and not others is harder to scan than
                one that is always in the same place; a short entry simply has
                nothing hidden behind it.
              -->
								<button
									type="button"
									onclick={() => (expanded = { ...expanded, [entry.id]: !expanded[entry.id] })}
									class="mt-1.5 flex items-center gap-1 text-[11px] text-[var(--dash-primary)] hover:underline"
								>
									<FontAwesomeIcon
										icon={expanded[entry.id] ? faChevronUp : faChevronDown}
										class="h-2.5 w-2.5"
									/>
									{expanded[entry.id] ? 'Show less' : 'Show full text'}
								</button>
							{/if}
						</Card>
					</div>
				{/if}
			{/each}
		</div>
	{/if}
</div>

<!--
  Submitted programmatically from the modal. A real form rather than a
  constructed one so it goes through use:enhance like every other mutation
  here, instead of a full page navigation.
-->
<form
	method="POST"
	action="?/delete"
	bind:this={deleteForm}
	use:enhance={() => handleMutation(() => (deleteTarget = null))}
	class="hidden"
>
	<input type="hidden" name="id" value={deleteTarget ? rawId(deleteTarget.id) : ''} />
</form>

<ConfirmModal
	isOpen={deleteTarget !== null}
	title="Delete entry"
	message={`Delete "${deleteTarget?.title ?? ''}"? Any file attached to it is deleted too. This cannot be undone.`}
	onCancel={() => (deleteTarget = null)}
	onConfirm={() => deleteForm?.requestSubmit()}
/>
