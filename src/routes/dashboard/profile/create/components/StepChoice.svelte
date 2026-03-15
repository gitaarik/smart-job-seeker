<script lang="ts">
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faEdit,
    faFileImport,
    faFileUpload,
  } from "@fortawesome/free-solid-svg-icons";

  interface Props {
    onChoose: (method: "upload" | "manual" | "import") => void;
  }

  let { onChoose }: Props = $props();
</script>

<div class="space-y-4">
  <div class="grid gap-4 md:grid-cols-2">
    <button
      type="button"
      onclick={() => onChoose("upload")}
      class="group bg-[var(--dash-card)] rounded-lg border border-[var(--dash-border)] hover:border-[var(--dash-primary)] p-4 sm:p-6 transition-all text-left"
    >
      <div
        class="w-10 h-10 rounded-lg bg-[var(--dash-bg)] group-hover:bg-[var(--dash-primary)]/10 flex items-center justify-center mb-3 sm:mb-4"
      >
        <FontAwesomeIcon
          icon={faFileUpload}
          class="w-5 h-5 text-[var(--dash-text-muted)] group-hover:text-[var(--dash-primary)]"
        />
      </div>
      <h3
        class="text-base sm:text-lg font-semibold text-[var(--dash-text)] mb-1 sm:mb-2"
      >
        Upload CV/Resume
      </h3>
      <p class="text-xs sm:text-sm text-[var(--dash-text-secondary)]">
        Upload your CV or resume and we'll extract your information using AI.
      </p>
      <p class="text-xs text-[var(--dash-text-muted)] mt-2 sm:mt-3">
        PDF, DOCX, HTML
      </p>
    </button>

    <button
      type="button"
      onclick={() => onChoose("manual")}
      class="group bg-[var(--dash-card)] rounded-lg border border-[var(--dash-border)] hover:border-[var(--dash-primary)] p-4 sm:p-6 transition-all text-left"
    >
      <div
        class="w-10 h-10 rounded-lg bg-[var(--dash-bg)] group-hover:bg-[var(--dash-primary)]/10 flex items-center justify-center mb-3 sm:mb-4"
      >
        <FontAwesomeIcon
          icon={faEdit}
          class="w-5 h-5 text-[var(--dash-text-muted)] group-hover:text-[var(--dash-primary)]"
        />
      </div>
      <h3
        class="text-base sm:text-lg font-semibold text-[var(--dash-text)] mb-1 sm:mb-2"
      >
        Create Manually
      </h3>
      <p class="text-xs sm:text-sm text-[var(--dash-text-secondary)]">
        Start with a blank profile and enter your information manually.
      </p>
      <p class="text-xs text-[var(--dash-text-muted)] mt-2 sm:mt-3">
        Basic fields
      </p>
    </button>
  </div>

  <div class="pt-2 border-t border-[var(--dash-border)]">
    <button
      type="button"
      onclick={() => onChoose("import")}
      class="w-full flex items-center justify-center gap-2 py-2 text-sm text-[var(--dash-text-secondary)] hover:text-[var(--dash-primary)] transition-colors"
    >
      <FontAwesomeIcon icon={faFileImport} class="w-4 h-4" />
      <span>Import from a previous export</span>
    </button>
  </div>
</div>
