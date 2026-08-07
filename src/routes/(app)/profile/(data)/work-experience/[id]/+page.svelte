<script lang="ts">
	import type { PageData } from './$types';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faArrowLeft,
		faBriefcase,
		faGripVertical,
		faPlus,
		faTags,
		faTimes,
		faTrash,
		faUndo
	} from '@fortawesome/free-solid-svg-icons';
	import MediaUpload from '$lib/components/MediaUpload.svelte';
	import SectionSaveButton from '$lib/components/SectionSaveButton.svelte';
	import { autoSaveField, diffPayload, recordsEqual } from '$lib/components/auto-save.svelte';
	import AutoSaveIndicator from '$lib/components/AutoSaveIndicator.svelte';
	import TranslatableField from '$lib/components/TranslatableField.svelte';
	import AchievementsList, { type AchievementItem } from '$lib/components/AchievementsList.svelte';
	import WorkExperienceProjects from '../../../components/WorkExperienceProjects.svelte';
	import VersionTags from '$lib/components/VersionTags.svelte';
	import VersionTagsPopup from '$lib/components/VersionTagsPopup.svelte';
	import ConfirmModal from '../../../components/ConfirmModal.svelte';
	import Card from '../../../../components/Card.svelte';
	import { dndzone } from 'svelte-dnd-action';
	import { flip } from 'svelte/animate';

	type SaveState = 'idle' | 'saving' | 'saved' | 'error';

	let { data }: { data: PageData } = $props();

	let logoUrl = $state(data.logoUrl);
	let bannerUrl = $state(data.bannerUrl);

	let experience = $derived(data.experience);
	// projectId → attached documents; rebuilt on reload so the docs section stays
	// fresh after upload/delete (invalidateAll).
	let documentsByProject = $derived(
		Object.fromEntries(
			experience.work_experience_projects.map((p) => [p.id, p.profile_document_projects])
		)
	);

	let pageTitle = $derived(experience.position || experience.name || 'Experience');

	// Section save states. Technologies and achievements stay on explicit save:
	// both stage removals in a `deleted*` index set that only takes effect on
	// commit, so auto-saving would change what the delete button means, not just
	// when the PATCH fires.
	let techSaveState = $state<SaveState>('idle');
	let achievementsSaveState = $state<SaveState>('idle');

	// Form states
	let editName = $state(experience.name || '');
	let editPosition = $state(experience.position || '');
	let editLocation = $state(experience.location || '');
	let editWebsite = $state(experience.website || '');
	let editHeadline = $state(experience.headline || '');
	let editSummary = $state(experience.summary || '');
	let editStartDate = $state(formatDate(experience.start_date));
	let editEndDate = $state(formatDate(experience.end_date));
	let editTags = $state<string[]>(
		Array.isArray(experience.tags) ? (experience.tags as string[]) : []
	);
	let showDeleteConfirm = $state(false);

	let editAchievements = $state<AchievementItem[]>(
		experience.work_experience_achievements.map((a) => ({
			id: a.id,
			description: a.description || '',
			tags: Array.isArray(a.tags) ? (a.tags as string[]) : null
		}))
	);
	let versionSlugs = $state<string[]>([]);
	let deletedAchievements = $state<Set<number>>(new Set());
	// `_id` is a stable client-side key so drag-and-drop reordering can track
	// items across moves (it's stripped before saving).
	type TechItem = { name: string; tags: string[]; _id: number };
	let techIdSeq = 0;
	let editTechnologies = $state<TechItem[]>(
		experience.work_experience_technologies.map((t) => ({
			name: t.name || '',
			tags: Array.isArray(t.tags) ? (t.tags as string[]) : [],
			_id: techIdSeq++
		}))
	);
	let deletedTechnologies = $state<Set<number>>(new Set());
	let lastAddedTechIndex = $state<number | null>(null);
	// Index of the technology whose version-tags popup is open (null = closed).
	let techTagIndex = $state<number | null>(null);
	// Version tags are hidden on the chips until toggled on (like the skills page).
	let showTechVersionTags = $state(false);
	let hasAnyTechVersionTags = $derived(
		versionSlugs.length > 0 || editTechnologies.some((t) => t.tags.length > 0)
	);

	// Load version slugs for achievement tags
	let versionSlugsLoaded = $state(false);
	$effect(() => {
		if (versionSlugsLoaded) return;
		versionSlugsLoaded = true;
		fetch('/api/profile-versions')
			.then((res) => (res.ok ? res.json() : []))
			.then((slugs: string[]) => {
				versionSlugs = slugs;
			})
			.catch(() => {});
	});

	function formatDate(date: Date | string | null): string {
		if (!date) return '';
		const d = typeof date === 'string' ? new Date(date) : date;
		return d.toISOString().split('T')[0];
	}

	type ExperienceBasics = {
		name: string;
		position: string;
		location: string;
		website: string;
		headline: string;
		summary: string;
		startDate: string;
		endDate: string;
	};
	/** Form state as the API expects it. Both sides of the diff go through here. */
	function basicsBody(v: ExperienceBasics) {
		return {
			name: v.name,
			position: v.position,
			location: v.location,
			website: v.website,
			headline: v.headline,
			summary: v.summary,
			start_date: v.startDate || null,
			end_date: v.endDate || null
		};
	}
	const basicsField = autoSaveField<ExperienceBasics>({
		initial: {
			name: editName,
			position: editPosition,
			location: editLocation,
			website: editWebsite,
			headline: editHeadline,
			summary: editSummary,
			startDate: editStartDate,
			endDate: editEndDate
		},
		save: async (v, prev) => {
			const changed = diffPayload(basicsBody(v), basicsBody(prev));
			if (Object.keys(changed).length === 0) return;

			const response = await fetch(`/api/work-experience/${experience.id}`, {
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
			editPosition = v.position;
			editLocation = v.location;
			editWebsite = v.website;
			editHeadline = v.headline;
			editSummary = v.summary;
			editStartDate = v.startDate;
			editEndDate = v.endDate;
		},
		equal: recordsEqual,
		debounceMs: 700
	});
	$effect(() =>
		basicsField.set({
			name: editName,
			position: editPosition,
			location: editLocation,
			website: editWebsite,
			headline: editHeadline,
			summary: editSummary,
			startDate: editStartDate,
			endDate: editEndDate
		})
	);

	async function saveTechnologies() {
		techSaveState = 'saving';
		try {
			const response = await fetch(`/api/work-experience/${experience.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					section: 'technologies',
					technologies: editTechnologies
						.filter((t, i) => t.name.trim() && !deletedTechnologies.has(i))
						.map((t) => ({
							name: t.name.trim(),
							tags: t.tags.length > 0 ? t.tags : null
						}))
				})
			});

			if (response.ok) {
				techSaveState = 'saved';
				setTimeout(() => (techSaveState = 'idle'), 2000);
			} else {
				techSaveState = 'error';
				setTimeout(() => (techSaveState = 'idle'), 3000);
			}
		} catch {
			techSaveState = 'error';
			setTimeout(() => (techSaveState = 'idle'), 3000);
		}
	}

	async function saveAchievements() {
		achievementsSaveState = 'saving';
		try {
			// Track the original indices we send so we can write back the ids the
			// server assigns to newly-inserted achievements (keeps them translatable
			// without a reload).
			const sent = editAchievements
				.map((a, i) => ({ a, i }))
				.filter(({ a, i }) => a.description.trim() && !deletedAchievements.has(i));

			const response = await fetch(`/api/work-experience/${experience.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					section: 'achievements',
					achievements: sent.map(({ a }) => ({
						id: a.id,
						description: a.description,
						tags: a.tags
					}))
				})
			});

			if (response.ok) {
				const result = await response.json().catch(() => null);
				if (result && Array.isArray(result.achievements)) {
					const updated = [...editAchievements];
					sent.forEach(({ i }, k) => {
						const newId = result.achievements[k]?.id;
						if (newId) updated[i] = { ...updated[i], id: newId };
					});
					editAchievements = updated;
				}
				achievementsSaveState = 'saved';
				setTimeout(() => (achievementsSaveState = 'idle'), 2000);
			} else {
				achievementsSaveState = 'error';
				setTimeout(() => (achievementsSaveState = 'idle'), 3000);
			}
		} catch {
			achievementsSaveState = 'error';
			setTimeout(() => (achievementsSaveState = 'idle'), 3000);
		}
	}

	let lastAddedAchievementIndex = $state<number | null>(null);

	function addAchievement() {
		editAchievements = [...editAchievements, { description: '', tags: null }];
		lastAddedAchievementIndex = editAchievements.length - 1;
	}

	function removeAchievement(index: number) {
		if (!editAchievements[index]?.description.trim()) {
			// Empty item - remove immediately
			editAchievements = editAchievements.filter((_, i) => i !== index);
			// Adjust deleted indices for removed item
			const newDeleted = new Set<number>();
			deletedAchievements.forEach((i) => {
				if (i > index) newDeleted.add(i - 1);
				else if (i < index) newDeleted.add(i);
			});
			deletedAchievements = newDeleted;
		} else {
			// Has content - soft delete
			deletedAchievements = new Set([...deletedAchievements, index]);
		}
	}

	function undoRemoveAchievement(index: number) {
		const newSet = new Set(deletedAchievements);
		newSet.delete(index);
		deletedAchievements = newSet;
	}

	// AchievementsList commits a reorder with the soft-delete set already
	// remapped to the new order; realign our index-based side state to match.
	function commitAchievementsReorder(newDeleted: Set<number>) {
		deletedAchievements = newDeleted;
		lastAddedAchievementIndex = null;
	}

	function addTechnology() {
		editTechnologies = [...editTechnologies, { name: '', tags: [], _id: techIdSeq++ }];
		lastAddedTechIndex = editTechnologies.length - 1;
	}

	function focusIfNew(node: HTMLInputElement, isNew: boolean) {
		if (isNew) {
			node.focus();
			lastAddedTechIndex = null;
		}
	}

	function removeTechnology(index: number) {
		if (!editTechnologies[index]?.name?.trim()) {
			// Empty tag - remove immediately
			editTechnologies = editTechnologies.filter((_, i) => i !== index);
			// Adjust deleted indices for removed item
			const newDeleted = new Set<number>();
			deletedTechnologies.forEach((i) => {
				if (i > index) newDeleted.add(i - 1);
				else if (i < index) newDeleted.add(i);
			});
			deletedTechnologies = newDeleted;
		} else {
			// Has content - soft delete
			deletedTechnologies = new Set([...deletedTechnologies, index]);
		}
	}

	function undoRemoveTechnology(index: number) {
		const newSet = new Set(deletedTechnologies);
		newSet.delete(index);
		deletedTechnologies = newSet;
	}

	// --- Drag-and-drop reordering of technologies (svelte-dnd-action) ---
	// Reordering is gated behind an explicit "Reorder" mode (like the skills
	// page) so that clicking chips edits them normally until the user opts in.
	const techFlipMs = 150;
	let techReorderMode = $state(false);
	// Snapshot both the order and the soft-delete set so Cancel is a true revert.
	let techReorderSnapshot = $state<{ techs: TechItem[]; deleted: Set<number> } | null>(null);

	interface DndTechItem {
		id: number;
		tech: TechItem;
		deleted: boolean;
	}
	let dndTech = $state<DndTechItem[]>([]);

	function startTechReorder() {
		techReorderSnapshot = {
			techs: editTechnologies.map((t) => ({ ...t })),
			deleted: new Set(deletedTechnologies)
		};
		dndTech = editTechnologies.map((t, i) => ({
			id: t._id,
			tech: t,
			deleted: deletedTechnologies.has(i)
		}));
		techReorderMode = true;
	}

	function applyDndOrder(items: DndTechItem[]) {
		dndTech = items;
		editTechnologies = items.map((w) => w.tech);
		deletedTechnologies = new Set(items.flatMap((w, i) => (w.deleted ? [i] : [])));
		lastAddedTechIndex = null;
	}

	function handleTechConsider(e: CustomEvent<{ items: DndTechItem[] }>) {
		dndTech = e.detail.items;
	}

	function handleTechFinalize(e: CustomEvent<{ items: DndTechItem[] }>) {
		applyDndOrder(e.detail.items);
	}

	function cancelTechReorder() {
		if (techReorderSnapshot) {
			editTechnologies = techReorderSnapshot.techs;
			deletedTechnologies = techReorderSnapshot.deleted;
		}
		techReorderSnapshot = null;
		techReorderMode = false;
		dndTech = [];
	}

	async function saveTechReorder() {
		await saveTechnologies();
		// Stay in reorder mode on failure so the user can retry.
		if (techSaveState === 'error') return;
		techReorderSnapshot = null;
		techReorderMode = false;
		dndTech = [];
	}
