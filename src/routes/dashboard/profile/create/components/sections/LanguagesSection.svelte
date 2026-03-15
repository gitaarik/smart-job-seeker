<script lang="ts">
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faChevronDown,
    faChevronUp,
    faLanguage,
    faTrash,
  } from "@fortawesome/free-solid-svg-icons";
  import type { Language } from "$lib/server/resume/types";

  interface Props {
    languages: Language[];
  }

  let { languages = $bindable() }: Props = $props();

  let isExpanded = $state(false);

  function removeItem(index: number) {
    languages = languages.filter((_, i) => i !== index);
  }

  const proficiencyOptions = [
    { value: "native", label: "Native" },
    { value: "fluent", label: "Fluent" },
    { value: "proficient", label: "Proficient" },
    { value: "conversational", label: "Conversational" },
    { value: "basic", label: "Basic" },
  ];
</script>

<div
  class="bg-[var(--dash-card)] rounded-lg border border-[var(--dash-border)] overflow-hidden"
>
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
          icon={faLanguage}
          class="w-5 h-5 text-[var(--dash-primary)]"
        />
      </div>
      <span class="font-semibold text-base text-[var(--dash-text)]">Languages</span>
      <span class="text-sm text-[var(--dash-text-secondary)]"
        >({languages.length})</span
      >
    </div>
    <FontAwesomeIcon
      icon={isExpanded ? faChevronUp : faChevronDown}
      class="w-4 h-4 text-[var(--dash-text-muted)]"
    />
  </button>

  {#if isExpanded}
    <div class="border-t border-[var(--dash-border)] p-3 sm:p-4 space-y-3">
      {#each languages as lang, index}
        <div class="flex items-center gap-3">
          <input
            type="text"
            bind:value={languages[index].name}
            placeholder="Language"
            class="flex-1 px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
          />

          <select
            bind:value={languages[index].proficiency}
            class="px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
          >
            <option value="">Proficiency</option>
            {#each proficiencyOptions as option}
              <option value={option.value}>{option.label}</option>
            {/each}
          </select>

          <button
            type="button"
            onclick={() => removeItem(index)}
            class="p-2 text-[var(--dash-text-muted)] hover:text-[var(--dash-error)] transition-colors"
            aria-label="Remove language"
          >
            <FontAwesomeIcon icon={faTrash} class="w-4 h-4" />
          </button>
        </div>
      {/each}
    </div>
  {/if}
</div>
