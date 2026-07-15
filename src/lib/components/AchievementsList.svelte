<script lang="ts">
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import { faCircleNotch, faPlus, faTimes, faUndo, faPencil, faTags, faChevronDown, faChevronRight, faGripVertical, faBan } from "@fortawesome/free-solid-svg-icons";
  import { portalToBody } from "$lib/actions/portal";
  import TranslatableField from "$lib/components/TranslatableField.svelte";
  import { translations } from "$lib/stores/translations.svelte";
  import { BASE_LOCALE } from "$lib/resume-translations";
  import { dndzone } from "svelte-dnd-action";
  import { flip } from "svelte/animate";

  export interface AchievementItem {
    /** DB row id; absent for freshly-added, not-yet-saved achievements. */
    id?: number;
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
    onReorderCommit,
    onReorderSave,
  }: Props = $props();

  // Normalize: support both string[] and AchievementItem[]
  function isStringArray(arr: unknown[]): arr is string[] {
    return arr.length === 0 || typeof arr[0] === "string";
  }

  function getItem(index: number): AchievementItem {
    const item = achievements[index];
    if (typeof item === "string") return { description: item, tags: null };
    return item;
  }

  function setItem(index: number, value: AchievementItem) {
    if (typeof achievements[0] === "string" || (achievements.length === 0 && !showTags)) {
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
  let editDescription = $state("");
  let editTags = $state<string[]>([]);
  let showVersionTags_popup = $state(false);

  const builtinTags = ["resume", "cv"];

  function hasEditTag(tag: string): boolean {
    return editTags.some((t) => t.toLowerCase() === tag.toLowerCase());
  }

  // Candidates not yet decided in either form (positive or "!" exclude);
  // once a version is whitelisted or hidden we stop re-suggesting it.
  let availableSuggestions = $derived.by(() => {
    if (!showTags) return [];
    const all = [...builtinTags, ...versionSlugs.filter((v) => !builtinTags.includes(v.toLowerCase()))];
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
    editDescription = "";
    editTags = [];
  }

  function saveEdit() {
    if (editingIndex === null) return;
    setItem(editingIndex, {
      id: getItem(editingIndex).id,
      description: editDescription,
      tags: editTags.length > 0 ? editTags : null,
    });
    closeEdit();
  }

  function addEditTag(tag: string) {
    const trimmed = tag.trim();
    if (trimmed && !editTags.some((t) => t.toLowerCase() === trimmed.toLowerCase())) {
      editTags = [...editTags, trimmed];
    }
  }

  function removeEditTag(tag: string) {
    editTags = editTags.filter((t) => t !== tag);
  }

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
        achievements = [...achievements, ""] as string[];
      } else {
        achievements = [...achievements, { description: "", tags: null }] as AchievementItem[];
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
      deleted: deletedIndices.has(i),
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
    achievements = (wasStrings ? ordered.map((a) => a.description) : ordered) as typeof achievements;
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
      const t = translations.get(entity, item.id, "description", translations.activeLocale);
      if (t.trim()) return { text: t, fallback: false };
      return { text: base, fallback: !!base };
    }
    return { text: base, fallback: false };
  }
</script>

{#if achievements.length > 1}
  <div class="flex justify-end mb-2">
    <button
      type="button"
      onclick={() => (reorderMode ? cancelReorder() : startReorder())}
      class="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded border transition-colors {reorderMode
        ? 'bg-amber-500/15 text-amber-700 border-amber-500/30'
        : 'bg-[var(--dash-bg)] text-[var(--dash-text-muted)] border-[var(--dash-border)]'}"
    >
      <span class="inline-block w-1.5 h-1.5 rounded-full transition-colors {reorderMode ? 'bg-amber-500' : 'bg-[var(--dash-text-muted)]/30'}"></span>
      Reorder
    </button>
  </div>
{/if}

{#if reorderMode}
  <div
    class="border border-[var(--dash-border)] rounded-md overflow-hidden"
    use:dndzone={{ items: dndAch, flipDurationMs: flipMs, type: "achievements" }}
    onconsider={handleReorderConsider}
    onfinalize={handleReorderFinalize}
  >
    {#each dndAch as w, index (w.id)}
      {@const shown = shownDescription(w.item)}
      <div
        animate:flip={{ duration: flipMs }}
        class="flex items-center cursor-grab active:cursor-grabbing {index > 0 ? 'border-t border-[var(--dash-border)]' : ''} {w.deleted ? 'opacity-50 bg-[var(--dash-bg)]/50' : ''}"
      >
        <span
          class="pl-2 pr-1 self-stretch flex items-center text-[var(--dash-text-secondary)]/60"
          aria-hidden="true"
        >
          <FontAwesomeIcon icon={faGripVertical} class="w-3 h-3" />
        </span>
        <span class="flex-1 px-2 py-3 text-[var(--dash-text)] {w.deleted ? 'line-through text-[var(--dash-text-secondary)]' : ''} {!shown.text ? 'text-[var(--dash-text-secondary)] italic' : ''}">
          {shown.text || "(empty)"}
        </span>
      </div>
    {/each}
  </div>
  <div class="flex items-center justify-end gap-2 mt-3">
    <span class="mr-auto text-xs text-[var(--dash-text-muted)]">Drag to reorder, then {onReorderSave ? "save" : "done"}.</span>
    <button
      type="button"
      onclick={cancelReorder}
      class="px-3 py-1.5 text-sm border border-[var(--dash-border)] rounded-lg text-[var(--dash-text)] hover:bg-[var(--dash-bg)] transition-colors"
    >
      Cancel
    </button>
    <button
      type="button"
      onclick={confirmReorder}
      disabled={reorderSaving}
      class="px-3 py-1.5 text-sm bg-[var(--dash-primary)] text-white rounded-lg hover:bg-[var(--dash-primary-hover)] transition-colors inline-flex items-center gap-1.5 disabled:opacity-70"
    >
      {#if reorderSaving}<FontAwesomeIcon icon={faCircleNotch} spin class="w-3 h-3" />{/if}
      {onReorderSave ? "Save" : "Done"}
    </button>
  </div>
{:else if achievements.length === 0}
  <p class="text-[var(--dash-text-secondary)] text-sm">No achievements added yet.</p>
{:else}
  <div class="border border-[var(--dash-border)] rounded-md overflow-hidden">
    {#each achievements as _, index}
      {@const item = getItem(index)}
      {@const isDeleted = deletedIndices.has(index)}
      {@const shown = shownDescription(item)}
      <div
        class="flex items-center {index > 0 ? 'border-t border-[var(--dash-border)]' : ''} {isDeleted ? 'opacity-50 bg-[var(--dash-bg)]/50' : ''}"
      >
        {#if isDeleted}
          <span class="flex-1 px-4 py-3 text-[var(--dash-text-secondary)] line-through">{shown.text}</span>
          <button
            type="button"
            onclick={() => onUndoRemove?.(index)}
            class="p-3 text-[var(--dash-primary)] hover:text-[var(--dash-primary-hover)] transition-colors"
            aria-label="Undo"
          >
            <FontAwesomeIcon icon={faUndo} class="w-4 h-4" />
          </button>
        {:else}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            class="flex-1 px-4 py-3 cursor-pointer hover:bg-[var(--dash-bg)]/50 transition-colors flex items-center gap-2"
            onclick={() => openEdit(index)}
          >
            <span class="flex-1 text-[var(--dash-text)] {!shown.text ? 'text-[var(--dash-text-secondary)] italic' : ''}">
              {shown.text || "Click to edit..."}
            </span>
            {#if shown.fallback}
              <span
                class="shrink-0 text-[10px] font-medium uppercase text-[var(--dash-text-secondary)]/70 border border-[var(--dash-border)] rounded px-1 leading-tight"
                title="No {translations.activeLocale.toUpperCase()} translation yet — showing English"
              >
                {BASE_LOCALE}
              </span>
            {/if}
            <FontAwesomeIcon icon={faPencil} class="w-3 h-3 text-[var(--dash-text-secondary)]" />
          </div>
          <button
            type="button"
            onclick={() => handleRemove(index)}
            class="p-3 text-[var(--dash-text-secondary)] hover:text-[var(--dash-error)] transition-colors"
            aria-label="Remove"
          >
            <FontAwesomeIcon icon={faTimes} class="w-4 h-4" />
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
    class="text-[var(--dash-primary)] hover:text-[var(--dash-primary-hover)] text-sm flex items-center gap-1 mt-3"
  >
    <FontAwesomeIcon icon={faPlus} class="w-3 h-3" />
    Add Achievement
  </button>
{/if}

<!-- Edit Popup -->
{#if editingIndex !== null}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    use:portalToBody={{ onClose: closeEdit }}
    class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
    onclick={(e) => { if (e.target === e.currentTarget) closeEdit(); }}
  >
    <div class="bg-[var(--dash-card)] rounded-lg shadow-xl border border-[var(--dash-border)] max-w-lg w-full p-6">
      <h3 class="text-lg font-semibold text-[var(--dash-text)] mb-4">Edit Achievement</h3>

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
            bind:value={editDescription}
            placeholder="Describe your achievement..."
          />
        {:else}
          <label for="edit-achievement-desc" class="block text-sm font-medium text-[var(--dash-text)] mb-1">
            Description
          </label>
          <textarea
            id="edit-achievement-desc"
            bind:value={editDescription}
            rows={3}
            placeholder="Describe your achievement..."
            class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent resize-y"
          ></textarea>
        {/if}
      </div>

      <!-- Version Tags (collapsible) -->
      {#if showTags && versionSlugs.length > 0}
        <div class="mb-4">
          <button
            type="button"
            onclick={() => (showVersionTags_popup = !showVersionTags_popup)}
            class="flex items-center gap-1.5 text-sm font-medium text-[var(--dash-text)] hover:text-[var(--dash-primary)] transition-colors mb-1"
          >
            <FontAwesomeIcon icon={showVersionTags_popup ? faChevronDown : faChevronRight} class="w-3 h-3" />
            <FontAwesomeIcon icon={faTags} class="w-3.5 h-3.5 text-[var(--dash-text-secondary)]" />
            Resume / CV Versions
            {#if !showVersionTags_popup && editTags.length > 0}
              <span class="text-xs font-normal text-[var(--dash-primary)]">({editTags.length})</span>
            {/if}
          </button>

          {#if showVersionTags_popup}
            <p class="text-xs text-[var(--dash-text-secondary)] mb-2">
              No tags means this achievement appears in all versions.
            </p>

            <!-- Current tags -->
            {#if editTags.length > 0}
              <div class="flex flex-wrap gap-1.5 mb-2">
                {#each editTags as tag}
                  {@const isExclude = tag.startsWith("!")}
                  <button
                    type="button"
                    onclick={() => removeEditTag(tag)}
                    class="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md border transition-colors cursor-pointer
                      {isExclude
                        ? 'bg-amber-500/10 text-amber-700 border-amber-500/30 hover:bg-red-500/15 hover:text-red-500 hover:border-red-500/30'
                        : 'bg-[var(--dash-primary)]/10 text-[var(--dash-primary)] border-[var(--dash-primary)]/20 hover:bg-red-500/15 hover:text-red-500 hover:border-red-500/30'}"
                  >
                    {isExclude ? `hide from ${tag.slice(1)}` : tag}
                    <FontAwesomeIcon icon={faTimes} class="w-2.5 h-2.5" />
                  </button>
                {/each}
              </div>
            {:else}
              <p class="text-xs text-[var(--dash-text-muted)] italic mb-2">All versions</p>
            {/if}

            <!-- Suggestions -->
            {#if availableSuggestions.length > 0}
              <!-- Show only on (whitelist) -->
              <p class="text-xs font-medium text-[var(--dash-text-secondary)] mb-1.5">Show only on</p>
              <div class="flex flex-wrap gap-1.5 mb-3">
                {#each availableSuggestions as suggestion}
                  <button
                    type="button"
                    onclick={() => addEditTag(suggestion)}
                    class="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-[var(--dash-bg)] text-[var(--dash-text-secondary)] border border-[var(--dash-border)] hover:border-[var(--dash-primary)]/40 hover:text-[var(--dash-primary)] transition-colors"
                  >
                    <FontAwesomeIcon icon={faPlus} class="w-2.5 h-2.5" />
                    {suggestion}
                  </button>
                {/each}
              </div>

              <!-- Hide from (exclude) -->
              <p class="text-xs font-medium text-[var(--dash-text-secondary)] mb-1.5">Hide from</p>
              <div class="flex flex-wrap gap-1.5">
                {#each availableSuggestions as suggestion}
                  <button
                    type="button"
                    onclick={() => addEditTag(`!${suggestion}`)}
                    class="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-[var(--dash-bg)] text-[var(--dash-text-secondary)] border border-[var(--dash-border)] hover:border-amber-500/40 hover:text-amber-700 transition-colors"
                  >
                    <FontAwesomeIcon icon={faBan} class="w-2.5 h-2.5" />
                    {suggestion}
                  </button>
                {/each}
              </div>
            {/if}
          {/if}
        </div>
      {/if}

      <!-- Actions -->
      <div class="flex justify-end gap-2">
        <button
          type="button"
          onclick={closeEdit}
          class="px-4 py-2 text-sm border border-[var(--dash-border)] rounded-lg text-[var(--dash-text)] hover:bg-[var(--dash-bg)] transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onclick={saveEdit}
          class="px-4 py-2 text-sm bg-[var(--dash-primary)] text-white rounded-lg hover:bg-[var(--dash-primary-hover)] transition-colors"
        >
          Done
        </button>
      </div>
    </div>
  </div>
{/if}
