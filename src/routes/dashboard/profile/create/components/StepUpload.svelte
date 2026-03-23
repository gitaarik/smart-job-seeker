<script lang="ts">
  import { enhance } from "$app/forms";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faArrowRight,
    faCloudUploadAlt,
    faFile,
    faSpinner,
    faTimes,
  } from "@fortawesome/free-solid-svg-icons";
  import type { ExportedProfile } from "$lib/server/profile/export-profile-json";
  import type { ResumeData } from "$lib/server/resume/types";
  import { convertExportToResumeData } from "../lib/convert-export";
  import Card from "../../../components/Card.svelte";

  interface Props {
    isLoading: boolean;
    error: string | null;
    onSkipToManual: () => void;
    onUploadComplete: (data: {
      parsedData: unknown;
      fileId: string;
      fileName: string;
    }) => void;
    onImportComplete: (data: ResumeData) => void;
    onError: (error: string) => void;
    onLoadingChange: (loading: boolean) => void;
  }

  let {
    isLoading,
    error,
    onSkipToManual,
    onUploadComplete,
    onImportComplete,
    onError,
    onLoadingChange,
  }: Props = $props();

  let selectedFile = $state<File | null>(null);
  let isDragging = $state(false);

  // SJS export detection
  let parsedExport = $state<ExportedProfile | null>(null);
  let exportPreview = $state<{
    name: string;
    title?: string;
    counts: { label: string; count: number }[];
  } | null>(null);
  let parseError = $state<string | null>(null);

  let isSjsExport = $derived(!!exportPreview);
  const displayError = $derived(error || parseError);

  async function detectSjsExport(file: File) {
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
        // Not an SJS export — will be handled by server as JSON Resume
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
      add("Profile versions", p.profile_versions);
      add("Languages", p.languages);
      add("Highlights", p.highlights);
      add("References", p.references);
      add("Project stories", p.project_stories);
      add("Cheat sheets", p.cheat_sheets);
      add("Salary expectations", p.salary_expectations);

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

    const input = document.getElementById("file-input") as HTMLInputElement;
    if (input) {
      const dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
    }

    detectSjsExport(file);
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
      onImportComplete(resumeData);
    } catch {
      onError("Failed to convert export data");
    }
  }
</script>

<Card padding="responsive">
  <h3 class="font-medium text-[var(--dash-text)] mb-1">
    Upload Your CV/Resume
  </h3>
  <p class="text-sm text-[var(--dash-text-secondary)] mb-4">
    Upload a resume, or import from a previous export
  </p>

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
          <FontAwesomeIcon
            icon={faFile}
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
        id="file-input"
        type="file"
        name="file"
        accept=".pdf,.docx,.json,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/html,application/json"
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
        {:else}
          <p class="text-xs sm:text-sm text-[var(--dash-text-muted)]">
            No data found in export
          </p>
        {/if}
      </div>
    {/if}

    <div class="flex justify-end gap-2">
      <button
        type="button"
        onclick={onSkipToManual}
        class="px-4 py-2 border border-[var(--dash-border)] rounded-lg text-[var(--dash-text)] hover:bg-[var(--dash-bg)] transition-colors"
      >
        Skip to Manual Entry
      </button>

      {#if isSjsExport}
        <button
          type="button"
          onclick={handleImportContinue}
          disabled={!selectedFile || !exportPreview}
          class="px-4 py-2 bg-[var(--dash-primary)] text-white rounded-lg hover:bg-[var(--dash-primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <FontAwesomeIcon icon={faArrowRight} class="w-4 h-4" />
          Continue
        </button>
      {:else}
        <button
          type="submit"
          disabled={!selectedFile || isLoading}
          class="px-4 py-2 bg-[var(--dash-primary)] text-white rounded-lg hover:bg-[var(--dash-primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {#if isLoading}
            <FontAwesomeIcon icon={faSpinner} class="w-4 h-4 spin-pulse" />
            Processing...
          {:else}
            Upload & Parse
          {/if}
        </button>
      {/if}
    </div>
  </form>
</Card>
