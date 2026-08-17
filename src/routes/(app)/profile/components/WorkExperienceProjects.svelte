<script lang="ts">
	/**
	 * A role's projects, each saving itself.
	 *
	 * ## What changed, and why
	 *
	 * This used to be one local array posted whole to
	 * `PATCH /api/work-experience/[id]` behind a Save button. Two problems, and
	 * only one of them was visible:
	 *
	 *  - The button sat below every project in the section, after "Add Project",
	 *    so editing the seventh one put it off-screen — on a page whose basic
	 *    fields had been auto-saving for months. Nothing was broken. The page
	 *    asked for a click it never showed you, having taught you it wouldn't.
	 *  - The endpoint reconciles: it deletes every project the payload does not
	 *    mention. That is correct behind a button and unusable in front of a
	 *    debounce, because each tick would ship one tab's whole idea of the
	 *    section and silently delete rows another tab had added.
	 *
	 * So the writes are per row now, through `/api/profile-section/…` and
	 * `sectionRows`. Reordering keeps an explicit commit because a drag is not
	 * finished until it is dropped, and deleting asks first because a project
	 * owns its technologies and documents by cascade.
	 */
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faGripVertical, faPlus } from '@fortawesome/free-solid-svg-icons';
	import SectionSaveButton from '$lib/components/SectionSaveButton.svelte';
	import { sectionRows, type SectionRow } from '$lib/components/section-rows.svelte';
	import ConfirmModal from './ConfirmModal.svelte';
	import WorkExperienceProjectRow from './WorkExperienceProjectRow.svelte';
	import {
		blankProject,
		projectBody,
		projectIsWorthCreating,
		toProjectData,
		type ProjectData
	} from './work-experience-projects';
	import { dndzone } from 'svelte-dnd-action';
	import { flip } from 'svelte/animate';

	interface InitialTech {
		id: number;
		name: string | null;
	}
	interface InitialProject {
		id: number;
		name: string | null;
		url: string | null;
		start_date: string | Date | null;
		end_date: string | Date | null;
		description: string | null;
		outcome: string | null;
		work_experience_project_technologies: InitialTech[];
	}

	interface DocForList {
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
	}

	let {
		workExperienceId,
		projects: initial,
		profileId,
		documentsByProject = {}
	}: {
		workExperienceId: number;
		projects: InitialProject[];
		profileId: number;
		documentsByProject?: Record<number, DocForList[]>;
	} = $props();

	const store = sectionRows({
		resource: 'work_experience_project',
		parentKey: 'work_experience_id',
		parentId: workExperienceId,
		profileId,
		initial,
		toData: toProjectData,
		blank: blankProject,
		toBody: projectBody,
		canCreate: projectIsWorthCreating
	});

	// The technologies each project started with, by project id. The store for a
	// project's chips is seeded from this once and owns the list after that.
	const initialTechnologies: Record<number, InitialTech[]> = Object.fromEntries(
		initial.map((p) => [p.id, p.work_experience_project_technologies ?? []])
	);

	let expanded = $state<number | null>(null);
	let confirming = $state<SectionRow<ProjectData> | null>(null);
	let removeError = $state<string | null>(null);

	function addProject() {
		const row = store.add();
		expanded = row.key;
	}

	/**
	 * A project the user has opened and not written goes without asking.
	 *
	 * The confirmation is about losing something: the technologies and documents
	 * that hang off a saved project go with it, and no undo can bring those back.
	 * A draft has neither, and has never been anywhere but this screen.
	 */
	function requestRemove(row: SectionRow<ProjectData>) {
		if (row.id === null) {
			void store.remove(row);
			if (expanded === row.key) expanded = null;
			return;
		}
		confirming = row;
	}

	async function confirmRemove() {
		const row = confirming;
		confirming = null;
		if (!row) return;
		try {
			await store.remove(row);
			if (expanded === row.key) expanded = null;
		} catch (e) {
			removeError = e instanceof Error ? e.message : 'Could not delete that project';
		}
	}

	// --- Drag reorder (gated behind a toggle, like the Technologies section) ---
	const flipMs = 150;
	let reorderMode = $state(false);
	let reorderState = $state<'idle' | 'saving' | 'error'>('idle');
	let dnd = $state<Array<{ id: number; row: SectionRow<ProjectData> }>>([]);

	function startReorder() {
		dnd = store.rows.map((row) => ({ id: row.key, row }));
		expanded = null;
		reorderMode = true;
	}

	function handleConsider(e: CustomEvent<{ items: typeof dnd }>) {
		dnd = e.detail.items;
	}

	function handleFinalize(e: CustomEvent<{ items: typeof dnd }>) {
		dnd = e.detail.items;
	}

	async function saveReorder() {
		reorderState = 'saving';
		try {
			await store.reorder(dnd.map((d) => d.row));
			reorderState = 'idle';
			reorderMode = false;
			dnd = [];
		} catch {
			// Stay in reorder mode so the drop the user made is still on screen to
			// retry, rather than snapping back with nothing to show for it.
			reorderState = 'error';
			setTimeout(() => (reorderState = 'idle'), 3000);
		}
	}

	function cancelReorder() {
		reorderMode = false;
		dnd = [];
	}

	function yearLabel(value: string): string {
		return value ? value.slice(0, 4) : '';
	}

	function dateRange(p: ProjectData): string {
		const start = yearLabel(p.start_date);
		const end = yearLabel(p.end_date);
		if (start && end) return start === end ? start : `${start} – ${end}`;
		if (start) return `${start} – present`;
		return end;
	}
