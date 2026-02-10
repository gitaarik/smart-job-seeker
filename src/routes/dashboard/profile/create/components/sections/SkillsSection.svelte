<script lang="ts">
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faChevronDown,
    faChevronUp,
    faCode,
    faTrash,
  } from "@fortawesome/free-solid-svg-icons";
  import type { SkillCategory } from "$lib/server/resume/types";

  interface Props {
    skills: SkillCategory[];
  }

  let { skills = $bindable() }: Props = $props();

  let isExpanded = $state(false);

  function removeCategory(index: number) {
    skills = skills.filter((_, i) => i !== index);
  }

  function removeSkill(categoryIndex: number, skillIndex: number) {
    skills[categoryIndex].skills = skills[categoryIndex].skills.filter(
      (_, i) => i !== skillIndex,
    );
  }

  // Count total skills
  let totalSkills = $derived(
    skills.reduce((sum, cat) => sum + cat.skills.length, 0),
  );
</script>

<div class="border border-light rounded-lg overflow-hidden">
  <button
    type="button"
    onclick={() => (isExpanded = !isExpanded)}
    class="w-full flex items-center justify-between p-4 bg-snow hover:bg-light/30 transition-colors"
  >
    <div class="flex items-center gap-3">
      <div
        class="w-8 h-8 rounded-full bg-ocean/10 flex items-center justify-center"
      >
        <FontAwesomeIcon icon={faCode} class="w-4 h-4 text-ocean" />
      </div>
      <span class="font-medium text-slate">Skills</span>
      <span class="text-sm text-pearl">
        ({skills.length} categories, {totalSkills} skills)
      </span>
    </div>
    <FontAwesomeIcon
      icon={isExpanded ? faChevronUp : faChevronDown}
      class="w-4 h-4 text-pearl"
    />
  </button>

  {#if isExpanded}
    <div class="border-t border-light p-4 space-y-4">
      {#each skills as category, categoryIndex}
        <div class="border border-light rounded-lg p-4">
          <div class="flex items-center justify-between mb-3">
            <input
              type="text"
              bind:value={skills[categoryIndex].name}
              class="font-medium text-slate bg-transparent border-none focus:outline-none focus:ring-0 p-0"
            />
            <button
              type="button"
              onclick={() => removeCategory(categoryIndex)}
              class="p-1 text-pearl hover:text-crimson transition-colors"
              aria-label="Remove category"
            >
              <FontAwesomeIcon icon={faTrash} class="w-4 h-4" />
            </button>
          </div>

          <div class="flex flex-wrap gap-2">
            {#each category.skills as skill, skillIndex}
              <div
                class="flex items-center gap-1 px-3 py-1 bg-ocean/10 rounded-full text-sm"
              >
                <span class="text-slate">{skill.name}</span>
                {#if skill.level}
                  <span class="text-pearl">({skill.level})</span>
                {/if}
                <button
                  type="button"
                  onclick={() => removeSkill(categoryIndex, skillIndex)}
                  class="ml-1 text-pearl hover:text-crimson transition-colors"
                  aria-label="Remove skill"
                >
                  <FontAwesomeIcon icon={faTrash} class="w-3 h-3" />
                </button>
              </div>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
