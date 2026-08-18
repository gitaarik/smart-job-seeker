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
	import { sectionRows } from '$lib/components/section-rows.svelte';
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

	let pageTitle = $derived(experience.position || experience.name || 'Experience');

	// Every section on this page now saves as you type, through `sectionRows`
	// and `/api/profile-section/…`. What is left of an explicit save is the two
	// reorder modes: a drag is not finished until it is dropped, and an order is
	// one write for the section rather than one per row.
	//
	// The staged-removal sets these used to keep are gone with it. They were the
	// reason technologies and achievements stayed on a button — a delete that
	// only took effect on commit needs a commit — and the replacement is that a
	// delete means it now: immediately for a chip, and behind a confirmation for
	// an achievement, whose text nothing can retype for you.
	let techReorderState = $state<SaveState>('idle');

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

	let versionSlugs = $state<string[]>([]);

	/**
	 * The two child collections, each row saving itself.
	 *
	 * `tags` is a real field on both — the version slugs that decide which
	 * documents an entry appears on — so it goes through the same PATCH as the
	 * text. `sectionRows` compares arrays by element, or rebuilding the tag list
	 * on every keystroke in the name beside it would rewrite the tags each time.
	 */
	type ChildRow = { description?: string; name?: string; tags: string[] };

	const achievementStore = sectionRows({
		resource: 'work_experience_achievement',
		parentKey: 'work_experience_id',
		parentId: experience.id,
		profileId: data.profileId,
		initial: experience.work_experience_achievements,
		toData: (a) => ({
			description: a.description ?? '',
			tags: Array.isArray(a.tags) ? (a.tags as string[]) : []
		}),
		blank: () => ({ description: '', tags: [] as string[] }),
		toBody: (v: ChildRow) => ({
			description: (v.description ?? '').trim(),
			tags: v.tags.length > 0 ? v.tags : null
		}),
		canCreate: (v: ChildRow) => (v.description ?? '').trim().length > 0
	});

	const techStore = sectionRows({
		resource: 'work_experience_technology',
		parentKey: 'work_experience_id',
		parentId: experience.id,
		profileId: data.profileId,
		initial: experience.work_experience_technologies,
		toData: (t) => ({
			name: t.name ?? '',
			tags: Array.isArray(t.tags) ? (t.tags as string[]) : []
		}),
		blank: () => ({ name: '', tags: [] as string[] }),
		toBody: (v: ChildRow) => ({
			name: (v.name ?? '').trim(),
			tags: v.tags.length > 0 ? v.tags : null
		}),
		canCreate: (v: ChildRow) => (v.name ?? '').trim().length > 0
	});

	/**
	 * What `AchievementsList` renders, kept in step with the store by `key`.
	 *
	 * The component owns an array and reports changes by index; the store owns
	 * the saves and identifies rows by key. Neither is wrong and they cannot be
	 * merged without the component growing a second mode, so the array carries
	 * the key and this page is the one place that knows both.
	 */
	let editAchievements = $state<AchievementItem[]>(
		achievementStore.rows.map((row) => ({
			key: row.key,
			id: row.id ?? undefined,
			description: row.data.description ?? '',
			tags: row.data.tags.length > 0 ? row.data.tags : null
		}))
	);

	/**
	 * Ids arrive later for a row that started as a draft, and the list needs them
	 * — a translated achievement is looked up by id, so without this a newly
	 * added one would show its base text until the next page load.
	 */
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

	let lastAddedTechKey = $state<number | null>(null);
	/** The technology whose version-tags popup is open, by row key (null = closed). */
	let techTagKey = $state<number | null>(null);
	// Version tags are hidden on the chips until toggled on (like the skills page).
	let showTechVersionTags = $state(false);
	let hasAnyTechVersionTags = $derived(
		versionSlugs.length > 0 || techStore.rows.some((t) => t.data.tags.length > 0)
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

	let lastAddedAchievementIndex = $state<number | null>(null);
	let confirmingAchievement = $state<number | null>(null);
	let childError = $state<string | null>(null);

	function addAchievement() {
		const row = achievementStore.add();
		editAchievements = [...editAchievements, { key: row.key, description: '', tags: null }];
		lastAddedAchievementIndex = editAchievements.length - 1;
	}

	/** The popup was accepted: write the entry the user just edited. */
	function changeAchievement(index: number, item: AchievementItem) {
		const row = achievementRow(item.key);
		if (row) {
			achievementStore.update(row, { description: item.description, tags: item.tags ?? [] });
		}
	}

	/**
	 * Remove an achievement — for good, and after asking unless it is empty.
	 *
	 * There is no soft delete any more because there is no commit to stage it
	 * against. An achievement is a sentence the applicant wrote and nothing can
	 * retype it for them, so this asks; a row they added and never filled in has
	 * nothing to lose and goes straight away.
	 */
	function removeAchievement(index: number) {
		const item = editAchievements[index];
		if (!item?.description.trim()) {
			void dropAchievement(index);
			return;
		}
		confirmingAchievement = index;
	}

	async function dropAchievement(index: number) {
		const item = editAchievements[index];
		const row = achievementRow(item?.key);
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

	/**
	 * The list has already written the new order into `editAchievements`; this
	 * turns it into one reorder call, matching the array's entries back to their
	 * rows by key.
	 */
	async function saveAchievementsReorder() {
		lastAddedAchievementIndex = null;
		// The list runs its own spinner for the duration of this call, so the only
		// thing left to report is a failure.
		try {
			await achievementStore.reorder(
				editAchievements.map((item) => achievementRow(item.key)).filter((row) => row !== undefined)
			);
		} catch (e) {
			childError = e instanceof Error ? e.message : 'Could not save that order';
		}
	}

	function addTechnology() {
		lastAddedTechKey = techStore.add().key;
	}

	function focusIfNew(node: HTMLInputElement, isNew: boolean) {
		if (isNew) {
			node.focus();
			lastAddedTechKey = null;
		}
	}

	/** A chip is one word; deleting it costs a retype, so it does not ask. */
	async function removeTechnology(key: number) {
		const row = techStore.rows.find((r) => r.key === key);
		if (!row) return;
		try {
			await techStore.remove(row);
		} catch (e) {
			childError = e instanceof Error ? e.message : 'Could not delete that technology';
		}
	}

	// --- Drag-and-drop reordering of technologies (svelte-dnd-action) ---
	// Reordering is gated behind an explicit "Reorder" mode (like the skills
	// page) so that clicking chips edits them normally until the user opts in.
	const techFlipMs = 150;
	let techReorderMode = $state(false);

	interface DndTechItem {
		id: number;
		row: (typeof techStore.rows)[number];
	}
	let dndTech = $state<DndTechItem[]>([]);

	function startTechReorder() {
		dndTech = techStore.rows.map((row) => ({ id: row.key, row }));
		techReorderMode = true;
	}

	function handleTechConsider(e: CustomEvent<{ items: DndTechItem[] }>) {
		dndTech = e.detail.items;
	}

	function handleTechFinalize(e: CustomEvent<{ items: DndTechItem[] }>) {
		dndTech = e.detail.items;
	}

	function cancelTechReorder() {
		techReorderMode = false;
		dndTech = [];
	}

	async function saveTechReorder() {
		techReorderState = 'saving';
		try {
			await techStore.reorder(dndTech.map((d) => d.row));
			techReorderState = 'idle';
			techReorderMode = false;
			dndTech = [];
		} catch (e) {
			// Stay in reorder mode so the drop the user made is still on screen.
			techReorderState = 'error';
			childError = e instanceof Error ? e.message : 'Could not save that order';
			setTimeout(() => (techReorderState = 'idle'), 3000);
		}
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
			<div class="flex items-center gap-3">
				<h2 class="text-lg font-semibold text-[var(--dash-text)]">Technologies</h2>
				<AutoSaveIndicator field={techStore.summary} idleLabel="Saves as you type" />
			</div>
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
				{#if techStore.rows.length > 1}
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
							class="flex cursor-grab items-center gap-1.5 rounded-lg border border-[var(--dash-primary)]/20 bg-[var(--dash-primary)]/5 py-1.5 pr-3.5 pl-2 text-sm active:cursor-grabbing"
						>
							<FontAwesomeIcon
								icon={faGripVertical}
								class="h-3 w-3 text-[var(--dash-text-muted)]"
							/>
							<span class="text-[var(--dash-text)]">{item.row.data.name || 'Technology'}</span>
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
				<SectionSaveButton state={techReorderState} onClick={saveTechReorder} />
			</div>
		{:else}
			<div class="flex flex-wrap gap-2">
				{#each techStore.rows as tech (tech.key)}
					<div
						class="flex items-center gap-1 rounded-lg border border-[var(--dash-primary)]/20 bg-[var(--dash-primary)]/5 py-1 pr-1 pl-3.5"
						class:opacity-60={tech.field.status === 'saving'}
						title={tech.field.error ?? undefined}
					>
						<div class="relative pr-3">
							<span class="invisible min-w-[3ch] text-sm whitespace-pre"
								>{tech.data.name || 'Technology'}</span
							>
							<input
								type="text"
								value={tech.data.name}
								oninput={(e) => techStore.update(tech, { name: e.currentTarget.value })}
								onblur={tech.field.flush}
								placeholder="Technology"
								aria-label="Technology"
								use:focusIfNew={tech.key === lastAddedTechKey}
								class="absolute inset-0 w-full border-none bg-transparent pr-3 text-sm focus:outline-none {tech
									.field.status === 'error'
									? 'text-[var(--dash-error)]'
									: 'text-[var(--dash-text)]'}"
							/>
						</div>
						{#if showTechVersionTags}
							<button
								type="button"
								onclick={() => (techTagKey = tech.key)}
								class="flex items-center gap-1 rounded p-1 transition-colors {tech.data.tags
									.length > 0
									? 'text-[var(--dash-primary)] hover:text-[var(--dash-primary-hover)]'
									: 'text-[var(--dash-text-secondary)]/50 hover:text-[var(--dash-primary)]'}"
								aria-label="Version tags"
								title="Resume / CV versions"
							>
								<FontAwesomeIcon icon={faTags} class="h-3 w-3" />
								{#if tech.data.tags.length > 0}
									<span class="text-[10px] leading-none font-medium">{tech.data.tags.length}</span>
								{/if}
							</button>
						{/if}
						<button
							type="button"
							onclick={() => removeTechnology(tech.key)}
							class="p-1 text-[var(--dash-text-secondary)] transition-colors hover:text-[var(--dash-error)]"
							aria-label="Remove"
						>
							<FontAwesomeIcon icon={faTimes} class="h-3 w-3" />
						</button>
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
		{/if}
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
			showTags={true}
			entity="work_experience_achievement"
			{versionSlugs}
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

	<!-- Projects -->
	<Card padding="lg">
		<h2 class="mb-1 text-lg font-semibold text-[var(--dash-text)]">Projects</h2>
		<p class="mb-4 text-sm text-[var(--dash-text-secondary)]">
			Specific projects you worked on at {experience.name || 'this company'}. Each opens its own
			page, with its details, technologies and any source or notes you attach to it.
		</p>
		<WorkExperienceProjects
			workExperienceId={experience.id}
			projects={experience.work_experience_projects}
			profileId={data.profileId}
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
	isOpen={confirmingAchievement !== null}
	title="Delete achievement"
	message={`Delete “${(confirmingAchievement !== null && editAchievements[confirmingAchievement]?.description) || ''}”? This cannot be undone.`}
	confirmLabel="Delete"
	onCancel={() => (confirmingAchievement = null)}
	onConfirm={confirmRemoveAchievement}
/>

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

{#if techTagKey !== null}
	{@const row = techStore.rows.find((r) => r.key === techTagKey)}
	{#if row}
		<VersionTagsPopup
			title="Technology versions"
			subtitle={row.data.name || undefined}
			tags={row.data.tags}
			{versionSlugs}
			onChange={(tags) => techStore.update(row, { tags })}
			onClose={() => (techTagKey = null)}
		/>
	{/if}
{/if}
