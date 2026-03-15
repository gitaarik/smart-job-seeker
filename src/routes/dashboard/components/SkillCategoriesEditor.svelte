<script lang="ts">
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import { faPlus, faXmark } from "@fortawesome/free-solid-svg-icons";
  import SkillTagsEditor from "./SkillTagsEditor.svelte";
  import type { SkillItem } from "./SkillTagsEditor.svelte";

  export interface CategoryItem {
    name: string;
    skills: SkillItem[];
  }

  interface Props {
    categories: CategoryItem[];
    oncreate?: (category: CategoryItem) => void;
    onrename?: (category: CategoryItem) => void;
    onremove?: (category: CategoryItem) => void;
    onskillcreate?: (category: CategoryItem, skill: SkillItem) => void;
    onskillupdate?: (category: CategoryItem, skill: SkillItem) => void;
    onskillremove?: (category: CategoryItem, skill: SkillItem) => void;
  }

  let {
    categories = $bindable(),
    oncreate,
    onrename,
    onremove,
    onskillcreate,
    onskillupdate,
    onskillremove,
  }: Props = $props();

  // Track which categories are newly added (not yet persisted)
  let newIndices = $state(new Set<number>());
  // Track original names for rename detection
  let originalNames = $state(new Map<number, string>());

  function addCategory() {
    const newCat: CategoryItem = { name: "", skills: [] };
    categories = [...categories, newCat];
    const idx = categories.length - 1;
    newIndices = new Set([...newIndices, idx]);
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

{#each categories as category, categoryIndex}
  <div class="border border-[var(--dash-border)] rounded-lg p-3 sm:p-4">
    <div class="flex items-center justify-between mb-3">
      <input
        type="text"
        bind:value={categories[categoryIndex].name}
        onfocus={() => handleNameFocus(categoryIndex)}
        onblur={() => handleNameBlur(categoryIndex)}
        placeholder="Category name"
        class="font-medium text-[var(--dash-text)] bg-transparent border-none focus:outline-none focus:ring-0 p-0"
      />
      <button
        type="button"
        onclick={() => removeCategory(categoryIndex)}
        class="px-3 py-1.5 text-xs bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-lg text-[var(--dash-text)] hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-500 transition-colors flex items-center gap-1.5"
        aria-label="Remove category"
      >
        <FontAwesomeIcon icon={faXmark} class="w-3 h-3" />
        <span class="hidden sm:inline">Remove</span>
      </button>
    </div>

    <SkillTagsEditor
      bind:skills={categories[categoryIndex].skills}
      oncreate={onskillcreate
        ? (skill) => onskillcreate(categories[categoryIndex], skill)
        : undefined}
      onupdate={onskillupdate
        ? (skill) => onskillupdate(categories[categoryIndex], skill)
        : undefined}
      onremove={onskillremove
        ? (skill) => onskillremove(categories[categoryIndex], skill)
        : undefined}
    />
  </div>
{/each}

<button
  type="button"
  onclick={() => addCategory()}
  class="w-full py-2 text-sm text-[var(--dash-primary)] hover:text-[var(--dash-primary-hover)] border border-dashed border-[var(--dash-border)] rounded-lg hover:border-[var(--dash-primary)]/40 transition-colors flex items-center justify-center gap-1"
>
  <FontAwesomeIcon icon={faPlus} class="w-3 h-3" />
  Add category
</button>
