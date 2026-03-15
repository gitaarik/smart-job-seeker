<script lang="ts">
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faChevronDown,
    faChevronUp,
    faCode,
    faPlus,
    faXmark,
  } from "@fortawesome/free-solid-svg-icons";
  import type { SkillCategory } from "$lib/server/resume/types";
  import Card from "../../../../components/Card.svelte";
  import SkillTagsEditor from "../../../../components/SkillTagsEditor.svelte";

  interface Props {
    skills: SkillCategory[];
  }

  let { skills = $bindable() }: Props = $props();

  let isExpanded = $state(false);

  function removeCategory(index: number) {
    if (!confirm("Remove this skill category?")) return;
    skills = skills.filter((_, i) => i !== index);
  }

  function addCategory() {
    skills = [...skills, { name: "", skills: [] }];
  }

  let totalSkills = $derived(
    skills.reduce((sum, cat) => sum + cat.skills.length, 0),
  );
</script>

<Card class="overflow-hidden">
  <button
    type="button"
    onclick={() => (isExpanded = !isExpanded)}
    class="w-full flex items-center justify-between p-3 sm:p-4 hover:bg-[var(--dash-bg)] transition-colors"
  >
    <div class="flex items-center gap-3">
      <div
        class="w-10 h-10 rounded-lg bg-[var(--dash-primary)]/10 flex items-center justify-center"
      >
        <FontAwesomeIcon
          icon={faCode}
          class="w-5 h-5 text-[var(--dash-primary)]"
        />
      </div>
      <span class="font-semibold text-base text-[var(--dash-text)]"
      >Skills</span>
      <span class="text-sm text-[var(--dash-text-secondary)]">
        ({skills.length} categories, {totalSkills} skills)
      </span>
    </div>
    <FontAwesomeIcon
      icon={isExpanded ? faChevronUp : faChevronDown}
      class="w-4 h-4 text-[var(--dash-text-muted)]"
    />
  </button>

  {#if isExpanded}
    <div class="border-t border-[var(--dash-border)] p-3 sm:p-4 space-y-4">
      {#each skills as category, categoryIndex}
        <div class="border border-[var(--dash-border)] rounded-lg p-3 sm:p-4">
          <div class="flex items-center justify-between mb-3">
            <input
              type="text"
              bind:value={skills[categoryIndex].name}
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

          <SkillTagsEditor bind:skills={skills[categoryIndex].skills} />
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
    </div>
  {/if}
</Card>
