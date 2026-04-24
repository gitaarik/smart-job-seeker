<script lang="ts">
  import type { PageData } from "./$types";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faFileAlt,
    faDownload,
    faExclamationTriangle,
    faCheckCircle,
  } from "@fortawesome/free-solid-svg-icons";
  import Card from "../../components/Card.svelte";

  let { data }: { data: PageData } = $props();

  let files = $derived((data as any).files);
  let total = $derived((data as any).total);
  let page = $derived((data as any).page);
  let totalPages = $derived((data as any).totalPages);
  let typeFilter = $derived((data as any).typeFilter);
  let usageFilter = $derived((data as any).usageFilter);

  const typeFilters = [
    { value: "", label: "All types" },
    { value: "pdf", label: "PDF" },
    { value: "image", label: "Images" },
    { value: "document", label: "Documents" },
    { value: "json", label: "JSON" },
  ];

  const usageFilters = [
    { value: "", label: "All usage" },
    { value: "cv", label: "Source CVs" },
    { value: "application", label: "Applications" },
    { value: "feedback", label: "Feedback" },
    { value: "export", label: "Exports" },
    { value: "orphan", label: "Orphaned" },
  ];

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

  function formatFileSize(bytes: number | null): string {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function buildUrl(params: Record<string, string>): string {
    const base = "/admin/files";
    const search = new URLSearchParams();
    const merged = { type: typeFilter, usage: usageFilter, page: "1", ...params };
    for (const [k, v] of Object.entries(merged)) {
      if (v) search.set(k, v);
    }
    const qs = search.toString();
    return qs ? `${base}?${qs}` : base;
  }

  function getUsageLabels(file: any): { label: string; detail: string }[] {
    const labels: { label: string; detail: string }[] = [];
    for (const p of file.profiles || []) {
      labels.push({ label: "Source CV", detail: p.name || `Profile #${p.id}` });
    }
    for (const af of file.applications_files || []) {
      const app = af.application;
      if (app) {
        const job = app.job;
        labels.push({
          label: "Application",
          detail: job ? `${job.title} @ ${job.company}` : `#${app.id}`,
        });
      }
    }
    for (const ff of file.user_feedback_files || []) {
      const fb = ff.user_feedback;
      if (fb) {
        labels.push({ label: "Feedback", detail: `#${fb.id} (${fb.category})` });
      }
    }
    for (const pe of file.profile_exports || []) {
      labels.push({ label: "Export", detail: `#${pe.id}` });
    }
    return labels;
  }

  function getTypeColor(type: string | null): string {
    if (!type) return "bg-gray-100 text-gray-600";
    if (type.includes("pdf")) return "bg-red-100 text-red-700";
    if (type.startsWith("image/")) return "bg-green-100 text-green-700";
    if (type.includes("json")) return "bg-yellow-100 text-yellow-700";
    if (type.includes("word") || type.includes("document")) return "bg-blue-100 text-blue-700";
    if (type.includes("html") || type.includes("text")) return "bg-purple-100 text-purple-700";
    return "bg-gray-100 text-gray-600";
  }

  function getShortType(type: string | null): string {
    if (!type) return "unknown";
    if (type.includes("pdf")) return "PDF";
    if (type === "image/png") return "PNG";
    if (type === "image/jpeg") return "JPEG";
    if (type === "image/webp") return "WebP";
    if (type === "image/gif") return "GIF";
    if (type === "image/avif") return "AVIF";
    if (type.includes("json")) return "JSON";
    if (type.includes("word") || type.includes("document")) return "DOCX";
    if (type.includes("html")) return "HTML";
    if (type.includes("text")) return "TXT";
    return type.split("/").pop() || type;
  }

  let expandedFile = $state<string | null>(null);
</script>

<div class="space-y-6">
  <div class="flex items-center justify-between">
    <div class="flex items-center gap-2">
      <FontAwesomeIcon icon={faFileAlt} class="w-5 h-5 text-[var(--dash-primary)]" />
      <h1 class="text-lg font-semibold text-[var(--dash-text)]">Files</h1>
      <span class="text-sm text-[var(--dash-text-muted)]">({total})</span>
    </div>
  </div>

  <!-- Type filters -->
  <div class="flex flex-wrap gap-2">
    {#each typeFilters as f}
      <a
        href={buildUrl({ type: f.value, page: "1" })}
        class="px-3 py-1.5 text-sm rounded-lg border transition-colors {typeFilter === f.value
          ? 'border-[var(--dash-primary)] bg-[var(--dash-primary)]/10 text-[var(--dash-primary)] font-medium'
          : 'border-[var(--dash-border)] text-[var(--dash-text-secondary)] hover:border-[var(--dash-text-muted)]'}"
      >
        {f.label}
      </a>
    {/each}
  </div>

  <!-- Usage filters -->
  <div class="flex flex-wrap gap-1.5">
    {#each usageFilters as f}
      <a
        href={buildUrl({ usage: f.value, page: "1" })}
        class="px-2 py-0.5 text-xs rounded-full border transition-colors {usageFilter === f.value
          ? 'border-[var(--dash-primary)] bg-[var(--dash-primary)]/10 text-[var(--dash-primary)]'
          : 'border-[var(--dash-border)] text-[var(--dash-text-muted)] hover:border-[var(--dash-text-muted)]'}"
      >
        {f.label}
      </a>
    {/each}
  </div>

  <!-- File list -->
  {#if files.length === 0}
    <Card padding="lg">
      <p class="text-sm text-[var(--dash-text-muted)] text-center py-8">No files found.</p>
    </Card>
  {:else}
    <div class="space-y-2">
      {#each files as file (file.id)}
        {@const usageLabels = getUsageLabels(file)}
        <Card padding="sm">
          <button
            type="button"
            class="w-full text-left"
            onclick={() => expandedFile = expandedFile === file.id ? null : file.id}
          >
            <div class="flex items-center gap-3">
              <!-- Type badge -->
              <span class="text-xs px-2 py-0.5 rounded-full {getTypeColor(file.type)} flex-shrink-0">
                {getShortType(file.type)}
              </span>

              <!-- Filename -->
              <span class="text-sm text-[var(--dash-text)] truncate min-w-0 flex-1">
                {file.filename_download || file.filename_disk || file.id}
              </span>

              <!-- Usage badges -->
              <div class="flex items-center gap-1.5 flex-shrink-0">
                {#each usageLabels as u}
                  <span class="text-xs px-1.5 py-0.5 rounded bg-[var(--dash-bg)] border border-[var(--dash-border)] text-[var(--dash-text-muted)]">
                    {u.label}
                  </span>
                {/each}
                {#if usageLabels.length === 0}
                  <span class="text-xs px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-600">
                    Orphaned
                  </span>
                {/if}
              </div>

              <!-- Import log indicator -->
              {#if file.importLogs.length > 0}
                {@const hasError = file.importLogs.some((l: any) => l.event.includes("error"))}
                <FontAwesomeIcon
                  icon={hasError ? faExclamationTriangle : faCheckCircle}
                  class="w-3.5 h-3.5 flex-shrink-0 {hasError ? 'text-amber-500' : 'text-green-500'}"
                  title={hasError ? "Import had errors" : "Import successful"}
                />
              {/if}

              <!-- Size & date -->
              <span class="text-xs text-[var(--dash-text-muted)] flex-shrink-0 w-16 text-right">
                {formatFileSize(file.filesize)}
              </span>
              <span class="text-xs text-[var(--dash-text-muted)] flex-shrink-0 w-28 text-right hidden sm:block">
                {formatDate(file.created_on)}
              </span>

              <!-- Download -->
              <a
                href="/assets/{file.id}"
                class="p-1 text-[var(--dash-text-muted)] hover:text-[var(--dash-primary)] transition-colors flex-shrink-0"
                title="Download"
                onclick={(e) => e.stopPropagation()}
              >
                <FontAwesomeIcon icon={faDownload} class="w-3.5 h-3.5" />
              </a>
            </div>
          </button>

          <!-- Expanded details -->
          {#if expandedFile === file.id}
            <div class="mt-3 pt-3 border-t border-[var(--dash-border)] space-y-3">
              <!-- File metadata -->
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span class="text-[var(--dash-text-muted)]">ID</span>
                  <p class="text-[var(--dash-text)] font-mono text-[10px] break-all">{file.id}</p>
                </div>
                <div>
                  <span class="text-[var(--dash-text-muted)]">Disk name</span>
                  <p class="text-[var(--dash-text)] break-all">{file.filename_disk || "—"}</p>
                </div>
                <div>
                  <span class="text-[var(--dash-text-muted)]">MIME type</span>
                  <p class="text-[var(--dash-text)]">{file.type || "—"}</p>
                </div>
                <div>
                  <span class="text-[var(--dash-text-muted)]">Created</span>
                  <p class="text-[var(--dash-text)]">{formatDate(file.created_on)}</p>
                </div>
                {#if file.title && file.title !== file.filename_download}
                  <div class="col-span-2">
                    <span class="text-[var(--dash-text-muted)]">Title</span>
                    <p class="text-[var(--dash-text)]">{file.title}</p>
                  </div>
                {/if}
                {#if file.description}
                  <div class="col-span-2">
                    <span class="text-[var(--dash-text-muted)]">Description</span>
                    <p class="text-[var(--dash-text)]">{file.description}</p>
                  </div>
                {/if}
              </div>

              <!-- Usage details -->
              {#if usageLabels.length > 0}
                <div>
                  <span class="text-xs text-[var(--dash-text-muted)]">Used by</span>
                  <div class="flex flex-wrap gap-1.5 mt-1">
                    {#each usageLabels as u}
                      <span class="text-xs px-2 py-0.5 rounded bg-[var(--dash-bg)] border border-[var(--dash-border)] text-[var(--dash-text-secondary)]">
                        <span class="font-medium">{u.label}:</span> {u.detail}
                      </span>
                    {/each}
                  </div>
                </div>
              {/if}

              <!-- Import logs -->
              {#if file.importLogs.length > 0}
                <div>
                  <span class="text-xs text-[var(--dash-text-muted)]">Import history</span>
                  <div class="mt-1 space-y-1.5">
                    {#each file.importLogs as log}
                      <div class="text-xs rounded p-2 {log.event.includes('error')
                        ? 'bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/30'
                        : 'bg-[var(--dash-bg)] border border-[var(--dash-border)]'}">
                        <div class="flex items-center gap-2 flex-wrap">
                          <span class="font-medium {log.event.includes('error') ? 'text-red-600 dark:text-red-400' : 'text-[var(--dash-text)]'}">
                            {log.event}
                          </span>
                          {#if log.file_format}
                            <span class="text-[var(--dash-text-muted)]">{log.file_format}</span>
                          {/if}
                          {#if log.user_email}
                            <span class="text-[var(--dash-text-muted)]">{log.user_email}</span>
                          {/if}
                          <span class="text-[var(--dash-text-muted)]">{formatDate(log.date_created)}</span>
                        </div>
                        {#if log.error}
                          <p class="mt-1 text-red-600 dark:text-red-400">{log.error}</p>
                        {/if}
                        {#if log.sections}
                          <p class="mt-1 text-[var(--dash-text-muted)]">
                            Sections: {Object.entries(log.sections as Record<string, number>).map(([k, v]) => `${k}: ${v}`).join(", ")}
                          </p>
                        {/if}
                      </div>
                    {/each}
                  </div>
                </div>
              {/if}
            </div>
          {/if}
        </Card>
      {/each}
    </div>
  {/if}

  <!-- Pagination -->
  {#if totalPages > 1}
    <div class="flex items-center justify-center gap-2">
      {#if page > 1}
        <a
          href={buildUrl({ page: String(page - 1) })}
          class="px-3 py-1.5 text-sm rounded-lg border border-[var(--dash-border)] text-[var(--dash-text-secondary)] hover:border-[var(--dash-text-muted)] transition-colors"
        >
          Previous
        </a>
      {/if}
      <span class="text-sm text-[var(--dash-text-muted)]">
        Page {page} of {totalPages}
      </span>
      {#if page < totalPages}
        <a
          href={buildUrl({ page: String(page + 1) })}
          class="px-3 py-1.5 text-sm rounded-lg border border-[var(--dash-border)] text-[var(--dash-text-secondary)] hover:border-[var(--dash-text-muted)] transition-colors"
        >
          Next
        </a>
      {/if}
    </div>
  {/if}
</div>
