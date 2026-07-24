<script lang="ts">
import type { ActionData, PageData } from "./$types";
import { invalidateAll } from "$app/navigation";
import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
import {
  faChevronDown,
  faChevronRight,
  faCloudArrowUp,
  faFileLines,
  faFileZipper,
  faKey,
  faTrash,
  faTriangleExclamation,
} from "@fortawesome/free-solid-svg-icons";
import Card from "../../../components/Card.svelte";
import SectionHeader from "../../components/SectionHeader.svelte";
import EmptyState from "../../components/EmptyState.svelte";
import ConfirmModal from "../../components/ConfirmModal.svelte";

let { data, form }: { data: PageData; form: ActionData } = $props();

let uploading = $state(false);
let uploadResult = $state<string | null>(null);
let uploadError = $state<string | null>(null);
let isDragging = $state(false);
let deleteId = $state<number | null>(null);
let expanded = $state<Set<number>>(new Set());

function formatSize(bytes: number): string {
  if (!bytes) return "0 KB";
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function statusClass(status: string): string {
  switch (status) {
    case "extracted":
      return "bg-green-500/10 text-green-600 border-green-500/30";
    case "partial":
      return "bg-amber-500/10 text-amber-600 border-amber-500/30";
    case "failed":
      return "bg-red-500/10 text-red-600 border-red-500/30";
    default:
      return "bg-[var(--dash-bg)] text-[var(--dash-text-muted)] border-[var(--dash-border)]";
  }
}

function toggle(id: number) {
  const next = new Set(expanded);
  next.has(id) ? next.delete(id) : next.add(id);
  expanded = next;
}

async function uploadFiles(files: FileList | File[]) {
  const list = Array.from(files);
  if (list.length === 0 || uploading) return;
  uploading = true;
  uploadError = null;
  uploadResult = null;
  try {
    const fd = new FormData();
    for (const f of list) fd.append("files", f);
    const res = await fetch(`/api/profile/${data.profileId}/documents`, {
      method: "POST",
      body: fd,
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      uploadError = body?.message ?? "Upload failed.";
      return;
    }
    const created: Array<{ secretsRedacted?: number }> = body?.created ?? [];
    const errs: Array<{ filename: string; error: string }> = body?.errors ?? [];
    const redacted = created.reduce((s, c) => s + (c.secretsRedacted ?? 0), 0);
    const parts = [
      `${created.length} ${
        created.length === 1 ? "project" : "projects"
      } added`,
    ];
    if (redacted > 0) {
      parts.push(
        `${redacted} ${redacted === 1 ? "secret" : "secrets"} redacted`,
      );
    }
    uploadResult = created.length > 0 ? parts.join(" · ") : null;
    uploadError = errs.length > 0
      ? errs.map((e) => `${e.filename}: ${e.error}`).join("; ")
      : null;
    await invalidateAll();
  } catch {
    uploadError = "Upload failed.";
  } finally {
    uploading = false;
  }
}

function onDrop(e: DragEvent) {
  e.preventDefault();
  isDragging = false;
  if (e.dataTransfer?.files?.length) uploadFiles(e.dataTransfer.files);
}

function confirmDelete() {
  if (deleteId === null) return;
  const el = document.createElement("form");
  el.method = "POST";
  el.action = "?/delete";
  const input = document.createElement("input");
  input.type = "hidden";
  input.name = "id";
  input.value = String(deleteId);
  el.appendChild(input);
  document.body.appendChild(el);
  el.submit();
}

const kw = (v: unknown): string[] => (Array.isArray(v) ? v as string[] : []);
const skippedCount = (v: unknown): number => (Array.isArray(v) ? v.length : 0);
</script>

<svelte:head>
  <title>Documents - Profile - Smart Job Seeker</title>
</svelte:head>

<div class="space-y-6">
  <SectionHeader
    title="Documents"
    icon={faFileLines}
  />

  <p class="text-sm text-[var(--dash-text-secondary)] -mt-2">
    Upload source code, docs, or a ZIP of a project. We extract the text and
    summarize each into reference notes + key technologies — then cite the ones
    relevant to a job when writing cover letters and answering application
    questions. Original files aren't stored; secrets are redacted.
  </p>

  <!-- Upload -->
  <Card padding="md">
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      role="button"
      tabindex="0"
      ondrop={onDrop}
      ondragover={(e) => {
        e.preventDefault();
        isDragging = true;
      }}
      ondragleave={() => (isDragging = false)}
      class="relative border-2 border-dashed rounded-lg p-8 text-center transition-colors {isDragging
        ? 'border-[var(--dash-primary)] bg-[var(--dash-primary)]/5'
        : 'border-[var(--dash-border)] hover:border-[var(--dash-primary)]/50'}"
    >
      <FontAwesomeIcon icon={faCloudArrowUp} class="w-7 h-7 text-[var(--dash-text-muted)] mb-2" />
      <p class="text-sm text-[var(--dash-text)]">
        {uploading ? "Uploading and analyzing…" : "Drop files or a ZIP here, or click to choose"}
      </p>
      <p class="text-xs text-[var(--dash-text-muted)] mt-1">
        Source code, PDF, DOCX, Markdown, text, or a .zip. Max 100MB per file.
      </p>
      <input
        type="file"
        multiple
        disabled={uploading}
        onchange={(e) => {
          const el = e.currentTarget as HTMLInputElement;
          if (el.files?.length) uploadFiles(el.files);
          el.value = "";
        }}
        class="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-default"
      />
    </div>

    {#if uploadResult}
      <p class="text-sm text-green-600 mt-3">{uploadResult}</p>
    {/if}
    {#if uploadError}
      <p class="text-sm text-[var(--dash-error)] mt-2">{uploadError}</p>
    {/if}
  </Card>

  {#if form?.error}
    <div class="bg-[var(--dash-error-light)] border border-[var(--dash-error)] rounded-lg p-4">
      <p class="text-[var(--dash-error)] text-sm">{form.error}</p>
    </div>
  {/if}

  <!-- List -->
  {#if data.documents.length === 0}
    <EmptyState
      icon={faFileLines}
      title="No documents yet"
      description="Upload a project or document above to get started."
    />
  {:else}
    <div class="space-y-3">
      {#each data.documents as doc (doc.id)}
        {@const keywords = kw(doc.keywords)}
        {@const skipped = skippedCount(doc.skipped)}
        {@const isOpen = expanded.has(doc.id)}
        <Card padding="md">
          <div class="flex items-start gap-3">
            <div class="mt-0.5 text-[var(--dash-text-muted)]">
              <FontAwesomeIcon
                icon={doc.kind === "archive" ? faFileZipper : faFileLines}
                class="w-5 h-5"
              />
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="font-medium text-[var(--dash-text)] truncate">
                  {doc.title || doc.original_filename || "Untitled"}
                </span>
                <span
                  class="text-[10px] font-medium uppercase tracking-wide px-1.5 py-0.5 rounded border {statusClass(doc.status)}"
                >
                  {doc.status}
                </span>
              </div>
              <p class="text-xs text-[var(--dash-text-secondary)] mt-0.5">
                {doc.file_count}
                {doc.file_count === 1 ? "file" : "files"} · {formatSize(doc.total_bytes)}
                {#if skipped > 0}· {skipped} skipped{/if}
              </p>

              {#if keywords.length > 0}
                <div class="flex flex-wrap gap-1.5 mt-2">
                  {#each keywords as k}
                    <span
                      class="text-xs px-2 py-0.5 rounded-full bg-[var(--dash-primary)]/10 text-[var(--dash-primary)] border border-[var(--dash-primary)]/20"
                    >{k}</span>
                  {/each}
                </div>
              {/if}

              {#if doc.summary}
                <button
                  type="button"
                  onclick={() => toggle(doc.id)}
                  class="flex items-center gap-1.5 text-xs text-[var(--dash-text-secondary)] hover:text-[var(--dash-primary)] transition-colors mt-2"
                >
                  <FontAwesomeIcon icon={isOpen ? faChevronDown : faChevronRight} class="w-3 h-3" />
                  {isOpen ? "Hide" : "Show"} reference notes
                </button>
                {#if isOpen}
                  <p class="text-sm text-[var(--dash-text)] whitespace-pre-line mt-2 pl-4 border-l-2 border-[var(--dash-border)]">
                    {doc.summary}
                  </p>
                {/if}
              {:else if doc.status !== "failed"}
                <p class="text-xs text-[var(--dash-text-muted)] italic mt-2 flex items-center gap-1.5">
                  <FontAwesomeIcon icon={faTriangleExclamation} class="w-3 h-3" />
                  No summary was generated for this document.
                </p>
              {/if}
            </div>

            <button
              type="button"
              onclick={() => (deleteId = doc.id)}
              class="p-2 text-[var(--dash-text-secondary)] hover:text-[var(--dash-error)] transition-colors"
              aria-label="Delete document"
            >
              <FontAwesomeIcon icon={faTrash} class="w-4 h-4" />
            </button>
          </div>
        </Card>
      {/each}
    </div>

    <p class="text-xs text-[var(--dash-text-muted)] flex items-center gap-1.5">
      <FontAwesomeIcon icon={faKey} class="w-3 h-3" />
      Detected credentials in uploaded files are redacted before storage.
    </p>
  {/if}
</div>

<ConfirmModal
  isOpen={deleteId !== null}
  title="Delete document"
  message="Permanently delete this document and its extracted notes? This cannot be undone."
  confirmLabel="Delete"
  onCancel={() => (deleteId = null)}
  onConfirm={confirmDelete}
/>
