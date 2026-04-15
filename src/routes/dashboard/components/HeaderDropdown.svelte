<script lang="ts">
  import type { Snippet } from "svelte";
  import { page } from "$app/stores";
  import { untrack } from "svelte";
  import { sidebarState, overlayState } from "./sidebar-state.svelte";

  interface Props {
    trigger: Snippet<[{ isOpen: boolean }]>;
    children: Snippet;
    width?: string;
    id?: string;
    onopen?: () => void;
  }

  let { trigger, children, width = "w-64", onopen }: Props = $props();
  let isOpen = $state(false);

  // Close on navigation
  $effect(() => {
    $page.url;
    untrack(() => close());
  });

  function toggle() {
    if (isOpen) {
      close();
    } else {
      // Close any other open overlay (other dropdown or sidebar)
      overlayState.onclose?.();
      sidebarState.mobileOpen = false;
      overlayState.onclose = close;
      isOpen = true;
      onopen?.();
    }
  }

  export function close() {
    if (!isOpen) return;
    isOpen = false;
    overlayState.onclose = null;
  }
</script>

<div class="relative">
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
