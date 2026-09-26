<script lang="ts">
	import { onDestroy } from 'svelte';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faBan,
		faCheck,
		faChevronDown,
		faChevronRight,
		faCircleNotch,
		faEyeSlash,
		faGripVertical,
		faPlus,
		faTags,
		faTimes,
		faTrash,
		faXmark
	} from '@fortawesome/free-solid-svg-icons';
	import { dndzone } from 'svelte-dnd-action';
	import { flip } from 'svelte/animate';
	import { clickOutside, keepInView } from '$lib/actions/popover';
	import { arraysEqual, autoSaveField } from '$lib/components/auto-save.svelte';
	import AutoSaveIndicator from '$lib/components/AutoSaveIndicator.svelte';
	import {
		BASE_TEMPLATE_TAGS,
		BASE_TEMPLATES,
		isHiddenFromDocuments,
		setBaseTemplates,
		setShownOn,
		shownOnTemplate,
		shownTemplates,
		tagSlug
	} from '$lib/profile-visibility';

	export interface SkillItem {
		name: string;
		level?: string;
		yearsExperience?: number;
		tags?: string[] | null;
	}

	export interface LevelOption {
		value: string;
		label: string;
	}

	const defaultLevelOptions: LevelOption[] = [
		{ value: 'expert', label: 'Expert' },
		{ value: 'proficient', label: 'Proficient' },
		{ value: 'intermediate', label: 'Intermediate' },
		{ value: 'beginner', label: 'Beginner' }
	];

	interface Props {
		skills: SkillItem[];
		levelOptions?: LevelOption[];
		versionSlugs?: string[];
		hasAnyLevel?: boolean;
		hasAnyExperience?: boolean;
		hasAnyVersionTags?: boolean;
		showLevel?: boolean;
		showExperience?: boolean;
		showVersionTags?: boolean;
		onupdate?: (skill: SkillItem) => void;
		oncreate?: (skill: SkillItem) => void;
		onremove?: (skill: SkillItem) => void;
		/** Awaited: reorder mode stays open, spinning, until the write lands. */
		onreorder?: (skills: SkillItem[]) => void | Promise<void>;
		/**
		 * Persist one existing skill's base templates, now, and throw if it fails.
		 *
		 * Supplying it is what makes the three Show-on switches save themselves
		 * instead of waiting for the popup's Save. It takes the whole set rather
		 * than the switch that moved, because that is the only unambiguous way to
		 * state visibility — see `setBaseTemplates`.
		 *
		 * Optional because the other caller is the profile-create wizard, where no
		 * skill has been written yet and there is nothing to patch. Without it the
		 * switches behave as they always did: local until Save.
		 */
		onshownon?: (skill: SkillItem, shownOn: string[]) => Promise<void>;
	}

	let {
		skills = $bindable(),
		levelOptions: _levelOptions = defaultLevelOptions,
		versionSlugs = [],
		hasAnyLevel,
		hasAnyExperience,
		hasAnyVersionTags,
		showLevel = $bindable(false),
		showExperience = $bindable(false),
		showVersionTags = $bindable(false),
		onupdate,
		oncreate,
		onremove,
		onreorder,
		onshownon
	}: Props = $props();
	// Links the edit popover's labels to its fields.
	const uid = $props.id();

	let levelOptions = $derived(_levelOptions.length > 0 ? _levelOptions : defaultLevelOptions);

	// When used standalone (without parent), derive visibility from local skills
	let showLevelToggle = $derived(hasAnyLevel ?? skills.some((s) => s.level));
	let showExperienceToggle = $derived(hasAnyExperience ?? skills.some((s) => s.yearsExperience));
	let showVersionTagsToggle = $derived(hasAnyVersionTags ?? versionSlugs.length > 0);

	let editingIndex = $state<number | null>(null);
	let editingSnapshot = $state<SkillItem | null>(null);
	let editingIsNew = $state(false);
	let showVersionTags_popup = $state(false);

	// Reorder mode belongs to this list alone. Dragging mutates `skills` as it
	// goes, so leaving the mode without saving restores the snapshot taken on
	// the way in; a save clears the snapshot first, because the dragged order is
	// now the stored one.
	let reorderMode = $state(false);
	let reorderSnapshot = $state<SkillItem[] | null>(null);
	let reorderSaving = $state(false);
	let orderSaved = $state(false);
	let savedFlashTimer: ReturnType<typeof setTimeout> | undefined;

	onDestroy(() => clearTimeout(savedFlashTimer));

	function startReorder() {
		if (editingIndex !== null) confirmEditing();
		reorderSnapshot = skills.map((s) => ({ ...s }));
		reorderMode = true;
	}

	function exitReorder() {
		if (reorderSnapshot) skills = reorderSnapshot;
		reorderSnapshot = null;
		reorderMode = false;
	}

	/**
	 * Save the dragged order, then leave reorder mode — the pills going back to
	 * their normal state is half the confirmation, the pill beside the Reorder
	 * toggle is the other half. Failures are the caller's to report; the mode
	 * closes either way, over an order the caller has reloaded from the server.
	 */
	async function confirmReorder() {
		reorderSaving = true;
		try {
			await onreorder?.(skills);
		} finally {
			reorderSaving = false;
		}
		reorderSnapshot = null;
		reorderMode = false;
		orderSaved = true;
		clearTimeout(savedFlashTimer);
		savedFlashTimer = setTimeout(() => (orderSaved = false), 3000);
	}

	// Version tag editing state

	/** A tag naming a base template, in either form — the switches own these. */
	function isBaseTag(tag: string): boolean {
		return BASE_TEMPLATE_TAGS.includes(tagSlug(tag));
	}

	let editingSkillTags = $derived(editingIndex === null ? [] : (skills[editingIndex]?.tags ?? []));
	let editingProfileOnly = $derived(isHiddenFromDocuments(editingSkillTags));

	// Chips list the version tags only. The base templates are the switches
	// above, and offering them here as well would let the two disagree.
	let editingTags = $derived(editingSkillTags.filter((t) => !isBaseTag(t)));

	let allSuggestions = $derived.by(() => {
		// Suggest from the stored tags, not the displayed chips: a version already
		// decided in either form (include or exclude) shouldn't be offered again.
		const used = new Set(editingSkillTags.map(tagSlug));
		return versionSlugs.filter((v) => !isBaseTag(v) && !used.has(v.toLowerCase()));
	});

	/**
	 * The skill the visibility field is currently saving for.
	 *
	 * Held apart from `editingIndex` because the two answer different questions:
	 * the index says which popup is open now, and a save in flight belongs to
	 * whichever skill was open when it started. Plain, not `$state` — nothing
	 * renders from it.
	 */
	let shownOnTarget: SkillItem | null = null;

	/**
	 * The Show-on switches, saving themselves.
	 *
	 * No debounce: a switch is a decision the moment it moves, and there is no
	 * half-flipped state worth waiting out. The value is the whole shown-on set
	 * rather than the switch that changed, which is what the endpoint wants and
	 * what makes a concurrent edit converge instead of racing.
	 *
	 * The popup's Save and Cancel still govern the name, level, years and the
	 * version chips; only these three are out from under them.
	 */
	const visibility = autoSaveField<string[]>({
		initial: [],
		equal: arraysEqual,
		save: async (shownOn) => {
			const target = shownOnTarget;
			if (!target || !onshownon) return;
			await onshownon(target, shownOn);
		},
		onSaved: (shownOn) => {
			// The switches follow what was written, which for a click they already
			// show and for the indicator's Undo they do not: undo posts the
			// previous set straight through this field without going back through
			// toggleTemplate, so without this the server moves and the switches
			// stay put. Applied to the row's own tags, so a version chip added in
			// the meantime survives.
			if (shownOnTarget) {
				const next = setBaseTemplates(shownOnTarget.tags, shownOn);
				shownOnTarget.tags = next.length > 0 ? next : null;
			}
			// Move the Cancel snapshot forward over the base templates only. A
			// switch that has already been written is not something Cancel should
			// offer to take back — it would put the UI back over a server that has
			// moved on. The version chips are untouched, so Cancel still reverts
			// those, which is the edit it is actually there for.
			if (editingSnapshot) {
				const next = setBaseTemplates(editingSnapshot.tags, shownOn);
				editingSnapshot.tags = next.length > 0 ? next : null;
			}
		}
	});

	/** Whether the switches in the open popup write on their own. */
	let autoSavesVisibility = $derived(!!onshownon && !editingIsNew);

	function toggleTemplate(type: string, shown: boolean) {
		if (editingIndex === null) return;
		const next = setShownOn(editingSkillTags, type, shown);
		skills[editingIndex].tags = next.length > 0 ? next : null;
		// Not for a skill that does not exist on the server yet: its tags ride
		// along with the create on Save, and patching by id needs an id.
		if (!editingIsNew && onshownon) visibility.set(shownTemplates(next));
	}

	/** Version tags worth badging on the pill — the switches cover the rest. */
	function versionTagCount(tags: string[] | null | undefined): number {
		if (!Array.isArray(tags)) return 0;
		return tags.filter((t) => !isBaseTag(t)).length;
	}

	function addSkillTag(tag: string) {
		if (editingIndex === null) return;
		const trimmed = tag.trim();
		if (!trimmed) return;
		const slug = tagSlug(trimmed);
		const current = skills[editingIndex].tags ?? [];
		// Skip if this version is already tagged in either include or exclude form.
		if (current.some((t) => tagSlug(t) === slug)) return;
		skills[editingIndex].tags = [...current, trimmed];
	}

	function removeSkillTag(tag: string) {
		if (editingIndex === null) return;
		skills[editingIndex].tags = (skills[editingIndex].tags ?? []).filter((t) => t !== tag);
		if (skills[editingIndex].tags!.length === 0) skills[editingIndex].tags = null;
	}

	interface DndSkillItem extends SkillItem {
		_dndId: string;
		[key: string]: unknown;
	}

	let dndItems = $derived<DndSkillItem[]>(
		skills.map((s, i) => ({
			...s,
			_dndId: (s as unknown as Record<string, unknown>).id
				? String((s as unknown as Record<string, unknown>).id)
				: `new-${i}`
		}))
	);

	// Reactive wrapper for dndzone (needs id field). Assignable, because the drag
	// handlers below write the in-flight order straight back into it; a change to
	// `skills` re-derives it, which is what ends a drag.
	let dndWrapped = $derived<{ id: string; skill: SkillItem; index: number }[]>(
		dndItems.map((s, i) => ({
			id: s._dndId,
			skill: s,
			index: i
		}))
	);

	const flipDurationMs = 150;

	function handleDndConsider(e: CustomEvent<{ items: typeof dndWrapped }>) {
		dndWrapped = e.detail.items;
	}

	function handleDndFinalize(e: CustomEvent<{ items: typeof dndWrapped }>) {
		dndWrapped = e.detail.items;
		// Map back to skills array (don't save yet — wait for confirm)
		skills = dndWrapped.map((w) => w.skill);
	}

	function getLevelLabel(value: string): string {
		return levelOptions.find((o) => o.value === value)?.label || value;
	}

	const levelColors: Record<string, string> = {
		expert: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30',
		proficient: 'bg-blue-500/15 text-blue-600 border-blue-500/30',
		intermediate: 'bg-amber-500/15 text-amber-600 border-amber-500/30',
		beginner: 'bg-gray-500/15 text-gray-600 border-gray-500/30'
	};

	// Track whether we pushed a history entry for the current popup
	let historyPushed = $state(false);

	function pushEditHistory() {
		history.pushState({ skillEdit: true }, '');
		historyPushed = true;
	}

	function popEditHistory() {
		if (historyPushed) {
			historyPushed = false;
			history.back();
		}
	}

	function handlePopState() {
		if (editingIndex !== null) {
			historyPushed = false; // Already popped by the browser
			confirmEditing();
		}
	}

	$effect(() => {
		window.addEventListener('popstate', handlePopState);
		return () => window.removeEventListener('popstate', handlePopState);
	});

	function startEditing(index: number) {
		if (reorderMode) return;
		editingSnapshot = {
			...skills[index],
			tags: skills[index].tags ? [...skills[index].tags] : null
		};
		editingIsNew = false;
		editingIndex = index;
		// Re-seed rather than create one field per skill: only one popup is open
		// at a time, so one field serves them all. reset() also invalidates an
		// in-flight save's commit step, which is what stops a slow write for the
		// last skill from reporting itself on this one.
		shownOnTarget = skills[index];
		visibility.reset(shownTemplates(skills[index].tags));
		// Auto-expand only for tags the section actually lists — a profile-only
		// skill's exclusion pair lives on the switch, not in here.
		showVersionTags_popup = versionTagCount(skills[index].tags) > 0;
		pushEditHistory();
	}

	function addSkill() {
		skills = [...skills, { name: '' }];
		editingIndex = skills.length - 1;
		editingSnapshot = null;
		editingIsNew = true;
		shownOnTarget = null;
		visibility.reset(BASE_TEMPLATE_TAGS);
		showVersionTags_popup = false;
		pushEditHistory();
	}

	function confirmEditing() {
		if (editingIndex === null) return;
		const s = skills[editingIndex];
		if (!s.name.trim()) {
			skills = skills.filter((_, i) => i !== editingIndex);
		} else if (editingIsNew) {
			oncreate?.(s);
		} else {
			onupdate?.(s);
		}
		editingIndex = null;
		editingSnapshot = null;
		popEditHistory();
	}

	function cancelEditing() {
		if (editingIndex === null) return;
		if (editingIsNew) {
			skills = skills.filter((_, i) => i !== editingIndex);
		} else if (editingSnapshot) {
			skills[editingIndex] = { ...editingSnapshot };
		}
		editingIndex = null;
		editingSnapshot = null;
		popEditHistory();
	}

	function removeSkill(index: number) {
		if (!confirm('Remove this skill?')) return;
		const removed = skills[index];
		skills = skills.filter((_, i) => i !== index);
		if (editingIndex === index) {
			editingIndex = null;
			popEditHistory();
		}
		onremove?.(removed);
	}
