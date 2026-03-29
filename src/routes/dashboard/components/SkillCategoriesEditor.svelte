<script lang="ts">
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faCheck,
    faChevronDown,
    faChevronUp,
    faPencil,
    faPlus,
    faTimes,
    faTrash,
  } from "@fortawesome/free-solid-svg-icons";
  import Card from "./Card.svelte";
  import SkillTagsEditor from "./SkillTagsEditor.svelte";
  import type { LevelOption, SkillItem } from "./SkillTagsEditor.svelte";

  export interface CategoryItem {
    name: string;
    skills: SkillItem[];
  }

  interface Props {
    categories: CategoryItem[];
    levelOptions?: LevelOption[];
    versionSlugs?: string[];
    compact?: boolean;
    oncreate?: (category: CategoryItem) => void;
    onrename?: (category: CategoryItem) => void;
    onremove?: (category: CategoryItem) => void;
    onskillcreate?: (category: CategoryItem, skill: SkillItem) => void;
    onskillupdate?: (category: CategoryItem, skill: SkillItem) => void;
    onskillremove?: (category: CategoryItem, skill: SkillItem) => void;
    onskillreorder?: (category: CategoryItem, skills: SkillItem[]) => void;
  }

  let {
    categories = $bindable(),
    levelOptions,
    versionSlugs = [],
    compact = false,
    oncreate,
    onrename,
    onremove,
    onskillcreate,
    onskillupdate,
    onskillremove,
    onskillreorder,
  }: Props = $props();

  // Shared toggle state across all categories
  let showLevel = $state(false);
  let showExperience = $state(false);
  let showVersionTags = $state(false);
  let reorderMode = $state(false);

  // Determine which toggles are relevant across all categories
  let allSkills = $derived(categories.flatMap((c) => c.skills));
  let hasAnyLevel = $derived(allSkills.some((s) => s.level));
  let hasAnyExperience = $derived(allSkills.some((s) => s.yearsExperience));
  let hasAnyVersionTags = $derived(versionSlugs.length > 0);

  // Compact mode: track expanded items
  let expandedItems = $state<Set<number>>(new Set());

  function toggleItem(index: number) {
    if (expandedItems.has(index)) {
      expandedItems.delete(index);
    } else {
      expandedItems.add(index);
    }
    expandedItems = new Set(expandedItems);
  }

  // Track which categories are newly added (not yet persisted)
  let newIndices = $state(new Set<number>());
  // Track original names for rename detection
  let originalNames = $state(new Map<number, string>());
  // Track which category name is being edited
  let editingNameIndex = $state<number | null>(null);

  function addCategory() {
    const newCat: CategoryItem = { name: "", skills: [] };
    categories = [...categories, newCat];
    const idx = categories.length - 1;
    newIndices = new Set([...newIndices, idx]);
    editingNameIndex = idx;
    if (compact) expandedItems = new Set([...expandedItems, idx]);
  }

  function startEditingName(index: number) {
    handleNameFocus(index);
    editingNameIndex = index;
  }

  function saveEditingName(index: number) {
    handleNameBlur(index);
    editingNameIndex = null;
  }

  function cancelEditingName(index: number) {
    if (newIndices.has(index)) {
      // New unsaved category — remove it
      categories = categories.filter((_, i) => i !== index);
      const updatedNew = new Set<number>();
      for (const ni of newIndices) {
        if (ni < index) updatedNew.add(ni);
        else if (ni > index) updatedNew.add(ni - 1);
      }
      newIndices = updatedNew;
    } else if (originalNames.has(index)) {
      // Revert to original name
      categories[index].name = originalNames.get(index)!;
      const updated = new Map(originalNames);
      updated.delete(index);
      originalNames = updated;
    }
    editingNameIndex = null;
  }

  function autofocus(node: HTMLElement) {
    node.focus();
  }

  function removeCategory(index: number) {
    if (!confirm("Remove this skill category?")) return;
    const cat = categories[index];
    if (!newIndices.has(index)) {
      onremove?.(cat);
    }
    categories = categories.filter((_, i) => i !== index);
    // Reindex tracking sets
    const updatedNew = new Set<number>();
    for (const ni of newIndices) {
      if (ni < index) updatedNew.add(ni);
      else if (ni > index) updatedNew.add(ni - 1);
    }
    newIndices = updatedNew;
    const updatedNames = new Map<number, string>();
    for (const [ni, name] of originalNames) {
      if (ni < index) updatedNames.set(ni, name);
      else if (ni > index) updatedNames.set(ni - 1, name);
    }
    originalNames = updatedNames;
  }

  function handleNameFocus(index: number) {
    if (!newIndices.has(index) && !originalNames.has(index)) {
      originalNames = new Map([...originalNames, [
        index,
        categories[index].name,
      ]]);
    }
  }

  function handleNameBlur(index: number) {
    const cat = categories[index];
    if (newIndices.has(index)) {
      if (cat.name.trim()) {
        oncreate?.(cat);
        const updated = new Set(newIndices);
        updated.delete(index);
        newIndices = updated;
      }
    } else if (originalNames.has(index)) {
      const orig = originalNames.get(index)!;
      if (cat.name.trim() && cat.name !== orig) {
        onrename?.(cat);
      }
      const updated = new Map(originalNames);
      updated.delete(index);
      originalNames = updated;
    }
  }
