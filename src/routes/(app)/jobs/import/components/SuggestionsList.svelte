<script lang="ts" module>
  import type { SearchFilterValue } from "$lib/job-platforms/search-filters";

  export type Suggestion = {
    platform_id: number;
    platform: string;
    platform_name: string;
    /** URL the scraper will navigate to — `search_page_url` if set, else the
     *  platform's home `url`. Shown on the card so the user knows what site
     *  the import will hit. */
    platform_url: string;
    keywords: string | null;
    note: string;
    relevance: "high" | "medium" | "low";
    /** User-editable filter preferences for this suggestion. Mutated in
     *  place by the embedded FilterPicker; serialized to JSON when the
     *  suggestion is accepted. */
    filters: Record<string, SearchFilterValue>;
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
    faArrowUpRightFromSquare,
    faCheck,
    faChevronDown,
    faChevronRight,
    faMagicWandSparkles,
    faPlus,
  } from "@fortawesome/free-solid-svg-icons";
  import Spinner from "$lib/components/Spinner.svelte";
  import FilterPicker from "./FilterPicker.svelte";

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

  /** Per-card "show filter preferences" toggle. Keyed by suggestion._key so
   *  it survives rerenders without leaking into the parent's state. */
  let expandedFilters = $state<Record<number, boolean>>({});

  function displayUrl(url: string): string {
    try {
      const u = new URL(url);
      const host = u.hostname.replace(/^www\./, "");
      const path = u.pathname === "/" ? "" : u.pathname;
      return `${host}${path}`;
    } catch {
      return url;
    }
  }

  function countActiveFilters(filters: Record<string, SearchFilterValue>): number {
    let n = 0;
    for (const v of Object.values(filters)) {
      if (typeof v === "string" && v.length > 0) n += 1;
      else if (Array.isArray(v) && v.length > 0) n += 1;
    }
    return n;
  }
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
      {@const isExpanded = expandedFilters[suggestion._key] ?? false}
      {@const activeFilterCount = countActiveFilters(suggestion.filters)}
      <div
        class="bg-[var(--dash-card)] rounded-lg border border-[var(--dash-border)] p-3 sm:p-4 space-y-3 {suggestion.accepted
          ? 'opacity-60'
          : ''}"
      >
        <!-- Header: platform name + relevance + URL link -->
        <div class="space-y-1">
          <div class="flex items-center gap-2 flex-wrap">
            <span
              class="font-medium text-[var(--dash-text)]"
            >{suggestion.platform_name}</span>
            {#if suggestion.relevance === "high"}
              <span
                class="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 font-medium"
              >Strong match</span>
            {:else if suggestion.relevance === "medium"}
              <span
                class="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium"
              >Decent match</span>
            {:else}
              <span
                class="text-xs px-2 py-0.5 rounded-full bg-[var(--dash-bg)] text-[var(--dash-text-muted)]"
              >Generic</span>
            {/if}
          </div>
          <a
            href={suggestion.platform_url}
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1 text-xs text-[var(--dash-text-muted)] hover:text-[var(--dash-primary)] hover:underline"
            onclick={(e) => e.stopPropagation()}
            title={suggestion.platform_url}
          >
            <FontAwesomeIcon
              icon={faArrowUpRightFromSquare}
              class="w-2.5 h-2.5"
            />
            {displayUrl(suggestion.platform_url)}
          </a>
          <p
            class="text-sm text-[var(--dash-text-secondary)]"
          >{suggestion.note}</p>
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

        <!-- Collapsible filter preferences -->
        <div>
          <button
            type="button"
            onclick={() => {
              expandedFilters[suggestion._key] = !isExpanded;
            }}
            disabled={suggestion.accepted || suggestion.submitting}
            class="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--dash-text-secondary)] hover:text-[var(--dash-text)] disabled:opacity-60"
          >
            <FontAwesomeIcon
              icon={isExpanded ? faChevronDown : faChevronRight}
              class="w-2.5 h-2.5"
            />
            Filter preferences
            {#if activeFilterCount > 0}
              <span
                class="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-[var(--dash-primary)]/10 text-[var(--dash-primary)]"
              >{activeFilterCount} set</span>
            {:else}
              <span
                class="ml-1 text-[var(--dash-text-muted)] font-normal"
              >(none set — scraper uses defaults)</span>
            {/if}
          </button>
          {#if isExpanded}
            <div class="mt-2 pl-4 border-l-2 border-[var(--dash-border)]">
              <FilterPicker bind:filters={suggestion.filters} compact={true} />
            </div>
          {/if}
        </div>

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
