<script lang="ts">
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import { faExclamationTriangle } from "@fortawesome/free-solid-svg-icons";

  interface Props {
    isOpen: boolean;
    title?: string;
    message?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: () => void;
    onCancel: () => void;
  }

  let {
    isOpen,
    title = "Delete Item",
    message =
      "Are you sure you want to delete this item? This action cannot be undone.",
    confirmLabel = "Delete",
    cancelLabel = "Cancel",
    onConfirm,
    onCancel,
  }: Props = $props();
</script>

{#if isOpen}
  <!-- Backdrop -->
  <div
    class="fixed inset-0 bg-black/50 z-40"
    onclick={onCancel}
    onkeydown={(e) => e.key === "Escape" && onCancel()}
    role="button"
    tabindex="-1"
    aria-label="Close modal"
  >
  </div>

  <!-- Modal -->
  <div
    class="fixed inset-0 z-50 flex items-center justify-center p-4"
    role="dialog"
    aria-modal="true"
    aria-labelledby="modal-title"
  >
    <div
      class="bg-[var(--dash-card)] rounded-xl shadow-xl max-w-md w-full p-6"
      onclick={(e) => e.stopPropagation()}
      onkeydown={() => {}}
      role="document"
    >
      <div class="flex items-start gap-4">
        <div
          class="w-10 h-10 rounded-full bg-[var(--dash-error-light)] flex items-center justify-center flex-shrink-0"
        >
          <FontAwesomeIcon
            icon={faExclamationTriangle}
            class="w-5 h-5 text-[var(--dash-error)]"
          />
        </div>
        <div>
          <h3 id="modal-title" class="text-lg font-semibold text-[var(--dash-text)] mb-2">
            {title}
          </h3>
          <p class="text-[var(--dash-text-secondary)] text-sm">{message}</p>
        </div>
      </div>

      <div class="flex justify-end gap-3 mt-6">
        <button
          type="button"
          onclick={onCancel}
          class="px-4 py-2 border border-[var(--dash-border)] rounded-lg text-[var(--dash-text)] hover:bg-[var(--dash-bg)] transition-colors"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onclick={onConfirm}
          class="px-4 py-2 bg-[var(--dash-error)] text-white rounded-lg hover:opacity-90 transition-colors"
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  </div>
{/if}
