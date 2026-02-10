<script lang="ts">
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faChevronDown,
    faChevronUp,
    faQuoteLeft,
    faTrash,
  } from "@fortawesome/free-solid-svg-icons";
  import type { Reference } from "$lib/server/resume/types";

  interface Props {
    references: Reference[];
  }

  let { references = $bindable() }: Props = $props();

  let isExpanded = $state(false);

  function removeItem(index: number) {
    references = references.filter((_, i) => i !== index);
  }
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
        <FontAwesomeIcon icon={faQuoteLeft} class="w-4 h-4 text-ocean" />
      </div>
      <span class="font-medium text-slate">References</span>
      <span class="text-sm text-pearl">({references.length})</span>
    </div>
    <FontAwesomeIcon
      icon={isExpanded ? faChevronUp : faChevronDown}
      class="w-4 h-4 text-pearl"
    />
  </button>

  {#if isExpanded}
    <div class="border-t border-light p-4 space-y-4">
      {#each references as ref, index}
        <div class="border border-light rounded-lg p-4">
          <div class="flex items-start justify-between gap-3 mb-3">
            <div class="flex-1 grid gap-3 md:grid-cols-2">
              <div>
                <label class="block text-sm font-medium text-slate mb-1">
                  Author
                </label>
                <input
                  type="text"
                  bind:value={references[index].author}
                  class="w-full px-3 py-2 border border-light rounded-lg focus:outline-none focus:ring-2 focus:ring-ocean focus:border-ocean bg-snow text-slate"
                />
              </div>

              <div>
                <label class="block text-sm font-medium text-slate mb-1">
                  Position
                </label>
                <input
                  type="text"
                  bind:value={references[index].authorPosition}
                  class="w-full px-3 py-2 border border-light rounded-lg focus:outline-none focus:ring-2 focus:ring-ocean focus:border-ocean bg-snow text-slate"
                />
              </div>
            </div>

            <button
              type="button"
              onclick={() => removeItem(index)}
              class="p-2 text-pearl hover:text-crimson transition-colors"
              aria-label="Remove reference"
            >
              <FontAwesomeIcon icon={faTrash} class="w-4 h-4" />
            </button>
          </div>

          <div>
            <label class="block text-sm font-medium text-slate mb-1">
              Reference Text
            </label>
            <textarea
              bind:value={references[index].text}
              rows="3"
              class="w-full px-3 py-2 border border-light rounded-lg focus:outline-none focus:ring-2 focus:ring-ocean focus:border-ocean bg-snow text-slate resize-none"
            ></textarea>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