</script>

{#snippet categoryHeader(categoryIndex: number)}
  {#if editingNameIndex === categoryIndex}
    <div class="flex items-center gap-1">
      <input
        type="text"
        bind:value={categories[categoryIndex].name}
        onkeydown={(e) => {
          if (e.key === "Enter") saveEditingName(categoryIndex);
          if (e.key === "Escape") cancelEditingName(categoryIndex);
        }}
        placeholder="Category name"
        class="px-3 py-1.5 text-sm font-medium text-[var(--dash-text)] border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent w-36 sm:w-auto"
        use:autofocus
      />
      <button
        type="button"
        onclick={() => cancelEditingName(categoryIndex)}
        class="p-2 text-[var(--dash-text-secondary)] hover:text-[var(--dash-text)] transition-colors"
        aria-label="Cancel"
      >
        <FontAwesomeIcon icon={faTimes} class="w-4 h-4" />
      </button>
      <button
        type="button"
        onclick={() => saveEditingName(categoryIndex)}
        class="p-2 text-[var(--dash-primary)] hover:text-[var(--dash-primary-hover)] transition-colors"
        aria-label="Save"
      >
        <FontAwesomeIcon icon={faCheck} class="w-4 h-4" />
      </button>
    </div>
  {:else}
    <div class="flex items-center gap-2 min-w-0">
      <h3 class="text-base font-semibold text-[var(--dash-text)] truncate">
        {categories[categoryIndex].name || "Untitled category"}
      </h3>
      {#if !compact}
        <button
          type="button"
          onclick={() => startEditingName(categoryIndex)}
          class="p-1 text-[var(--dash-text-muted)] hover:text-[var(--dash-primary)] transition-colors flex-shrink-0"
          aria-label="Edit category name"
        >
          <FontAwesomeIcon icon={faPencil} class="w-3 h-3" />
        </button>
      {/if}
    </div>
  {/if}
{/snippet}

{#snippet categorySkills(categoryIndex: number)}
  <SkillTagsEditor
    bind:skills={categories[categoryIndex].skills}
    {levelOptions}
    {versionSlugs}
    {hasAnyLevel}
    {hasAnyExperience}
    {hasAnyVersionTags}
    bind:showLevel
    bind:showExperience
    bind:showVersionTags
    bind:reorderMode
    oncreate={onskillcreate
      ? (skill) => onskillcreate(categories[categoryIndex], skill)
      : undefined}
    onupdate={onskillupdate
      ? (skill) => onskillupdate(categories[categoryIndex], skill)
      : undefined}
    onremove={onskillremove
      ? (skill) => onskillremove(categories[categoryIndex], skill)
      : undefined}
    onreorder={onskillreorder
      ? (skills) => onskillreorder(categories[categoryIndex], skills)
      : undefined}
  />
{/snippet}

{#if compact}
  <div class="divide-y divide-[var(--dash-border)]">
    {#each categories as category, categoryIndex}
      <div
        class={expandedItems.has(categoryIndex)
          ? "border-l-2 border-l-[var(--dash-primary)]"
          : ""}
      >
        <div
          class="flex items-center justify-between hover:bg-[var(--dash-bg)] transition-colors"
        >
          <button
            type="button"
            onclick={() => {
              if (editingNameIndex !== categoryIndex) toggleItem(categoryIndex);
            }}
            class="flex-1 self-stretch text-left p-3 sm:p-4"
          >
            {@render categoryHeader(categoryIndex)}
          </button>
          <div class="flex items-center gap-2">
            <button
              type="button"
              onclick={() => removeCategory(categoryIndex)}
              class="px-3 py-1.5 text-xs bg-red-500/10 border border-red-500/30 rounded-lg text-red-500 hover:bg-red-500/20 hover:border-red-500/50 hover:text-red-600 transition-colors flex items-center gap-1.5 flex-shrink-0"
              aria-label="Remove category"
            >
              <FontAwesomeIcon icon={faTrash} class="w-3 h-3" />
              <span class="hidden sm:inline">Remove</span>
            </button>
            <button
              type="button"
              onclick={() => toggleItem(categoryIndex)}
              class="p-1"
              aria-label={expandedItems.has(categoryIndex) ? "Collapse" : "Expand"}
            >
              <FontAwesomeIcon
                icon={expandedItems.has(categoryIndex)
                  ? faChevronUp
                  : faChevronDown}
                class="w-4 h-4 text-[var(--dash-text-muted)]"
              />
            </button>
          </div>
        </div>

        {#if expandedItems.has(categoryIndex)}
          <div class="px-3 sm:px-4 py-4">
            {@render categorySkills(categoryIndex)}
          </div>
        {/if}
      </div>
    {/each}

    <div class="p-3 sm:p-4">
      <button
        type="button"
        onclick={() => addCategory()}
        class="w-full py-2 text-sm text-[var(--dash-primary)] hover:text-[var(--dash-primary-hover)] border border-dashed border-[var(--dash-border)] rounded-lg hover:border-[var(--dash-primary)]/40 transition-colors flex items-center justify-center gap-1"
      >
        <FontAwesomeIcon icon={faPlus} class="w-3 h-3" />
        Add category
      </button>
    </div>
  </div>
{:else}
  {#each categories as category, categoryIndex}
    <Card class="p-3 sm:p-4">
      <div class="flex items-center justify-between mb-3 gap-2">
        {@render categoryHeader(categoryIndex)}
        <button
          type="button"
          onclick={() => removeCategory(categoryIndex)}
          class="px-3 py-1.5 text-xs bg-red-500/10 border border-red-500/30 rounded-lg text-red-500 hover:bg-red-500/20 hover:border-red-500/50 hover:text-red-600 transition-colors flex items-center gap-1.5 flex-shrink-0"
          aria-label="Remove category"
        >
          <FontAwesomeIcon icon={faTrash} class="w-3 h-3" />
          <span class="hidden sm:inline">Remove</span>
        </button>
      </div>

      {@render categorySkills(categoryIndex)}
    </Card>
  {/each}

  <button
    type="button"
    onclick={() => addCategory()}
    class="w-full py-2 text-sm text-[var(--dash-primary)] hover:text-[var(--dash-primary-hover)] border border-dashed border-[var(--dash-border)] rounded-lg hover:border-[var(--dash-primary)]/40 transition-colors flex items-center justify-center gap-1"
  >
    <FontAwesomeIcon icon={faPlus} class="w-3 h-3" />
    Add category
  </button>
{/if}
