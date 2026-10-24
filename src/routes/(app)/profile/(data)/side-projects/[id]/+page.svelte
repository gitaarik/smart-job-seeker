<script lang="ts">
	import type { PageData } from './$types';
	import { untrack } from 'svelte';
	import { remountOnAppliedChange } from '$lib/components/applied-change.svelte';
	import { armOn } from '$lib/actions/arm-on';
	import { invalidate, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faTrash } from '@fortawesome/free-solid-svg-icons';
	import MediaUpload from '$lib/components/MediaUpload.svelte';
	import { autoSaveField, patchBody, recordsEqual } from '$lib/components/auto-save.svelte';
	import AutoSaveIndicator from '$lib/components/AutoSaveIndicator.svelte';
	import TranslatableField from '$lib/components/TranslatableField.svelte';
	import AchievementsList, { type AchievementItem } from '$lib/components/AchievementsList.svelte';
	import { projectDetailDep } from '$lib/project-detail';
	import { sectionRows } from '$lib/components/section-rows.svelte';
	import { SITE_TEMPLATE_TAGS } from '$lib/profile-visibility';
	import ProjectRepoFetch from '$lib/components/ProjectRepoFetch.svelte';
	import ProjectSuggestions from '$lib/components/ProjectSuggestions.svelte';
	import VersionTags from '$lib/components/VersionTags.svelte';
	import ConfirmModal from '../../../components/ConfirmModal.svelte';
	import ProjectSourcesPointer from '../../../components/ProjectSourcesPointer.svelte';
	import TechnologyChips from '../../../components/TechnologyChips.svelte';
	import Card from '../../../../components/Card.svelte';

	let { data }: { data: PageData } = $props();

	// Everything below that starts from `data` does so once, at mount: the
	// fields, their auto-save baselines and the row stores are the page's own
	// from then on. The one thing that changes a project under an open editor is
	// a proposal applied from the chat panel, and that mounts the page again.
	remountOnAppliedChange();
	const loaded = untrack(() => data);

	let imageUrl = $state(loaded.imageUrl);
	let bannerUrl = $state(loaded.bannerUrl);

	let project = $derived(data.project);

	const sourcesHref = $derived(
		resolve('/(app)/profile/(data)/side-projects/[id]/sources', { id: String(project.id) })
	);

	/**
	 * Re-read the row this editor was built from, once a save has landed.
	 *
	 * The project comes from the layout's load, which SvelteKit keeps across a
	 * move between the tabs — so without this, leaving Details and coming back
	 * rebuilds the form from the values the page was opened with and the edit
	 * appears to have been thrown away. See `projectDetailDep`.
	 */
	function refresh() {
		void invalidate(projectDetailDep('side_project', project.id));
	}

	// Both child collections save as you type now, through `sectionRows` and
	// `/api/profile-section/…` (the technologies in TechnologyChips). The
	// staged-removal sets that used to require a commit are gone with them: a
	// chip goes immediately, and an achievement — a sentence nothing can retype
	// for the applicant — asks first.

	// Form states
	const loadedBasics = basicsOf(loaded.project);
	let editName = $state(loadedBasics.name);
	let editRole = $state(loadedBasics.role);
	let editUrl = $state(loadedBasics.url);
	let editRepoUrl = $state(loadedBasics.repoUrl);
	let editSummary = $state(loadedBasics.summary);
	let editStars = $state(loadedBasics.stars);
	let editStartDate = $state(loadedBasics.startDate);
	let editEndDate = $state(loadedBasics.endDate);
	let editTags = $state<string[]>(
		Array.isArray(loaded.project.tags) ? (loaded.project.tags as string[]) : []
	);
	let showDeleteConfirm = $state(false);
	let childError = $state<string | null>(null);

	const achievementStore = sectionRows({
		resource: 'side_project_achievement',
		parentKey: 'side_project_id',
		parentId: loaded.project.id,
		profileId: loaded.profileId,
		initial: loaded.project.side_project_achievements,
		toData: (a) => ({ description: a.description ?? '' }),
		blank: () => ({ description: '' }),
		toBody: (v: { description: string }) => ({ description: v.description.trim() }),
		canCreate: (v: { description: string }) => v.description.trim().length > 0,
		onChanged: refresh
	});

	/**
	 * What the achievements list renders, kept in step with its store.
	 *
	 * The list owns an array and reports by index; the store owns the saves.
	 * Achievements can be reordered, so their entries carry a `key` and are
	 * matched by it.
	 */
	let editAchievements = $state<AchievementItem[]>(
		achievementStore.rows.map((row) => ({
			key: row.key,
			id: row.id ?? undefined,
			description: row.data.description,
			tags: null
		}))
	);
	let confirmingAchievement = $state<number | null>(null);

	/**
	 * Store → list: ids arrive late for a row that started as a draft, and
	 * translations need them; text can change under the list's feet when an
	 * Undo reverts the row through the store. The list's own edits go the other
	 * way, through `changeAchievement`, before this runs.
	 */
	$effect(() => {
		const rows = new Map(achievementStore.rows.map((row) => [row.key, row]));
		let changed = false;
		const next = editAchievements.map((item) => {
			const row = item.key === undefined ? undefined : rows.get(item.key);
			if (!row) return item;
			const id = row.id ?? undefined;
			const description = row.data.description;
			if (id === item.id && description === item.description) return item;
			changed = true;
			return { ...item, id, description };
		});
		if (changed) editAchievements = next;
	});

	function achievementRow(key: number | undefined) {
		return key === undefined ? undefined : achievementStore.rows.find((r) => r.key === key);
	}

	function formatDate(date: Date | string | null): string {
		if (!date) return '';
		const d = typeof date === 'string' ? new Date(date) : date;
		return d.toISOString().split('T')[0];
	}

	type ProjectBasics = {
		name: string;
		role: string;
		url: string;
		repoUrl: string;
		summary: string;
		stars: string;
		startDate: string;
		endDate: string;
	};

	/** A loaded project as the form holds it. */
	function basicsOf(p: PageData['project']): ProjectBasics {
		return {
			name: p.name || '',
			role: p.project_role || '',
			url: p.url || '',
			repoUrl: p.repo_url || '',
			summary: p.summary || '',
			stars: p.stars?.toString() || '',
			startDate: formatDate(p.start_date),
			endDate: formatDate(p.end_date)
		};
	}
	/** Form state as the API expects it. Both sides of the diff go through here. */
	function basicsBody(v: ProjectBasics) {
		return {
			name: v.name,
			project_role: v.role,
			url: v.url,
			repo_url: v.repoUrl,
			summary: v.summary,
			stars: v.stars || null,
			start_date: v.startDate || null,
			end_date: v.endDate || null
		};
	}
	const basicsField = autoSaveField<ProjectBasics>({
		armOnInteraction: true,
		initial: { ...loadedBasics },
		save: async (v, prev) => {
			const body = patchBody(basicsBody(v), basicsBody(prev));
			if (!body) return;

			const response = await fetch(`/api/side-project/${project.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ section: 'basic', ...body })
			});
			if (!response.ok) {
				const failed = await response.json().catch(() => ({}));
				throw new Error(failed.message || failed.error || `Save failed (${response.status})`);
			}
		},
		onSaved: (v) => {
			editName = v.name;
			editRole = v.role;
			editUrl = v.url;
			editRepoUrl = v.repoUrl;
			editSummary = v.summary;
			editStars = v.stars;
			editStartDate = v.startDate;
			editEndDate = v.endDate;
			refresh();
		},
		equal: recordsEqual,
		debounceMs: 700
	});
	$effect(() =>
		basicsField.set({
			name: editName,
			role: editRole,
			url: editUrl,
			repoUrl: editRepoUrl,
			summary: editSummary,
			stars: editStars,
			startDate: editStartDate,
			endDate: editEndDate
		})
	);

	/**
	 * Apply what the user ticked in the GitHub proposal list.
	 *
	 * These are the same `$state` variables the form binds to, so the existing
	 * `$effect` → `basicsField` autosave picks the change up and writes it — the
	 * fetch needs no save path of its own.
	 */
	/** An answered question, drafted into a bullet, saved like any typed one. */
	function applyDraftedAchievement(achievement: string) {
		const row = achievementStore.add();
		editAchievements = [
			...editAchievements,
			{ key: row.key, description: achievement, tags: null }
		];
		achievementStore.update(row, { description: achievement });
	}

	/** The chips component owns its own store, so ticked technologies reach it by ref. */
	let technologiesRef = $state<{ addTechnologies: (names: string[]) => void } | null>(null);

	/**
	 * What the repo scan and the suggestions should not offer again. Read from
	 * the layout's load, which `refresh` re-runs after every write, as on a role
	 * project's page.
	 */
	const currentTechnologies = $derived(
		(data.project.side_project_technologies ?? []).map((t) => t.name ?? '').filter(Boolean)
	);

	function applyRepoTechnologies(names: string[]) {
		technologiesRef?.addTechnologies(names);
	}

	function applyRepoMetadata(values: Partial<Record<string, string>>) {
		if (values.name !== undefined) editName = values.name;
		if (values.url !== undefined) editUrl = values.url;
		if (values.summary !== undefined) editSummary = values.summary;
		if (values.stars !== undefined) editStars = values.stars;
		if (values.start_date !== undefined) editStartDate = values.start_date;
		if (values.end_date !== undefined) editEndDate = values.end_date;
	}

	let lastAddedAchievementIndex = $state<number | null>(null);

	function addAchievement() {
		const row = achievementStore.add();
		editAchievements = [...editAchievements, { key: row.key, description: '', tags: null }];
		lastAddedAchievementIndex = editAchievements.length - 1;
	}

	/** The popup edited an entry, as it is typed: write it through. */
	function changeAchievement(index: number, item: AchievementItem) {
		const row = achievementRow(item.key);
		if (row) achievementStore.update(row, { description: item.description });
	}

	/** The popup's field blurred or the popup closed: push a pending save out now. */
	function flushAchievement(index: number) {
		achievementRow(editAchievements[index]?.key)?.field.flush();
	}

	/**
	 * Remove an achievement — for good, and after asking unless it is empty.
	 *
	 * There is no soft delete any more because there is no commit to stage it
	 * against, and an achievement is a sentence nothing can retype for the
	 * applicant. A row they added and never filled in has nothing to lose.
	 */
	function removeAchievement(index: number) {
		if (!editAchievements[index]?.description.trim()) {
			void dropAchievement(index);
			return;
		}
		confirmingAchievement = index;
	}

	async function dropAchievement(index: number) {
		const row = achievementRow(editAchievements[index]?.key);
		try {
			if (row) await achievementStore.remove(row);
			editAchievements = editAchievements.filter((_, i) => i !== index);
			if (lastAddedAchievementIndex === index) lastAddedAchievementIndex = null;
		} catch (e) {
			childError = e instanceof Error ? e.message : 'Could not delete that achievement';
		}
	}

	async function confirmRemoveAchievement() {
		const index = confirmingAchievement;
		confirmingAchievement = null;
		if (index !== null) await dropAchievement(index);
	}

	/** The list has already written the new order; turn it into one call. */
	async function saveAchievementsReorder() {
		lastAddedAchievementIndex = null;
		try {
			await achievementStore.reorder(
				editAchievements.map((item) => achievementRow(item.key)).filter((row) => row !== undefined)
			);
		} catch (e) {
			childError = e instanceof Error ? e.message : 'Could not save that order';
		}
	}
</script>

<div class="space-y-6" use:armOn={basicsField.arm}>
	<!-- Basic Info -->
	<Card padding="lg">
		<h2 class="mb-4 text-lg font-semibold text-[var(--dash-text)]">Basic Information</h2>
		<div class="grid grid-cols-1 gap-4 xl:grid-cols-2">
			<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
				<div>
					<TranslatableField
						entity="side_project"
						id={project.id}
						field="name"
						label="Project Name"
						required
						bind:value={editName}
					/>
				</div>

				<TranslatableField
					entity="side_project"
					id={project.id}
					field="project_role"
					label="Your role"
					bind:value={editRole}
					placeholder="e.g. Contributor, Co-founder"
					hint="Leave empty if it's your own project."
				/>

				<div>
					<label for="edit-url" class="mb-1 block text-sm font-medium text-[var(--dash-text)]">
						URL
					</label>
					<input
						type="url"
						id="edit-url"
						bind:value={editUrl}
						placeholder="https://github.com/user/project"
						class="w-full rounded-md border border-[var(--dash-border)] px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
					/>
				</div>

				<TranslatableField
					entity="side_project"
					id={project.id}
					field="repo_url"
					label="Repo URL"
					bind:value={editRepoUrl}
					placeholder="e.g., View on GitHub"
				/>

				<div>
					<label
						for="edit-start-date"
						class="mb-1 block text-sm font-medium text-[var(--dash-text)]"
					>
						Start Date
					</label>
					<input
						type="date"
						id="edit-start-date"
						bind:value={editStartDate}
						class="w-full rounded-md border border-[var(--dash-border)] px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
					/>
				</div>

				<div>
					<label for="edit-end-date" class="mb-1 block text-sm font-medium text-[var(--dash-text)]">
						End Date
					</label>
					<input
						type="date"
						id="edit-end-date"
						bind:value={editEndDate}
						class="w-full rounded-md border border-[var(--dash-border)] px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
					/>
				</div>

				<div>
					<label for="edit-stars" class="mb-1 block text-sm font-medium text-[var(--dash-text)]">
						GitHub Stars
					</label>
					<input
						type="number"
						id="edit-stars"
						bind:value={editStars}
						min="0"
						class="w-full rounded-md border border-[var(--dash-border)] px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
					/>
				</div>
			</div>

			<TranslatableField
				entity="side_project"
				id={project.id}
				field="summary"
				label="Summary"
				multiline
				rows={5}
				bind:value={editSummary}
				placeholder="Brief description of the project..."
			/>
		</div>
		<ProjectSourcesPointer count={data.sourceCount} href={sourcesHref} />
		<ProjectRepoFetch
			kind="side_project"
			projectId={project.id}
			repoUrl={editRepoUrl}
			current={{
				name: editName,
				url: editUrl,
				summary: editSummary,
				stars: editStars,
				start_date: editStartDate,
				end_date: editEndDate
			}}
			{currentTechnologies}
			onApply={applyRepoMetadata}
			onApplyTechnologies={applyRepoTechnologies}
			onSetRepoUrl={(v) => (editRepoUrl = v)}
		/>
		<ProjectSuggestions
			kind="side_project"
			projectId={project.id}
			currentSummary={editSummary}
			{currentTechnologies}
			onApplySummary={(v) => (editSummary = v)}
			onApplyTechnologies={applyRepoTechnologies}
			onApplyAchievement={applyDraftedAchievement}
		/>
		<div class="mt-4 flex justify-end">
			<AutoSaveIndicator field={basicsField} />
		</div>
	</Card>

	<!-- Technologies -->
	<Card padding="lg">
		<TechnologyChips
			bind:this={technologiesRef}
			resource="side_project_technology"
			parentKey="side_project_id"
			parentId={project.id}
			profileId={data.profileId}
			initial={loaded.project.side_project_technologies}
			templates={SITE_TEMPLATE_TAGS}
			onChanged={refresh}
		/>
	</Card>

	<!-- Achievements -->
	<Card padding="lg">
		<div class="mb-4 flex items-center gap-3">
			<h2 class="text-lg font-semibold text-[var(--dash-text)]">Achievements</h2>
			<AutoSaveIndicator field={achievementStore.summary} idleLabel="Saves as you type" />
		</div>

		<AchievementsList
			bind:achievements={editAchievements}
			lastAddedIndex={lastAddedAchievementIndex}
			entity="side_project_achievement"
			onAdd={addAchievement}
			onRemove={removeAchievement}
			onItemChange={changeAchievement}
			onItemBlur={flushAchievement}
			statusFor={(item) => achievementRow(item.key)?.field}
			onReorderSave={saveAchievementsReorder}
			onFocused={() => (lastAddedAchievementIndex = null)}
		/>
		{#if childError}
			<p class="mt-3 text-sm text-[var(--dash-error)]">{childError}</p>
		{/if}
	</Card>

	<!-- Portfolio Images -->
	<Card padding="lg">
		<h2 class="mb-2 text-lg font-semibold text-[var(--dash-text)]">Portfolio Images</h2>
		<p class="mb-4 text-sm text-[var(--dash-text-secondary)]">
			These images are used for your portfolio display. They are not required for job search or
			scoring.
		</p>
		<div class="flex gap-6">
			<div class="max-w-xs">
				<MediaUpload
					entityType="side_project"
					entityId={project.id}
					field="image_path"
					currentUrl={imageUrl}
					label="Project Image"
					showHint={false}
					onUpload={(url) => {
						imageUrl = url;
						// The header shows this too, from layout data.
						void invalidateAll();
					}}
					onDelete={() => {
						imageUrl = null;
						void invalidateAll();
					}}
				/>
			</div>
			<div class="flex-1">
				<MediaUpload
					entityType="side_project"
					entityId={project.id}
					field="banner_path"
					currentUrl={bannerUrl}
					label="Project Banner"
					showHint={false}
					onUpload={(url) => (bannerUrl = url)}
					onDelete={() => (bannerUrl = null)}
				/>
			</div>
		</div>
		<p class="mt-3 text-xs text-[var(--dash-text-secondary)]">JPEG, PNG, WebP, or GIF. Max 5MB.</p>
	</Card>

	<!-- Version Tags -->
	<VersionTags
		bind:tags={editTags}
		apiUrl={`/api/side-project/${project.id}`}
		section="basic"
		onSaved={refresh}
	/>

	<!-- Danger Zone -->
	<Card padding="lg">
		<div class="space-y-3">
			<div class="mb-2 flex items-center gap-2">
				<FontAwesomeIcon icon={faTrash} class="h-4 w-4 text-[var(--dash-text-secondary)]" />
				<h2 class="text-sm font-semibold tracking-wide text-[var(--dash-text)] uppercase">
					Danger Zone
				</h2>
			</div>

			<p class="text-sm text-[var(--dash-text-secondary)]">
				Permanently remove this side project and all associated data.
			</p>

			<button
				type="button"
				onclick={() => (showDeleteConfirm = true)}
				class="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-500 transition-colors hover:border-red-500/50 hover:bg-red-500/20"
			>
				<FontAwesomeIcon icon={faTrash} class="h-3 w-3" />
				Delete Side Project
			</button>
		</div>
	</Card>
</div>

<ConfirmModal
	isOpen={confirmingAchievement !== null}
	title="Delete achievement"
	message={`Delete “${(confirmingAchievement !== null && editAchievements[confirmingAchievement]?.description) || ''}”? This cannot be undone.`}
	confirmLabel="Delete"
	onCancel={() => (confirmingAchievement = null)}
	onConfirm={confirmRemoveAchievement}
/>

<ConfirmModal
	isOpen={showDeleteConfirm}
	title="Delete Side Project"
	message="Are you sure you want to permanently delete this side project? All achievements and technologies will also be deleted. This action cannot be undone."
	confirmLabel="Delete"
	onCancel={() => (showDeleteConfirm = false)}
	onConfirm={() => {
		showDeleteConfirm = false;
		const form = document.createElement('form');
		form.method = 'POST';
		form.action = '/profile/side-projects?/delete';
		const input = document.createElement('input');
		input.type = 'hidden';
		input.name = 'id';
		input.value = String(project.id);
		form.appendChild(input);
		document.body.appendChild(form);
		form.submit();
	}}
/>
