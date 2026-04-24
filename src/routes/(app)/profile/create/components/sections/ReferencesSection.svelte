<script lang="ts">
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faChevronDown,
    faChevronUp,
    faPlus,
    faQuoteLeft,
    faTrash,
  } from "@fortawesome/free-solid-svg-icons";
  import type { Reference } from "$lib/server/resume/types";
  import Card from "../../../../components/Card.svelte";

  interface Props {
    references: Reference[];
  }

  let { references = $bindable() }: Props = $props();

  let isExpanded = $state(false);
  let expandedItems = $state<Set<number>>(new Set());

  function toggleItem(index: number) {
    if (expandedItems.has(index)) {
      expandedItems.delete(index);
    } else {
      expandedItems.add(index);
    }
    expandedItems = new Set(expandedItems);
  }

  function removeItem(index: number) {
    if (!confirm("Remove this reference?")) return;
    references = references.filter((_, i) => i !== index);
  }

  function addReference() {
    references = [...references, { author: "", text: "" }];
    expandedItems.add(references.length - 1);
    expandedItems = new Set(expandedItems);
    isExpanded = true;
  }
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
    <div
      class="border-t border-[var(--dash-border)] divide-y divide-[var(--dash-border)]"
    >
      {#each references as ref, index}
        <div
          class={expandedItems.has(index)
            ? "border-l-2 border-l-[var(--dash-primary)]"
            : ""}
        >
          <div
            class="flex items-center justify-between hover:bg-[var(--dash-bg)] transition-colors"
          >
            <button
              type="button"
              onclick={() => toggleItem(index)}
              class="flex-1 self-stretch text-left p-3 sm:p-4"
            >
              <div class="font-semibold text-[var(--dash-text)] text-sm">
                {ref.author || "Author"}
              </div>
              {#if ref.authorPosition}
                <div class="text-xs sm:text-sm text-[var(--dash-text-secondary)]">
                  {ref.authorPosition}
                </div>
              {/if}
            </button>
            <div class="flex items-center gap-2">
              <button
                type="button"
                onclick={() => removeItem(index)}
                class="px-3 py-1.5 text-xs bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-lg text-[var(--dash-text)] hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-500 transition-colors flex items-center gap-1.5"
                aria-label="Remove"
              >
                <FontAwesomeIcon icon={faTrash} class="w-3 h-3" />
                <span class="hidden sm:inline">Remove</span>
              </button>
              <button
                type="button"
                onclick={() => toggleItem(index)}
                class="p-1"
                aria-label={expandedItems.has(index) ? "Collapse" : "Expand"}
              >
                <FontAwesomeIcon
                  icon={expandedItems.has(index)
                    ? faChevronUp
                    : faChevronDown}
                  class="w-4 h-4 text-[var(--dash-text-muted)]"
                />
              </button>
            </div>
          </div>

          {#if expandedItems.has(index)}
            <div class="px-3 sm:px-4 py-4 space-y-4">
              <div class="grid gap-4 md:grid-cols-2">
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
          {/if}
        </div>
      {/each}

      <div class="p-3 sm:p-4">
        <button
          type="button"
          onclick={addReference}
          class="w-full py-2 text-sm text-[var(--dash-primary)] hover:text-[var(--dash-primary-hover)] border border-dashed border-[var(--dash-border)] rounded-lg hover:border-[var(--dash-primary)]/40 transition-colors flex items-center justify-center gap-1"
        >
          <FontAwesomeIcon icon={faPlus} class="w-3 h-3" />
          Add reference
        </button>
      </div>
    </div>
  {/if}
</Card>
