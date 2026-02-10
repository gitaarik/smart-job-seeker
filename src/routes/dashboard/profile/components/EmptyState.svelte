<script lang="ts">
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import { faPlus } from "@fortawesome/free-solid-svg-icons";
  import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";

  interface Props {
    icon: IconDefinition;
    title: string;
    description: string;
    actionLabel?: string;
    onAction?: () => void;
  }

  let { icon, title, description, actionLabel = "Add First", onAction }:
    Props = $props();
</script>

<div
  class="flex flex-col items-center justify-center py-12 px-6 border-2 border-dashed border-light rounded-lg"
>
  <div
    class="w-16 h-16 rounded-full bg-ocean/10 flex items-center justify-center mb-4"
  >
    <FontAwesomeIcon {icon} class="w-8 h-8 text-ocean/50" />
  </div>
  <h3 class="text-lg font-medium text-slate mb-2">{title}</h3>
  <p class="text-pearl text-center max-w-sm mb-6">{description}</p>
  {#if onAction}
    <button
      type="button"
      onclick={onAction}
      class="flex items-center gap-2 px-4 py-2 bg-ocean text-white rounded-lg hover:bg-aqua transition-colors"
    >
      <FontAwesomeIcon icon={faPlus} class="w-4 h-4" />
      {actionLabel}
    </button>
  {/if}
</div>
