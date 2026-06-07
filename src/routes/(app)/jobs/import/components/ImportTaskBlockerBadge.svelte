<script lang="ts">
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import { faTriangleExclamation } from "@fortawesome/free-solid-svg-icons";
  import type { ImportTaskBlocker } from "$lib/import-tasks/readiness";
  import ImportTaskBlockerList from "./ImportTaskBlockerList.svelte";

  let { blockers }: { blockers: ImportTaskBlocker[] } = $props();

  // Hover opens on desktop; tap toggles on mobile. The row is a link, so the
  // trigger swallows the click to avoid navigating while reading the recap.
  let open = $state(false);
  function toggle(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    open = !open;
  }
</script>

{#if blockers.length > 0}
  <span
    class="relative inline-flex"
    onmouseenter={() => (open = true)}
    onmouseleave={() => (open = false)}
  >
    <button
      type="button"
      onclick={toggle}
      aria-label="{blockers.length} setup step{blockers.length === 1
        ? ''
        : 's'} needed before this import can run"
      class="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full whitespace-nowrap bg-amber-500/15 text-amber-600 dark:text-amber-400 hover:bg-amber-500/25 transition-colors"
    >
      <FontAwesomeIcon icon={faTriangleExclamation} class="w-3 h-3" />
      Needs setup
    </button>

    {#if open}
      <div
        role="tooltip"
        onclick={(e) => e.preventDefault()}
        onkeydown={() => {}}
        class="absolute right-0 top-full mt-1.5 z-20 w-72 p-3 rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)] shadow-lg text-left cursor-default"
      >
        <p
          class="text-xs font-semibold text-[var(--dash-text)] mb-2"
        >
          Finish setup before it can run
        </p>
        <ImportTaskBlockerList {blockers} />
      </div>
    {/if}
  </span>
{/if}
