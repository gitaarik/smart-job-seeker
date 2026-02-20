<script lang="ts">
  import type { ActionData, PageData } from "./$types";
  import { enhance } from "$app/forms";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faCloudUploadAlt,
    faExclamationTriangle,
    faFile,
    faPlus,
    faSpinner,
    faSync,
    faTimes,
  } from "@fortawesome/free-solid-svg-icons";
  import SectionHeader from "../../profile/components/SectionHeader.svelte";
  import { faFileImport } from "@fortawesome/free-solid-svg-icons";

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let selectedFile = $state<File | null>(null);
  let isDragging = $state(false);
  let isLoading = $state(false);
  let error = $state<string | null>(null);
  let importMode = $state<"new" | "overwrite">("new");
  let showOverwriteConfirm = $state(false);
  let confirmName = $state("");
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
      const fileData = JSON.parse(text);
      const p = fileData?.profile;
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
    showOverwriteConfirm = false;
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
    showOverwriteConfirm = false;
    confirmName = "";
  }

  const overwriteNameMatches = $derived(confirmName === data.selectedProfileName);

  function handleImportClick(mode: "new" | "overwrite") {
    importMode = mode;
    if (mode === "overwrite") {
      showOverwriteConfirm = true;
    } else {
      showOverwriteConfirm = false;
      document.getElementById("import-form")?.requestSubmit();
    }
  }

  function confirmOverwrite() {
    document.getElementById("import-form")?.requestSubmit();
  }

  function cancelOverwrite() {
    showOverwriteConfirm = false;
    importMode = "new";
    confirmName = "";
  }
</script>

<div class="space-y-6">
  <SectionHeader title="Import Data" icon={faFileImport} />

  <form
    id="import-form"
    method="POST"
    action="?/importJson"
    enctype="multipart/form-data"
    use:enhance={() => {
      isLoading = true;
      error = null;
      return async ({ result }) => {
        isLoading = false;
        if (result.type === "failure") {
          const resultData = result.data as { error?: string } | undefined;
          error = resultData?.error || "Import failed";
        } else if (result.type === "redirect") {
          window.location.href = result.location;
        }
      };
    }}
    class="space-y-4"
  >
    <input type="hidden" name="importMode" value={importMode} />

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

      {#if showOverwriteConfirm}
        <div
          class="rounded-lg border p-4 space-y-4"
          style="border-color: var(--dash-warning-border); background-color: var(--dash-warning-light);"
        >
          <div class="flex items-start gap-3">
            <FontAwesomeIcon
              icon={faExclamationTriangle}
              class="w-5 h-5 flex-shrink-0 mt-0.5"
              style="color: var(--dash-warning);"
            />
            <div>
              <p class="font-medium" style="color: var(--dash-warning);">
                Overwrite "{data.selectedProfileName}"?
              </p>
              <p class="text-sm mt-1 text-[var(--dash-text-secondary)]">
                This will permanently delete all existing data in the current profile and replace it with the imported data. This action cannot be undone.
              </p>
            </div>
          </div>
          <div class="ml-8 space-y-3">
            <div>
              <label
                for="confirmOverwriteName"
                class="block text-sm font-medium mb-1"
                style="color: var(--dash-warning);"
              >
                To confirm, type <strong>"{data.selectedProfileName}"</strong> below:
              </label>
              <input
                type="text"
                id="confirmOverwriteName"
                bind:value={confirmName}
                autocomplete="off"
                class="w-full max-w-md px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:border-transparent bg-[var(--dash-card)] text-[var(--dash-text)]"
                style="border: 1px solid var(--dash-warning-border);"
                placeholder="Enter profile name to confirm"
              />
            </div>
            <div class="flex gap-2">
              <button
                type="button"
                onclick={cancelOverwrite}
                disabled={isLoading}
                class="px-3 py-1.5 text-sm border border-[var(--dash-border)] rounded-md hover:bg-[var(--dash-bg)] transition-colors disabled:opacity-50 text-[var(--dash-text)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onclick={confirmOverwrite}
                disabled={isLoading || !overwriteNameMatches}
                class="px-3 py-1.5 text-sm text-white rounded-md hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                style="background-color: var(--dash-warning);"
              >
                {#if isLoading}
                  <FontAwesomeIcon icon={faSpinner} class="w-3 h-3 animate-spin" />
                {/if}
                Yes, overwrite profile
              </button>
            </div>
          </div>
        </div>
      {:else}
        <div class="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onclick={() => handleImportClick("new")}
            disabled={!selectedFile || !preview || isLoading}
            class="flex-1 py-2.5 px-4 bg-[var(--dash-primary)] text-white font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {#if isLoading && importMode === "new"}
              <FontAwesomeIcon icon={faSpinner} class="w-4 h-4 animate-spin" />
              Importing...
            {:else}
              <FontAwesomeIcon icon={faPlus} class="w-4 h-4" />
              Import as New Profile
            {/if}
          </button>
          <button
            type="button"
            onclick={() => handleImportClick("overwrite")}
            disabled={!selectedFile || !preview || isLoading}
            class="flex-1 py-2.5 px-4 border border-[var(--dash-border)] text-[var(--dash-text)] font-medium rounded-lg hover:bg-[var(--dash-bg)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <FontAwesomeIcon icon={faSync} class="w-4 h-4" />
            Overwrite Current Profile
          </button>
        </div>
      {/if}
    {/if}
  </form>
</div>