</script>

<svelte:head>
	<title>{pageTitle} - Experience - Smart Job Seeker</title>
</svelte:head>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center gap-4">
		<a
			href="/profile/work-experience"
			class="flex items-center gap-2 text-[var(--dash-text-secondary)] transition-colors hover:text-[var(--dash-primary)]"
		>
			<FontAwesomeIcon icon={faArrowLeft} class="h-4 w-4" />
			<span class="text-sm">All Work Experience</span>
		</a>
	</div>

	<div class="flex items-center gap-4">
		{#if logoUrl}
			<img src={logoUrl} alt="{experience.name} logo" class="h-12 w-12 rounded-lg object-cover" />
		{:else}
			<div class="flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--dash-bg)]">
				<FontAwesomeIcon icon={faBriefcase} class="h-6 w-6 text-[var(--dash-primary)]" />
			</div>
		{/if}
		<div>
			<h1 class="text-2xl font-bold text-[var(--dash-text)]">Edit Work Experience</h1>
			<p class="text-[var(--dash-text-secondary)]">{experience.name} - {experience.position}</p>
		</div>
	</div>

	<!-- Basic Info -->
	<Card padding="lg">
		<h2 class="mb-4 text-lg font-semibold text-[var(--dash-text)]">Basic Information</h2>

		<div class="mb-4">
			<TranslatableField
				entity="work_experience"
				id={experience.id}
				field="headline"
				label="Headline"
				bind:value={editHeadline}
				placeholder="e.g. Led the development of a ticketing platform with 10,000+ monthly active users"
				hint="Optional one-line summary shown above your achievements on a resume."
			/>
		</div>

		<div class="grid grid-cols-1 gap-4 xl:grid-cols-2">
			<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
				<div>
					<label for="edit-name" class="mb-1 block text-sm font-medium text-[var(--dash-text)]">
						Company Name <span class="text-[var(--dash-error)]">*</span>
					</label>
					<input
						type="text"
						id="edit-name"
						bind:value={editName}
						required
						class="w-full rounded-md border border-[var(--dash-border)] px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
					/>
				</div>

				<TranslatableField
					entity="work_experience"
					id={experience.id}
					field="position"
					label="Position"
					required
					bind:value={editPosition}
				/>

				<div>
					<label for="edit-location" class="mb-1 block text-sm font-medium text-[var(--dash-text)]">
						Location
					</label>
					<input
						type="text"
						id="edit-location"
						bind:value={editLocation}
						class="w-full rounded-md border border-[var(--dash-border)] px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
					/>
				</div>

				<div>
					<label for="edit-website" class="mb-1 block text-sm font-medium text-[var(--dash-text)]">
						Website
					</label>
					<input
						type="url"
						id="edit-website"
						bind:value={editWebsite}
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
				entity="work_experience"
				id={experience.id}
				field="summary"
				label="Role Summary"
				multiline
				rows={5}
				bind:value={editSummary}
			/>
		</div>
		<div class="mt-4 flex justify-end">
			<AutoSaveIndicator field={basicsField} />
		</div>
	</Card>

	<!-- Technologies -->
	<Card padding="lg">
		<div class="mb-4 flex items-center justify-between">
			<h2 class="text-lg font-semibold text-[var(--dash-text)]">Technologies</h2>
			<div class="flex items-center gap-1.5">
				{#if !techReorderMode && hasAnyTechVersionTags}
					<button
						type="button"
						onclick={() => (showTechVersionTags = !showTechVersionTags)}
						class="inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-medium transition-colors {showTechVersionTags
							? 'border-teal-500/30 bg-teal-500/15 text-teal-700'
							: 'border-[var(--dash-border)] bg-[var(--dash-bg)] text-[var(--dash-text-muted)]'}"
					>
						<span
							class="inline-block h-1.5 w-1.5 rounded-full transition-colors {showTechVersionTags
								? 'bg-teal-500'
								: 'bg-[var(--dash-text-muted)]/30'}"
						></span>
						Versions
					</button>
				{/if}
				{#if editTechnologies.length > 1}
					<button
						type="button"
						onclick={() => (techReorderMode ? cancelTechReorder() : startTechReorder())}
						class="inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-medium transition-colors {techReorderMode
							? 'border-amber-500/30 bg-amber-500/15 text-amber-700'
							: 'border-[var(--dash-border)] bg-[var(--dash-bg)] text-[var(--dash-text-muted)]'}"
					>
						<span
							class="inline-block h-1.5 w-1.5 rounded-full transition-colors {techReorderMode
								? 'bg-amber-500'
								: 'bg-[var(--dash-text-muted)]/30'}"
						></span>
						Reorder
					</button>
				{/if}
			</div>
		</div>

		{#if techReorderMode}
			<div
				class="flex flex-wrap gap-2"
				use:dndzone={{ items: dndTech, flipDurationMs: techFlipMs, type: 'technologies' }}
				onconsider={handleTechConsider}
				onfinalize={handleTechFinalize}
			>
				{#each dndTech as item (item.id)}
					<div animate:flip={{ duration: techFlipMs }}>
						<div
							class="flex cursor-grab items-center gap-1.5 rounded-lg border border-[var(--dash-primary)]/20 bg-[var(--dash-primary)]/5 py-1.5 pr-3.5 pl-2 text-sm active:cursor-grabbing {item.deleted
								? 'opacity-50'
								: ''}"
						>
							<FontAwesomeIcon
								icon={faGripVertical}
								class="h-3 w-3 text-[var(--dash-text-muted)]"
							/>
							<span class="text-[var(--dash-text)] {item.deleted ? 'line-through' : ''}"
								>{item.tech.name || 'Technology'}</span
							>
						</div>
					</div>
				{/each}
			</div>
			<div class="mt-4 flex items-center justify-end gap-2">
				<span class="mr-auto text-xs text-[var(--dash-text-muted)]"
					>Drag the chips to reorder, then save.</span
				>
				<button
					type="button"
					onclick={cancelTechReorder}
					class="rounded-lg border border-[var(--dash-border)] px-3 py-1.5 text-sm text-[var(--dash-text)] transition-colors hover:bg-[var(--dash-bg)]"
				>
					Cancel
				</button>
				<SectionSaveButton state={techSaveState} onClick={saveTechReorder} />
			</div>
		{:else}
			<div class="flex flex-wrap gap-2">
				{#each editTechnologies as tech, index}
					{@const isDeleted = deletedTechnologies.has(index)}
					<div
						class="flex items-center gap-1 rounded-lg border border-[var(--dash-primary)]/20 bg-[var(--dash-primary)]/5 py-1 pr-1 pl-3.5 {isDeleted
							? 'opacity-50'
							: ''}"
					>
						<div class="relative pr-3">
							<span
								class="invisible min-w-[3ch] text-sm whitespace-pre {isDeleted
									? 'line-through'
									: ''}">{editTechnologies[index].name || 'Technology'}</span
							>
							{#if isDeleted}
								<span
									class="absolute inset-0 pr-3 text-sm text-[var(--dash-text-secondary)] line-through"
									>{editTechnologies[index].name}</span
								>
							{:else}
								<input
									type="text"
									bind:value={editTechnologies[index].name}
									placeholder="Technology"
									use:focusIfNew={index === lastAddedTechIndex}
									class="absolute inset-0 w-full border-none bg-transparent pr-3 text-sm text-[var(--dash-text)] focus:outline-none"
								/>
							{/if}
						</div>
						{#if isDeleted}
							<button
								type="button"
								onclick={() => undoRemoveTechnology(index)}
								class="p-1 text-[var(--dash-primary)] transition-colors hover:text-[var(--dash-primary-hover)]"
								aria-label="Undo"
							>
								<FontAwesomeIcon icon={faUndo} class="h-3 w-3" />
							</button>
						{:else}
							{#if showTechVersionTags}
								<button
									type="button"
									onclick={() => (techTagIndex = index)}
									class="flex items-center gap-1 rounded p-1 transition-colors {editTechnologies[
										index
									].tags.length > 0
										? 'text-[var(--dash-primary)] hover:text-[var(--dash-primary-hover)]'
										: 'text-[var(--dash-text-secondary)]/50 hover:text-[var(--dash-primary)]'}"
									aria-label="Version tags"
									title="Resume / CV versions"
								>
									<FontAwesomeIcon icon={faTags} class="h-3 w-3" />
									{#if editTechnologies[index].tags.length > 0}
										<span class="text-[10px] leading-none font-medium"
											>{editTechnologies[index].tags.length}</span
										>
									{/if}
								</button>
							{/if}
							<button
								type="button"
								onclick={() => removeTechnology(index)}
								class="p-1 text-[var(--dash-text-secondary)] transition-colors hover:text-[var(--dash-error)]"
								aria-label="Remove"
							>
								<FontAwesomeIcon icon={faTimes} class="h-3 w-3" />
							</button>
						{/if}
					</div>
				{/each}
				<button
					type="button"
					onclick={addTechnology}
					class="flex items-center gap-1 rounded-lg border border-dashed border-[var(--dash-border)] px-3 py-1 text-sm text-[var(--dash-primary)] transition-colors hover:border-[var(--dash-primary)]/40 hover:text-[var(--dash-primary-hover)]"
				>
					<FontAwesomeIcon icon={faPlus} class="h-3 w-3" />
					Add
				</button>
			</div>
			<div class="mt-4 flex justify-end">
				<SectionSaveButton state={techSaveState} onClick={saveTechnologies} />
			</div>
		{/if}
	</Card>

	<!-- Achievements -->
	<Card padding="lg">
		<h2 class="mb-4 text-lg font-semibold text-[var(--dash-text)]">Achievements</h2>

		<AchievementsList
			bind:achievements={editAchievements}
			deletedIndices={deletedAchievements}
			lastAddedIndex={lastAddedAchievementIndex}
			showTags={true}
			entity="work_experience_achievement"
			{versionSlugs}
			onAdd={addAchievement}
			onRemove={removeAchievement}
			onUndoRemove={undoRemoveAchievement}
			onReorderCommit={commitAchievementsReorder}
			onReorderSave={saveAchievements}
			onFocused={() => (lastAddedAchievementIndex = null)}
		/>
		<div class="mt-4 flex justify-end">
			<SectionSaveButton state={achievementsSaveState} onClick={saveAchievements} />
		</div>
	</Card>

	<!-- Projects -->
	<Card padding="lg">
		<h2 class="mb-1 text-lg font-semibold text-[var(--dash-text)]">Projects</h2>
		<p class="mb-4 text-sm text-[var(--dash-text-secondary)]">
			Specific projects you worked on at {experience.name || 'this company'}, each with its own
			details and technologies.
		</p>
		<WorkExperienceProjects
			workExperienceId={experience.id}
			projects={experience.work_experience_projects}
			profileId={data.profileId}
			{documentsByProject}
		/>
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
					entityType="work_experience"
					entityId={experience.id}
					field="logo_path"
					currentUrl={logoUrl}
					label="Company Logo"
					showHint={false}
					onUpload={(url) => (logoUrl = url)}
					onDelete={() => (logoUrl = null)}
				/>
			</div>
			<div class="flex-1">
				<MediaUpload
					entityType="work_experience"
					entityId={experience.id}
					field="banner_path"
					currentUrl={bannerUrl}
					label="Company Banner"
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
		apiUrl={`/api/work-experience/${experience.id}`}
		section="basic"
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
				Permanently remove this work experience and all associated achievements and technologies.
			</p>

			<button
				type="button"
				onclick={() => (showDeleteConfirm = true)}
				class="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-500 transition-colors hover:border-red-500/50 hover:bg-red-500/20"
			>
				<FontAwesomeIcon icon={faTrash} class="h-3 w-3" />
				Delete Work Experience
			</button>
		</div>
	</Card>
</div>

<ConfirmModal
	isOpen={showDeleteConfirm}
	title="Delete Work Experience"
	message="Are you sure you want to permanently delete this work experience? All achievements and technologies will also be deleted. This action cannot be undone."
	confirmLabel="Delete"
	onCancel={() => (showDeleteConfirm = false)}
	onConfirm={() => {
		showDeleteConfirm = false;
		const form = document.createElement('form');
		form.method = 'POST';
		form.action = '/profile/work-experience?/delete';
		const input = document.createElement('input');
		input.type = 'hidden';
		input.name = 'id';
		input.value = String(experience.id);
		form.appendChild(input);
		document.body.appendChild(form);
		form.submit();
	}}
/>

{#if techTagIndex !== null}
	{@const idx = techTagIndex}
	<VersionTagsPopup
		title="Technology versions"
		subtitle={editTechnologies[idx].name || undefined}
		bind:tags={editTechnologies[idx].tags}
		{versionSlugs}
		onClose={() => (techTagIndex = null)}
	/>
{/if}
