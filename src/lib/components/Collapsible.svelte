<script lang="ts">
  /**
   * Minimal collapsible section: a chevron-prefixed label that toggles a
   * children snippet. Matches the visual pattern of the section toggles in
   * SearchTaskFields (icon swaps between right and down).
   */
  import type { Snippet } from "svelte";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faChevronDown,
    faChevronRight,
  } from "@fortawesome/free-solid-svg-icons";

  interface Props {
    label: string;
    /** Bidirectional. Defaults to closed. */
    open?: boolean;
    children: Snippet;
  }

  let { label, open = $bindable(false), children }: Props = $props();
</script>

<button
  type="button"
  onclick={() => (open = !open)}
  class="flex items-center gap-1.5 text-xs text-[var(--dash-text-muted)] hover:text-[var(--dash-text-secondary)] transition-colors"
>
  {#if open}
    <FontAwesomeIcon icon={faChevronDown} class="w-2.5 h-2.5" />
  {:else}
    <FontAwesomeIcon icon={faChevronRight} class="w-2.5 h-2.5" />
  {/if}
  {label}
</button>

{#if open}
  {@render children()}
{/if}
