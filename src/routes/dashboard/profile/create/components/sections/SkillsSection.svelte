<script lang="ts">
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faChevronDown,
    faChevronUp,
    faCode,
  } from "@fortawesome/free-solid-svg-icons";
  import type { SkillCategory } from "$lib/server/resume/types";
  import Card from "../../../../components/Card.svelte";
  import SkillCategoriesEditor from "../../../../components/SkillCategoriesEditor.svelte";

  interface Props {
    skills: SkillCategory[];
  }

  let { skills = $bindable() }: Props = $props();

  let isExpanded = $state(false);

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
      <SkillCategoriesEditor bind:categories={skills} />
    </div>
  {/if}
</Card>
