<script lang="ts">
	/**
	 * One project of a role: the collapsed header, and the editor behind it.
	 *
	 * Every field writes itself. There is no Save button and no dirty state to
	 * lose — `store.update` merges the change and the row's `autoSaveField`
	 * debounces a PATCH, with the status pill in this row's header rather than at
	 * the bottom of the section, which is where the button used to be and where
	 * nobody editing the seventh project could see it.
	 */
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faChevronDown, faChevronRight, faTimes } from '@fortawesome/free-solid-svg-icons';
	import AutoSaveIndicator from '$lib/components/AutoSaveIndicator.svelte';
	import TranslatableField from '$lib/components/TranslatableField.svelte';
	import type { SectionRow, SectionRows } from '$lib/components/section-rows.svelte';
	import ProjectDocuments from './ProjectDocuments.svelte';
	import ProjectTechnologies from './ProjectTechnologies.svelte';
	import ProjectSuggestions from '$lib/components/ProjectSuggestions.svelte';
	import ProjectRepoFetch from '$lib/components/ProjectRepoFetch.svelte';
	import type { ProjectData } from './work-experience-projects';

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
		row,
		store,
		profileId,
		technologies = [],
		documents = [],
		open,
		onToggle,
		onRemove
	}: {
		row: SectionRow<ProjectData>;
		store: SectionRows<ProjectData>;
		profileId: number;
		technologies?: Array<{ id: number; name: string | null }>;
		documents?: DocForList[];
		open: boolean;
		onToggle: () => void;
		onRemove: () => void;
	} = $props();

	const inputClass =
		'w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent';

	function set(patch: Partial<ProjectData>) {
		store.update(row, patch);
	}

	/** The chips component owns its own store, so suggestions reach it by ref. */
	let technologiesRef = $state<{ addTechnologies: (names: string[]) => void } | null>(null);

	/**
	 * An answered question lands in `outcome`, whose placeholder is literally
	 * "What changed because of it?" — this table has no achievement rows, and
	 * that field is the same idea in singular form. Appended rather than
	 * replaced: a role's project can have more than one thing worth saying, and
	 * silently overwriting what is there would be the worse failure.
	 */
	function applyDraftedAchievement(achievement: string) {
		const current = (row.data.outcome ?? '').trim();
		set({ outcome: current ? `${current}\n${achievement}` : achievement });
		row.field.flush();
	}

	function yearLabel(value: string): string {
		return value ? value.slice(0, 4) : '';
	}

	const dateRange = $derived.by(() => {
		const start = yearLabel(row.data.start_date);
		const end = yearLabel(row.data.end_date);
		if (start && end) return start === end ? start : `${start} – ${end}`;
		if (start) return `${start} – present`;
		return end;
	});

	/** Said in two places, because a draft has neither of the two things an id buys. */
	const untilNamed = 'Give the project a name and this appears.';
</script>