</script>

{#if reorderMode}
	<div
		use:dndzone={{ items: dnd, flipDurationMs: flipMs, dropTargetStyle: {} }}
		onconsider={handleConsider}
		onfinalize={handleFinalize}
		class="space-y-2"
	>
		{#each dnd as entry (entry.id)}
			<div
				animate:flip={{ duration: flipMs }}
				class="flex cursor-grab items-center rounded-lg border border-[var(--dash-border)] bg-[var(--dash-surface)] active:cursor-grabbing"
			>
				<span
					class="flex items-center self-stretch pr-1 pl-3 text-[var(--dash-text-secondary)]/60"
					aria-hidden="true"
				>
					<FontAwesomeIcon icon={faGripVertical} class="h-3 w-3" />
				</span>
				<span
					class="flex-1 px-2 py-3 text-[var(--dash-text)] {!entry.row.data.name.trim()
						? 'text-[var(--dash-text-secondary)] italic'
						: ''}"
				>
					{entry.row.data.name.trim() || 'Untitled project'}
				</span>
				{#if dateRange(entry.row.data)}
					<span class="px-3 text-xs text-[var(--dash-text-muted)]">{dateRange(entry.row.data)}</span
					>
				{/if}
			</div>
		{/each}
	</div>
	<div class="mt-4 flex items-center justify-end gap-2">
		<span class="mr-auto text-xs text-[var(--dash-text-muted)]">Drag to reorder, then save.</span>
		<button
			type="button"
			onclick={cancelReorder}
			class="rounded-lg border border-[var(--dash-border)] px-3 py-1.5 text-sm text-[var(--dash-text)] transition-colors hover:bg-[var(--dash-bg)]"
		>
			Cancel
		</button>
		<SectionSaveButton
			state={reorderState === 'idle' ? 'idle' : reorderState}
			onClick={saveReorder}
		/>
	</div>
{:else}
	{#if store.rows.length > 1}
		<div class="mb-2 flex justify-end">
			<button
				type="button"
				onclick={startReorder}
				class="inline-flex items-center gap-1 rounded border border-[var(--dash-border)] bg-[var(--dash-bg)] px-2 py-0.5 text-[10px] font-medium text-[var(--dash-text-muted)] transition-colors hover:text-[var(--dash-text)]"
			>
				<span class="inline-block h-1.5 w-1.5 rounded-full bg-[var(--dash-text-muted)]/30"></span>
				Reorder
			</button>
		</div>
	{/if}

	{#if store.rows.length === 0}
		<p class="text-sm text-[var(--dash-text-secondary)]">No projects added yet.</p>
	{:else}
		<div class="space-y-3">
			{#each store.rows as row (row.key)}
				<WorkExperienceProjectRow
					{row}
					{store}
					{profileId}
					technologies={row.id ? (initialTechnologies[row.id] ?? []) : []}
					documents={row.id ? (documentsByProject[row.id] ?? []) : []}
					open={expanded === row.key}
					onToggle={() => (expanded = expanded === row.key ? null : row.key)}
					onRemove={() => requestRemove(row)}
				/>
			{/each}
		</div>
	{/if}

	{#if removeError}
		<p class="mt-2 text-sm text-[var(--dash-error)]">{removeError}</p>
	{/if}

	<button
		type="button"
		onclick={addProject}
		class="mt-3 flex items-center gap-1 text-sm text-[var(--dash-primary)] hover:text-[var(--dash-primary-hover)]"
	>
		<FontAwesomeIcon icon={faPlus} class="h-3 w-3" />
		Add Project
	</button>
{/if}

<ConfirmModal
	isOpen={confirming !== null}
	title="Delete project"
	message={`Delete “${confirming?.data.name.trim() || 'Untitled project'}”? Its technologies and any files attached to it go with it, and this cannot be undone.`}
	confirmLabel="Delete"
	onCancel={() => (confirming = null)}
	onConfirm={confirmRemove}
/>
