<script lang="ts">
import type { ActionData, PageData } from "./$types";
import { deserialize, enhance } from "$app/forms";
import { invalidateAll } from "$app/navigation";
import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
import {
  faCheck,
  faCloudUploadAlt,
  faDownload,
  faExternalLinkAlt,
  faFile,
  faFileAlt,
  faFileImage,
  faFilePdf,
  faFileWord,
  faSave,
  faTrash,
} from "@fortawesome/free-solid-svg-icons";
import Card from "../../../components/Card.svelte";
import EmptyState from "../../../profile/components/EmptyState.svelte";
import ConfirmModal from "../../../profile/components/ConfirmModal.svelte";
import { profileDocUrl } from "$lib/utils/profile-doc-url";
import type { DocType } from "$lib/utils/profile-doc-url";

let { data, form }: { data: PageData; form: ActionData } = $props();

let app = $derived(data.application);
let files = $derived(app.applications_files || []);
let versions = $derived(
  (data as any).versions as { slug: string; name: string }[] || [],
);

const MAX_FILE_BYTES = 10 * 1024 * 1024;

let deleteFileId = $state<number | null>(null);
let uploading = $state(false);
let uploadDone = $state(0);
let uploadTotal = $state(0);
let uploadErrors = $state<string[]>([]);
let isDragging = $state(false);
let cvSaved = $state(false);
let docType = $state<string>(app.cv_sent_through || "resume");
let profileSlug = $derived(
  (data as any).selectedProfile?.slug as string | undefined,
);

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "Unknown size";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(mimeType: string | null) {
  if (!mimeType) return faFile;
  if (mimeType.includes("pdf")) return faFilePdf;
  if (mimeType.includes("image")) return faFileImage;
  if (mimeType.includes("word") || mimeType.includes("document")) {
    return faFileWord;
  }
  return faFile;
}

function getFileIconColor(mimeType: string | null): string {
  if (!mimeType) return "text-[var(--dash-text-muted)]";
  if (mimeType.includes("pdf")) return "text-red-500";
  if (mimeType.includes("image")) return "text-blue-500";
  if (mimeType.includes("word")) return "text-blue-600";
  return "text-[var(--dash-text-muted)]";
}

type UploadResult =
  | {
    type: "success";
    data?: { errors?: { filename: string; error: string }[] };
  }
  | { type: "failure"; data?: { error?: string } }
  | { type: "redirect"; location: string }
  | { type: "error"; error?: { message?: string } };

/**
 * Upload a selection one request at a time. BODY_SIZE_LIMIT (10M in
 * production) caps the whole request, so posting a batch would reject every
 * file in it as soon as the total crossed the line — and the failure would
 * come from the adapter, before the action's own per-file check could name
 * the offender. One file per request keeps each failure attributable.
 */
async function uploadFiles(selection: FileList | File[]) {
  const list = Array.from(selection);
  if (list.length === 0 || uploading) return;

  uploading = true;
  uploadErrors = [];
  uploadDone = 0;
  uploadTotal = list.length;

  for (const file of list) {
    // Checked here as well as server-side so an oversized file is named
    // rather than dying as a transport-level 413.
    if (file.size > MAX_FILE_BYTES) {
      uploadErrors.push(`${file.name}: exceeds the 10MB limit`);
      uploadDone++;
      continue;
    }
    try {
      const fd = new FormData();
      fd.append("file", file);
      // The header is what use:enhance sends to mark a POST as a form action
      // rather than an endpoint request, and it gets us the devalue-encoded
      // action result back. Set it explicitly: without it SvelteKit resolves
      // any non-text/html POST to a sibling +server.ts if one ever exists at
      // this route, which answers 405 for an action it does not export.
      const res = await fetch("?/uploadFile", {
        method: "POST",
        body: fd,
        headers: { "x-sveltekit-action": "true" },
      });
      const result = deserialize(await res.text()) as UploadResult;
      if (result.type === "success") {
        for (const e of result.data?.errors ?? []) {
          uploadErrors.push(`${e.filename}: ${e.error}`);
        }
      } else if (result.type === "failure") {
        uploadErrors.push(
          `${file.name}: ${result.data?.error ?? "upload failed"}`,
        );
      } else if (result.type === "error") {
        uploadErrors.push(
          `${file.name}: ${result.error?.message ?? "upload failed"}`,
        );
      }
    } catch {
      uploadErrors.push(`${file.name}: upload failed`);
    }
    uploadDone++;
  }

  uploading = false;
  await invalidateAll();
}

