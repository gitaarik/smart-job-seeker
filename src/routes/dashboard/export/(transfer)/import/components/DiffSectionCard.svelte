<script lang="ts">
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faChevronDown,
    faChevronUp,
  } from "@fortawesome/free-solid-svg-icons";
  import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
  import Card from "../../../../components/Card.svelte";

  interface Props {
    title: string;
    icon: IconDefinition;
    count?: string;
    badge?: { added: number; modified: number; removed: number };
    defaultExpanded?: boolean;
    children?: import("svelte").Snippet;
  }

  let {
    title,
    icon,
    count,
    badge,
    defaultExpanded = false,
    children,
  }: Props = $props();

  let isExpanded = $state(defaultExpanded);

  const hasBadgeChanges = $derived(
    badge && (badge.added > 0 || badge.modified > 0 || badge.removed > 0),
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
          icon={icon}
          class="w-5 h-5 text-[var(--dash-primary)]"
        />
      </div>
      <span class="font-semibold text-base text-[var(--dash-text)]"
        >{title}</span
      >
      {#if count}
        <span class="text-sm text-[var(--dash-text-secondary)]">({count})</span
        >
      {/if}
      {#if hasBadgeChanges}
        <div class="flex items-center gap-1.5">
          {#if badge && badge.modified > 0}
            <span
              class="text-xs px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium"
            >
              {badge.modified} modified
            </span>
          {/if}
          {#if badge && badge.added > 0}
            <span
              class="text-xs px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 font-medium"
            >
              {badge.added} new
            </span>
          {/if}
          {#if badge && badge.removed > 0}
            <span
              class="text-xs px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-medium"
            >
              {badge.removed} removed
            </span>
          {/if}
        </div>
      {:else if badge}
        <span
          class="text-xs px-1.5 py-0.5 rounded-full bg-[var(--dash-bg)] text-[var(--dash-text-muted)] font-medium"
        >
          No changes
        </span>
      {/if}
    </div>
    <FontAwesomeIcon
      icon={isExpanded ? faChevronUp : faChevronDown}
      class="w-4 h-4 text-[var(--dash-text-muted)]"
    />
  </button>

  {#if isExpanded}
    <div class="border-t border-[var(--dash-border)]">
      {@render children?.()}
    </div>
  {/if}
</Card>
