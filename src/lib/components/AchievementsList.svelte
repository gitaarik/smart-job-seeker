<script lang="ts">
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import { faPlus, faTimes, faUndo, faPencil, faTags } from "@fortawesome/free-solid-svg-icons";

  export interface AchievementItem {
    description: string;
    tags?: string[] | null;
  }

  interface Props {
    achievements?: AchievementItem[] | string[];
    deletedIndices?: Set<number>;
    lastAddedIndex?: number | null;
    showTags?: boolean;
    versionNames?: string[];
    onAdd?: () => void;
    onRemove?: (index: number) => void;
    onUndoRemove?: (index: number) => void;
    onFocused?: () => void;
  }

  let {
    achievements = $bindable([]),
    deletedIndices = new Set(),
    lastAddedIndex = null,
    showTags = false,
    versionNames = [],
    onAdd,
    onRemove,
    onUndoRemove,
    onFocused,
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
  let newTag = $state("");

  const builtinTags = ["resume", "cv"];

  let allSuggestions = $derived.by(() => {
    if (!showTags) return [];
    const all = [...builtinTags, ...versionNames.filter((v) => !builtinTags.includes(v.toLowerCase()))];
    return all.filter((s) => !editTags.some((t) => t.toLowerCase() === s.toLowerCase()));
  });

  function openEdit(index: number) {
    editingIndex = index;
    const item = getItem(index);
    editDescription = item.description;
    editTags = [...(item.tags || [])];
    newTag = "";
  }

  function closeEdit() {
    editingIndex = null;
    editDescription = "";
    editTags = [];
    newTag = "";
  }

  function saveEdit() {
    if (editingIndex === null) return;
    setItem(editingIndex, {
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
    newTag = "";
  }

  function removeEditTag(tag: string) {
    editTags = editTags.filter((t) => t !== tag);
  }

  function handleTagKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (newTag.trim()) {
        addEditTag(newTag);
      }
    }
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
</script>

{#if achievements.length === 0}
  <p class="text-[var(--dash-text-secondary)] text-sm">No achievements added yet.</p>
{:else}
  <div class="border border-[var(--dash-border)] rounded-md overflow-hidden">
    {#each achievements as _, index}
      {@const item = getItem(index)}
      {@const isDeleted = deletedIndices.has(index)}
      <div class="flex items-center {index > 0 ? 'border-t border-[var(--dash-border)]' : ''} {isDeleted ? 'opacity-50 bg-[var(--dash-bg)]/50' : ''}">
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
            {#if showTags && item.tags && item.tags.length > 0}
              <span class="flex items-center gap-1 text-xs text-[var(--dash-text-secondary)]">
                <FontAwesomeIcon icon={faTags} class="w-3 h-3" />
                {item.tags.join(", ")}
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
    class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
    onclick={(e) => { if (e.target === e.currentTarget) closeEdit(); }}
  >
    <div class="bg-[var(--dash-card)] rounded-lg shadow-xl border border-[var(--dash-border)] max-w-lg w-full p-6">
      <h3 class="text-lg font-semibold text-[var(--dash-text)] mb-4">Edit Achievement</h3>

      <!-- Description -->
      <div class="mb-4">
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
      </div>

      <!-- Version Tags (only for work experience achievements) -->
      {#if showTags}
        <div class="mb-4">
          <label class="block text-sm font-medium text-[var(--dash-text)] mb-1">
            <FontAwesomeIcon icon={faTags} class="w-3.5 h-3.5 mr-1 text-[var(--dash-text-secondary)]" />
            CV / Resume Versions
          </label>
          <p class="text-xs text-[var(--dash-text-secondary)] mb-2">
            No tags means this achievement appears in all versions.
          </p>

          <!-- Current tags -->
          {#if editTags.length > 0}
            <div class="flex flex-wrap gap-1.5 mb-2">
              {#each editTags as tag}
                <span class="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-md bg-[var(--dash-primary)]/10 text-[var(--dash-primary)] border border-[var(--dash-primary)]/20">
                  {tag}
                  <button
                    type="button"
                    onclick={() => removeEditTag(tag)}
                    class="hover:text-[var(--dash-error)] transition-colors"
                  >
                    <FontAwesomeIcon icon={faTimes} class="w-2.5 h-2.5" />
                  </button>
                </span>
              {/each}
            </div>
          {:else}
            <p class="text-xs text-[var(--dash-text-muted)] italic mb-2">All versions</p>
          {/if}

          <!-- Suggestions -->
          {#if allSuggestions.length > 0}
            <div class="flex flex-wrap gap-1.5 mb-2">
              {#each allSuggestions as suggestion}
                <button
                  type="button"
                  onclick={() => addEditTag(suggestion)}
                  class="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-md bg-[var(--dash-bg)] text-[var(--dash-text-secondary)] border border-[var(--dash-border)] hover:border-[var(--dash-primary)]/40 hover:text-[var(--dash-primary)] transition-colors"
                >
                  <FontAwesomeIcon icon={faPlus} class="w-2.5 h-2.5" />
                  {suggestion}
                </button>
              {/each}
            </div>
          {/if}

          <!-- Custom tag input -->
          <div class="flex gap-2">
            <input
              type="text"
              bind:value={newTag}
              onkeydown={handleTagKeydown}
              placeholder="Custom tag..."
              class="flex-1 max-w-[160px] px-2 py-1 text-xs border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
            />
            <button
              type="button"
              onclick={() => { if (newTag.trim()) addEditTag(newTag); }}
              disabled={!newTag.trim()}
              class="px-2 py-1 text-xs bg-[var(--dash-primary)] text-white rounded-md hover:bg-[var(--dash-primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add
            </button>
          </div>
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
