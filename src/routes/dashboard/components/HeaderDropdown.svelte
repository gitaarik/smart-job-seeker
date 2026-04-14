<script lang="ts">
  import type { Snippet } from "svelte";
  import { page } from "$app/stores";
  import { sidebarState } from "./sidebar-state.svelte";

  interface Props {
    trigger: Snippet<[{ isOpen: boolean }]>;
    children: Snippet;
    width?: string;
    id: string;
    onopen?: () => void;
  }

  let { trigger, children, width = "w-64", id, onopen }: Props = $props();
  let isOpen = $state(false);

  // Close on navigation
  $effect(() => {
    $page.url;
    isOpen = false;
  });

  function handleClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest(`.header-dropdown-${id}`)) {
      isOpen = false;
    }
  }

  function toggle() {
    isOpen = !isOpen;
    if (isOpen) {
      sidebarState.mobileOpen = false;
      onopen?.();
    }
  }

  export function close() {
    isOpen = false;
  }
</script>

<svelte:window onclick={handleClickOutside} />

<div class="header-dropdown-{id} relative">
  <button type="button" onclick={toggle}>
    {@render trigger({ isOpen })}
  </button>

  {#if isOpen}
    <div
      class="fixed right-2 left-2 top-[65px] sm:absolute sm:left-auto sm:top-auto sm:right-0 sm:mt-2 sm:{width} bg-[var(--dash-card)] rounded-lg shadow-lg border border-[var(--dash-border)] overflow-hidden z-50"
    >
      {@render children()}
    </div>
  {/if}
</div>
