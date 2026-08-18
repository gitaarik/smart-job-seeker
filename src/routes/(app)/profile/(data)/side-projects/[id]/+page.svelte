<script lang="ts">
	import type { PageData } from './$types';
	import { invalidateAll } from '$app/navigation';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faTrash } from '@fortawesome/free-solid-svg-icons';
	import MediaUpload from '$lib/components/MediaUpload.svelte';
	import SectionSaveButton from '$lib/components/SectionSaveButton.svelte';
	import { autoSaveField, diffPayload, recordsEqual } from '$lib/components/auto-save.svelte';
	import AutoSaveIndicator from '$lib/components/AutoSaveIndicator.svelte';
	import TranslatableField from '$lib/components/TranslatableField.svelte';
	import AchievementsList, { type AchievementItem } from '$lib/components/AchievementsList.svelte';
	import { sectionRows } from '$lib/components/section-rows.svelte';
	import TechnologyTagsEditor from '$lib/components/TechnologyTagsEditor.svelte';
	import ProjectRepoFetch from '$lib/components/ProjectRepoFetch.svelte';
	import ProjectSuggestions from '$lib/components/ProjectSuggestions.svelte';
	import VersionTags from '$lib/components/VersionTags.svelte';
	import ConfirmModal from '../../../components/ConfirmModal.svelte';
	import Card from '../../../../components/Card.svelte';

	type SaveState = 'idle' | 'saving' | 'saved' | 'error';

	let { data }: { data: PageData } = $props();

	let imageUrl = $state(data.imageUrl);
	let bannerUrl = $state(data.bannerUrl);

	let project = $derived(data.project);

	// Both child collections save as you type now, through `sectionRows` and
	// `/api/profile-section/…`. The staged-removal sets that used to require a
	// commit are gone with them: a chip goes immediately, and an achievement —
	// a sentence nothing can retype for the applicant — asks first.

	// Form states
	let editName = $state(project.name || '');
	let editUrl = $state(project.url || '');
	let editRepoUrl = $state(project.repo_url || '');
	let editSummary = $state(project.summary || '');
	let editStars = $state(project.stars?.toString() || '');
	let editStartDate = $state(formatDate(project.start_date));
	let editEndDate = $state(formatDate(project.end_date));
	let editTags = $state<string[]>(Array.isArray(project.tags) ? (project.tags as string[]) : []);
	let showDeleteConfirm = $state(false);
	let childError = $state<string | null>(null);

	const achievementStore = sectionRows({
		resource: 'side_project_achievement',
		parentKey: 'side_project_id',
		parentId: project.id,
		profileId: data.profileId,
		initial: project.side_project_achievements,
		toData: (a) => ({ description: a.description ?? '' }),
		blank: () => ({ description: '' }),
		toBody: (v: { description: string }) => ({ description: v.description.trim() }),
		canCreate: (v: { description: string }) => v.description.trim().length > 0
	});

	const techStore = sectionRows({
		resource: 'side_project_technology',
		parentKey: 'side_project_id',
		parentId: project.id,
		profileId: data.profileId,
		initial: project.side_project_technologies,
		toData: (t) => ({ name: t.name ?? '' }),
		blank: () => ({ name: '' }),
		toBody: (v: { name: string }) => ({ name: v.name.trim() }),
		canCreate: (v: { name: string }) => v.name.trim().length > 0
	});

	/**
	 * What the two list components render, kept in step with their stores.
	 *
	 * Both components own an array and report by index; the stores own the saves.
	 * Achievements can be reordered, so their entries carry a `key` and are
	 * matched by it. Technologies cannot, so index alignment is enough — the
	 * order only ever changes through the add and remove below, which move both
	 * sides together.
	 */
	let editAchievements = $state<AchievementItem[]>(
		achievementStore.rows.map((row) => ({
			key: row.key,
			id: row.id ?? undefined,
			description: row.data.description,
			tags: null
		}))
	);
	let editTechnologies = $state<string[]>(techStore.rows.map((row) => row.data.name));
	let lastAddedTechIndex = $state<number | null>(null);
	let confirmingAchievement = $state<number | null>(null);

	/** Ids arrive later for a row that started as a draft; translations need them. */
	$effect(() => {
		const ids = new Map(achievementStore.rows.map((row) => [row.key, row.id ?? undefined]));
		let changed = false;
		const next = editAchievements.map((item) => {
			const id = item.key === undefined ? item.id : ids.get(item.key);
			if (id === item.id) return item;
			changed = true;
			return { ...item, id };
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
		url: string;
		repoUrl: string;
		summary: string;
		stars: string;
		startDate: string;
		endDate: string;
	};

	/** Form state as the API expects it. Both sides of the diff go through here. */
	function basicsBody(v: ProjectBasics) {
		return {
			name: v.name,
			url: v.url,
			repo_url: v.repoUrl,
			summary: v.summary,
			stars: v.stars || null,
			start_date: v.startDate || null,
			end_date: v.endDate || null
		};
	}
	const basicsField = autoSaveField<ProjectBasics>({
		initial: {
			name: editName,
			url: editUrl,
			repoUrl: editRepoUrl,
			summary: editSummary,
			stars: editStars,
			startDate: editStartDate,
			endDate: editEndDate
		},
		save: async (v, prev) => {
			const changed = diffPayload(basicsBody(v), basicsBody(prev));
			if (Object.keys(changed).length === 0) return;

			const response = await fetch(`/api/side-project/${project.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ section: 'basic', ...changed })
			});
			if (!response.ok) {
				const body = await response.json().catch(() => ({}));
				throw new Error(body.message || body.error || `Save failed (${response.status})`);
			}
		},
		onSaved: (v) => {
			editName = v.name;
			editUrl = v.url;
			editRepoUrl = v.repoUrl;
			editSummary = v.summary;
			editStars = v.stars;
			editStartDate = v.startDate;
			editEndDate = v.endDate;
		},
		equal: recordsEqual,
		debounceMs: 700
	});
	$effect(() =>
		basicsField.set({
			name: editName,
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

	/**
	 * Add the technology chips the user ticked.
	 *
	 * `add()` makes a local draft and `update()` is what actually creates it —
	 * a blank draft is deliberately not written (see section-rows), so the name
	 * has to go through update rather than being handed to add.
	 */
	function applyRepoTechnologies(names: string[]) {
		for (const name of names) {
			const row = techStore.add();
			editTechnologies = [...editTechnologies, name];
			techStore.update(row, { name });
		}
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

	/** The popup was accepted: write the entry the user just edited. */
	function changeAchievement(index: number, item: AchievementItem) {
		const row = achievementRow(item.key);
		if (row) achievementStore.update(row, { description: item.description });
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

	// Technologies have no reorder, so the editor's index and the store's row
	// index stay aligned: only these two functions change the length, and they
	// change both sides at once.
	function addTechnology() {
		techStore.add();
		editTechnologies = [...editTechnologies, ''];
		lastAddedTechIndex = editTechnologies.length - 1;
	}

	function changeTechnology(index: number, value: string) {
		const row = techStore.rows[index];
		if (row) techStore.update(row, { name: value });
	}

	function flushTechnology(index: number) {
		techStore.rows[index]?.field.flush();
	}

	/** A chip is one word; deleting it costs a retype, so it does not ask. */
	async function removeTechnology(index: number) {
		const row = techStore.rows[index];
		try {
			if (row) await techStore.remove(row);
			editTechnologies = editTechnologies.filter((_, i) => i !== index);
			if (lastAddedTechIndex === index) lastAddedTechIndex = null;
		} catch (e) {
			childError = e instanceof Error ? e.message : 'Could not delete that technology';
		}
	}
</script>

<div class="space-y-6">
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
			currentTechnologies={editTechnologies}
			onApply={applyRepoMetadata}
			onApplyTechnologies={applyRepoTechnologies}
			onSetRepoUrl={(v) => (editRepoUrl = v)}
		/>
		<ProjectSuggestions
			kind="side_project"
			projectId={project.id}
			currentSummary={editSummary}
			currentTechnologies={editTechnologies}
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
		<div class="mb-4 flex items-center gap-3">
			<h2 class="text-lg font-semibold text-[var(--dash-text)]">Technologies</h2>
			<AutoSaveIndicator field={techStore.summary} idleLabel="Saves as you type" />
		</div>

		<TechnologyTagsEditor
			bind:technologies={editTechnologies}
			lastAddedIndex={lastAddedTechIndex}
			onAdd={addTechnology}
			onRemove={removeTechnology}
			onItemChange={changeTechnology}
			onItemBlur={flushTechnology}
			onFocused={() => (lastAddedTechIndex = null)}
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
	<VersionTags bind:tags={editTags} apiUrl={`/api/side-project/${project.id}`} section="basic" />

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
