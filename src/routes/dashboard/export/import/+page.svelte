<script lang="ts">
  import type { ActionData, PageData } from "./$types";
  import type { ResumeData } from "$lib/server/resume/types";
  import { page } from "$app/stores";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faFileImport,
    faBug,
    faChevronDown,
    faChevronRight,
    faDownload,
    faRotateRight,
  } from "@fortawesome/free-solid-svg-icons";
  import SectionHeader from "../../profile/components/SectionHeader.svelte";
  import Card from "../../components/Card.svelte";

  import StepUpload from "./components/StepUpload.svelte";
  import StepDiffReview from "./components/StepDiffReview.svelte";

  let { data, form }: { data: PageData; form: ActionData } = $props();

  // Wizard state
  let showDiffReview = $state(false);
  let incomingData = $state<ResumeData | null>(null);
  let isLoading = $state(false);
  let error = $state<string | null>(form?.error || null);

  // Current profile data from server (fall back to empty for diff)
  const emptyProfile: ResumeData = { basics: { name: "" } };
  const currentData = $derived(data.currentProfileData ?? emptyProfile);

  function handleParsed(
    parsed: ResumeData,
    source: "upload" | "import" | "jsonResume",
  ) {
    incomingData = parsed;
    showDiffReview = true;
    error = null;
  }

  function handleBackFromReview() {
    showDiffReview = false;
    incomingData = null;
    error = null;
  }

  function handleError(msg: string) {
    error = msg;
  }

  function handleLoadingChange(loading: boolean) {
    isLoading = loading;
  }

  // Admin
  const isAdmin = $derived(
    ($page.data.user as { is_admin?: boolean })?.is_admin ||
    !!$page.data.adminUser,
  );
  let logsOpen = $state(false);
  let expandedLogId = $state<number | null>(null);
  let reparseLogId = $state<number | null>(null);

  async function reparseFromLog(logId: number) {
    reparseLogId = logId;
    isLoading = true;
    error = null;
    try {
      const res = await fetch("/api/resume/reparse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logId }),
      });

      if (!res.ok) {
        let message = "Re-parse failed";
        try {
          const errData = await res.json();
          message = errData.message || errData.error || message;
        } catch {}
        error = message;
        return;
      }

      const result = await res.json();
      if (result.success && result.parsedData) {
        handleParsed(result.parsedData as ResumeData, "upload");
      } else {
        error = "Failed to parse file";
      }
    } catch (e) {
      error = e instanceof Error ? e.message : "Re-parse failed";
    } finally {
      isLoading = false;
      reparseLogId = null;
    }
  }

  const eventColors: Record<string, string> = {
    parse: "bg-blue-500/15 text-blue-700 border-blue-500/30",
    apply: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
    parse_error: "bg-red-500/15 text-red-700 border-red-500/30",
    apply_error: "bg-red-500/15 text-red-700 border-red-500/30",
  };

  const sectionLabels: Record<string, string> = {
    basics: "Basics",
    work: "Work",
    education: "Education",
    skills: "Skills",
    languages: "Languages",
    projects: "Projects",
    references: "References",
  };

  function formatDate(iso: string) {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  function formatSectionsCompact(sections: unknown): string {
    if (!sections || typeof sections !== "object") return "";
    return Object.entries(sections as Record<string, number>)
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ");
  }

  function formatChangesCompact(changes: unknown): string {
    if (!changes || typeof changes !== "object") return "";
    return Object.entries(changes as Record<string, Record<string, number>>)
      .map(([section, counts]) => {
        const parts = Object.entries(counts)
          .map(([op, n]) => op === "added" ? `+${n}` : op === "removed" ? `-${n}` : op === "modified" ? `~${n}` : `${op}:${n}`)
          .join(",");
        return `${section}(${parts})`;
      })
      .join(", ");
  }
</script>

<svelte:head>
  <title>Import Data - Smart Job Seeker</title>
</svelte:head>

<div class="space-y-6">
  <SectionHeader
    title={showDiffReview ? "Review Changes" : "Import Data"}
    icon={faFileImport}
  />

  {#if showDiffReview && incomingData}
    <StepDiffReview
      {currentData}
      {incomingData}
      {isLoading}
      {error}
      onBack={handleBackFromReview}
      onLoadingChange={handleLoadingChange}
    />
  {:else}
    <StepUpload
      {isLoading}
      {error}
      onParsed={handleParsed}
      onError={handleError}
      onLoadingChange={handleLoadingChange}
    />

    {#if !data.currentProfileData}
      <div
        class="rounded-lg border border-amber-200 bg-amber-50 p-4"
      >
        <p class="text-sm text-amber-800">
          No profile is currently selected. Import will compare against an empty profile.
        </p>
      </div>
    {/if}
  {/if}

  <!-- Admin import logs -->
  {#if isAdmin && data.importLogs && data.importLogs.length > 0}
    <Card padding="responsive">
      <button
        type="button"
        onclick={() => (logsOpen = !logsOpen)}
        class="flex items-center gap-2 w-full text-left text-sm font-medium text-[var(--dash-text-muted)] hover:text-[var(--dash-text)] transition-colors"
      >
        <FontAwesomeIcon icon={faBug} class="w-3.5 h-3.5" />
        Import Logs ({data.importLogs.length})
        <FontAwesomeIcon icon={logsOpen ? faChevronDown : faChevronRight} class="w-3 h-3 ml-auto" />
      </button>
      {#if logsOpen}
        <div class="mt-3 max-h-[32rem] overflow-y-auto divide-y divide-[var(--dash-border)]">
          {#each data.importLogs as log}
            {@const isExpanded = expandedLogId === log.id}
            {@const hasDetails = log.parsed_data || log.changes || log.sections || log.file_id}
            <div class="py-2">
              <!-- Summary row -->
              <button
                type="button"
                onclick={() => (expandedLogId = isExpanded ? null : log.id)}
                class="flex flex-wrap items-center gap-x-2 gap-y-0.5 w-full text-left text-xs hover:bg-[var(--dash-bg)]/50 rounded px-1 -mx-1 py-0.5 transition-colors"
              >
                {#if hasDetails}
                  <FontAwesomeIcon icon={isExpanded ? faChevronDown : faChevronRight} class="w-2.5 h-2.5 text-[var(--dash-text-muted)] shrink-0" />
                {/if}
                <span class="text-[var(--dash-text-muted)] whitespace-nowrap shrink-0">
                  {formatDate(log.date_created)}
                </span>
                <span class="px-1.5 py-0.5 rounded border text-[10px] font-medium shrink-0 {eventColors[log.event] || 'bg-[var(--dash-bg)] text-[var(--dash-text-muted)] border-[var(--dash-border)]'}">
                  {log.event}
                </span>
                <span class="text-[var(--dash-text-secondary)] truncate">
                  {log.user_email || "unknown"}
                </span>
                {#if log.file_name}
                  <span class="text-[var(--dash-text)] font-medium truncate max-w-48">
                    {log.file_name}
                  </span>
                {/if}
                {#if log.file_format}
                  <span class="text-[var(--dash-text-muted)]">
                    ({log.file_format})
                  </span>
                {/if}
                {#if log.doc_type}
                  <span class="px-1 py-0.5 rounded text-[10px] shrink-0 {log.doc_type === 'partial'
                    ? 'bg-amber-500/10 text-amber-600'
                    : 'bg-emerald-500/10 text-emerald-600'}">
                    {log.doc_type}
                  </span>
                {/if}
                {#if log.profile_id}
                  <span class="text-[var(--dash-text-muted)] text-[10px]">
                    profile #{log.profile_id}
                  </span>
                {/if}
                {#if !isExpanded && log.sections}
                  <span class="text-[var(--dash-text-muted)] text-[10px]">
                    {formatSectionsCompact(log.sections)}
                  </span>
                {/if}
                {#if !isExpanded && log.changes}
                  <span class="text-[var(--dash-text-muted)] text-[10px]">
                    {formatChangesCompact(log.changes)}
                  </span>
                {/if}
                {#if log.error}
                  <span class="text-red-600 text-[10px] break-all">
                    {log.error}
                  </span>
                {/if}
              </button>

              <!-- Expanded details -->
              {#if isExpanded && hasDetails}
                <div class="mt-2 ml-5 space-y-3">
                  <!-- Original file actions -->
                  {#if log.file_id}
                    <div class="flex flex-wrap items-center gap-3">
                      <a
                        href="/api/resume/reparse?logId={log.id}"
                        class="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        <FontAwesomeIcon icon={faDownload} class="w-3 h-3" />
                        Download
                      </a>
                      <button
                        type="button"
                        onclick={() => reparseFromLog(log.id)}
                        disabled={reparseLogId === log.id}
                        class="inline-flex items-center gap-1.5 text-xs text-emerald-600 hover:text-emerald-800 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <FontAwesomeIcon icon={faRotateRight} class="w-3 h-3 {reparseLogId === log.id ? 'animate-spin' : ''}" />
                        {reparseLogId === log.id ? "Parsing..." : "Re-parse"}
                      </button>
                    </div>
                  {/if}

                  <!-- Sections overview (for parse events) -->
                  {#if log.sections}
                    <div>
                      <p class="text-[10px] uppercase tracking-wide font-medium text-[var(--dash-text-muted)] mb-1">Parsed sections</p>
                      <div class="flex flex-wrap gap-1.5">
                        {#each Object.entries(log.sections as Record<string, number>) as [name, count]}
                          <span class="px-2 py-0.5 text-xs rounded border bg-emerald-500/10 text-emerald-700 border-emerald-500/20">
                            {sectionLabels[name] || name}: {count}
                          </span>
                        {/each}
                        <!-- Show absent sections -->
                        {#each ["work", "education", "skills", "languages", "projects", "references"] as name}
                          {#if !(log.sections as Record<string, unknown>)[name]}
                            <span class="px-2 py-0.5 text-xs rounded border bg-[var(--dash-bg)] text-[var(--dash-text-muted)] border-[var(--dash-border)]">
                              {sectionLabels[name]}: absent
                            </span>
                          {/if}
                        {/each}
                      </div>
                    </div>
                  {/if}

                  <!-- Changes overview (for apply events) -->
                  {#if log.changes}
                    <div>
                      <p class="text-[10px] uppercase tracking-wide font-medium text-[var(--dash-text-muted)] mb-1">Applied changes</p>
                      <div class="flex flex-wrap gap-1.5">
                        {#each Object.entries(log.changes as Record<string, Record<string, number>>) as [section, counts]}
                          <span class="px-2 py-0.5 text-xs rounded border bg-emerald-500/10 text-emerald-700 border-emerald-500/20">
                            {sectionLabels[section] || section}:
                            {#each Object.entries(counts) as [op, n], i}
                              {#if i > 0},{/if}
                              {op === "added" ? `+${n}` : op === "removed" ? `-${n}` : op === "modified" ? `~${n}` : `${op}:${n}`}
                            {/each}
                          </span>
                        {/each}
                      </div>
                    </div>
                  {/if}

                  <!-- Parsed data (for parse events) -->
                  {#if log.parsed_data}
                    <div>
                      <p class="text-[10px] uppercase tracking-wide font-medium text-[var(--dash-text-muted)] mb-1">Parsed JSON</p>
                      <pre class="p-3 bg-[var(--dash-bg)] rounded-lg overflow-x-auto text-[10px] text-[var(--dash-text-secondary)] max-h-60 overflow-y-auto">{JSON.stringify(log.parsed_data, null, 2)}</pre>
                    </div>
                  {/if}
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </Card>
  {/if}
</div>