</script>

<!-- Legend bar -->
<div class="mb-2 flex items-center gap-1.5">
	{#if showLevelToggle}
		<button
			type="button"
			onclick={() => (showLevel = !showLevel)}
			class="
        inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-medium transition-colors {showLevel
				? 'border-blue-500/30 bg-blue-500/15 text-blue-700'
				: 'border-[var(--dash-border)] bg-[var(--dash-bg)] text-[var(--dash-text-muted)]'}
      "
		>
			<span
				class="inline-block h-1.5 w-1.5 rounded-full transition-colors {showLevel
					? 'bg-blue-500'
					: 'bg-[var(--dash-text-muted)]/30'}"
			></span>
			Level
		</button>
	{/if}
	{#if showExperienceToggle}
		<button
			type="button"
			onclick={() => (showExperience = !showExperience)}
			class="
        inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-medium transition-colors {showExperience
				? 'border-purple-500/30 bg-purple-500/15 text-purple-700'
				: 'border-[var(--dash-border)] bg-[var(--dash-bg)] text-[var(--dash-text-muted)]'}
      "
		>
			<span
				class="inline-block h-1.5 w-1.5 rounded-full transition-colors {showExperience
					? 'bg-purple-500'
					: 'bg-[var(--dash-text-muted)]/30'}"
			></span>
			Experience
		</button>
	{/if}
	{#if showVersionTagsToggle}
		<button
			type="button"
			onclick={() => (showVersionTags = !showVersionTags)}
			class="
        inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-medium transition-colors {showVersionTags
				? 'border-teal-500/30 bg-teal-500/15 text-teal-700'
				: 'border-[var(--dash-border)] bg-[var(--dash-bg)] text-[var(--dash-text-muted)]'}
      "
		>
			<span
				class="inline-block h-1.5 w-1.5 rounded-full transition-colors {showVersionTags
					? 'bg-teal-500'
					: 'bg-[var(--dash-text-muted)]/30'}"
			></span>
			Versions
		</button>
	{/if}
	{#if skills.length > 1}
		<button
			type="button"
			onclick={() => (reorderMode ? exitReorder() : startReorder())}
			class="
        inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-medium transition-colors {reorderMode
				? 'border-amber-500/30 bg-amber-500/15 text-amber-700'
				: 'border-[var(--dash-border)] bg-[var(--dash-bg)] text-[var(--dash-text-muted)]'}
      "
		>
			<span
				class="inline-block h-1.5 w-1.5 rounded-full transition-colors {reorderMode
					? 'bg-amber-500'
					: 'bg-[var(--dash-text-muted)]/30'}"
			></span>
			Reorder
		</button>
	{/if}
	<!-- Outlives reorder mode on purpose: the save is what closes it, so the
	     confirmation has to be somewhere that is still on screen afterwards. -->
	{#if reorderSaving}
		<span class="inline-flex items-center gap-1 text-[10px] text-[var(--dash-text-muted)]">
			<FontAwesomeIcon icon={faCircleNotch} spin class="h-2.5 w-2.5" />
			Saving…
		</span>
	{:else if orderSaved}
		<span class="inline-flex items-center gap-1 text-[10px] text-[var(--dash-success)]">
			<FontAwesomeIcon icon={faCheck} class="h-2.5 w-2.5" />
			Order saved
		</span>
	{/if}
</div>

{#if reorderMode}
	<div
		class="flex flex-wrap gap-2"
		use:dndzone={{ items: dndWrapped, flipDurationMs, type: 'skills' }}
		onconsider={handleDndConsider}
		onfinalize={handleDndFinalize}
	>
		{#each dndWrapped as item (item.id)}
			{@const profileOnly = isHiddenFromDocuments(item.skill.tags)}
			<div animate:flip={{ duration: flipDurationMs }}>
				<div
					class="
            flex cursor-grab items-center gap-1.5 rounded-lg border border-[var(--dash-primary)]/20 bg-[var(--dash-primary)]/5 px-3.5 py-1.5 text-sm active:cursor-grabbing {profileOnly
						? 'opacity-60'
						: ''}
          "
				>
					<FontAwesomeIcon icon={faGripVertical} class="h-3 w-3 text-[var(--dash-text-muted)]" />
					<span class="text-[var(--dash-text)]">{item.skill.name || 'new skill'}</span>
					{#if profileOnly}
						<span title="Profile-only — counts for matching, not shown on documents">
							<FontAwesomeIcon
								icon={faEyeSlash}
								class="h-2.5 w-2.5 text-[var(--dash-text-muted)]"
							/>
						</span>
					{/if}
					{#if showLevel && item.skill.level}
						<span
							class="
                rounded border px-1.5 py-0.5 text-[10px] font-medium {levelColors[item.skill.level]}
              ">{getLevelLabel(item.skill.level)}</span
						>
					{/if}
					{#if showExperience && item.skill.yearsExperience}
						<span
							class="rounded border border-purple-500/30 bg-purple-500/15 px-1.5 py-0.5 text-[10px] font-medium text-purple-600"
							>{item.skill.yearsExperience}y</span
						>
					{/if}
					{#if showVersionTags && versionTagCount(item.skill.tags) > 0}
						<span
							class="inline-flex items-center gap-1 rounded border border-teal-500/30 bg-teal-500/15 px-1.5 py-0.5 text-[10px] font-medium text-teal-600"
							title={item.skill.tags!.join(', ')}
							><FontAwesomeIcon icon={faTags} class="h-2 w-2" />
							{versionTagCount(item.skill.tags)}</span
						>
					{/if}
				</div>
			</div>
		{/each}
	</div>
	<div class="mt-2 flex items-center justify-end gap-2">
		<span class="text-xs text-[var(--dash-text-muted)]">Reorder Skills</span>
		<button
			type="button"
			onclick={exitReorder}
			disabled={reorderSaving}
			class="rounded-lg border border-[var(--dash-border)] px-3 py-1 text-xs text-[var(--dash-text)] transition-colors hover:bg-[var(--dash-bg)] disabled:opacity-70"
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
{:else}
	<div class="flex flex-wrap gap-2">
		{#each skills as skill, index (index)}
			{@const profileOnly = isHiddenFromDocuments(skill.tags)}
			<div class="relative">
				<button
					type="button"
					onclick={() => startEditing(index)}
					class="
            flex items-center gap-1.5 rounded-lg border border-[var(--dash-primary)]/20 bg-[var(--dash-primary)]/5 px-3.5 py-1.5 text-sm transition-colors hover:border-[var(--dash-primary)]/40 {profileOnly
						? 'opacity-60'
						: ''}
          "
				>
					<span class="text-[var(--dash-text)]">{skill.name || 'new skill'}</span>
					{#if profileOnly}
						<span title="Profile-only — counts for matching, not shown on documents">
							<FontAwesomeIcon
								icon={faEyeSlash}
								class="h-2.5 w-2.5 text-[var(--dash-text-muted)]"
							/>
						</span>
					{/if}
					{#if showLevel && skill.level}
						<span
							class="
                rounded border px-1.5 py-0.5 text-[10px] font-medium {levelColors[skill.level]}
              ">{getLevelLabel(skill.level)}</span
						>
					{/if}
					{#if showExperience && skill.yearsExperience}
						<span
							class="rounded border border-purple-500/30 bg-purple-500/15 px-1.5 py-0.5 text-[10px] font-medium text-purple-600"
							>{skill.yearsExperience}y</span
						>
					{/if}
					{#if showVersionTags && versionTagCount(skill.tags) > 0}
						<span
							class="inline-flex items-center gap-1 rounded border border-teal-500/30 bg-teal-500/15 px-1.5 py-0.5 text-[10px] font-medium text-teal-600"
							title={skill.tags!.join(', ')}
							><FontAwesomeIcon icon={faTags} class="h-2 w-2" /> {versionTagCount(skill.tags)}</span
						>
					{/if}
				</button>

				{#if editingIndex === index}
					<!-- Mobile backdrop -->
					<div class="fixed inset-0 z-40 bg-black/30 sm:hidden"></div>
					<div
						use:clickOutside={confirmEditing}
						use:keepInView
						class="absolute top-full left-0 z-50 mt-1 w-64 space-y-2 rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)] p-3 shadow-lg"
					>
						<div>
							<label
								for="{uid}-{index}-name"
								class="mb-1 block text-[10px] tracking-wide text-[var(--dash-text-muted)] uppercase"
								>Name</label
							>
							<input
								id="{uid}-{index}-name"
								type="text"
								bind:value={skills[index].name}
								placeholder="Skill name"
								class="w-full rounded border border-[var(--dash-border)] bg-transparent px-2 py-1.5 text-sm text-[var(--dash-text)] focus:ring-1 focus:ring-[var(--dash-primary)] focus:outline-none"
								onkeydown={(e) => {
									if (e.key === 'Enter') confirmEditing();
									if (e.key === 'Escape') cancelEditing();
								}}
							/>
						</div>
						<div>
							<label
								for="{uid}-{index}-level"
								class="mb-1 block text-[10px] tracking-wide text-[var(--dash-text-muted)] uppercase"
								>Level</label
							>
							<select
								id="{uid}-{index}-level"
								bind:value={skills[index].level}
								class="w-full cursor-pointer rounded border border-[var(--dash-border)] bg-transparent px-2 py-1.5 text-sm text-[var(--dash-text)] focus:ring-1 focus:ring-[var(--dash-primary)] focus:outline-none"
							>
								<option value={undefined}>--</option>
								{#each levelOptions as opt, i (i)}
									<option value={opt.value}>{opt.label}</option>
								{/each}
							</select>
						</div>
						<div>
							<label
								for="{uid}-{index}-years"
								class="mb-1 block text-[10px] tracking-wide text-[var(--dash-text-muted)] uppercase"
								>Years of experience</label
							>
							<input
								id="{uid}-{index}-years"
								type="number"
								bind:value={skills[index].yearsExperience}
								placeholder="-"
								min="0"
								max="50"
								class="w-full rounded border border-[var(--dash-border)] bg-transparent px-2 py-1.5 text-sm text-[var(--dash-text)] focus:ring-1 focus:ring-[var(--dash-primary)] focus:outline-none"
							/>
						</div>
						<!-- Where the skill appears. Matching always uses every skill
                 whatever these say; they only decide what it is shown on. -->
						<div>
							<span class="text-[10px] tracking-wide text-[var(--dash-text-muted)] uppercase">
								Show on
							</span>
							{#each BASE_TEMPLATES as template (template.tag)}
								{@const shown = shownOnTemplate(editingSkillTags, template.tag)}
								<button
									type="button"
									onclick={() => toggleTemplate(template.tag, !shown)}
									aria-pressed={shown}
									class="mt-1 flex w-full items-center justify-between gap-2 text-left"
								>
									<span class="text-xs text-[var(--dash-text)]">{template.label}</span>
									<span
										class="
                      relative inline-flex h-4 w-7 shrink-0 rounded-full transition-colors {shown
											? 'bg-emerald-500'
											: 'bg-[var(--dash-border)]'}
                    "
									>
										<span
											class="
                        absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all {shown
												? 'left-3.5'
												: 'left-0.5'}
                      "
										></span>
									</span>
								</button>
							{/each}
							{#if autoSavesVisibility}
								<!--
									Its own line, not squeezed beside the label: the popup is a
									fixed 256px and the indicator does not wrap, so an error long
									enough to matter would hang off the edge of it. The reserved
									height keeps the switches from jumping as the pill comes and
									goes.
								-->
								<div class="mt-1 min-h-[1rem]">
									<AutoSaveIndicator field={visibility} />
								</div>
							{/if}
							<!--
								Says out loud that these three do not wait for Save, because the
								Save button is still on screen three fields below and governs
								everything else in here. The indicator is silent at rest by
								design, and silence next to a Save button reads as "this needs
								it".
							-->
							<p class="mt-1 text-[10px] leading-snug text-[var(--dash-text-muted)]">
								{#if shownTemplates(editingSkillTags).length === 0}
									Nowhere: counts for job matching and appears on nothing you send or publish.
								{:else}
									Counts for job matching either way.
								{/if}
								{#if autoSavesVisibility}
									Saved as you switch.
								{/if}
							</p>
						</div>

						<!-- Version Tags (collapsible) -->
						{#if versionSlugs.length > 0}
							<div>
								<button
									type="button"
									onclick={() => (showVersionTags_popup = !showVersionTags_popup)}
									class="mb-1 flex items-center gap-1 text-[10px] tracking-wide text-[var(--dash-text-muted)] uppercase transition-colors hover:text-[var(--dash-text-secondary)]"
								>
									<FontAwesomeIcon
										icon={showVersionTags_popup ? faChevronDown : faChevronRight}
										class="h-2 w-2"
									/>
									<FontAwesomeIcon icon={faTags} class="h-2.5 w-2.5" />
									Resume / CV Versions
									{#if !showVersionTags_popup && editingTags.length > 0}
										<span class="text-[var(--dash-primary)] normal-case"
											>({editingTags.length})</span
										>
									{/if}
								</button>
								{#if showVersionTags_popup}
									{#if editingTags.length > 0}
										<div class="mb-1.5 flex flex-wrap gap-1.5">
											{#each editingTags as tag, i (i)}
												{@const isNeg = tag.startsWith('!')}
												<button
													type="button"
													onclick={() => removeSkillTag(tag)}
													class="inline-flex cursor-pointer items-center gap-1 rounded border px-2 py-1 text-xs transition-colors hover:border-red-500/30 hover:bg-red-500/15 hover:text-red-500 {isNeg
														? 'border-red-500/25 bg-red-500/10 text-red-600'
														: 'border-[var(--dash-primary)]/20 bg-[var(--dash-primary)]/10 text-[var(--dash-primary)]'}"
												>
													{#if isNeg}
														<FontAwesomeIcon icon={faBan} class="h-2.5 w-2.5" />
													{/if}
													{isNeg ? tag.slice(1) : tag}
													<FontAwesomeIcon icon={faTimes} class="h-2.5 w-2.5" />
												</button>
											{/each}
										</div>
									{:else}
										<p class="mb-1.5 text-[10px] text-[var(--dash-text-muted)] italic">
											{editingProfileOnly ? 'No document' : 'All versions'}
										</p>
									{/if}
									{#if allSuggestions.length > 0}
										<p
											class="mb-1 text-[10px] tracking-wide text-[var(--dash-text-muted)] uppercase"
										>
											{editingProfileOnly ? 'Show anyway on' : 'Show only on'}
										</p>
										<div class="mb-2 flex flex-wrap gap-1.5">
											{#each allSuggestions as suggestion, i (i)}
												<button
													type="button"
													onclick={() => addSkillTag(suggestion)}
													class="inline-flex items-center gap-1 rounded border border-[var(--dash-border)] bg-[var(--dash-bg)] px-2 py-1 text-xs text-[var(--dash-text-secondary)] transition-colors hover:border-[var(--dash-primary)]/40 hover:text-[var(--dash-primary)]"
												>
													<FontAwesomeIcon icon={faPlus} class="h-2.5 w-2.5" />
													{suggestion}
												</button>
											{/each}
										</div>
										<p
											class="mb-1 text-[10px] tracking-wide text-[var(--dash-text-muted)] uppercase"
										>
											Exclude from
										</p>
										<div class="flex flex-wrap gap-1.5">
											{#each allSuggestions as suggestion, i (i)}
												<button
													type="button"
													onclick={() => addSkillTag('!' + suggestion)}
													class="inline-flex items-center gap-1 rounded border border-[var(--dash-border)] bg-[var(--dash-bg)] px-2 py-1 text-xs text-[var(--dash-text-secondary)] transition-colors hover:border-red-500/40 hover:text-red-500"
												>
													<FontAwesomeIcon icon={faBan} class="h-2.5 w-2.5" />
													{suggestion}
												</button>
											{/each}
										</div>
									{/if}
								{/if}
							</div>
						{/if}

						<div class="flex items-center justify-between pt-1">
							<button
								type="button"
								onclick={() => removeSkill(index)}
								class="mr-2 flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs text-red-500 transition-colors hover:border-red-500/50 hover:bg-red-500/20 hover:text-red-600"
								aria-label="Delete skill"
							>
								<FontAwesomeIcon icon={faTrash} class="h-3 w-3" />
								Delete
							</button>
							<div class="flex gap-1.5">
								<button
									type="button"
									onclick={() => cancelEditing()}
									class="flex items-center gap-1.5 rounded-lg border border-[var(--dash-border)] bg-[var(--dash-bg)] px-3 py-1.5 text-xs text-[var(--dash-text-secondary)] transition-colors hover:border-[var(--dash-text-muted)] hover:text-[var(--dash-text)]"
									aria-label="Cancel"
								>
									<FontAwesomeIcon icon={faXmark} class="h-3 w-3" />
									Cancel
								</button>
								<button
									type="button"
									onclick={() => confirmEditing()}
									class="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-600 transition-colors hover:border-emerald-500/50 hover:bg-emerald-500/20 hover:text-emerald-700"
									aria-label="Confirm"
								>
									<FontAwesomeIcon icon={faCheck} class="h-3 w-3" />
									Save
								</button>
							</div>
						</div>
					</div>
				{/if}
			</div>
		{/each}
		<button
			type="button"
			onclick={() => addSkill()}
			class="flex items-center gap-1 rounded-lg border border-dashed border-[var(--dash-border)] px-3 py-1 text-sm text-[var(--dash-primary)] transition-colors hover:border-[var(--dash-primary)]/40 hover:text-[var(--dash-primary-hover)]"
		>
			<FontAwesomeIcon icon={faPlus} class="h-3 w-3" />
			Add
		</button>
	</div>
{/if}
