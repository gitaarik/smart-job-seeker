<script lang="ts">
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import { faPlus, faTimes, faUndo, faPencil, faTags, faChevronDown, faChevronRight, faGripVertical } from "@fortawesome/free-solid-svg-icons";
  import { portalToBody } from "$lib/actions/portal";
  import TranslatableField from "$lib/components/TranslatableField.svelte";

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
     * Notified after a drag-and-drop reorder so the parent can remap any
     * index-based side state (e.g. soft-deleted indices). The component
     * already moves the `achievements` array itself; this is parent-only.
     */
    onReorder?: (from: number, to: number) => void;
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
    onReorder,
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

  let allSuggestions = $derived.by(() => {
    if (!showTags) return [];
    const all = [...builtinTags, ...versionSlugs.filter((v) => !builtinTags.includes(v.toLowerCase()))];
    return all.filter((s) => !editTags.some((t) => t.toLowerCase() === s.toLowerCase()));
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

  // --- Drag-and-drop reordering ---
  let dragIndex = $state<number | null>(null);
  let dragOverIndex = $state<number | null>(null);

  function moveItem(from: number, to: number) {
    if (from === to) return;
    const arr = [...achievements];
    const [moved] = arr.splice(from, 1);
    arr.splice(to, 0, moved);
    achievements = arr as typeof achievements;
    // The component owns the array move; the parent only remaps its own
    // index-based side state (soft-deletes, last-added) via onReorder.
    onReorder?.(from, to);
  }

  function handleDragStart(index: number, e: DragEvent) {
    dragIndex = index;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
      // Firefox requires data to be set for a drag to start.
      e.dataTransfer.setData("text/plain", String(index));
    }
  }

  function handleDragOver(index: number, e: DragEvent) {
    if (dragIndex === null) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
    dragOverIndex = index;
  }

  function handleDrop(index: number) {
    if (dragIndex !== null) moveItem(dragIndex, index);
    dragIndex = null;
    dragOverIndex = null;
  }

  function handleDragEnd() {
    dragIndex = null;
    dragOverIndex = null;
  }
</script>

{#if achievements.length === 0}
  <p class="text-[var(--dash-text-secondary)] text-sm">No achievements added yet.</p>
{:else}
  <div class="border border-[var(--dash-border)] rounded-md overflow-hidden">
    {#each achievements as _, index}
      {@const item = getItem(index)}
      {@const isDeleted = deletedIndices.has(index)}
      {@const canDrag = achievements.length > 1}
      <div
        class="flex items-center {index > 0 ? 'border-t border-[var(--dash-border)]' : ''} {isDeleted ? 'opacity-50 bg-[var(--dash-bg)]/50' : ''} {dragIndex === index ? 'opacity-40' : ''} {dragOverIndex === index && dragIndex !== index ? 'bg-[var(--dash-primary)]/10' : ''}"
        draggable={canDrag}
        ondragstart={(e) => handleDragStart(index, e)}
        ondragover={(e) => handleDragOver(index, e)}
        ondrop={() => handleDrop(index)}
        ondragend={handleDragEnd}
      >
        {#if canDrag}
          <span
            class="pl-2 pr-1 self-stretch flex items-center text-[var(--dash-text-secondary)]/60 hover:text-[var(--dash-text-secondary)] cursor-grab active:cursor-grabbing"
            aria-hidden="true"
            title="Drag to reorder"
          >
            <FontAwesomeIcon icon={faGripVertical} class="w-3 h-3" />
          </span>
        {/if}
        {#if isDeleted}
          <span class="flex-1 px-4 py-3 text-[var(--dash-text-secondary)] line-through">{item.description}</span>
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
            <span class="flex-1 text-[var(--dash-text)] {!item.description ? 'text-[var(--dash-text-secondary)] italic' : ''}">
              {item.description || "Click to edit..."}
            </span>
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
<button
  type="button"
  onclick={handleAdd}
  class="text-[var(--dash-primary)] hover:text-[var(--dash-primary-hover)] text-sm flex items-center gap-1 mt-3"
>
  <FontAwesomeIcon icon={faPlus} class="w-3 h-3" />
  Add Achievement
</button>

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
                  <button
                    type="button"
                    onclick={() => removeEditTag(tag)}
                    class="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-[var(--dash-primary)]/10 text-[var(--dash-primary)] border border-[var(--dash-primary)]/20 hover:bg-red-500/15 hover:text-red-500 hover:border-red-500/30 transition-colors cursor-pointer"
                  >
                    {tag}
                    <FontAwesomeIcon icon={faTimes} class="w-2.5 h-2.5" />
                  </button>
                {/each}
              </div>
            {:else}
              <p class="text-xs text-[var(--dash-text-muted)] italic mb-2">All versions</p>
            {/if}

            <!-- Suggestions -->
            {#if allSuggestions.length > 0}
              <div class="flex flex-wrap gap-1.5">
                {#each allSuggestions as suggestion}
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
