<script lang="ts">
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faBan,
    faCheck,
    faChevronDown,
    faChevronRight,
    faChevronUp,
    faCircleNotch,
    faClone,
    faGripVertical,
    faPencil,
    faPlus,
    faTags,
    faTimes,
    faTrash,
  } from "@fortawesome/free-solid-svg-icons";
  import { dragHandleZone, dragHandle } from "svelte-dnd-action";
  import { flip } from "svelte/animate";
  import Card from "./Card.svelte";
  import SkillTagsEditor from "./SkillTagsEditor.svelte";
  import type { LevelOption, SkillItem } from "./SkillTagsEditor.svelte";
  import TranslatableField from "$lib/components/TranslatableField.svelte";

  export interface CategoryItem {
    name: string;
    tags?: string[] | null;
    note?: string | null;
    skills: SkillItem[];
  }

  interface Props {
    categories: CategoryItem[];
    levelOptions?: LevelOption[];
    versionSlugs?: string[];
    compact?: boolean;
    canCategoryReorder?: boolean;
    oncreate?: (category: CategoryItem) => void;
    onrename?: (category: CategoryItem) => void;
    onremove?: (category: CategoryItem) => void;
    onclone?: (category: CategoryItem) => void;
    oncategorytags?: (category: CategoryItem) => void;
    onskillcreate?: (category: CategoryItem, skill: SkillItem) => void;
    onskillupdate?: (category: CategoryItem, skill: SkillItem) => void;
    onskillremove?: (category: CategoryItem, skill: SkillItem) => void;
    onskillreorder?: (category: CategoryItem, skills: SkillItem[]) => void;
    oncategoryreorder?: (categories: CategoryItem[]) => void;
  }

  let {
    categories = $bindable(),
    levelOptions,
    versionSlugs = [],
    compact = false,
    canCategoryReorder = $bindable(false),
    oncreate,
    onrename,
    onremove,
    onclone,
    oncategorytags,
    onskillcreate,
    onskillupdate,
    onskillremove,
    onskillreorder,
    oncategoryreorder,
  }: Props = $props();

  // Expose whether category reorder is available to parent
  $effect(() => {
    canCategoryReorder = !!oncategoryreorder && categories.length > 1 && !categoryReorderMode;
  });

  // Shared toggle state across all categories
  let showLevel = $state(false);
  let showExperience = $state(false);
  let showVersionTags = $state(false);
  let reorderMode = $state(false);

  // Category reorder mode
  let categoryReorderMode = $state(false);
  let categoryReorderSaving = $state(false);
  let categoryReorderSnapshot = $state<CategoryItem[] | null>(null);

  interface DndCategoryItem {
    id: string;
    category: CategoryItem;
    [key: string]: unknown;
  }

  let dndCategories = $state<DndCategoryItem[]>([]);

  const catFlipDurationMs = 150;

  function handleCatDndConsider(e: CustomEvent<{ items: DndCategoryItem[] }>) {
    dndCategories = e.detail.items;
  }

  function handleCatDndFinalize(e: CustomEvent<{ items: DndCategoryItem[] }>) {
    dndCategories = e.detail.items;
    categories = dndCategories.map((d) => d.category);
  }

  export function startCategoryReorder() {
    categoryReorderSnapshot = categories.map((c) => ({ ...c }));
    dndCategories = categories.map((c, i) => ({
      id: (c as { id?: number }).id ? String((c as { id?: number }).id) : `cat-${i}`,
      category: c,
    }));
    categoryReorderMode = true;
  }

  function confirmCategoryReorder() {
    categoryReorderSaving = true;
    // Rebuild categories from dndCategories to ensure correct order
    const reordered = dndCategories.map((d) => {
      // Preserve the original DB id on the category object, since
      // svelte-dnd-action may clone items and lose nested properties
      const cat = { ...d.category };
      const numId = parseInt(d.id);
      if (!isNaN(numId)) (cat as CategoryItem & { id: number }).id = numId;
      return cat;
    });
    categories = reordered;
    oncategoryreorder?.(reordered);
    categoryReorderSaving = false;
    categoryReorderSnapshot = null;
    categoryReorderMode = false;
  }

  function cancelCategoryReorder() {
    if (categoryReorderSnapshot) {
      categories = categoryReorderSnapshot;
    }
    categoryReorderSnapshot = null;
    categoryReorderMode = false;
  }

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
  // Track original name + note for revert/dirty detection while editing
  let originalNames = $state(new Map<number, string>());
  let originalNotes = $state(new Map<number, string>());
  // Track which category (name + note) is being edited inline
  let editingNameIndex = $state<number | null>(null);

  function addCategory() {
    const newCat: CategoryItem = { name: "", note: "", skills: [] };
    categories = [...categories, newCat];
    const idx = categories.length - 1;
    newIndices = new Set([...newIndices, idx]);
    editingNameIndex = idx;
    if (compact) expandedItems = new Set([...expandedItems, idx]);
  }

  function startEditingName(index: number) {
    if (!newIndices.has(index)) {
      if (!originalNames.has(index)) {
        originalNames = new Map([...originalNames, [index, categories[index].name]]);
      }
      originalNotes = new Map([...originalNotes, [index, categories[index].note ?? ""]]);
    }
    editingNameIndex = index;
  }

  function saveEditingName(index: number) {
    commitEditing(index);
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
    } else {
      // Revert name + note to their snapshots
      if (originalNames.has(index)) {
        categories[index].name = originalNames.get(index)!;
        const m = new Map(originalNames);
        m.delete(index);
        originalNames = m;
      }
      if (originalNotes.has(index)) {
        categories[index].note = originalNotes.get(index)!;
        const m = new Map(originalNotes);
        m.delete(index);
        originalNotes = m;
      }
    }
    editingNameIndex = null;
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

  function cloneCategory(index: number) {
    // Only persisted categories can be cloned server-side.
    if (newIndices.has(index)) return;
    onclone?.(categories[index]);
  }

  function commitEditing(index: number) {
    const cat = categories[index];
    if (newIndices.has(index)) {
      if (cat.name.trim()) {
        oncreate?.(cat); // persists name + note
        const updated = new Set(newIndices);
        updated.delete(index);
        newIndices = updated;
      }
    } else {
      const origName = originalNames.get(index);
      const origNote = originalNotes.get(index) ?? "";
      const nameChanged = origName !== undefined && cat.name !== origName;
      const noteChanged = (cat.note ?? "") !== origNote;
      if (cat.name.trim() && (nameChanged || noteChanged)) {
        onrename?.(cat); // updates name + note together
      }
      if (originalNames.has(index)) {
        const m = new Map(originalNames);
        m.delete(index);
        originalNames = m;
      }
      if (originalNotes.has(index)) {
        const m = new Map(originalNotes);
        m.delete(index);
        originalNotes = m;
      }
    }
  }

  // Category version tags
  const builtinTags = ["resume", "cv"];
  let tagsExpanded = $state<Set<number>>(new Set());

  function toggleTagExpand(index: number) {
    if (tagsExpanded.has(index)) tagsExpanded.delete(index);
    else tagsExpanded.add(index);
    tagsExpanded = new Set(tagsExpanded);
  }


  function catTags(index: number): string[] {
    return categories[index].tags ?? [];
  }

  // The version/template slug of a tag, ignoring a leading "!" negation marker.
  function tagSlug(tag: string): string {
    return tag.replace(/^!/, "").trim().toLowerCase();
  }

  function catTagSuggestions(index: number): string[] {
    const used = new Set(catTags(index).map(tagSlug));
    const all = [
      ...builtinTags,
      ...versionSlugs.filter((v) => !builtinTags.includes(v.toLowerCase())),
    ];
    return all.filter((s) => !used.has(s.toLowerCase()));
  }

  function addCategoryTag(index: number, tag: string) {
    const trimmed = tag.trim();
    if (!trimmed) return;
    const slug = tagSlug(trimmed);
    const current = categories[index].tags ?? [];
    // Skip if this version is already tagged in either include or exclude form.
    if (current.some((t) => tagSlug(t) === slug)) return;
    categories[index].tags = [...current, trimmed];
    oncategorytags?.(categories[index]);
  }

  function removeCategoryTag(index: number, tag: string) {
    const next = (categories[index].tags ?? []).filter((t) => t !== tag);
    categories[index].tags = next.length ? next : null;
    oncategorytags?.(categories[index]);
  }
