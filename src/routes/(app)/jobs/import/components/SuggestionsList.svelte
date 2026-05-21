<script lang="ts" module>
  export type Suggestion = {
    platform_id: number;
    platform: string;
    platform_name: string;
    keywords: string | null;
    note: string;
    relevance: "high" | "medium" | "low";
    /** Stable per-row key — the LLM may return multiple suggestions sharing
     * the same platform_id, so platform_id alone is not unique. */
    _key: number;
    /** Local-only flag used to mark a card as accepted so we can show feedback
     * before fading it out. */
    accepted?: boolean;
    /** Local-only flag used while the create POST is in flight. */
    submitting?: boolean;
  };
</script>

<script lang="ts">
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faCheck,
    faMagicWandSparkles,
    faPlus,
  } from "@fortawesome/free-solid-svg-icons";
  import Spinner from "$lib/components/Spinner.svelte";

  let {
    suggestions,
    onAccept,
    onDismiss,
    onClearAll,
  }: {
    suggestions: Suggestion[];
    onAccept: (s: Suggestion) => void;
    onDismiss: (s: Suggestion) => void;
    onClearAll: () => void;
  } = $props();
</script>

{#if suggestions.length > 0}
  <div class="space-y-3 mb-4">
    <div class="flex items-center justify-between">
      <h3
        class="font-medium text-[var(--dash-text)] flex items-center gap-2"
      >
        <FontAwesomeIcon
          icon={faMagicWandSparkles}
          class="w-4 h-4 text-[var(--dash-primary)]"
        />
        Suggested searches based on your profile
      </h3>
      <button
        type="button"
        onclick={onClearAll}
        class="text-xs text-[var(--dash-text-secondary)] hover:text-[var(--dash-text)]"
      >
        Dismiss all
      </button>
    </div>

    {#each suggestions as suggestion (suggestion._key)}
      <div
        class="bg-[var(--dash-card)] rounded-lg border border-[var(--dash-border)] p-3 sm:p-4 space-y-3 {suggestion.accepted
          ? 'opacity-60'
          : ''}"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <span
                class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[var(--dash-bg)] text-[var(--dash-text)]"
              >
                {suggestion.platform_name}
              </span>
              {#if suggestion.relevance === "high"}
                <span
                  class="text-xs text-green-600 dark:text-green-400 font-medium"
                >Strong match</span>
              {:else if suggestion.relevance === "medium"}
                <span
                  class="text-xs text-amber-600 dark:text-amber-400 font-medium"
                >Decent match</span>
              {:else}
                <span
                  class="text-xs text-[var(--dash-text-muted)]"
                >Generic</span>
              {/if}
            </div>
            <p
              class="text-sm text-[var(--dash-text-secondary)] mt-1"
            >{suggestion.note}</p>
          </div>
        </div>

        {#if suggestion.keywords !== null}
          <div>
            <label
              class="block text-xs font-medium text-[var(--dash-text-secondary)] mb-1"
              for="suggestion-keywords-{suggestion._key}"
            >Search keywords</label>
            <input
              id="suggestion-keywords-{suggestion._key}"
              type="text"
              bind:value={suggestion.keywords}
              disabled={suggestion.accepted || suggestion.submitting}
              class="w-full px-2 py-1 text-sm border border-[var(--dash-border)] rounded bg-[var(--dash-bg)] text-[var(--dash-text)] disabled:opacity-60"
            />
          </div>
        {/if}

        <div class="flex justify-end gap-2">
          {#if suggestion.accepted}
            <span
              class="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-green-600 dark:text-green-400"
            >
              <FontAwesomeIcon icon={faCheck} class="w-3 h-3" />
              Added
            </span>
          {:else}
            <button
              type="button"
              onclick={() => onDismiss(suggestion)}
              disabled={suggestion.submitting}
              class="px-3 py-1.5 text-sm border border-[var(--dash-border)] rounded text-[var(--dash-text)] hover:bg-[var(--dash-bg)] disabled:opacity-50"
            >
              Dismiss
            </button>
            <button
              type="button"
              onclick={() => onAccept(suggestion)}
              disabled={suggestion.submitting}
              class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-[var(--dash-primary)] text-white rounded hover:bg-[var(--dash-primary-hover)] disabled:opacity-50"
            >
              {#if suggestion.submitting}
                <Spinner size="w-3 h-3" />
                Adding...
              {:else}
                <FontAwesomeIcon icon={faPlus} class="w-3 h-3" />
                Add this task
              {/if}
            </button>
          {/if}
        </div>
      </div>
    {/each}
  </div>
{/if}
