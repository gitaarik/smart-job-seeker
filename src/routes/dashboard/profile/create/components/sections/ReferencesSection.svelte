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
          icon={faQuoteLeft}
          class="w-5 h-5 text-[var(--dash-primary)]"
        />
      </div>
      <span class="font-semibold text-base text-[var(--dash-text)]">References</span>
      <span class="text-sm text-[var(--dash-text-secondary)]"
        >({references.length})</span
      >
    </div>
    <FontAwesomeIcon
      icon={isExpanded ? faChevronUp : faChevronDown}
      class="w-4 h-4 text-[var(--dash-text-muted)]"
    />
  </button>

  {#if isExpanded}
    <div class="border-t border-[var(--dash-border)] p-3 sm:p-4 space-y-4">
      {#each references as ref, index}
        <div class="border border-[var(--dash-border)] rounded-lg p-3 sm:p-4">
          <div class="flex items-start justify-between gap-3 mb-3">
            <div class="flex-1 grid gap-3 md:grid-cols-2">
              <div>
                <label
                  class="block text-sm font-medium text-[var(--dash-text)] mb-1"
                >
                  Author
                </label>
                <input
                  type="text"
                  bind:value={references[index].author}
                  class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
                />
              </div>

              <div>
                <label
                  class="block text-sm font-medium text-[var(--dash-text)] mb-1"
                >
                  Position
                </label>
                <input
                  type="text"
                  bind:value={references[index].authorPosition}
                  class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
                />
              </div>
            </div>

            <button
              type="button"
              onclick={() => removeItem(index)}
              class="px-3 py-1.5 text-xs bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-lg text-[var(--dash-text)] hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-500 transition-colors flex items-center gap-1.5"
              aria-label="Remove reference"
            >
              <FontAwesomeIcon icon={faTrash} class="w-3 h-3" />
              <span class="hidden sm:inline">Remove</span>
            </button>
          </div>

          <div>
            <label
              class="block text-sm font-medium text-[var(--dash-text)] mb-1"
            >
              Reference Text
            </label>
            <textarea
              bind:value={references[index].text}
              rows="3"
              class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent resize-none"
            ></textarea>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
