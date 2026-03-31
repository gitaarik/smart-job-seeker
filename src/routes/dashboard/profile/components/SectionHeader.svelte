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
    backHref,
    backLabel = "Back",
    showAddButton = false,
    addLabel = "Add New",
    onAdd,
  }: Props = $props();
</script>

<div class="mb-6">
  {#if backHref}
    <div class="mb-4">
      <a
        href={backHref}
        class="flex items-center gap-2 text-[var(--dash-text-secondary)] hover:text-[var(--dash-primary)] transition-colors"
      >
        <FontAwesomeIcon icon={faArrowLeft} class="w-4 h-4" />
        <span class="text-sm">{backLabel}</span>
      </a>
    </div>
  {/if}
  <div class="flex items-center justify-between">
    <div class="flex items-center gap-3">
      {#if icon}
        <div
          class="w-12 h-12 rounded-full bg-[var(--dash-bg)] flex items-center justify-center"
        >
          <FontAwesomeIcon
            {icon}
            class="w-6 h-6 text-[var(--dash-text-muted)]"
          />
        </div>
      {/if}
      <h1 class="text-2xl font-bold text-[var(--dash-text)]">{title}</h1>
    </div>

    {#if showAddButton}
      <button
        type="button"
        onclick={onAdd}
        class="flex items-center justify-center gap-2 p-3 sm:px-4 sm:py-2 bg-[var(--dash-primary)] text-white rounded-lg hover:bg-[var(--dash-primary-hover)] transition-colors"
      >
        <FontAwesomeIcon icon={faPlus} class="w-5 h-5 sm:w-4 sm:h-4" />
        <span class="hidden sm:inline">{addLabel}</span>
      </button>
    {/if}
  </div>
</div>
