<script lang="ts">
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faCircleNotch,
		faPlus,
		faTimes,
		faUndo,
		faPencil,
		faTags,
		faChevronDown,
		faChevronRight,
		faGripVertical,
		faBan
	} from '@fortawesome/free-solid-svg-icons';
	import { portalToBody } from '$lib/actions/portal';
	import AutoSaveIndicator from '$lib/components/AutoSaveIndicator.svelte';
	import type { SaveStatus } from '$lib/components/auto-save.svelte';
	import TranslatableField from '$lib/components/TranslatableField.svelte';
	import { translations } from '$lib/stores/translations.svelte';
	import { BASE_LOCALE } from '$lib/resume-translations';
	import { dndzone } from 'svelte-dnd-action';
	import { flip } from 'svelte/animate';

	export interface AchievementItem {
		/** DB row id; absent for freshly-added, not-yet-saved achievements. */
		id?: number;
		/**
		 * A caller's own handle on this entry, carried through reorders untouched.
		 *
		 * For a parent that saves each row as it changes (see `sectionRows`), the
		 * index is not an identity: a drag renumbers every entry, and an id is
		 * absent exactly when the row is new and most needs identifying. This is
		 * whatever that parent wants it to be; nothing here reads it.
		 */
		key?: number;
		description: string;
		tags?: string[] | null;
	}

	interface Props {
		achievements?: AchievementItem[] | string[];
		deletedIndices?: Set<number>;
		lastAddedIndex?: number | null;
		showTags?: boolean;
		versionSlugs?: string[];
		/**
		 * Translation entity type for the description (e.g.
		 * "work_experience_achievement"). When set, the edit popup shows inline
		 * language tabs for the description. Requires saved items (with an `id`).
		 */
		entity?: string;
		onAdd?: () => void;
		onRemove?: (index: number) => void;
		onUndoRemove?: (index: number) => void;
		onFocused?: () => void;
		/**
		 * One entry's text or tags changed, as it is edited.
		 *
		 * The reordered array already reaches a binding parent on its own; this is
		 * for the parent that persists per row and needs to know WHICH row, at the
		 * moment it changed, rather than diffing the array on every keystroke
		 * elsewhere on the page.
		 *
		 * Giving it also puts the edit popup in live mode. The popup used to hold
		 * an edit until Done and hand it over then — right while removals were
		 * staged and needed a commit, and wrong once the rows saved themselves:
		 * the section said "saves as you type", the translation tabs in the same
		 * popup did, and the English text and tags beside them waited for a
		 * button that Escape and a click outside skipped. So with a persisting
		 * parent every keystroke goes through here (and the parent's debounce),
		 * Done only closes, and the way back is the row's Undo rather than a
		 * Cancel — the contract the technology chips beside it already keep.
		 * Without it the popup stages and commits on Done, for a parent that only
		 * holds the array (the profile wizard).
		 */
		onItemChange?: (index: number, item: AchievementItem) => void;
		/**
		 * The popup's base field lost focus, or the popup closed — a parent that
		 * debounces its saves pushes the pending one out. Live mode only.
		 */
		onItemBlur?: (index: number) => void;
		/**
		 * The save state of one entry, for the pill inside the edit popup.
		 *
		 * The section's own indicator sits behind the modal overlay while the
		 * popup is open, so without this the popup has no way to say "Saving…",
		 * "Saved · Undo" or "Achievement is required". Live mode only.
		 */
		statusFor?: (item: AchievementItem) => SaveStatus | undefined;
		/**
		 * Called when a reorder is committed (Save/Done), with the soft-delete
		 * index set remapped to the new order. The component already writes the
		 * reordered `achievements` array; this lets the parent realign its own
		 * index-based side state (soft-deletes, last-added).
		 */
		onReorderCommit?: (deletedIndices: Set<number>) => void;
		/**
		 * Optional persist hook. When provided, reorder mode shows a Save button
		 * that commits the new order and calls this (e.g. the section's save);
		 * otherwise it shows a plain Done that just applies the order locally.
		 */
		onReorderSave?: () => void | Promise<void>;
	}

	let {
		achievements = $bindable([]),
		deletedIndices = new Set(),
		lastAddedIndex = null,
		showTags = false,
		versionSlugs = [],
		entity,
		onAdd,
		onRemove,
		onUndoRemove,
		onFocused,
		onItemChange,
		onItemBlur,
		statusFor,
		onReorderCommit,
		onReorderSave
	}: Props = $props();

	// Normalize: support both string[] and AchievementItem[]
	function isStringArray(arr: unknown[]): arr is string[] {
		return arr.length === 0 || typeof arr[0] === 'string';
	}

	function getItem(index: number): AchievementItem {
		const item = achievements[index];
		if (typeof item === 'string') return { description: item, tags: null };
		return item;
	}

	function setItem(index: number, value: AchievementItem) {
		if (typeof achievements[0] === 'string' || (achievements.length === 0 && !showTags)) {
			const arr = [...achievements] as string[];
			arr[index] = value.description;
			achievements = arr;
		} else {
			const arr = [...achievements] as AchievementItem[];
			arr[index] = value;
			achievements = arr;
		}
	}

	// Simple mode: component manages its own add/remove when callbacks not provided
	let internalLastAdded = $state<number | null>(null);
	let effectiveLastAdded = $derived(onAdd ? lastAddedIndex : internalLastAdded);

	// Edit popup state
	let editingIndex = $state<number | null>(null);
	let editDescription = $state('');
	let editTags = $state<string[]>([]);
	let showVersionTags_popup = $state(false);

	/** Whether the popup writes through as it edits, or stages until Done. */
	const live = $derived(onItemChange !== undefined);

	const builtinTags = ['resume', 'cv'];

	function hasEditTag(tag: string): boolean {
		return editTags.some((t) => t.toLowerCase() === tag.toLowerCase());
	}

	// Candidates not yet decided in either form (positive or "!" exclude);
	// once a version is whitelisted or hidden we stop re-suggesting it.
	let availableSuggestions = $derived.by(() => {
		if (!showTags) return [];
		const all = [
			...builtinTags,
			...versionSlugs.filter((v) => !builtinTags.includes(v.toLowerCase()))
		];
		return all.filter((s) => !hasEditTag(s) && !hasEditTag(`!${s}`));
	});

	function openEdit(index: number) {
		editingIndex = index;
		const item = getItem(index);
		editDescription = item.description;
		editTags = [...(item.tags || [])];
		showVersionTags_popup = editTags.length > 0;
	}

	function closeEdit() {
		editingIndex = null;
		editDescription = '';
		editTags = [];
	}

	/** Write what the popup holds into the list, and tell the parent which row. */
	function applyEdit() {
		if (editingIndex === null) return;
		const previous = getItem(editingIndex);
		const next: AchievementItem = {
			id: previous.id,
			key: previous.key,
			description: editDescription,
			tags: editTags.length > 0 ? editTags : null
		};
		setItem(editingIndex, next);
		onItemChange?.(editingIndex, next);
	}

	/** Staged mode: Done commits what the popup holds, then closes. */
	function saveEdit() {
		applyEdit();
		closeEdit();
	}

	/**
	 * Live mode: everything is written already, so Done only gives the parent
	 * its chance to push a pending debounce out, then closes.
	 */
	function finishEdit() {
		if (editingIndex !== null) onItemBlur?.(editingIndex);
		closeEdit();
	}

	/** Escape and a click outside: a staged edit is dropped, a live one is done. */
	function dismissEdit() {
		if (live) finishEdit();
		else closeEdit();
	}

	/** The base field lost focus; in live mode that is the parent's flush moment. */
	function blurEdit() {
		if (live && editingIndex !== null) onItemBlur?.(editingIndex);
	}

	function setEditDescription(value: string) {
		editDescription = value;
		if (live) applyEdit();
	}

	function addEditTag(tag: string) {
		const trimmed = tag.trim();
		if (trimmed && !editTags.some((t) => t.toLowerCase() === trimmed.toLowerCase())) {
			editTags = [...editTags, trimmed];
			if (live) applyEdit();
		}
	}

	function removeEditTag(tag: string) {
		editTags = editTags.filter((t) => t !== tag);
		if (live) applyEdit();
	}

	function sameTags(a: string[], b: string[]): boolean {
		return a.length === b.length && a.every((t, i) => t === b[i]);
	}

	/**
	 * Live mode: the entry can change under an open popup. An Undo reverts the
	 * row through the parent's store and the parent writes it back into
	 * `achievements`; the popup's own writes keep its copy equal to the entry,
	 * so a difference is always news from outside and safe to take.
	 */
	$effect(() => {
		if (!live || editingIndex === null || editingIndex >= achievements.length) return;
		const item = getItem(editingIndex);
		if (item.description !== editDescription) editDescription = item.description;
		const tags = item.tags ?? [];
		if (!sameTags(tags, editTags)) editTags = [...tags];
	});

	function focusIfNew(node: HTMLElement, isNew: boolean) {
		if (isNew) {
			// For new items, open the edit popup immediately
			const index = achievements.length - 1;
			if (onFocused) onFocused();
			else internalLastAdded = null;
			openEdit(index);
		}
	}

	function handleAdd() {
		if (onAdd) {
			onAdd();
		} else {
			if (isStringArray(achievements)) {
				achievements = [...achievements, ''] as string[];
			} else {
				achievements = [...achievements, { description: '', tags: null }] as AchievementItem[];
			}
			internalLastAdded = achievements.length - 1;
		}
	}

	function handleRemove(index: number) {
		if (onRemove) {
			onRemove(index);
		} else {
			achievements = achievements.filter((_, i) => i !== index) as typeof achievements;
		}
	}

	// --- Drag-and-drop reordering (svelte-dnd-action, gated behind a toggle) ---
	// Dragging only mutates local `dndAch` state; the reordered array and the
	// remapped soft-delete set are committed to the parent on Save/Done, so
	// Cancel is a clean revert with no snapshot.
	const flipMs = 150;
	let reorderMode = $state(false);
	let reorderSaving = $state(false);

	interface DndAch {
		id: number;
		item: AchievementItem;
		deleted: boolean;
	}
	let dndAch = $state<DndAch[]>([]);

	function startReorder() {
		dndAch = achievements.map((_, i) => ({
			id: i,
			item: getItem(i),
			deleted: deletedIndices.has(i)
		}));
		reorderMode = true;
	}

	function handleReorderConsider(e: CustomEvent<{ items: DndAch[] }>) {
		dndAch = e.detail.items;
	}

	function handleReorderFinalize(e: CustomEvent<{ items: DndAch[] }>) {
		dndAch = e.detail.items;
	}

	// Write the reordered order back to `achievements` (preserving string[] vs
	// AchievementItem[] shape) and return the remapped soft-delete set.
	function commitReorder(): Set<number> {
		const wasStrings = isStringArray(achievements);
		const ordered = dndAch.map((w) => w.item);
		achievements = (
			wasStrings ? ordered.map((a) => a.description) : ordered
		) as typeof achievements;
		return new Set(dndAch.flatMap((w, i) => (w.deleted ? [i] : [])));
	}

	function exitReorder() {
		reorderMode = false;
		dndAch = [];
	}

	function cancelReorder() {
		exitReorder();
	}

	async function confirmReorder() {
		const newDeleted = commitReorder();
		onReorderCommit?.(newDeleted);
		if (onReorderSave) {
			reorderSaving = true;
			try {
				await onReorderSave();
			} finally {
				reorderSaving = false;
			}
		}
		exitReorder();
	}

	// --- Translation-aware display ---
	// Show each achievement in the active locale, falling back to the English
	// base when that locale has no translation yet. Only kicks in for saved
	// items of a translatable entity.
	$effect(() => {
		if (entity) void translations.ensureLoaded();
	});

	function shownDescription(item: AchievementItem): { text: string; fallback: boolean } {
		const base = item.description;
		if (entity && item.id && translations.activeLocale !== BASE_LOCALE) {
			const t = translations.get(entity, item.id, 'description', translations.activeLocale);
			if (t.trim()) return { text: t, fallback: false };
			return { text: base, fallback: !!base };
		}
		return { text: base, fallback: false };
	}
