<script lang="ts">
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import { faArrowLeft, faPlus } from "@fortawesome/free-solid-svg-icons";
  import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";

  interface Props {
    title: string;
    icon?: IconDefinition;
    backHref?: string;
    backLabel?: string;
    showAddButton?: boolean;
    addLabel?: string;
    onAdd?: () => void;
  }

  let {
    title,
    icon,
    backHref = "/dashboard/profile",
    backLabel = "Back to Profile",
    showAddButton = false,
    addLabel = "Add New",
    onAdd,
  }: Props = $props();
</script>

<div class="flex items-center justify-between mb-6">
  <div class="flex items-center gap-4">
    <a
      href={backHref}
      class="flex items-center gap-2 text-pearl hover:text-ocean transition-colors"
    >
      <FontAwesomeIcon icon={faArrowLeft} class="w-4 h-4" />
      <span class="text-sm">{backLabel}</span>
    </a>
    <div class="flex items-center gap-3">
      {#if icon}
        <div
          class="w-10 h-10 rounded-full bg-ocean/10 flex items-center justify-center"
        >
          <FontAwesomeIcon {icon} class="w-5 h-5 text-ocean" />
        </div>
      {/if}
      <h1 class="text-2xl font-bold text-slate">{title}</h1>
    </div>
  </div>

  {#if showAddButton}
    <button
      type="button"
      onclick={onAdd}
      class="flex items-center gap-2 px-4 py-2 bg-ocean text-white rounded-lg hover:bg-aqua transition-colors"
    >
      <FontAwesomeIcon icon={faPlus} class="w-4 h-4" />
      {addLabel}
    </button>
  {/if}
</div>
