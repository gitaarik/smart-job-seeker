<script lang="ts">
  import type { ActionData, PageData } from "./$types";
  import { enhance } from "$app/forms";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import { faDatabase, faDownload } from "@fortawesome/free-solid-svg-icons";
  import SectionHeader from "../../profile/components/SectionHeader.svelte";
  import EmptyState from "../../profile/components/EmptyState.svelte";

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let exports = $derived(data.exports);
  let exporting = $state(false);

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
      case "txt":
        return "Text";
      default:
        return type.toUpperCase();
    }
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
</script>

<div class="space-y-6">
  <SectionHeader title="Export Data" icon={faDatabase} />

  {#if form?.error}
    <div
      class="bg-[var(--dash-error-light)] border border-[var(--dash-error)] rounded-lg p-4"
    >
      <p class="text-[var(--dash-error)] text-sm">{form.error}</p>
    </div>
  {/if}

  {#if form?.success}
    <div class="bg-green-50 border border-green-200 rounded-lg p-4">
      <p class="text-green-700 text-sm">
        Profile data exported successfully.
      </p>
    </div>
  {/if}

  <!-- Export Action -->
  <div
    class="bg-[var(--dash-card)] rounded-lg border border-[var(--dash-border)] p-6"
  >
    <div class="flex items-start gap-4">
      <div
        class="w-12 h-12 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0"
      >
        <FontAwesomeIcon
          icon={faDatabase}
          class="w-6 h-6 text-indigo-600"
        />
      </div>
      <div class="flex-1">
        <h3 class="font-medium text-[var(--dash-text)] mb-1">
          Export Profile JSON
        </h3>
        <p class="text-sm text-[var(--dash-text-secondary)] mb-4">
          Export your full profile data as a structured JSON file. This
          includes all your work experience, education, skills, projects, and
          other profile information. Useful for backups and data portability.
        </p>
        <form method="POST" action="?/exportJson" use:enhance={handleExport}>
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
              Export Profile JSON
            {/if}
          </button>
        </form>
      </div>
    </div>
  </div>

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
                class="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center"
              >
                <FontAwesomeIcon
                  icon={faDownload}
                  class="w-5 h-5 text-gray-600"
                />
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <span
                    class="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700 font-medium"
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
                <p class="text-xs text-[var(--dash-text-secondary)]">
                  {formatDate(exp.date_created)}
                </p>
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
      description="Export your profile data to create a backup or transfer your information. Click the button above to create your first export."
    />
  {/if}
</div>