function handleCvSubmit() {
  return async (
    { result, update }: {
      result: { type: string };
      update: () => Promise<void>;
    },
  ) => {
    await update();
    if (result.type === "success") {
      cvSaved = true;
      setTimeout(() => {
        cvSaved = false;
      }, 2000);
    }
  };
}
</script>

<div class="space-y-6">
  {#if form?.error}
    <div class="bg-[var(--dash-error-light)] border border-[var(--dash-error)] rounded-lg p-4">
      <p class="text-[var(--dash-error)] text-sm">{form.error}</p>
    </div>
  {/if}

  <!-- Section 1: CV / Resume Sent -->
  <div>
    <div class="flex items-center gap-2 mb-3">
      <FontAwesomeIcon icon={faFileAlt} class="w-5 h-5 text-[var(--dash-primary)]" />
      <h2 class="text-lg font-semibold text-[var(--dash-text)]">Resume / CV Sent</h2>
    </div>

    <Card padding="lg">
      <p class="text-xs text-[var(--dash-text-muted)] mb-4">
        Track which version you sent, so you can open the same one they'll have during an interview.
      </p>
      <form method="POST" action="?/setCvSent" use:enhance={handleCvSubmit}>
        <!-- Document type segmented control -->
        <input type="hidden" name="cv_sent_through" value={docType} />
        <div class="inline-flex rounded-lg border border-[var(--dash-border)] overflow-hidden mb-3">
          {#each [{ value: "resume", label: "Resume" }, { value: "cv", label: "CV" }] as opt, i}
            <button
              type="button"
              onclick={() => (docType = opt.value)}
              class="px-3 py-1.5 text-sm transition-colors {docType === opt.value
                ? 'bg-[var(--dash-primary)]/10 text-[var(--dash-primary)] font-medium'
                : 'text-[var(--dash-text-secondary)] hover:bg-[var(--dash-bg)]'} {i > 0 ? 'border-l border-[var(--dash-border)]' : ''}"
            >
              {opt.label}
            </button>
          {/each}
        </div>

        <!-- Version selector -->
        <div class="flex flex-col sm:flex-row gap-2">
          <select
            name="version_slug"
            class="flex-1 px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent text-sm"
          >
            <option value="">Select</option>
            {#each versions as v}
              <option value={v.slug} selected={v.slug === app.cv_version_sent}>
                {v.name}
              </option>
            {/each}
          </select>
          <button
            type="submit"
            class="flex items-center justify-center gap-2 px-4 py-2 bg-[var(--dash-primary)] text-white rounded-lg hover:bg-[var(--dash-primary-hover)] transition-colors text-sm"
          >
            {#if cvSaved}
              <FontAwesomeIcon icon={faCheck} class="w-3.5 h-3.5" />
              Saved
            {:else}
              <FontAwesomeIcon icon={faSave} class="w-3.5 h-3.5" />
              Set
            {/if}
          </button>
        </div>
      </form>

      {#if app.cv_version_sent && app.cv_sent_through && profileSlug}
        {@const dt = app.cv_sent_through as DocType}
        <div class="flex items-center gap-3 mt-4 pt-4 border-t border-[var(--dash-border)]">
          <a
            href={profileDocUrl({ profileSlug, docType: dt, versionSlug: app.cv_version_sent })}
            target="_blank"
            class="dash-link-ext"
          >
            <FontAwesomeIcon icon={faExternalLinkAlt} class="w-3 h-3" />
            Open {dt === "cv" ? "CV" : "Resume"}
          </a>
          <a
            href={profileDocUrl({ profileSlug, docType: dt, versionSlug: app.cv_version_sent, pdf: true })}
            target="_blank"
            class="dash-link-ext"
          >
            <FontAwesomeIcon icon={faFilePdf} class="w-3 h-3" />
            PDF
          </a>
        </div>
      {/if}
    </Card>
  </div>

  <!-- Section 2: Attached Files -->
  <div>
    <div class="flex items-center gap-2 mb-3">
      <FontAwesomeIcon icon={faCloudUploadAlt} class="w-5 h-5 text-[var(--dash-primary)]" />
      <h2 class="text-lg font-semibold text-[var(--dash-text)]">Attached Files</h2>
    </div>

    <!-- Upload -->
    <Card padding="md">
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
        class="relative flex items-center justify-center gap-3 px-4 py-6 border-2 border-dashed rounded-lg transition-colors {isDragging
          ? 'border-[var(--dash-primary)] bg-[var(--dash-primary)]/5'
          : 'border-[var(--dash-border)] hover:border-[var(--dash-primary)] hover:bg-[var(--dash-bg)]'}"
      >
        <FontAwesomeIcon icon={faCloudUploadAlt} class="w-5 h-5 text-[var(--dash-text-muted)]" />
        <span class="text-sm text-[var(--dash-text-secondary)]">
          {uploading
            ? `Uploading ${uploadDone + 1} of ${uploadTotal}…`
            : "Choose files or drag them here (max 10MB each)"}
        </span>
        <input
          type="file"
          name="file"
          multiple
          disabled={uploading}
          onchange={(e) => {
            const input = e.currentTarget as HTMLInputElement;
            if (input.files?.length) uploadFiles(input.files);
            // Reset so re-picking the same file fires change again.
            input.value = "";
          }}
          class="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-default"
        />
      </div>

      {#if uploadErrors.length > 0}
        <ul class="mt-3 space-y-1">
          {#each uploadErrors as message}
            <li class="text-sm text-[var(--dash-error)]">{message}</li>
          {/each}
        </ul>
      {/if}
    </Card>

    <!-- File List -->
    {#if files.length === 0}
      <div class="mt-4">
        <EmptyState
          icon={faFile}
          title="No files attached"
          description="Upload documents related to this application — offer letters, coding challenges, certificates, etc."
        />
      </div>
    {:else}
      <div class="space-y-2 mt-4">
        {#each files as fileRecord (fileRecord.id)}
          {@const file = fileRecord.file}
          {#if file}
            <Card padding="sm">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-3 min-w-0">
                  <FontAwesomeIcon icon={getFileIcon(file.type)} class="w-5 h-5 {getFileIconColor(file.type)} flex-shrink-0" />
                  <div class="min-w-0">
                    <p class="text-sm font-medium text-[var(--dash-text)] truncate">{file.filename_download}</p>
                    <p class="text-xs text-[var(--dash-text-muted)]">
                      {formatFileSize(file.filesize)}
                      {#if file.type}
                        <span class="mx-1">&middot;</span>{file.type}
                      {/if}
                    </p>
                  </div>
                </div>
                <div class="flex items-center gap-2 flex-shrink-0">
                  <!-- data-sveltekit-reload: the target is a server endpoint
                       with no page, so it must be a real browser navigation,
                       not a client-side route lookup. -->
                  <a
                    href="/applications/{app.id}/documents/download?fileId={file.id}"
                    data-sveltekit-reload
                    class="p-2 text-[var(--dash-text-secondary)] hover:text-[var(--dash-primary)] transition-colors"
                    aria-label="Download"
                  >
                    <FontAwesomeIcon icon={faDownload} class="w-4 h-4" />
                  </a>
                  <button
                    type="button"
                    onclick={() => (deleteFileId = fileRecord.id)}
                    class="p-2 text-[var(--dash-text-secondary)] hover:text-[var(--dash-error)] transition-colors"
                    aria-label="Delete"
                  >
                    <FontAwesomeIcon icon={faTrash} class="w-4 h-4" />
                  </button>
                </div>
              </div>
            </Card>
          {/if}
        {/each}
      </div>
    {/if}
  </div>
</div>

<!-- Delete Confirmation Modal -->
<ConfirmModal
  isOpen={deleteFileId !== null}
  title="Delete File"
  message="Are you sure you want to delete this file? This action cannot be undone."
  onCancel={() => (deleteFileId = null)}
  onConfirm={() => {
    if (deleteFileId !== null) {
      const form = document.createElement("form");
      form.method = "POST";
      form.action = "?/deleteFile";
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = "id";
      input.value = String(deleteFileId);
      form.appendChild(input);
      document.body.appendChild(form);
      form.submit();
    }
  }}
/>
