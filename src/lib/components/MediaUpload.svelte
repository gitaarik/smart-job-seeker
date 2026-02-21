<script lang="ts">
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faCloudUploadAlt,
    faSpinner,
    faTimes,
    faImage,
  } from "@fortawesome/free-solid-svg-icons";

  interface Props {
    entityType: string;
    entityId: number;
    field: string;
    currentUrl?: string | null;
    label?: string;
    accept?: string;
    onUpload?: (url: string) => void;
    onDelete?: () => void;
  }

  let {
    entityType,
    entityId,
    field,
    currentUrl = null,
    label = "Upload image",
    accept = "image/jpeg,image/png,image/webp",
    onUpload,
    onDelete,
  }: Props = $props();

  let isUploading = $state(false);
  let isDeleting = $state(false);
  let isDragging = $state(false);
  let error = $state<string | null>(null);
  let previewUrl = $state<string | null>(currentUrl);

  // Update preview when currentUrl prop changes
  $effect(() => {
    previewUrl = currentUrl;
  });

  async function handleUpload(file: File) {
    if (!file) return;

    error = null;
    isUploading = true;

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(
        `/api/media/${entityType}/${entityId}/${field}`,
        {
          method: "POST",
          body: formData,
        },
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Upload failed");
      }

      previewUrl = result.url;
      onUpload?.(result.url);
    } catch (e) {
      error = e instanceof Error ? e.message : "Upload failed";
    } finally {
      isUploading = false;
    }
  }

  async function handleDelete() {
    error = null;
    isDeleting = true;

    try {
      const response = await fetch(
        `/api/media/${entityType}/${entityId}/${field}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.message || "Delete failed");
      }

      previewUrl = null;
      onDelete?.();
    } catch (e) {
      error = e instanceof Error ? e.message : "Delete failed";
    } finally {
      isDeleting = false;
    }
  }

  function handleFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      handleUpload(input.files[0]);
    }
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    isDragging = false;
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      handleUpload(files[0]);
    }
  }

  function handleDragOver(event: DragEvent) {
    event.preventDefault();
    isDragging = true;
  }

  function handleDragLeave() {
    isDragging = false;
  }

  const inputId = $derived(`media-upload-${entityType}-${entityId}-${field}`);
</script>

<div class="space-y-2">
  {#if label}
    <label for={inputId} class="block text-sm font-medium text-[var(--dash-text)]">
      {label}
    </label>
  {/if}

  {#if error}
    <div class="text-sm text-[var(--dash-error)]">{error}</div>
  {/if}

  {#if previewUrl}
    <!-- Preview with delete option -->
    <div class="relative inline-block">
      <img
        src={previewUrl}
        alt="Preview"
        class="w-24 h-24 object-cover rounded-lg border border-[var(--dash-border)]"
      />
      <button
        type="button"
        onclick={handleDelete}
        disabled={isDeleting}
        class="absolute -top-2 -right-2 w-6 h-6 bg-[var(--dash-error)] text-white rounded-full flex items-center justify-center hover:opacity-80 transition-opacity disabled:opacity-50"
        aria-label="Remove image"
      >
        {#if isDeleting}
          <FontAwesomeIcon icon={faSpinner} class="w-3 h-3 animate-spin" />
        {:else}
          <FontAwesomeIcon icon={faTimes} class="w-3 h-3" />
        {/if}
      </button>
    </div>
  {:else}
    <!-- Upload area -->
    <div
      role="button"
      tabindex="0"
      ondrop={handleDrop}
      ondragover={handleDragOver}
      ondragleave={handleDragLeave}
      onkeydown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          document.getElementById(inputId)?.click();
        }
      }}
      class="
        relative w-24 h-24 border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer transition-colors
        {isDragging
        ? 'border-[var(--dash-primary)] bg-[var(--dash-primary)]/5'
        : 'border-[var(--dash-border)] hover:border-[var(--dash-primary)]/50'}
      "
    >
      {#if isUploading}
        <FontAwesomeIcon
          icon={faSpinner}
          class="w-6 h-6 text-[var(--dash-primary)] animate-spin"
        />
      {:else}
        <FontAwesomeIcon
          icon={faImage}
          class="w-6 h-6 text-[var(--dash-text-muted)] mb-1"
        />
        <span class="text-xs text-[var(--dash-text-muted)]">Upload</span>
      {/if}

      <input
        id={inputId}
        type="file"
        {accept}
        onchange={handleFileSelect}
        disabled={isUploading}
        class="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
      />
    </div>
  {/if}
</div>
