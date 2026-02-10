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
        <FontAwesomeIcon icon={faLanguage} class="w-4 h-4 text-ocean" />
      </div>
      <span class="font-medium text-slate">Languages</span>
      <span class="text-sm text-pearl">({languages.length})</span>
    </div>
    <FontAwesomeIcon
      icon={isExpanded ? faChevronUp : faChevronDown}
      class="w-4 h-4 text-pearl"
    />
  </button>

  {#if isExpanded}
    <div class="border-t border-light p-4 space-y-3">
      {#each languages as lang, index}
        <div class="flex items-center gap-3">
          <input
            type="text"
            bind:value={languages[index].name}
            placeholder="Language"
            class="flex-1 px-3 py-2 border border-light rounded-lg focus:outline-none focus:ring-2 focus:ring-ocean focus:border-ocean bg-snow text-slate"
          />

          <select
            bind:value={languages[index].proficiency}
            class="px-3 py-2 border border-light rounded-lg focus:outline-none focus:ring-2 focus:ring-ocean focus:border-ocean bg-snow text-slate"
          >
            <option value="">Proficiency</option>
            {#each proficiencyOptions as option}
              <option value={option.value}>{option.label}</option>
            {/each}
          </select>

          <button
            type="button"
            onclick={() => removeItem(index)}
            class="p-2 text-pearl hover:text-crimson transition-colors"
            aria-label="Remove language"
          >
            <FontAwesomeIcon icon={faTrash} class="w-4 h-4" />
          </button>
        </div>
      {/each}
    </div>
  {/if}
</div>
