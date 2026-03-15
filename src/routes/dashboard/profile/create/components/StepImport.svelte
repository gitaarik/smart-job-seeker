<script lang="ts">
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faArrowRight,
    faCloudUploadAlt,
    faFile,
    faTimes,
  } from "@fortawesome/free-solid-svg-icons";
  import type { ExportedProfile } from "$lib/server/profile/export-profile-json";
  import type { ResumeData } from "$lib/server/resume/types";
  import { convertExportToResumeData } from "../lib/convert-export";
  import Card from "../../../components/Card.svelte";

  interface Props {
    error: string | null;
    onBack: () => void;
    onImportComplete: (data: ResumeData) => void;
    onError: (error: string) => void;
  }

  let { error, onBack, onImportComplete, onError }: Props = $props();

  let selectedFile = $state<File | null>(null);
  let isDragging = $state(false);
  let parsedExport = $state<ExportedProfile | null>(null);
  let preview = $state<{
    name: string;
    title?: string;
    counts: { label: string; count: number }[];
  } | null>(null);
  let parseError = $state<string | null>(null);

  async function parsePreview(file: File) {
    try {
      const text = await file.text();
      const fileData = JSON.parse(text);
      const p = fileData?.profile;
      if (!p) {
        parseError = "Invalid export format: missing profile data";
        preview = null;
        parsedExport = null;
        return;
      }

      parsedExport = fileData as ExportedProfile;

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

      preview = {
        name: p.name || "Unnamed profile",
        title: p.title || undefined,
        counts,
      };
      parseError = null;
    } catch {
      parseError = "Could not read JSON file";
      preview = null;
      parsedExport = null;
    }
  }

  function setFile(file: File) {
    parseError = null;
    preview = null;
    parsedExport = null;
    selectedFile = file;
    parsePreview(file);
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
    preview = null;
    parsedExport = null;
    parseError = null;
  }

  function handleContinue() {
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

  const displayError = $derived(error || parseError);
</script>

<Card padding="responsive">
  <h3 class="font-medium text-[var(--dash-text)] mb-1">Import from Export</h3>
  <p class="text-sm text-[var(--dash-text-secondary)] mb-4">
    Upload a previously exported profile JSON file
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
          class="w-10 h-10 sm:w-12 sm:h-12 text-[var(--dash-text-muted)] mx-auto mb-3 sm:mb-4"
        />
        <p
          class="text-[var(--dash-text)] font-medium mb-1 text-sm sm:text-base"
        >
          Drag and drop your JSON file here, or click to browse
        </p>
        <p class="text-xs sm:text-sm text-[var(--dash-text-secondary)]">
          JSON export file (max 10MB)
        </p>
      {/if}

      <input
        id="import-file-input"
        type="file"
        accept=".json,application/json"
        onchange={handleFileSelect}
        class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      />
    </div>

    {#if preview}
      <div
        class="rounded-lg border border-[var(--dash-border)] bg-[var(--dash-bg)] p-3 sm:p-4 space-y-2 sm:space-y-3"
      >
        <div>
          <h3
            class="font-semibold text-[var(--dash-text)] text-sm sm:text-base"
          >
            {preview.name}
          </h3>
          {#if preview.title}
            <p class="text-xs sm:text-sm text-[var(--dash-text-secondary)]">
              {preview.title}
            </p>
          {/if}
        </div>

        {#if preview.counts.length > 0}
          <div class="flex flex-wrap gap-1.5 sm:gap-2">
            {#each preview.counts as { label, count }}
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

    <div class="flex justify-end gap-2 pt-2">
      <button
        type="button"
        onclick={onBack}
        class="px-4 py-2 border border-[var(--dash-border)] rounded-lg text-[var(--dash-text)] hover:bg-[var(--dash-bg)] transition-colors"
      >
        Back
      </button>

      <button
        type="button"
        onclick={handleContinue}
        disabled={!selectedFile || !preview}
        class="px-4 py-2 bg-[var(--dash-primary)] text-white rounded-lg hover:bg-[var(--dash-primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
      >
        <FontAwesomeIcon icon={faArrowRight} class="w-4 h-4" />
        Continue
      </button>
    </div>
  </div>
</Card>