</script>

{#snippet reorderConfirmCancel()}
  <div class="flex items-center justify-end gap-2">
    <span class="text-xs text-[var(--dash-text-muted)]">Reorder Categories</span>
    <button
      type="button"
      onclick={cancelCategoryReorder}
      class="px-3 py-1 border border-[var(--dash-border)] text-[var(--dash-text)] rounded-lg hover:bg-[var(--dash-bg)] transition-colors text-xs"
    >
      Cancel
    </button>
    <button
      type="button"
      onclick={confirmCategoryReorder}
      disabled={categoryReorderSaving}
      class="px-3 py-1 bg-[var(--dash-success)] text-white rounded-lg hover:opacity-90 transition-colors text-xs inline-flex items-center gap-1.5 disabled:opacity-70"
    >
      {#if categoryReorderSaving}<FontAwesomeIcon icon={faCircleNotch} spin class="w-3 h-3" />{/if}
      Save
    </button>
  </div>
{/snippet}

{#snippet categoryHeader(categoryIndex: number)}
  {#if editingNameIndex === categoryIndex}
    {@const catId = (categories[categoryIndex] as { id?: number }).id ?? 0}
    <div class="flex flex-col gap-1.5 w-full min-w-0">
      <TranslatableField
        entity="tech_skill_category"
        id={catId}
        field="name"
        bind:value={categories[categoryIndex].name}
        placeholder="Category name"
        onkeydown={(e) => {
          if (e.key === "Enter") saveEditingName(categoryIndex);
          if (e.key === "Escape") cancelEditingName(categoryIndex);
        }}
      />
      <input
        type="text"
        bind:value={categories[categoryIndex].note}
        onkeydown={(e) => {
          if (e.key === "Enter") saveEditingName(categoryIndex);
          if (e.key === "Escape") cancelEditingName(categoryIndex);
        }}
        placeholder="Note (private hint — which versions this is for)"
        class="px-3 py-1.5 text-sm italic text-[var(--dash-text)] border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent w-full sm:w-72"
      />
      <div class="flex items-center gap-1 flex-shrink-0">
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
    </div>
  {:else}
    {@const noteText = categories[categoryIndex].note?.trim()}
    <div class="flex items-baseline gap-2 min-w-0">
      <h3 class="text-base font-semibold text-[var(--dash-text)] truncate flex-shrink-0 max-w-full">
        {categories[categoryIndex].name || "Untitled category"}
      </h3>
      {#if noteText}
        <span
          class="text-xs font-normal italic text-[var(--dash-text-muted)]"
          title={noteText}
        >
          {noteText}
        </span>
      {/if}
      {#if !compact}
        <button
          type="button"
          onclick={() => startEditingName(categoryIndex)}
          class="p-1 text-[var(--dash-text-muted)] hover:text-[var(--dash-primary)] transition-colors flex-shrink-0 self-center"
          aria-label="Edit category name and note"
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

{#snippet categoryVersionTags(categoryIndex: number)}
  {#if versionSlugs.length > 0}
    {@const tags = catTags(categoryIndex)}
    {@const suggestions = catTagSuggestions(categoryIndex)}
    {@const expanded = tagsExpanded.has(categoryIndex)}
    <div class="mt-5 mb-1">
      <button
        type="button"
        onclick={() => toggleTagExpand(categoryIndex)}
        class="flex items-center gap-1 text-[10px] uppercase tracking-wide text-[var(--dash-text-muted)] hover:text-[var(--dash-text-secondary)] transition-colors mb-1"
      >
        <FontAwesomeIcon icon={expanded ? faChevronDown : faChevronRight} class="w-2 h-2" />
        <FontAwesomeIcon icon={faTags} class="w-2.5 h-2.5" />
        Resume / CV Versions
        {#if !expanded && tags.length > 0}
          <span class="normal-case text-[var(--dash-primary)]">({
            tags.map((t) => t.startsWith("!") ? `not ${t.slice(1)}` : t).join(", ")
          })</span>
        {/if}
      </button>
      {#if expanded}
        {#if tags.length > 0}
          <div class="flex flex-wrap gap-1.5 mb-1.5">
            {#each tags as tag}
              {@const isNeg = tag.startsWith("!")}
              <button
                type="button"
                onclick={() => removeCategoryTag(categoryIndex, tag)}
                class="inline-flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors cursor-pointer border hover:bg-red-500/15 hover:text-red-500 hover:border-red-500/30 {isNeg
                  ? 'bg-red-500/10 text-red-600 border-red-500/25'
                  : 'bg-[var(--dash-primary)]/10 text-[var(--dash-primary)] border-[var(--dash-primary)]/20'}"
              >
                {#if isNeg}
                  <FontAwesomeIcon icon={faBan} class="w-2.5 h-2.5" />
                {/if}
                {isNeg ? tag.slice(1) : tag}
                <FontAwesomeIcon icon={faTimes} class="w-2.5 h-2.5" />
              </button>
            {/each}
          </div>
        {:else}
          <p class="text-[10px] text-[var(--dash-text-muted)] italic mb-1.5">Shown on all versions</p>
        {/if}
        {#if suggestions.length > 0}
          <p class="text-[10px] uppercase tracking-wide text-[var(--dash-text-muted)] mb-1">Show only on</p>
          <div class="flex flex-wrap gap-1.5 mb-2">
            {#each suggestions as suggestion}
              <button
                type="button"
                onclick={() => addCategoryTag(categoryIndex, suggestion)}
                class="inline-flex items-center gap-1 px-2 py-1 text-xs rounded bg-[var(--dash-bg)] text-[var(--dash-text-secondary)] border border-[var(--dash-border)] hover:border-[var(--dash-primary)]/40 hover:text-[var(--dash-primary)] transition-colors"
              >
                <FontAwesomeIcon icon={faPlus} class="w-2.5 h-2.5" />
                {suggestion}
              </button>
            {/each}
          </div>
          <p class="text-[10px] uppercase tracking-wide text-[var(--dash-text-muted)] mb-1">Exclude from</p>
          <div class="flex flex-wrap gap-1.5">
            {#each suggestions as suggestion}
              <button
                type="button"
                onclick={() => addCategoryTag(categoryIndex, "!" + suggestion)}
                class="inline-flex items-center gap-1 px-2 py-1 text-xs rounded bg-[var(--dash-bg)] text-[var(--dash-text-secondary)] border border-[var(--dash-border)] hover:border-red-500/40 hover:text-red-500 transition-colors"
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
            {#if onclone}
              <button
                type="button"
                onclick={() => cloneCategory(categoryIndex)}
                class="px-3 py-1.5 text-xs bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-lg text-[var(--dash-text-secondary)] hover:text-[var(--dash-primary)] hover:border-[var(--dash-primary)]/40 transition-colors flex items-center gap-1.5 flex-shrink-0"
                aria-label="Clone category"
              >
                <FontAwesomeIcon icon={faClone} class="w-3 h-3" />
                <span class="hidden sm:inline">Clone</span>
              </button>
            {/if}
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
            {@render categoryVersionTags(categoryIndex)}
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
  {#if categoryReorderMode}
    {@render reorderConfirmCancel()}
    <div
      class="space-y-2 mt-2"
      use:dragHandleZone={{ items: dndCategories, flipDurationMs: catFlipDurationMs, type: "categories" }}
      onconsider={handleCatDndConsider}
      onfinalize={handleCatDndFinalize}
    >
      {#each dndCategories as item (item.id)}
        <div animate:flip={{ duration: catFlipDurationMs }}>
          <Card class="p-3 sm:p-4">
            <div class="flex items-center gap-3">
              <div use:dragHandle class="cursor-grab active:cursor-grabbing touch-none p-1 -m-1">
                <FontAwesomeIcon
                  icon={faGripVertical}
                  class="w-4 h-4 text-[var(--dash-text-muted)] flex-shrink-0"
                />
              </div>
              <h3 class="text-base font-semibold text-[var(--dash-text)] truncate">
                {item.category.name || "Untitled category"}
              </h3>
              <span class="text-xs text-[var(--dash-text-muted)] flex-shrink-0">
                {item.category.skills.length} skill{item.category.skills.length === 1 ? "" : "s"}
              </span>
            </div>
          </Card>
        </div>
      {/each}
    </div>
    <div class="mt-2">
      {@render reorderConfirmCancel()}
    </div>
  {:else}
    {#each categories as category, categoryIndex}
      <Card class="p-3 sm:p-4">
        <div class="flex items-center justify-between mb-3 gap-2">
          {@render categoryHeader(categoryIndex)}
          <div class="flex items-center gap-2 flex-shrink-0">
            {#if onclone}
              <button
                type="button"
                onclick={() => cloneCategory(categoryIndex)}
                class="px-3 py-1.5 text-xs bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-lg text-[var(--dash-text-secondary)] hover:text-[var(--dash-primary)] hover:border-[var(--dash-primary)]/40 transition-colors flex items-center gap-1.5"
                aria-label="Clone category"
              >
                <FontAwesomeIcon icon={faClone} class="w-3 h-3" />
                <span class="hidden sm:inline">Clone</span>
              </button>
            {/if}
            <button
              type="button"
              onclick={() => removeCategory(categoryIndex)}
              class="px-3 py-1.5 text-xs bg-red-500/10 border border-red-500/30 rounded-lg text-red-500 hover:bg-red-500/20 hover:border-red-500/50 hover:text-red-600 transition-colors flex items-center gap-1.5"
              aria-label="Remove category"
            >
              <FontAwesomeIcon icon={faTrash} class="w-3 h-3" />
              <span class="hidden sm:inline">Remove</span>
            </button>
          </div>
        </div>

        {@render categorySkills(categoryIndex)}
        {@render categoryVersionTags(categoryIndex)}
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
{/if}
