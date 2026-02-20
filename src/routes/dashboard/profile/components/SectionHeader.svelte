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

<div class="flex items-center justify-between mb-6">
  <div class="flex items-center gap-4">
    {#if backHref}
      <a
        href={backHref}
        class="flex items-center gap-2 text-[var(--dash-text-secondary)] hover:text-[var(--dash-primary)] transition-colors"
      >
        <FontAwesomeIcon icon={faArrowLeft} class="w-4 h-4" />
        <span class="text-sm">{backLabel}</span>
      </a>
    {/if}
    <div class="flex items-center gap-3">
      {#if icon}
        <div
          class="w-10 h-10 rounded-full bg-[var(--dash-bg)] flex items-center justify-center"
        >
          <FontAwesomeIcon
            {icon}
            class="w-5 h-5 text-[var(--dash-text-muted)]"
          />
        </div>
      {/if}
      <h1 class="text-2xl font-bold text-[var(--dash-text)]">{title}</h1>
    </div>
  </div>

  {#if showAddButton}
    <button
      type="button"
      onclick={onAdd}
      class="flex items-center gap-2 px-4 py-2 bg-[var(--dash-primary)] text-white rounded-lg hover:bg-[var(--dash-primary-hover)] transition-colors"
    >
      <FontAwesomeIcon icon={faPlus} class="w-4 h-4" />
      {addLabel}
    </button>
  {/if}
</div>
