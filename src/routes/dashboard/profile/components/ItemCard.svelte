<script lang="ts">
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faChevronRight,
  } from "@fortawesome/free-solid-svg-icons";
  import type { IconDefinition } from "@fortawesome/free-solid-svg-icons";
  import type { Snippet } from "svelte";
  import Card from "../../components/Card.svelte";

  interface Props {
    id: number;
    expandedId?: number | null;
    onToggle?: (id: number) => void;
    icon: IconDefinition;
    iconColor?: string;
    imageUrl?: string | null;
    imageAlt?: string;
    title: Snippet;
    badges?: Snippet;
    subtitle?: Snippet;
    dateline?: Snippet;
    headerActions?: Snippet;
    expandedContent?: Snippet;
    editContent?: Snippet;
    footer?: Snippet;
  }

  let {
    id,
    expandedId = null,
    onToggle,
    icon,
    iconColor = "text-[var(--dash-primary)]",
    imageUrl,
    imageAlt = "",
    title,
    badges,
    subtitle,
    dateline,
    headerActions,
    expandedContent,
    editContent,
    footer,
  }: Props = $props();

  let expanded = $derived(expandedId === id);
  let expandable = $derived(!!onToggle && (!!expandedContent || !!editContent));

  function handleToggle() {
    onToggle?.(id);
  }
</script>

<Card class="overflow-hidden relative transition-all">
  {#if editContent}
    <!-- Edit mode replaces entire card -->
    <div class="p-3 sm:p-4">
      {@render editContent()}
    </div>
  {:else}
    <!-- Top right: header actions + chevron -->
    {#if expandable || headerActions}
      <div class="absolute top-3 right-3 flex items-center gap-1 z-10">
        {#if headerActions}
          {@render headerActions()}
        {/if}
        {#if expandable}
          <button
            type="button"
            onclick={(e) => {
              e.stopPropagation();
              handleToggle();
            }}
            class="p-1.5 text-[var(--dash-text-secondary)] hover:text-[var(--dash-primary)] transition-colors"
            aria-label={expanded ? "Collapse" : "Expand"}
          >
            <span class="inline-block transition-transform duration-200 {expanded ? 'rotate-90' : ''}">
              <FontAwesomeIcon
                icon={faChevronRight}
                class="w-4 h-4"
              />
            </span>
          </button>
        {/if}
      </div>
    {/if}

    <!-- Header -->
    <div class="p-3 sm:p-4 hover:bg-[var(--dash-bg)] transition-colors">
      <div class="flex items-start gap-3">
        <!-- Desktop: Logo/icon on the left -->
        <div class="hidden md:flex flex-shrink-0">
          {#if imageUrl}
            <img
              src={imageUrl}
              alt={imageAlt}
              class="w-12 h-12 rounded-lg object-cover"
            />
          {:else}
            <div class="w-12 h-12 rounded-lg bg-[var(--dash-bg)] flex items-center justify-center">
              <FontAwesomeIcon {icon} class="w-6 h-6 {iconColor}" />
            </div>
          {/if}
        </div>

        <!-- Clickable area for expand/collapse -->
        {#if expandable}
          <button
            type="button"
            onclick={handleToggle}
            class="flex items-start gap-3 flex-1 min-w-0 text-left"
          >
            <div class="flex-1 min-w-0">
              <h3 class="font-medium text-[var(--dash-text)] text-sm sm:text-base line-clamp-2 sm:truncate pr-8">
                {@render title()}
                {#if badges}
                  {@render badges()}
                {/if}
              </h3>

              {#if subtitle}
                <div class="flex items-center gap-2 sm:gap-3 mt-1 text-xs sm:text-sm text-[var(--dash-text-secondary)] flex-wrap">
                  {@render subtitle()}
                </div>
              {/if}

              {#if dateline}
                <div class="mt-1.5 sm:mt-2 text-xs sm:text-sm text-[var(--dash-text-muted)]">
                  {@render dateline()}
                </div>
              {/if}
            </div>
          </button>
        {:else}
          <!-- Non-expandable: plain content, not a button -->
          <div class="flex-1 min-w-0">
            <h3 class="font-medium text-[var(--dash-text)] text-sm sm:text-base">
              {@render title()}
              {#if badges}
                {@render badges()}
              {/if}
            </h3>

            {#if subtitle}
              <div class="mt-1 text-xs sm:text-sm text-[var(--dash-text-secondary)]">
                {@render subtitle()}
              </div>
            {/if}

            {#if dateline}
              <div class="mt-1.5 sm:mt-2 text-xs sm:text-sm text-[var(--dash-text-muted)]">
                {@render dateline()}
              </div>
            {/if}
          </div>
        {/if}

        <!-- Mobile: Logo/icon on the right -->
        <div class="flex-shrink-0 md:hidden flex flex-col items-end">
          {#if expandable || headerActions}
            <div class="h-6 mb-1"></div> <!-- Spacer for top-right buttons -->
          {/if}
          {#if expandable}
            <button
              type="button"
              onclick={handleToggle}
            >
              {#if imageUrl}
                <img
                  src={imageUrl}
                  alt={imageAlt}
                  class="w-12 h-12 rounded-lg object-cover"
                />
              {:else}
                <div class="w-12 h-12 rounded-lg bg-[var(--dash-bg)] flex items-center justify-center">
                  <FontAwesomeIcon {icon} class="w-6 h-6 {iconColor}" />
                </div>
              {/if}
            </button>
          {:else}
            {#if imageUrl}
              <img
                src={imageUrl}
                alt={imageAlt}
                class="w-12 h-12 rounded-lg object-cover"
              />
            {:else}
              <div class="w-12 h-12 rounded-lg bg-[var(--dash-bg)] flex items-center justify-center">
                <FontAwesomeIcon {icon} class="w-6 h-6 {iconColor}" />
              </div>
            {/if}
          {/if}
        </div>
      </div>
    </div>
  {/if}

  <!-- Expanded Content -->
  {#if expanded && expandedContent && !editContent}
    <div class="border-t border-[var(--dash-border)] p-3 sm:p-4 space-y-3 sm:space-y-4 relative">
      {@render expandedContent()}
    </div>
  {/if}

  <!-- Footer (always visible when provided, hidden during edit) -->
  {#if footer && !editContent}
    <div class="border-t border-[var(--dash-border)] px-3 py-2 sm:px-4 flex justify-end md:justify-start items-center gap-2">
      {@render footer()}
    </div>
  {/if}
</Card>
