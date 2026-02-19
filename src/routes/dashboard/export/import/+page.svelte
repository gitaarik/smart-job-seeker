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
  let preview = $state<
    {
      name: string;
      title?: string;
      counts: { label: string; count: number }[];
    } | null
  >(null);

  async function parsePreview(file: File) {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const p = data?.profile;
      if (!p) {
        error = "Invalid export format: missing profile data";
        preview = null;
        return;
      }

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
      error = null;
    } catch {
      error = "Could not read JSON file";
      preview = null;
    }
  }

  function setFile(file: File) {
    error = null;
    preview = null;
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

    {#if preview}
      <div
        class="rounded-lg border border-[var(--dash-border)] bg-[var(--dash-bg-secondary)] p-4 space-y-3"
      >
        <div>
          <h3 class="font-semibold text-[var(--dash-text)]">{preview.name}</h3>
          {#if preview.title}
            <p class="text-sm text-[var(--dash-text-secondary)]">
              {preview.title}
            </p>
          {/if}
        </div>

        {#if preview.counts.length > 0}
          <div class="flex flex-wrap gap-2">
            {#each preview.counts as { label, count }}
              <span
                class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-[var(--dash-bg)] border border-[var(--dash-border)] text-[var(--dash-text-secondary)]"
              >
                {label}
                <span
                  class="bg-[var(--dash-primary)]/10 text-[var(--dash-primary)] px-1.5 rounded-full font-semibold"
                >{count}</span>
              </span>
            {/each}
          </div>
        {:else}
          <p class="text-sm text-[var(--dash-text-muted)]">
            No child records found
          </p>
        {/if}
      </div>
    {/if}

    <button
      type="submit"
      disabled={!selectedFile || !preview || isLoading}
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
