<script lang="ts">
  import type { ActionData, PageData } from "./$types";
  import { enhance } from "$app/forms";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faDatabase,
    faDownload,
    faImage,
    faUser,
    faLayerGroup,
  } from "@fortawesome/free-solid-svg-icons";
  import Card from "../../../components/Card.svelte";
  import EmptyState from "../../../profile/components/EmptyState.svelte";

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let exports = $derived(data.exports);
  let exporting = $state(false);

  // Export options
  let scope = $state<"profile" | "full">("profile");
  let includeMedia = $state(false);

  function formatDate(date: Date | string | null): string {
    if (!date) return "";
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function getFileTypeLabel(type: string): string {
    switch (type) {
      case "pdf":
        return "PDF";
      case "html":
        return "HTML";
      case "docx":
        return "Word";
      case "json":
        return "JSON";
      case "zip":
        return "ZIP";
      case "txt":
        return "Text";
      default:
        return type.toUpperCase();
    }
  }

  function formatFileSize(bytes: bigint | number | null | undefined): string {
    if (!bytes) return "";
    const size = Number(bytes);
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  function handleExport() {
    exporting = true;
    return async ({
      result,
      update,
    }: {
      result: { type: string };
      update: () => Promise<void>;
    }) => {
      await update();
      exporting = false;
    };
  }

  const exportDescription = $derived.by(() => {
    const scopeText =
      scope === "full"
        ? "full account (profile + job tracking data)"
        : "profile data (resume/CV)";
    const mediaText = includeMedia ? " with media files" : "";
    return `Export your ${scopeText}${mediaText}`;
  });

  const exportButtonText = $derived.by(() => {
    if (exporting) return "Exporting...";
    const format = includeMedia ? "ZIP" : "JSON";
    const scopeText = scope === "full" ? "Full Account" : "Profile";
    return `Export ${scopeText} (${format})`;
  });
</script>

<div class="space-y-6">
  {#if form?.error}
    <div
      class="bg-[var(--dash-error-light)] border border-[var(--dash-error)] rounded-lg p-4"
    >
      <p class="text-[var(--dash-error)] text-sm">{form.error}</p>
    </div>
  {/if}

  {#if form?.success}
    <div
      class="bg-[var(--dash-success-light)] border border-[var(--dash-success)] rounded-lg p-4"
    >
      <p class="text-[var(--dash-success)] text-sm">
        Data exported successfully. You can download it from the list below.
      </p>
    </div>
  {/if}

  <!-- Export Options -->
  <Card padding="lg">
    <div class="flex items-start gap-4">
      <div
        class="w-12 h-12 rounded-lg bg-[var(--dash-bg)] flex items-center justify-center flex-shrink-0"
      >
        <FontAwesomeIcon icon={faDatabase} class="w-6 h-6 text-indigo-600" />
      </div>
      <div class="flex-1">
        <h3 class="font-medium text-[var(--dash-text)] mb-1">Export Options</h3>
        <p class="text-sm text-[var(--dash-text-secondary)] mb-4">
          {exportDescription}
        </p>

        <form method="POST" action="?/export" use:enhance={handleExport}>
          <input type="hidden" name="scope" value={scope} />
          <input
            type="hidden"
            name="includeMedia"
            value={includeMedia.toString()}
          />

          <!-- Scope Selection -->
          <div class="mb-4">
            <label class="block text-sm font-medium text-[var(--dash-text)] mb-2"
              >What to export</label
            >
            <div class="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onclick={() => (scope = "profile")}
                class="flex-1 flex items-center gap-3 p-3 rounded-lg border transition-colors {scope ===
                'profile'
                  ? 'border-[var(--dash-primary)] bg-[var(--dash-primary)]/5'
                  : 'border-[var(--dash-border)] hover:border-[var(--dash-primary)]/50'}"
              >
                <FontAwesomeIcon
                  icon={faUser}
                  class="w-5 h-5 {scope === 'profile'
                    ? 'text-[var(--dash-primary)]'
                    : 'text-[var(--dash-text-muted)]'}"
                />
                <div class="text-left">
                  <div
                    class="font-medium {scope === 'profile'
                      ? 'text-[var(--dash-primary)]'
                      : 'text-[var(--dash-text)]'}"
                  >
                    Profile Only
                  </div>
                  <div class="text-xs text-[var(--dash-text-secondary)]">
                    Resume, skills, experience
                  </div>
                </div>
              </button>
              <button
                type="button"
                onclick={() => (scope = "full")}
                class="flex-1 flex items-center gap-3 p-3 rounded-lg border transition-colors {scope ===
                'full'
                  ? 'border-[var(--dash-primary)] bg-[var(--dash-primary)]/5'
                  : 'border-[var(--dash-border)] hover:border-[var(--dash-primary)]/50'}"
              >
                <FontAwesomeIcon
                  icon={faLayerGroup}
                  class="w-5 h-5 {scope === 'full'
                    ? 'text-[var(--dash-primary)]'
                    : 'text-[var(--dash-text-muted)]'}"
                />
                <div class="text-left">
                  <div
                    class="font-medium {scope === 'full'
                      ? 'text-[var(--dash-primary)]'
                      : 'text-[var(--dash-text)]'}"
                  >
                    Full Account
                  </div>
                  <div class="text-xs text-[var(--dash-text-secondary)]">
                    Profile + stories, notes, salary
                  </div>
                </div>
              </button>
            </div>
          </div>

          <!-- Media Option -->
          <div class="mb-4">
            <label
              class="flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors {includeMedia
                ? 'border-[var(--dash-primary)] bg-[var(--dash-primary)]/5'
                : 'border-[var(--dash-border)] hover:border-[var(--dash-primary)]/50'}"
            >
              <input
                type="checkbox"
                bind:checked={includeMedia}
                class="w-4 h-4 rounded border-[var(--dash-border)] text-[var(--dash-primary)] focus:ring-[var(--dash-primary)]"
              />
              <FontAwesomeIcon
                icon={faImage}
                class="w-5 h-5 {includeMedia
                  ? 'text-[var(--dash-primary)]'
                  : 'text-[var(--dash-text-muted)]'}"
              />
              <div>
                <div
                  class="font-medium {includeMedia
                    ? 'text-[var(--dash-primary)]'
                    : 'text-[var(--dash-text)]'}"
                >
                  Include media files
                </div>
                <div class="text-xs text-[var(--dash-text-secondary)]">
                  Profile photos, logos, images (creates ZIP file)
                </div>
              </div>
            </label>
          </div>

          <button
            type="submit"
            disabled={exporting}
            class="flex items-center gap-2 px-4 py-2 bg-[var(--dash-primary)] text-white rounded-lg hover:bg-[var(--dash-primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {#if exporting}
              <span
                class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"
              ></span>
              Exporting...
            {:else}
              <FontAwesomeIcon icon={faDownload} class="w-4 h-4" />
              {exportButtonText}
            {/if}
          </button>
        </form>
      </div>
    </div>
  </Card>

  <!-- Existing Exports -->
  {#if exports.length > 0}
    <div>
      <h2 class="text-lg font-semibold text-[var(--dash-text)] mb-4">
        Previous Exports
      </h2>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {#each exports as exp (exp.id)}
          <a
            href="/dashboard/export/data/download?id={exp.id}"
            download
            class="bg-[var(--dash-card)] rounded-lg border border-[var(--dash-border)] p-4 hover:border-[var(--dash-primary)] transition-colors block"
          >
            <div class="flex items-center gap-3">
              <div
                class="w-10 h-10 rounded-lg bg-[var(--dash-bg)] flex items-center justify-center"
              >
                <FontAwesomeIcon
                  icon={faDownload}
                  class="w-5 h-5 text-gray-600"
                />
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <span
                    class="text-xs px-2 py-0.5 rounded bg-[var(--dash-bg)] text-gray-700 font-medium"
                  >
                    {getFileTypeLabel(exp.file_type)}
                  </span>
                  <span class="text-xs text-[var(--dash-text-secondary)]">
                    {exp.export_format || exp.export_type}
                  </span>
                </div>
                <p class="text-sm text-[var(--dash-text)] truncate mt-1">
                  {exp.description || "Export file"}
                </p>
                <div class="flex items-center gap-2 text-xs text-[var(--dash-text-secondary)]">
                  <span>{formatDate(exp.date_created)}</span>
                  {#if exp.directus_files?.filesize}
                    <span>•</span>
                    <span>{formatFileSize(exp.directus_files.filesize)}</span>
                  {/if}
                </div>
              </div>
            </div>
          </a>
        {/each}
      </div>
    </div>
  {:else}
    <EmptyState
      icon={faDatabase}
      title="No data exports yet"
      description="Export your profile data to create a backup or transfer your information. Choose your options above and click export."
    />
  {/if}
</div>
