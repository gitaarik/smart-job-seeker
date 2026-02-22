<script lang="ts">
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import { faSpinner, faCheck } from "@fortawesome/free-solid-svg-icons";

  type SaveState = "idle" | "saving" | "saved" | "error";

  interface Props {
    state?: SaveState;
    onClick?: () => void;
    disabled?: boolean;
  }

  let { state = "idle", onClick, disabled = false }: Props = $props();

  const buttonText = $derived(
    state === "saving"
      ? "Saving..."
      : state === "saved"
        ? "Saved"
        : state === "error"
          ? "Error"
          : "Save",
  );
</script>

<button
  type="button"
  onclick={onClick}
  disabled={disabled || state === "saving"}
  class="px-4 py-2 rounded-lg transition-all duration-200 flex items-center gap-2 text-sm font-medium
    {state === 'saved'
    ? 'bg-[var(--dash-success)] text-white'
    : state === 'error'
      ? 'bg-[var(--dash-error)] text-white'
      : 'bg-[var(--dash-primary)] text-white hover:bg-[var(--dash-primary-hover)]'}
    disabled:opacity-50 disabled:cursor-not-allowed"
>
  {#if state === "saving"}
    <FontAwesomeIcon icon={faSpinner} class="w-4 h-4 animate-spin" />
  {:else if state === "saved"}
    <FontAwesomeIcon icon={faCheck} class="w-4 h-4" />
  {/if}
  {buttonText}
</button>
