<script lang="ts">
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import { faExclamationTriangle, faQuestionCircle } from "@fortawesome/free-solid-svg-icons";

  interface Props {
    isOpen: boolean;
    title?: string;
    message?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: "destructive" | "primary";
    onConfirm: () => void;
    onCancel: () => void;
  }

  let {
    isOpen,
    title = "Confirm",
    message = "Are you sure?",
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    variant = "destructive",
    onConfirm,
    onCancel,
  }: Props = $props();

  const iconBg = $derived(
    variant === "destructive"
      ? "bg-[var(--dash-error-light)]"
      : "bg-[var(--dash-primary)]/10"
  );
  const iconColor = $derived(
    variant === "destructive"
      ? "text-[var(--dash-error)]"
      : "text-[var(--dash-primary)]"
  );
  const icon = $derived(
    variant === "destructive" ? faExclamationTriangle : faQuestionCircle
  );
  const btnClass = $derived(
    variant === "destructive"
      ? "bg-[var(--dash-error)] text-white"
      : "bg-[var(--dash-primary)] text-white"
  );
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
          class="w-10 h-10 rounded-full {iconBg} flex items-center justify-center flex-shrink-0"
        >
          <FontAwesomeIcon
            {icon}
            class="w-5 h-5 {iconColor}"
          />
        </div>
        <div>
          <h3 id="modal-title" class="text-lg font-semibold text-[var(--dash-text)] mb-2">
            {title}
          </h3>
          <p class="text-[var(--dash-text-secondary)] text-sm whitespace-pre-line">{message}</p>
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
          class="px-4 py-2 {btnClass} rounded-lg hover:opacity-90 transition-colors"
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  </div>
{/if}
