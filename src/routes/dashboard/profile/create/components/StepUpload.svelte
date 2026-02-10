<script lang="ts">
  import { enhance } from "$app/forms";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faCloudUploadAlt,
    faFile,
    faSpinner,
    faTimes,
  } from "@fortawesome/free-solid-svg-icons";

  interface Props {
    isLoading: boolean;
    error: string | null;
    onSkipToManual: () => void;
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

<div class="space-y-6">
  <div class="text-center">
    <h2 class="text-xl font-semibold text-slate mb-2">Upload Your CV/Resume</h2>
    <p class="text-pearl">
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
      <div class="rounded-md bg-red-50 p-4">
        <p class="text-sm text-crimson">{error}</p>
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
        relative border-2 border-dashed rounded-lg p-8 text-center transition-colors
        {isDragging
        ? 'border-ocean bg-ocean/5'
        : 'border-light hover:border-ocean/50'}
      "
    >
      {#if selectedFile}
        <div class="flex items-center justify-center gap-3">
          <FontAwesomeIcon icon={faFile} class="w-8 h-8 text-ocean" />
          <div class="text-left">
            <p class="font-medium text-slate">{selectedFile.name}</p>
            <p class="text-sm text-pearl">
              {(selectedFile.size / 1024).toFixed(1)} KB
            </p>
          </div>
          <button
            type="button"
            onclick={clearFile}
            class="p-1 rounded hover:bg-light transition-colors"
            aria-label="Remove file"
          >
            <FontAwesomeIcon icon={faTimes} class="w-4 h-4 text-pearl" />
          </button>
        </div>
      {:else}
        <FontAwesomeIcon
          icon={faCloudUploadAlt}
          class="w-12 h-12 text-pearl mx-auto mb-4"
        />
        <p class="text-slate font-medium mb-1">
          Drag and drop your file here, or click to browse
        </p>
        <p class="text-sm text-pearl">PDF, DOCX, or HTML (max 10MB)</p>
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
        class="flex-1 py-2 px-4 border border-light rounded-lg text-slate hover:bg-light/50 transition-colors"
      >
        Skip to Manual Entry
      </button>

      <button
        type="submit"
        disabled={!selectedFile || isLoading}
        class="flex-1 py-2 px-4 bg-ocean text-pearl font-medium rounded-lg hover:bg-aqua transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {#if isLoading}
          <FontAwesomeIcon icon={faSpinner} class="w-4 h-4 animate-spin" />
          Processing...
        {:else}
          Upload & Parse
        {/if}
      </button>
    </div>
  </form>
</div>
