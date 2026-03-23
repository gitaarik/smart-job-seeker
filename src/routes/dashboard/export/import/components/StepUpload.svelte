<script lang="ts">
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faArrowRight,
    faCloudUploadAlt,
    faFile,
    faFileArchive,
    faTimes,
  } from "@fortawesome/free-solid-svg-icons";
  import Spinner from "$lib/components/Spinner.svelte";
  import type { ExportedProfile } from "$lib/server/profile/export-profile-json";
  import type { ResumeData } from "$lib/server/resume/types";
  import { convertExportToResumeData } from "$lib/resume/convert-export";
  import Card from "../../../components/Card.svelte";

  interface Props {
    isLoading: boolean;
    error: string | null;
    onParsed: (data: ResumeData, source: "upload" | "import" | "jsonResume") => void;
    onError: (error: string) => void;
    onLoadingChange: (loading: boolean) => void;
  }

  let { isLoading, error, onParsed, onError, onLoadingChange }: Props =
    $props();

  let selectedFile = $state<File | null>(null);
  let isDragging = $state(false);
  let parseError = $state<string | null>(null);

  // SJS export detection
  let parsedExport = $state<ExportedProfile | null>(null);
  let exportPreview = $state<{
    name: string;
    title?: string;
    counts: { label: string; count: number }[];
  } | null>(null);

  let isSjsExport = $derived(!!exportPreview);
  const displayError = $derived(error || parseError);

  async function detectFormat(file: File) {
    if (file.type !== "application/json" && !file.name.endsWith(".json")) {
      parsedExport = null;
      exportPreview = null;
      parseError = null;
      return;
    }

    try {
      const text = await file.text();
      const jsonData = JSON.parse(text);
      const p = jsonData?.profile;

      if (!p) {
        // Not an SJS export — may be JSON Resume
        parsedExport = null;
        exportPreview = null;
        parseError = null;
        return;
      }

      parsedExport = jsonData as ExportedProfile;

      const counts: { label: string; count: number }[] = [];
      const add = (label: string, arr: unknown[] | undefined | null) => {
        const len = arr?.length ?? 0;
        if (len > 0) counts.push({ label, count: len });
      };

      add("Work experiences", p.work_experiences);
      add("Education", p.education);
      add("Skill categories", p.tech_skill_categories);
      add("Side projects", p.side_projects);
      add("Languages", p.languages);
      add("References", p.references);

      exportPreview = {
        name: p.name || "Unnamed profile",
        title: p.title || undefined,
        counts,
      };
      parseError = null;
    } catch {
      parsedExport = null;
      exportPreview = null;
      parseError = null;
    }
  }

  function setFile(file: File) {
    parseError = null;
    exportPreview = null;
    parsedExport = null;
    selectedFile = file;

    // Sync to the hidden file input for server-side upload
    const input = document.getElementById(
      "import-file-input",
    ) as HTMLInputElement;
    if (input) {
      const dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
    }

    detectFormat(file);
  }

  function handleFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      setFile(input.files[0]);
    }
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    isDragging = false;
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      setFile(files[0]);
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
    parsedExport = null;
    exportPreview = null;
    parseError = null;
  }

  function handleImportContinue() {
    if (!parsedExport) {
      onError("No valid export data found");
      return;
    }
    try {
      const resumeData = convertExportToResumeData(parsedExport);
      onParsed(resumeData, "import");
    } catch {
      onError("Failed to convert export data");
    }
  }

  async function handleUpload() {
    if (!selectedFile) return;

    onLoadingChange(true);
    parseError = null;

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch("/api/resume/parse", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        let message = "Upload failed";
        try {
          const errorData = await response.json();
          message = errorData.message || errorData.error || message;
        } catch {
          // response wasn't JSON
        }
        onError(message);
        return;
      }

      const result = await response.json();

      if (result.success && result.parsedData) {
        onParsed(result.parsedData as ResumeData, "upload");
      } else {
        onError("Failed to parse file");
      }
    } catch {
      onError("Upload failed");
    } finally {
      onLoadingChange(false);
    }
  }

  const isZipFile = $derived(
    selectedFile?.name.endsWith(".zip") ||
      selectedFile?.type === "application/zip",
  );
  const fileIcon = $derived(isZipFile ? faFileArchive : faFile);
