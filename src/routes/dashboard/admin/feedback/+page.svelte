<script lang="ts">
  import type { PageData } from "./$types";
  import { enhance } from "$app/forms";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faCommentDots,
    faTrash,
    faExternalLinkAlt,
    faDownload,
    faStickyNote,
  } from "@fortawesome/free-solid-svg-icons";
  import Card from "../../components/Card.svelte";
  import ConfirmModal from "../../profile/components/ConfirmModal.svelte";

  let { data }: { data: PageData } = $props();

  let feedback = $derived((data as any).feedback);
  let counts = $derived((data as any).counts);
  let statusFilter = $derived((data as any).statusFilter);
  let categoryFilter = $derived((data as any).categoryFilter);

  let deleteId = $state<number | null>(null);
  let editingNoteId = $state<number | null>(null);
  let noteText = $state("");

  let statusTabs = $derived([
    { value: "", label: "All", count: counts.all },
    { value: "new", label: "New", count: counts.new },
    { value: "reviewed", label: "Reviewed", count: counts.reviewed },
    { value: "resolved", label: "Resolved", count: counts.resolved },
  ]);

  const categoryLabels: Record<string, string> = {
    bug: "Bug",
    feature: "Feature",
    ui: "UI / Design",
    question: "Question",
    other: "Other",
  };

  const categoryColors: Record<string, string> = {
    bug: "bg-red-100 text-red-700",
    feature: "bg-blue-100 text-blue-700",
    ui: "bg-purple-100 text-purple-700",
    question: "bg-amber-100 text-amber-700",
    other: "bg-gray-100 text-gray-600",
  };

  const statusColors: Record<string, string> = {
    new: "bg-yellow-100 text-yellow-700",
    reviewed: "bg-blue-100 text-blue-700",
    resolved: "bg-green-100 text-green-700",
  };

  function formatDate(date: string | Date | null): string {
    if (!date) return "";
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function formatFileSize(bytes: number | bigint | null): string {
    if (!bytes) return "";
    const n = Number(bytes);
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  }

  function startEditNote(id: number, currentNote: string | null) {
    editingNoteId = id;
    noteText = currentNote || "";
  }
</script>

<div class="space-y-6">
  <div class="flex items-center gap-2">
    <FontAwesomeIcon icon={faCommentDots} class="w-5 h-5 text-[var(--dash-primary)]" />
    <h1 class="text-lg font-semibold text-[var(--dash-text)]">User Feedback</h1>
  </div>

  <!-- Status filter tabs -->
  <div class="flex flex-wrap gap-2">
    {#each statusTabs as tab}
      <a
        href="/dashboard/admin/feedback{tab.value ? `?status=${tab.value}` : ''}{categoryFilter ? `${tab.value ? '&' : '?'}category=${categoryFilter}` : ''}"
        class="px-3 py-1.5 text-sm rounded-lg border transition-colors {statusFilter === tab.value
          ? 'border-[var(--dash-primary)] bg-[var(--dash-primary)]/10 text-[var(--dash-primary)] font-medium'
          : 'border-[var(--dash-border)] text-[var(--dash-text-secondary)] hover:border-[var(--dash-text-muted)]'}"
      >
        {tab.label}
        <span class="ml-1 text-xs opacity-70">{tab.count}</span>
      </a>
    {/each}
  </div>

  <!-- Category filter -->
  <div class="flex flex-wrap gap-1.5">
    <a
      href="/dashboard/admin/feedback{statusFilter ? `?status=${statusFilter}` : ''}"
      class="px-2 py-0.5 text-xs rounded-full border transition-colors {!categoryFilter
        ? 'border-[var(--dash-primary)] bg-[var(--dash-primary)]/10 text-[var(--dash-primary)]'
        : 'border-[var(--dash-border)] text-[var(--dash-text-muted)] hover:border-[var(--dash-text-muted)]'}"
    >All categories</a>
    {#each Object.entries(categoryLabels) as [value, label]}
      <a
        href="/dashboard/admin/feedback?{statusFilter ? `status=${statusFilter}&` : ''}category={value}"
        class="px-2 py-0.5 text-xs rounded-full border transition-colors {categoryFilter === value
          ? 'border-[var(--dash-primary)] bg-[var(--dash-primary)]/10 text-[var(--dash-primary)]'
          : 'border-[var(--dash-border)] text-[var(--dash-text-muted)] hover:border-[var(--dash-text-muted)]'}"
      >{label}</a>
    {/each}
  </div>

  <!-- Feedback list -->
  {#if feedback.length === 0}
    <Card padding="lg">
      <p class="text-sm text-[var(--dash-text-muted)] text-center py-8">No feedback yet.</p>
    </Card>
  {:else}
    <div class="space-y-3">
      {#each feedback as entry (entry.id)}
        <Card padding="md">
          <div class="space-y-3">
            <!-- Header row -->
            <div class="flex items-start justify-between gap-3">
              <div class="flex items-center flex-wrap gap-2 min-w-0">
                <span class="text-xs px-2 py-0.5 rounded-full {categoryColors[entry.category] || categoryColors.other}">
                  {categoryLabels[entry.category] || entry.category}
                </span>
                <span class="text-xs px-2 py-0.5 rounded-full {statusColors[entry.status] || statusColors.new}">
                  {entry.status}
                </span>
                <span class="text-xs text-[var(--dash-text-muted)]">#{entry.id}</span>
              </div>
              <button
                type="button"
                onclick={() => (deleteId = entry.id)}
                class="p-1 text-[var(--dash-text-muted)] hover:text-[var(--dash-error)] transition-colors flex-shrink-0"
                aria-label="Delete"
              >
                <FontAwesomeIcon icon={faTrash} class="w-3.5 h-3.5" />
              </button>
            </div>

            <!-- Message -->
            <p class="text-sm text-[var(--dash-text)] whitespace-pre-wrap">{entry.message}</p>

            <!-- Attachments -->
            {#if entry.user_feedback_files?.length > 0}
              <div class="flex flex-wrap gap-2">
                {#each entry.user_feedback_files as fileRecord}
                  {#if fileRecord.directus_files}
                    <a
                      href="/dashboard/admin/feedback?fileId={fileRecord.directus_files.id}&feedbackId={entry.id}"
                      class="flex items-center gap-1.5 px-2 py-1 text-xs bg-[var(--dash-bg)] rounded border border-[var(--dash-border)] text-[var(--dash-text-secondary)] hover:border-[var(--dash-primary)] hover:text-[var(--dash-primary)] transition-colors"
                    >
                      <FontAwesomeIcon icon={faDownload} class="w-3 h-3" />
                      <span class="truncate max-w-32">{fileRecord.directus_files.filename_download}</span>
                      <span class="text-[var(--dash-text-muted)]">{formatFileSize(fileRecord.directus_files.filesize)}</span>
                    </a>
                  {/if}
                {/each}
              </div>
            {/if}

            <!-- Meta row -->
            <div class="flex items-center flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--dash-text-muted)]">
              <span>{entry.user?.name || entry.user?.email}</span>
              <span>{formatDate(entry.date_created)}</span>
              {#if entry.page_url}
                <a
                  href={entry.page_url}
                  class="flex items-center gap-1 text-[var(--dash-primary)] hover:underline"
                >
                  <FontAwesomeIcon icon={faExternalLinkAlt} class="w-2.5 h-2.5" />
                  {entry.page_url}
                </a>
              {/if}
            </div>

            <!-- Admin note -->
            {#if editingNoteId === entry.id}
              <form method="POST" action="?/addNote" use:enhance={() => {
                return async ({ update }) => {
                  editingNoteId = null;
                  await update();
                };
              }}>
                <input type="hidden" name="id" value={entry.id} />
                <div class="flex gap-2">
                  <input
                    name="note"
                    value={noteText}
                    oninput={(e) => (noteText = (e.currentTarget as HTMLInputElement).value)}
                    placeholder="Admin note..."
                    class="flex-1 px-2 py-1 text-xs border border-[var(--dash-border)] rounded focus:outline-none focus:ring-1 focus:ring-[var(--dash-primary)]"
                  />
                  <button type="submit" class="px-2 py-1 text-xs bg-[var(--dash-primary)] text-white rounded hover:bg-[var(--dash-primary-hover)] transition-colors">Save</button>
                  <button type="button" onclick={() => (editingNoteId = null)} class="px-2 py-1 text-xs border border-[var(--dash-border)] rounded text-[var(--dash-text-secondary)] hover:bg-[var(--dash-bg)] transition-colors">Cancel</button>
                </div>
              </form>
            {:else if entry.admin_note}
              <div class="flex items-start gap-2 text-xs bg-[var(--dash-bg)] rounded p-2">
                <FontAwesomeIcon icon={faStickyNote} class="w-3 h-3 text-[var(--dash-text-muted)] mt-0.5 flex-shrink-0" />
                <span class="text-[var(--dash-text-secondary)]">{entry.admin_note}</span>
                <button type="button" onclick={() => startEditNote(entry.id, entry.admin_note)} class="text-[var(--dash-text-muted)] hover:text-[var(--dash-primary)] ml-auto flex-shrink-0 text-xs">edit</button>
              </div>
            {/if}

            <!-- Actions -->
            <div class="flex items-center gap-2 pt-1 border-t border-[var(--dash-border)]">
              {#each ["new", "reviewed", "resolved"] as s}
                {#if entry.status !== s}
                  <form method="POST" action="?/updateStatus" use:enhance class="inline">
                    <input type="hidden" name="id" value={entry.id} />
                    <input type="hidden" name="status" value={s} />
                    <button type="submit" class="text-xs text-[var(--dash-text-secondary)] hover:text-[var(--dash-primary)] transition-colors capitalize">
                      {s === "new" ? "Reopen" : s === "reviewed" ? "Mark reviewed" : "Resolve"}
                    </button>
                  </form>
                {/if}
              {/each}
              {#if editingNoteId !== entry.id}
                <button type="button" onclick={() => startEditNote(entry.id, entry.admin_note)} class="text-xs text-[var(--dash-text-secondary)] hover:text-[var(--dash-primary)] transition-colors ml-auto">
                  {entry.admin_note ? "Edit note" : "Add note"}
                </button>
              {/if}
            </div>
          </div>
        </Card>
      {/each}
    </div>
  {/if}
</div>

<!-- Delete Confirmation -->
<ConfirmModal
  isOpen={deleteId !== null}
  title="Delete Feedback"
  message="Delete this feedback entry and its attachments? This cannot be undone."
  onCancel={() => (deleteId = null)}
  onConfirm={() => {
    if (deleteId !== null) {
      const form = document.createElement("form");
      form.method = "POST";
      form.action = "?/delete";
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = "id";
      input.value = String(deleteId);
      form.appendChild(input);
      document.body.appendChild(form);
      form.submit();
    }
  }}
/>