<div class="overflow-hidden rounded-lg border border-[var(--dash-border)]">
	<div class="flex items-center">
		<button
			type="button"
			onclick={onToggle}
			class="flex flex-1 items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-[var(--dash-bg)]/50"
		>
			<FontAwesomeIcon
				icon={open ? faChevronDown : faChevronRight}
				class="h-3 w-3 text-[var(--dash-text-secondary)]"
			/>
			<span
				class="flex-1 text-[var(--dash-text)] {!row.data.name.trim()
					? 'text-[var(--dash-text-secondary)] italic'
					: ''}"
			>
				{row.data.name.trim() || 'Untitled project'}
			</span>
			{#if dateRange}
				<span class="text-xs text-[var(--dash-text-muted)]">{dateRange}</span>
			{/if}
		</button>
		<!--
			The statement lives on the row being edited rather than on the section's
			heading, because that is where the question is asked: a collapsed project
			cannot be edited and needs no reassurance, and an open one is where the
			user is typing. It is a standing label until there is a real status to
			show, and the status replaces it.
		-->
		<AutoSaveIndicator field={row.field} idleLabel={open ? 'Saves as you type' : undefined} />
		<button
			type="button"
			onclick={onRemove}
			class="p-3 text-[var(--dash-text-secondary)] transition-colors hover:text-[var(--dash-error)]"
			aria-label="Remove project"
		>
			<FontAwesomeIcon icon={faTimes} class="h-4 w-4" />
		</button>
	</div>

	{#if open}
		<div class="space-y-4 border-t border-[var(--dash-border)] bg-[var(--dash-bg)]/30 p-4">
			<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
				<TranslatableField
					entity="work_experience_project"
					id={row.id ?? 0}
					field="name"
					label="Project Name"
					required
					bind:value={() => row.data.name, (v) => set({ name: v })}
					onblur={row.field.flush}
					placeholder="e.g. Payments rewrite"
				/>
				<div>
					<label
						for="proj-url-{row.key}"
						class="mb-1 block text-sm font-medium text-[var(--dash-text)]">URL</label
					>
					<input
						id="proj-url-{row.key}"
						type="url"
						value={row.data.url}
						oninput={(e) => set({ url: e.currentTarget.value })}
						onblur={row.field.flush}
						placeholder="https://…"
						class={inputClass}
					/>
				</div>
				<div>
					<label
						for="proj-repo-{row.key}"
						class="mb-1 block text-sm font-medium text-[var(--dash-text)]">Repo URL</label
					>
					<input
						id="proj-repo-{row.key}"
						type="url"
						value={row.data.repo_url}
						oninput={(e) => set({ repo_url: e.currentTarget.value })}
						onblur={row.field.flush}
						placeholder="https://github.com/…"
						class={inputClass}
					/>
				</div>
				<div>
					<label
						for="proj-start-{row.key}"
						class="mb-1 block text-sm font-medium text-[var(--dash-text)]">Start Date</label
					>
					<input
						id="proj-start-{row.key}"
						type="date"
						value={row.data.start_date}
						onchange={(e) => set({ start_date: e.currentTarget.value })}
						class={inputClass}
					/>
				</div>
				<div>
					<label
						for="proj-end-{row.key}"
						class="mb-1 block text-sm font-medium text-[var(--dash-text)]">End Date</label
					>
					<input
						id="proj-end-{row.key}"
						type="date"
						value={row.data.end_date}
						onchange={(e) => set({ end_date: e.currentTarget.value })}
						class={inputClass}
					/>
				</div>
			</div>

			<TranslatableField
				entity="work_experience_project"
				id={row.id ?? 0}
				field="description"
				label="Description"
				multiline
				rows={3}
				bind:value={() => row.data.description, (v) => set({ description: v })}
				onblur={row.field.flush}
				placeholder="What was the project and your role in it?"
			/>

			<TranslatableField
				entity="work_experience_project"
				id={row.id ?? 0}
				field="outcome"
				label="Outcome"
				multiline
				rows={2}
				bind:value={() => row.data.outcome, (v) => set({ outcome: v })}
				onblur={row.field.flush}
				placeholder="What changed because of it?"
			/>

			<div>
				{#if row.id}
					<!-- Brings its own heading, so the chips' save state sits beside it. -->
					<ProjectTechnologies
						bind:this={technologiesRef}
						projectId={row.id}
						{profileId}
						initial={technologies}
					/>
				{:else}
					<span class="mb-1 block text-sm font-medium text-[var(--dash-text)]">Technologies</span>
					<p class="text-xs text-[var(--dash-text-muted)] italic">{untilNamed}</p>
				{/if}
			</div>

			<div>
				<span class="mb-1 block text-sm font-medium text-[var(--dash-text)]">
					Files & source code
				</span>
				{#if row.id}
					<ProjectRepoFetch
						kind="work_experience_project"
						projectId={row.id}
						repoUrl={row.data.repo_url ?? ''}
						current={{
							name: row.data.name ?? '',
							url: row.data.url ?? '',
							description: row.data.description ?? '',
							start_date: row.data.start_date ?? '',
							end_date: row.data.end_date ?? ''
						}}
						currentTechnologies={technologies.map((t) => t.name ?? '').filter(Boolean)}
						onApply={(values: Record<string, string>) => {
							set(values as Partial<ProjectData>);
							row.field.flush();
						}}
						onApplyTechnologies={(names: string[]) => technologiesRef?.addTechnologies(names)}
						onSetRepoUrl={(v: string) => {
							set({ repo_url: v });
							row.field.flush();
						}}
					/>
					<ProjectDocuments
						{profileId}
						workExperienceProjectId={row.id}
						repoUrl={row.data.repo_url ?? ''}
						{documents}
					/>
					<ProjectSuggestions
						kind="work_experience_project"
						projectId={row.id}
						currentSummary={row.data.description ?? ''}
						currentTechnologies={technologies.map((t) => t.name ?? '').filter(Boolean)}
						summaryLabel="Description"
						achievementLabel="Outcome"
						onApplySummary={(v) => {
							set({ description: v });
							row.field.flush();
						}}
						onApplyTechnologies={(names) => technologiesRef?.addTechnologies(names)}
						onApplyAchievement={applyDraftedAchievement}
					/>
				{:else}
					<p class="text-xs text-[var(--dash-text-muted)] italic">{untilNamed}</p>
				{/if}
			</div>
		</div>
	{/if}
</div>
