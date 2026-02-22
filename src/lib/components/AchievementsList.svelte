<script lang="ts">
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import { faPlus, faTimes, faUndo } from "@fortawesome/free-solid-svg-icons";

  interface Props {
    achievements: string[];
    deletedIndices: Set<number>;
    onAdd: () => void;
    onRemove: (index: number) => void;
    onUndoRemove: (index: number) => void;
  }

  let {
    achievements = $bindable(),
    deletedIndices,
    onAdd,
    onRemove,
    onUndoRemove,
  }: Props = $props();
</script>

{#if achievements.length === 0}
  <p class="text-[var(--dash-text-secondary)] text-sm">No achievements added yet.</p>
{:else}
  <div class="border border-[var(--dash-border)] rounded-md overflow-hidden">
    {#each achievements as achievement, index}
      {@const isDeleted = deletedIndices.has(index)}
      <div class="flex items-center {index > 0 ? 'border-t border-[var(--dash-border)]' : ''} {isDeleted ? 'opacity-50 bg-[var(--dash-bg)]/50' : ''}">
        {#if isDeleted}
          <span class="flex-1 px-4 py-3 text-[var(--dash-text-secondary)] line-through">{achievements[index]}</span>
          <button
            type="button"
            onclick={() => onUndoRemove(index)}
            class="p-3 text-[var(--dash-primary)] hover:text-[var(--dash-primary-hover)] transition-colors"
            aria-label="Undo"
          >
            <FontAwesomeIcon icon={faUndo} class="w-4 h-4" />
          </button>
        {:else}
          <input
            type="text"
            bind:value={achievements[index]}
            placeholder="Achievement description"
            class="flex-1 px-4 py-3 border-none focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:ring-inset"
          />
          <button
            type="button"
            onclick={() => onRemove(index)}
            class="p-3 text-[var(--dash-text-secondary)] hover:text-[var(--dash-error)] transition-colors"
            aria-label="Remove"
          >
            <FontAwesomeIcon icon={faTimes} class="w-4 h-4" />
          </button>
        {/if}
      </div>
    {/each}
  </div>
{/if}
<button
  type="button"
  onclick={onAdd}
  class="text-[var(--dash-primary)] hover:text-[var(--dash-primary-hover)] text-sm flex items-center gap-1 mt-3"
>
  <FontAwesomeIcon icon={faPlus} class="w-3 h-3" />
  Add Achievement
</button>
