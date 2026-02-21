<script lang="ts">
  import { enhance } from "$app/forms";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faCloudUploadAlt,
    faFile,
    faFileImport,
    faSpinner,
    faTimes,
  } from "@fortawesome/free-solid-svg-icons";

  interface Props {
    isLoading: boolean;
    error: string | null;
    onSkipToManual: () => void;
    onImportExport: () => void;
    onUploadComplete: (data: {
      parsedData: unknown;
      fileId: string;
      fileName: string;
    }) => void;
    onError: (error: string) => void;
    onLoadingChange: (loading: boolean) => void;
  }

  let {
    isLoading,
    error,
    onSkipToManual,
    onImportExport,
    onUploadComplete,
    onError,
    onLoadingChange,
  }: Props = $props();

  let selectedFile = $state<File | null>(null);
  let isDragging = $state(false);

  function handleFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      selectedFile = input.files[0];
    }
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    isDragging = false;

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      selectedFile = files[0];
    }
  }

  function handleDragOver(event: DragEvent) {
    event.preventDefault();
    isDragging = true;
  }

  function handleDragLeave() {
    isDragging = false;
  }

  function clearFile() {
    selectedFile = null;
  }
</script>

<div class="space-y-4 sm:space-y-6">
  <div class="text-center">
    <h2 class="text-lg sm:text-xl font-semibold text-[var(--dash-text)] mb-1 sm:mb-2">Upload Your CV/Resume</h2>
    <p class="text-sm sm:text-base text-[var(--dash-text-secondary)]">
      We'll use AI to extract your information automatically
    </p>
  </div>

  <form
    method="POST"
    action="?/upload"
    enctype="multipart/form-data"
    use:enhance={() => {
      onLoadingChange(true);
      return async ({ result }) => {
        onLoadingChange(false);

        if (result.type === "success") {
          const data = result.data as {
            success?: boolean;
            parsedData?: unknown;
            fileId?: string;
            fileName?: string;
          };
          if (data?.success) {
            onUploadComplete({
              parsedData: data.parsedData,
              fileId: data.fileId as string,
              fileName: data.fileName as string,
            });
          }
        } else if (result.type === "failure") {
          const data = result.data as { error?: string } | undefined;
          onError(data?.error || "Upload failed");
        }
      };
    }}
    class="space-y-4"
  >
    {#if error}
      <div class="rounded-md bg-[var(--dash-error-light)] p-4">
        <p class="text-sm text-[var(--dash-error)]">{error}</p>
      </div>
    {/if}

    <div
      role="button"
      tabindex="0"
      ondrop={handleDrop}
      ondragover={handleDragOver}
      ondragleave={handleDragLeave}
      onkeydown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          document.getElementById("file-input")?.click();
        }
      }}
      class="
        relative border-2 border-dashed rounded-lg p-4 sm:p-8 text-center transition-colors
        {isDragging
        ? 'border-[var(--dash-primary)] bg-[var(--dash-primary)]/5'
        : 'border-[var(--dash-border)] hover:border-[var(--dash-primary)]/50'}
      "
    >
      {#if selectedFile}
        <div class="flex items-center justify-center gap-2 sm:gap-3">
          <FontAwesomeIcon icon={faFile} class="w-6 h-6 sm:w-8 sm:h-8 text-[var(--dash-primary)]" />
          <div class="text-left">
            <p class="font-medium text-[var(--dash-text)] text-sm sm:text-base">{selectedFile.name}</p>
            <p class="text-xs sm:text-sm text-[var(--dash-text-secondary)]">
              {(selectedFile.size / 1024).toFixed(1)} KB
            </p>
          </div>
          <button
            type="button"
            onclick={clearFile}
            class="p-1 rounded hover:bg-[var(--dash-bg)] transition-colors"
            aria-label="Remove file"
          >
            <FontAwesomeIcon icon={faTimes} class="w-4 h-4 text-[var(--dash-text-secondary)]" />
          </button>
        </div>
      {:else}
        <FontAwesomeIcon
          icon={faCloudUploadAlt}
          class="w-10 h-10 sm:w-12 sm:h-12 text-[var(--dash-text-muted)] mx-auto mb-3 sm:mb-4"
        />
        <p class="text-[var(--dash-text)] font-medium mb-1 text-sm sm:text-base">
          Drag and drop your file here, or click to browse
        </p>
        <p class="text-xs sm:text-sm text-[var(--dash-text-secondary)]">PDF, DOCX, or HTML (max 10MB)</p>
      {/if}

      <input
        id="file-input"
        type="file"
        name="file"
        accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/html"
        onchange={handleFileSelect}
        class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      />
    </div>

    <div class="flex gap-3">
      <button
        type="button"
        onclick={onSkipToManual}
        class="flex-1 py-2 px-4 border border-[var(--dash-border)] rounded-lg text-[var(--dash-text)] hover:bg-[var(--dash-bg)] transition-colors"
      >
        Skip to Manual Entry
      </button>

      <button
        type="submit"
        disabled={!selectedFile || isLoading}
        class="flex-1 py-2 px-4 bg-[var(--dash-primary)] text-white font-medium rounded-lg hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {#if isLoading}
          <FontAwesomeIcon icon={faSpinner} class="w-4 h-4 animate-spin" />
          Processing...
        {:else}
          Upload & Parse
        {/if}
      </button>
    </div>

    <div class="pt-2 sm:pt-4 border-t border-[var(--dash-border)]">
      <button
        type="button"
        onclick={onImportExport}
        class="w-full flex items-center justify-center gap-2 py-2 text-sm text-[var(--dash-text-secondary)] hover:text-[var(--dash-primary)] transition-colors"
      >
        <FontAwesomeIcon icon={faFileImport} class="w-4 h-4" />
        <span>Import from a previous export</span>
      </button>
    </div>
  </form>
</div>