</script>

<Card padding="responsive">
  <h3 class="font-medium text-[var(--dash-text)] mb-1">Import Data</h3>
  <p class="text-sm text-[var(--dash-text-secondary)] mb-4">
    Upload a resume (PDF, DOCX), JSON Resume, or a previous SJS export to
    compare with your current profile
  </p>

  <div class="space-y-4">
    {#if displayError}
      <div
        class="bg-[var(--dash-error-light)] border border-[var(--dash-error)] rounded-lg p-4"
      >
        <p class="text-sm text-[var(--dash-error)]">{displayError}</p>
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
          document.getElementById("import-file-input")?.click();
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
          <FontAwesomeIcon
            icon={fileIcon}
            class="w-6 h-6 sm:w-8 sm:h-8 text-[var(--dash-primary)]"
          />
          <div class="text-left">
            <p class="font-medium text-[var(--dash-text)] text-sm sm:text-base">
              {selectedFile.name}
            </p>
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
            <FontAwesomeIcon
              icon={faTimes}
              class="w-4 h-4 text-[var(--dash-text-secondary)]"
            />
          </button>
        </div>
      {:else}
        <FontAwesomeIcon
          icon={faCloudUploadAlt}
          class="w-12 h-12 sm:w-16 sm:h-16 text-[var(--dash-text-muted)] mx-auto mb-3 sm:mb-4"
        />
        <p
          class="text-[var(--dash-text)] font-medium mb-1 text-sm sm:text-base"
        >
          Drag and drop your file here, or click to browse
        </p>
        <p class="text-xs sm:text-sm text-[var(--dash-text-secondary)]">
          PDF, DOCX, JSON Resume, or SJS export (max 10MB)
        </p>
      {/if}

      <input
        id="import-file-input"
        type="file"
        accept=".pdf,.docx,.json,.zip,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/json,application/zip"
        onchange={handleFileSelect}
        class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      />
    </div>

    {#if exportPreview}
      <div
        class="rounded-lg border border-[var(--dash-border)] bg-[var(--dash-bg)] p-3 sm:p-4 space-y-2 sm:space-y-3"
      >
        <div>
          <h3
            class="font-semibold text-[var(--dash-text)] text-sm sm:text-base"
          >
            {exportPreview.name}
          </h3>
          {#if exportPreview.title}
            <p class="text-xs sm:text-sm text-[var(--dash-text-secondary)]">
              {exportPreview.title}
            </p>
          {/if}
        </div>

        {#if exportPreview.counts.length > 0}
          <div class="flex flex-wrap gap-1.5 sm:gap-2">
            {#each exportPreview.counts as { label, count }}
              <span
                class="inline-flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-xs font-medium bg-[var(--dash-card)] border border-[var(--dash-border)] text-[var(--dash-text-secondary)]"
              >
                {label}
                <span
                  class="bg-[var(--dash-primary)]/10 text-[var(--dash-primary)] px-1 sm:px-1.5 rounded-full font-semibold"
                  >{count}</span
                >
              </span>
            {/each}
          </div>
        {/if}
      </div>
    {/if}

    <div class="flex justify-end">
      {#if isSjsExport}
        <button
          type="button"
          onclick={handleImportContinue}
          disabled={!selectedFile || !exportPreview}
          class="px-4 py-2 bg-[var(--dash-primary)] text-white rounded-lg hover:bg-[var(--dash-primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <FontAwesomeIcon icon={faArrowRight} class="w-4 h-4" />
          Compare with Profile
        </button>
      {:else}
        <button
          type="button"
          onclick={handleUpload}
          disabled={!selectedFile || isLoading}
          class="px-4 py-2 bg-[var(--dash-primary)] text-white rounded-lg hover:bg-[var(--dash-primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {#if isLoading}
            <Spinner size="w-4 h-4" />
            Processing...
          {:else}
            Upload & Compare
          {/if}
        </button>
      {/if}
    </div>
  </div>
</Card>
