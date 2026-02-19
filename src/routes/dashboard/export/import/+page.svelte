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
  import SectionHeader from "../../profile/components/SectionHeader.svelte";

  let selectedFile = $state<File | null>(null);
  let isDragging = $state(false);
  let isLoading = $state(false);
  let error = $state<string | null>(null);

  function handleFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      error = null;
      selectedFile = input.files[0];
    }
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    isDragging = false;
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      error = null;
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

<div class="space-y-6">
  <SectionHeader title="Import Data" icon={faFileImport} />

  <form
    method="POST"
    action="?/importJson"
    enctype="multipart/form-data"
    use:enhance={() => {
      isLoading = true;
      error = null;
      return async ({ result }) => {
        isLoading = false;
        if (result.type === "failure") {
          const data = result.data as { error?: string } | undefined;
          error = data?.error || "Import failed";
        } else if (result.type === "redirect") {
          window.location.href = result.location;
        }
      };
    }}
    class="space-y-4"
  >
    {#if error}
      <div class="rounded-md bg-red-50 p-4">
        <p class="text-sm text-red-700">{error}</p>
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
          document.getElementById("json-file-input")?.click();
        }
      }}
      class="
        relative border-2 border-dashed rounded-lg p-8 text-center transition-colors
        {isDragging
        ? 'border-[var(--dash-primary)] bg-[var(--dash-primary)]/5'
        : 'border-[var(--dash-border)] hover:border-[var(--dash-primary)]/50'}
      "
    >
      {#if selectedFile}
        <div class="flex items-center justify-center gap-3">
          <FontAwesomeIcon
            icon={faFile}
            class="w-8 h-8 text-[var(--dash-primary)]"
          />
          <div class="text-left">
            <p class="font-medium text-[var(--dash-text)]">
              {selectedFile.name}
            </p>
            <p class="text-sm text-[var(--dash-text-secondary)]">
              {(selectedFile.size / 1024).toFixed(1)} KB
            </p>
          </div>
          <button
            type="button"
            onclick={clearFile}
            class="p-1 rounded hover:bg-gray-100 transition-colors"
            aria-label="Remove file"
          >
            <FontAwesomeIcon
              icon={faTimes}
              class="w-4 h-4 text-[var(--dash-text-secondary)]"
            />
          </button>
        </div>
      {:else}
        <FontAwesomeIcon
          icon={faCloudUploadAlt}
          class="w-12 h-12 text-[var(--dash-text-muted)] mx-auto mb-4"
        />
        <p class="font-medium text-[var(--dash-text)] mb-1">
          Drag and drop your JSON export here, or click to browse
        </p>
        <p class="text-sm text-[var(--dash-text-secondary)]">
          JSON files exported from Export Data (max 10MB)
        </p>
      {/if}

      <input
        id="json-file-input"
        type="file"
        name="file"
        accept=".json,application/json"
        onchange={handleFileSelect}
        class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      />
    </div>

    <button
      type="submit"
      disabled={!selectedFile || isLoading}
      class="w-full py-2.5 px-4 bg-[var(--dash-primary)] text-white font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
    >
      {#if isLoading}
        <FontAwesomeIcon icon={faSpinner} class="w-4 h-4 animate-spin" />
        Importing...
      {:else}
        <FontAwesomeIcon icon={faFileImport} class="w-4 h-4" />
        Import Profile
      {/if}
    </button>
  </form>
</div>