</script>

{#if achievements.length > 1}
	<div class="mb-2 flex justify-end">
		<button
			type="button"
			onclick={() => (reorderMode ? cancelReorder() : startReorder())}
			class="inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-medium transition-colors {reorderMode
				? 'border-amber-500/30 bg-amber-500/15 text-amber-700'
				: 'border-[var(--dash-border)] bg-[var(--dash-bg)] text-[var(--dash-text-muted)]'}"
		>
			<span
				class="inline-block h-1.5 w-1.5 rounded-full transition-colors {reorderMode
					? 'bg-amber-500'
					: 'bg-[var(--dash-text-muted)]/30'}"
			></span>
			Reorder
		</button>
	</div>
{/if}

{#if reorderMode}
	<div
		class="overflow-hidden rounded-md border border-[var(--dash-border)]"
		use:dndzone={{ items: dndAch, flipDurationMs: flipMs, type: 'achievements' }}
		onconsider={handleReorderConsider}
		onfinalize={handleReorderFinalize}
	>
		{#each dndAch as w, index (w.id)}
			{@const shown = shownDescription(w.item)}
			<div
				animate:flip={{ duration: flipMs }}
				class="flex cursor-grab items-center active:cursor-grabbing {index > 0
					? 'border-t border-[var(--dash-border)]'
					: ''} {w.deleted ? 'bg-[var(--dash-bg)]/50 opacity-50' : ''}"
			>
				<span
					class="flex items-center self-stretch pr-1 pl-2 text-[var(--dash-text-secondary)]/60"
					aria-hidden="true"
				>
					<FontAwesomeIcon icon={faGripVertical} class="h-3 w-3" />
				</span>
				<span
					class="flex-1 px-2 py-3 text-[var(--dash-text)] {w.deleted
						? 'text-[var(--dash-text-secondary)] line-through'
						: ''} {!shown.text ? 'text-[var(--dash-text-secondary)] italic' : ''}"
				>
					{shown.text || '(empty)'}
				</span>
			</div>
		{/each}
	</div>
	<div class="mt-3 flex items-center justify-end gap-2">
		<span class="mr-auto text-xs text-[var(--dash-text-muted)]"
			>Drag to reorder, then {onReorderSave ? 'save' : 'done'}.</span
		>
		<button
			type="button"
			onclick={cancelReorder}
			class="rounded-lg border border-[var(--dash-border)] px-3 py-1.5 text-sm text-[var(--dash-text)] transition-colors hover:bg-[var(--dash-bg)]"
		>
			Cancel
		</button>
		<button
			type="button"
			onclick={confirmReorder}
			disabled={reorderSaving}
			class="inline-flex items-center gap-1.5 rounded-lg bg-[var(--dash-primary)] px-3 py-1.5 text-sm text-white transition-colors hover:bg-[var(--dash-primary-hover)] disabled:opacity-70"
		>
			{#if reorderSaving}<FontAwesomeIcon icon={faCircleNotch} spin class="h-3 w-3" />{/if}
			{onReorderSave ? 'Save' : 'Done'}
		</button>
	</div>
{:else if achievements.length === 0}
	<p class="text-sm text-[var(--dash-text-secondary)]">No achievements added yet.</p>
{:else}
	<div class="overflow-hidden rounded-md border border-[var(--dash-border)]">
		{#each achievements as _, index}
			{@const item = getItem(index)}
			{@const isDeleted = deletedIndices.has(index)}
			{@const shown = shownDescription(item)}
			<div
				class="flex items-center {index > 0
					? 'border-t border-[var(--dash-border)]'
					: ''} {isDeleted ? 'bg-[var(--dash-bg)]/50 opacity-50' : ''}"
			>
				{#if isDeleted}
					<span class="flex-1 px-4 py-3 text-[var(--dash-text-secondary)] line-through"
						>{shown.text}</span
					>
					<button
						type="button"
						onclick={() => onUndoRemove?.(index)}
						class="p-3 text-[var(--dash-primary)] transition-colors hover:text-[var(--dash-primary-hover)]"
						aria-label="Undo"
					>
						<FontAwesomeIcon icon={faUndo} class="h-4 w-4" />
					</button>
				{:else}
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div
						class="flex flex-1 cursor-pointer items-center gap-2 px-4 py-3 transition-colors hover:bg-[var(--dash-bg)]/50"
						onclick={() => openEdit(index)}
					>
						<span
							class="flex-1 text-[var(--dash-text)] {!shown.text
								? 'text-[var(--dash-text-secondary)] italic'
								: ''}"
						>
							{shown.text || 'Click to edit...'}
						</span>
						{#if shown.fallback}
							<span
								class="shrink-0 rounded border border-[var(--dash-border)] px-1 text-[10px] leading-tight font-medium text-[var(--dash-text-secondary)]/70 uppercase"
								title="No {translations.activeLocale.toUpperCase()} translation yet — showing English"
							>
								{BASE_LOCALE}
							</span>
						{/if}
						<FontAwesomeIcon icon={faPencil} class="h-3 w-3 text-[var(--dash-text-secondary)]" />
					</div>
					<button
						type="button"
						onclick={() => handleRemove(index)}
						class="p-3 text-[var(--dash-text-secondary)] transition-colors hover:text-[var(--dash-error)]"
						aria-label="Remove"
					>
						<FontAwesomeIcon icon={faTimes} class="h-4 w-4" />
					</button>
				{/if}
			</div>
			<!-- Trigger focus/open for newly added items -->
			{#if index === effectiveLastAdded}
				<span class="hidden" use:focusIfNew={true}></span>
			{/if}
		{/each}
	</div>
{/if}
{#if !reorderMode}
	<button
		type="button"
		onclick={handleAdd}
		class="mt-3 flex items-center gap-1 text-sm text-[var(--dash-primary)] hover:text-[var(--dash-primary-hover)]"
	>
		<FontAwesomeIcon icon={faPlus} class="h-3 w-3" />
		Add Achievement
	</button>
{/if}

<!-- Edit Popup -->
{#if editingIndex !== null}
	{@const status = live ? statusFor?.(getItem(editingIndex)) : undefined}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		use:portalToBody={{ onClose: dismissEdit }}
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
		onclick={(e) => {
			if (e.target === e.currentTarget) dismissEdit();
		}}
	>
		<div
			class="w-full max-w-lg rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)] p-6 shadow-xl"
		>
			<h3 class="mb-4 text-lg font-semibold text-[var(--dash-text)]">Edit Achievement</h3>

			<!-- Description -->
			<div class="mb-4">
				{#if entity}
					{@const itemId = getItem(editingIndex).id ?? 0}
					<TranslatableField
						{entity}
						id={itemId}
						field="description"
						label="Description"
						multiline
						rows={3}
						bind:value={() => editDescription, setEditDescription}
						onblur={blurEdit}
						placeholder="Describe your achievement..."
					/>
				{:else}
					<label
						for="edit-achievement-desc"
						class="mb-1 block text-sm font-medium text-[var(--dash-text)]"
					>
						Description
					</label>
					<textarea
						id="edit-achievement-desc"
						bind:value={() => editDescription, setEditDescription}
						onblur={blurEdit}
						rows={3}
						placeholder="Describe your achievement..."
						class="w-full resize-y rounded-md border border-[var(--dash-border)] px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
					></textarea>
				{/if}
			</div>

			<!-- Version Tags (collapsible) -->
			{#if showTags && versionSlugs.length > 0}
				<div class="mb-4">
					<button
						type="button"
						onclick={() => (showVersionTags_popup = !showVersionTags_popup)}
						class="mb-1 flex items-center gap-1.5 text-sm font-medium text-[var(--dash-text)] transition-colors hover:text-[var(--dash-primary)]"
					>
						<FontAwesomeIcon
							icon={showVersionTags_popup ? faChevronDown : faChevronRight}
							class="h-3 w-3"
						/>
						<FontAwesomeIcon icon={faTags} class="h-3.5 w-3.5 text-[var(--dash-text-secondary)]" />
						Resume / CV Versions
						{#if !showVersionTags_popup && editTags.length > 0}
							<span class="text-xs font-normal text-[var(--dash-primary)]">({editTags.length})</span
							>
						{/if}
					</button>

					{#if showVersionTags_popup}
						<p class="mb-2 text-xs text-[var(--dash-text-secondary)]">
							No tags means this achievement appears in all versions.
						</p>

						<!-- Current tags -->
						{#if editTags.length > 0}
							<div class="mb-2 flex flex-wrap gap-1.5">
								{#each editTags as tag}
									{@const isExclude = tag.startsWith('!')}
									<button
										type="button"
										onclick={() => removeEditTag(tag)}
										class="inline-flex cursor-pointer items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors
                      {isExclude
											? 'border-amber-500/30 bg-amber-500/10 text-amber-700 hover:border-red-500/30 hover:bg-red-500/15 hover:text-red-500'
											: 'border-[var(--dash-primary)]/20 bg-[var(--dash-primary)]/10 text-[var(--dash-primary)] hover:border-red-500/30 hover:bg-red-500/15 hover:text-red-500'}"
									>
										{isExclude ? `hide from ${tag.slice(1)}` : tag}
										<FontAwesomeIcon icon={faTimes} class="h-2.5 w-2.5" />
									</button>
								{/each}
							</div>
						{:else}
							<p class="mb-2 text-xs text-[var(--dash-text-muted)] italic">All versions</p>
						{/if}

						<!-- Suggestions -->
						{#if availableSuggestions.length > 0}
							<!-- Show only on (whitelist) -->
							<p class="mb-1.5 text-xs font-medium text-[var(--dash-text-secondary)]">
								Show only on
							</p>
							<div class="mb-3 flex flex-wrap gap-1.5">
								{#each availableSuggestions as suggestion}
									<button
										type="button"
										onclick={() => addEditTag(suggestion)}
										class="inline-flex items-center gap-1 rounded-md border border-[var(--dash-border)] bg-[var(--dash-bg)] px-2 py-1 text-xs text-[var(--dash-text-secondary)] transition-colors hover:border-[var(--dash-primary)]/40 hover:text-[var(--dash-primary)]"
									>
										<FontAwesomeIcon icon={faPlus} class="h-2.5 w-2.5" />
										{suggestion}
									</button>
								{/each}
							</div>

							<!-- Hide from (exclude) -->
							<p class="mb-1.5 text-xs font-medium text-[var(--dash-text-secondary)]">Hide from</p>
							<div class="flex flex-wrap gap-1.5">
								{#each availableSuggestions as suggestion}
									<button
										type="button"
										onclick={() => addEditTag(`!${suggestion}`)}
										class="inline-flex items-center gap-1 rounded-md border border-[var(--dash-border)] bg-[var(--dash-bg)] px-2 py-1 text-xs text-[var(--dash-text-secondary)] transition-colors hover:border-amber-500/40 hover:text-amber-700"
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

			<!-- Actions -->
			<div class="flex items-center justify-end gap-2">
				{#if live}
					<!-- Live: the row is saved as it is edited, and this is where it says so. -->
					<span class="mr-auto">
						{#if status}
							<AutoSaveIndicator field={status} idleLabel="Saves as you type" />
						{:else}
							<span class="text-xs text-[var(--dash-text-muted)]">Saves as you type</span>
						{/if}
					</span>
					<button
						type="button"
						onclick={finishEdit}
						class="rounded-lg bg-[var(--dash-primary)] px-4 py-2 text-sm text-white transition-colors hover:bg-[var(--dash-primary-hover)]"
					>
						Done
					</button>
				{:else}
					<button
						type="button"
						onclick={closeEdit}
						class="rounded-lg border border-[var(--dash-border)] px-4 py-2 text-sm text-[var(--dash-text)] transition-colors hover:bg-[var(--dash-bg)]"
					>
						Cancel
					</button>
					<button
						type="button"
						onclick={saveEdit}
						class="rounded-lg bg-[var(--dash-primary)] px-4 py-2 text-sm text-white transition-colors hover:bg-[var(--dash-primary-hover)]"
					>
						Done
					</button>
				{/if}
			</div>
		</div>
	</div>
{/if}
