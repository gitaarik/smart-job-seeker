<script lang="ts">
import { invalidateAll } from "$app/navigation";
import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
import {
  faArrowsRotate,
  faChevronDown,
  faChevronRight,
  faCloudArrowUp,
  faFileLines,
  faFileZipper,
  faTrash,
} from "@fortawesome/free-solid-svg-icons";
import ConfirmModal from "./ConfirmModal.svelte";

interface DocRow {
  id: number;
  kind: string;
  title: string | null;
  original_filename: string | null;
  status: string;
  summary: string | null;
  keywords: unknown;
  skipped: unknown;
  file_count: number;
  total_bytes: number;
}

let {
  profileId,
  workExperienceProjectId = null,
  sideProjectId = null,
  documents,
}: {
  profileId: number;
  workExperienceProjectId?: number | null;
  sideProjectId?: number | null;
  documents: DocRow[];
} = $props();

let uploading = $state(false);
let error = $state<string | null>(null);
let isDragging = $state(false);
let deleteId = $state<number | null>(null);
let reparsingId = $state<number | null>(null);
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

const kw = (v: unknown): string[] => (Array.isArray(v) ? v as string[] : []);
const skippedCount = (v: unknown): number => (Array.isArray(v) ? v.length : 0);

function toggle(id: number) {
  const next = new Set(expanded);
  next.has(id) ? next.delete(id) : next.add(id);
  expanded = next;
}

async function uploadFiles(files: FileList | File[]) {
  const list = Array.from(files);
  if (list.length === 0 || uploading) return;
  uploading = true;
  error = null;
  try {
    const fd = new FormData();
    for (const f of list) fd.append("files", f);
    if (workExperienceProjectId != null) {
      fd.append("work_experience_project_id", String(workExperienceProjectId));
    }
    if (sideProjectId != null) {
      fd.append("side_project_id", String(sideProjectId));
    }

    const res = await fetch(`/api/profile/${profileId}/documents`, {
      method: "POST",
      body: fd,
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      error = body?.message ?? "Upload failed.";
      return;
    }
    const errs: Array<{ filename: string; error: string }> = body?.errors ?? [];
    error = errs.length > 0
      ? errs.map((e) => `${e.filename}: ${e.error}`).join("; ")
      : null;
    await invalidateAll();
  } catch {
    error = "Upload failed.";
  } finally {
    uploading = false;
  }
}

async function reparse(id: number) {
  if (reparsingId !== null) return;
  reparsingId = id;
  error = null;
  try {
    const res = await fetch(
      `/api/profile/${profileId}/documents/${id}/reparse`,
      { method: "POST" },
    );
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      error = body?.message ?? "Could not regenerate notes.";
      return;
    }
    await invalidateAll();
  } catch {
    error = "Could not regenerate notes.";
  } finally {
    reparsingId = null;
  }
}

async function doDelete() {
  if (deleteId === null) return;
  const id = deleteId;
  deleteId = null;
  try {
    const res = await fetch(`/api/profile/${profileId}/documents/${id}`, {
      method: "DELETE",
    });
    if (res.ok) await invalidateAll();
    else error = "Could not delete document.";
  } catch {
    error = "Could not delete document.";
  }
}
</script>

<div class="space-y-3">
  <!-- Upload -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    role="button"
    tabindex="0"
    ondrop={(e) => {
      e.preventDefault();
      isDragging = false;
      if (e.dataTransfer?.files?.length) uploadFiles(e.dataTransfer.files);
    }}
    ondragover={(e) => {
      e.preventDefault();
      isDragging = true;
    }}
    ondragleave={() => (isDragging = false)}
    class="relative border-2 border-dashed rounded-lg p-4 text-center transition-colors {isDragging
      ? 'border-[var(--dash-primary)] bg-[var(--dash-primary)]/5'
      : 'border-[var(--dash-border)] hover:border-[var(--dash-primary)]/50'}"
  >
    <FontAwesomeIcon icon={faCloudArrowUp} class="w-5 h-5 text-[var(--dash-text-muted)]" />
    <p class="text-sm text-[var(--dash-text)] mt-1">
      {uploading
        ? "Uploading and analyzing…"
        : "Drop source code, docs, or a ZIP here — or click to choose"}
    </p>
    <p class="text-xs text-[var(--dash-text-muted)] mt-0.5">
      We extract the text and summarize it; original files aren't stored, secrets are redacted.
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

  {#if error}
    <p class="text-sm text-[var(--dash-error)]">{error}</p>
  {/if}

  {#each documents as doc (doc.id)}
    {@const keywords = kw(doc.keywords)}
    {@const skipped = skippedCount(doc.skipped)}
    {@const isOpen = expanded.has(doc.id)}
    <div class="border border-[var(--dash-border)] rounded-lg p-3">
      <div class="flex items-start gap-3">
        <FontAwesomeIcon
          icon={doc.kind === "archive" ? faFileZipper : faFileLines}
          class="w-4 h-4 mt-0.5 text-[var(--dash-text-muted)]"
        />
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="text-sm font-medium text-[var(--dash-text)] truncate">
              {doc.title || doc.original_filename || "Untitled"}
            </span>
            <span
              class="text-[10px] font-medium uppercase tracking-wide px-1.5 py-0.5 rounded border {statusClass(doc.status)}"
            >{doc.status}</span>
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
              <p class="text-sm text-[var(--dash-text)] whitespace-pre-line mt-2 pl-3 border-l-2 border-[var(--dash-border)]">
                {doc.summary}
              </p>
            {/if}
          {/if}
        </div>

        <div class="flex items-center gap-0.5">
          <button
            type="button"
            onclick={() => reparse(doc.id)}
            disabled={reparsingId === doc.id}
            class="p-1.5 text-[var(--dash-text-secondary)] hover:text-[var(--dash-primary)] transition-colors disabled:opacity-50"
            aria-label="Regenerate notes"
            title="Regenerate reference notes"
          >
            <FontAwesomeIcon icon={faArrowsRotate} spin={reparsingId === doc.id} class="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onclick={() => (deleteId = doc.id)}
            class="p-1.5 text-[var(--dash-text-secondary)] hover:text-[var(--dash-error)] transition-colors"
            aria-label="Delete document"
          >
            <FontAwesomeIcon icon={faTrash} class="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  {/each}
</div>

<ConfirmModal
  isOpen={deleteId !== null}
  title="Delete document"
  message="Permanently delete this document and its extracted notes? This cannot be undone."
  confirmLabel="Delete"
  onCancel={() => (deleteId = null)}
  onConfirm={doDelete}
/>
