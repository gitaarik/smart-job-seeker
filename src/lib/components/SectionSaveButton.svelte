<script lang="ts">
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import { faCheck } from "@fortawesome/free-solid-svg-icons";
  import Spinner from "$lib/components/Spinner.svelte";

  type SaveState = "idle" | "saving" | "saved" | "error";

  interface Props {
    state?: SaveState;
    onClick?: () => void;
    disabled?: boolean;
    label?: string;
  }

  let { state = "idle", onClick, disabled = false, label }: Props = $props();

  const defaultLabel = label ?? "Save";

  const buttonText = $derived(
    state === "saving"
      ? "Saving..."
      : state === "saved"
        ? "Saved"
        : state === "error"
          ? "Error"
          : defaultLabel,
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
    <Spinner size="w-4 h-4" />
  {:else if state === "saved"}
    <FontAwesomeIcon icon={faCheck} class="w-4 h-4" />
  {/if}
  {buttonText}
</button>
