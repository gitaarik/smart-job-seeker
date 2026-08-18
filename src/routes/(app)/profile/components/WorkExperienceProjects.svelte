<script lang="ts">
	/**
	 * A role's projects, as a list of links.
	 *
	 * ## What changed, and why
	 *
	 * Each row used to expand into the whole editor: fields, technologies,
	 * attached files, repo metadata, code proposals. That was fine when a project
	 * was four fields. It is not fine now — the editor had reached three hundred
	 * lines nested inside a section inside this page, and every feature added to
	 * a project had to be fitted into an accordion row *and* into the side
	 * project page separately.
	 *
	 * So a project has its own page now, the way a side project always has, and
	 * this is the list that reaches it. What stays here is what belongs to the
	 * *collection* rather than to a project: the order, the delete, and adding
	 * one. Reordering keeps an explicit commit because a drag is not finished
	 * until it is dropped, and deleting asks first because a project owns its
	 * technologies and documents by cascade.
	 */
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faChevronRight, faGripVertical, faPlus } from '@fortawesome/free-solid-svg-icons';
	import SectionSaveButton from '$lib/components/SectionSaveButton.svelte';
	import { sectionRows, type SectionRow } from '$lib/components/section-rows.svelte';
	import ConfirmModal from './ConfirmModal.svelte';
	import {
		blankProject,
		projectBody,
		projectIsWorthCreating,
		toProjectData,
		type ProjectData
	} from './work-experience-projects';
	import { dndzone } from 'svelte-dnd-action';
	import { flip } from 'svelte/animate';

	interface InitialProject {
		id: number;
		name: string | null;
		url: string | null;
		repo_url: string | null;
		start_date: string | Date | null;
		end_date: string | Date | null;
		description: string | null;
		outcome: string | null;
		work_experience_project_technologies: { id: number; name: string | null }[];
		profile_document_projects: { id: number }[];
	}

	let {
		workExperienceId,
		projects: initial,
		profileId
	}: {
		workExperienceId: number;
		projects: InitialProject[];
		profileId: number;
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

	/** Counts shown on a row, by project id — what the row can say without opening it. */
	const counts: Record<number, { technologies: number; sources: number }> = Object.fromEntries(
		initial.map((p) => [
			p.id,
			{
				technologies: (p.work_experience_project_technologies ?? []).length,
				sources: (p.profile_document_projects ?? []).length
			}
		])
	);

	let confirming = $state<SectionRow<ProjectData> | null>(null);
	let removeError = $state<string | null>(null);

	// --- Adding ---
	//
	// A project needs a name before it can exist (the section's one required
	// field), and it needs an id before it has a page. So the name is asked for
	// here and the create is a plain POST — the row store's create is driven by
	// a debounce, which is right for an editor and wrong for "make this, then
	// take me to it".
	let adding = $state(false);
	let newName = $state('');
	let creating = $state(false);
	let addError = $state<string | null>(null);

	function startAdd() {
		adding = true;
		newName = '';
		addError = null;
	}

	async function createProject(e: SubmitEvent) {
		e.preventDefault();
		const name = newName.trim();
		if (!name || creating) return;
		creating = true;
		addError = null;
		try {
			const res = await fetch('/api/profile-section/work_experience_project', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name,
					work_experience_id: workExperienceId,
					profile_id: profileId
				})
			});
			const body = await res.json().catch(() => null);
			if (!res.ok) {
				addError = body?.message ?? 'Could not create that project.';
				return;
			}
			await goto(
				resolve('/(app)/profile/(data)/work-experience/[id]/projects/[pid]', {
					id: String(workExperienceId),
					pid: String(body.id)
				})
			);
		} catch {
			addError = 'Could not create that project.';
		} finally {
			creating = false;
		}
	}

	async function confirmRemove() {
		const row = confirming;
		confirming = null;
		if (!row) return;
		try {
			await store.remove(row);
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

	/** What a row can say about itself without being opened. */
	function summaryLine(row: SectionRow<ProjectData>): string {
		const c = row.id ? counts[row.id] : undefined;
		const parts: string[] = [];
		if (c?.technologies)
			parts.push(`${c.technologies} ${c.technologies === 1 ? 'technology' : 'technologies'}`);
		if (c?.sources) parts.push(`${c.sources} ${c.sources === 1 ? 'source' : 'sources'}`);
		return parts.join(' · ');
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
		<div class="space-y-2">
			{#each store.rows as row (row.key)}
				<div
					class="flex items-center rounded-lg border border-[var(--dash-border)] transition-colors hover:border-[var(--dash-primary)]/40"
				>
					<a
						href={resolve('/(app)/profile/(data)/work-experience/[id]/projects/[pid]', {
							id: String(workExperienceId),
							pid: String(row.id ?? 0)
						})}
						class="flex min-w-0 flex-1 items-center gap-3 px-4 py-3"
					>
						<span class="min-w-0 flex-1">
							<span
								class="block truncate text-[var(--dash-text)] {!row.data.name.trim()
									? 'text-[var(--dash-text-secondary)] italic'
									: ''}"
							>
								{row.data.name.trim() || 'Untitled project'}
							</span>
							{#if summaryLine(row)}
								<span class="mt-0.5 block text-xs text-[var(--dash-text-muted)]">
									{summaryLine(row)}
								</span>
							{/if}
						</span>
						{#if dateRange(row.data)}
							<span class="shrink-0 text-xs text-[var(--dash-text-muted)]">
								{dateRange(row.data)}
							</span>
						{/if}
						<FontAwesomeIcon
							icon={faChevronRight}
							class="h-3 w-3 shrink-0 text-[var(--dash-text-secondary)]"
						/>
					</a>
					<button
						type="button"
						onclick={() => (confirming = row)}
						class="px-3 py-3 text-xs text-[var(--dash-text-secondary)] transition-colors hover:text-[var(--dash-error)]"
					>
						Delete
					</button>
				</div>
			{/each}
		</div>
	{/if}

	{#if removeError}
		<p class="mt-2 text-sm text-[var(--dash-error)]">{removeError}</p>
	{/if}

	{#if adding}
		<form onsubmit={createProject} class="mt-3 flex flex-wrap items-center gap-2">
			<!-- svelte-ignore a11y_autofocus -->
			<input
				bind:value={newName}
				autofocus
				placeholder="Project name"
				class="min-w-0 flex-1 rounded-md border border-[var(--dash-border)] px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
			/>
			<button
				type="submit"
				disabled={creating || !newName.trim()}
				class="rounded-md bg-[var(--dash-primary)] px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--dash-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
			>
				{creating ? 'Creating…' : 'Create and open'}
			</button>
			<button
				type="button"
				onclick={() => (adding = false)}
				class="rounded-md border border-[var(--dash-border)] px-3 py-2 text-sm text-[var(--dash-text)] transition-colors hover:bg-[var(--dash-bg)]"
			>
				Cancel
			</button>
		</form>
		{#if addError}
			<p class="mt-2 text-sm text-[var(--dash-error)]">{addError}</p>
		{/if}
	{:else}
		<button
			type="button"
			onclick={startAdd}
			class="mt-3 flex items-center gap-1 text-sm text-[var(--dash-primary)] hover:text-[var(--dash-primary-hover)]"
		>
			<FontAwesomeIcon icon={faPlus} class="h-3 w-3" />
			Add Project
		</button>
	{/if}
{/if}

<ConfirmModal
	isOpen={confirming !== null}
	title="Delete project"
	message={`Delete “${confirming?.data.name.trim() || 'Untitled project'}”? Its technologies and any files attached to it go with it, and this cannot be undone.`}
	confirmLabel="Delete"
	onCancel={() => (confirming = null)}
	onConfirm={confirmRemove}
/>
