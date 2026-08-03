<script lang="ts">
  import type { PageData } from "./$types";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faChevronDown,
    faChevronUp,
    faDownload,
    faPaperclip,
    faStream,
  } from "@fortawesome/free-solid-svg-icons";
  import Card from "../../../components/Card.svelte";
  import EmptyState from "../../../profile/components/EmptyState.svelte";
  import {
    getContactRoleLabel,
    getRecordTypeColor,
    getRecordTypeLabel,
    recordTypes,
  } from "$lib/application-records";
  import { getStatusBgColor, getStatusLabel } from "$lib/application-status";
  import { formatDate as fmtDate } from "$lib/format-date";
  import { renderSafeMarkdown } from "$lib/utils/safe-markdown";

  let { data }: { data: PageData } = $props();

  let app = $derived(data.application);
  const basePath = $derived(`/applications/${app.id}`);

  /**
   * One row of the stream. Records and status transitions share an axis but not
   * a shape — a transition is context, not content — so they stay distinct
   * variants rather than being flattened into a lowest-common-denominator row.
   */
  type Entry =
    | {
      kind: "record";
      id: string;
      at: Date | null;
      record_type: string | null;
      title: string;
      content: string;
      step: string | null;
      contacts: { name: string; role: string | null }[];
      fileId: string | null;
      fromFile: boolean;
    }
    | {
      kind: "status";
      id: string;
      at: Date | null;
      to_status: string;
      step: string | null;
      action: string | null;
      description: string | null;
    };

  const toDate = (v: unknown): Date | null => {
    if (!v) return null;
    const d = v instanceof Date ? v : new Date(String(v));
    return isNaN(d.getTime()) ? null : d;
  };

  const records = $derived<Entry[]>(
    (app.application_records ?? []).map((r) => ({
      kind: "record" as const,
      id: `r${r.id}`,
      // event_date is when it HAPPENED; date_created is when it was written
      // down. A pasted email logged a week late belongs at the former.
      at: toDate(r.event_date) ?? toDate(r.date_created),
      record_type: r.record_type,
      title: r.title || "Untitled",
      content: r.content || "",
      step: r.step,
      contacts: (r.contacts ?? []) as { name: string; role: string | null }[],
      fileId: r.file_id ?? null,
      fromFile: !!r.file_id,
    })),
  );

  /**
   * Attached files still live in `applications_files` until the cutover, so the
   * stream unions them in exactly as the prompt context does. Without this the
   * Documents tab's contents would simply be missing from the page that claims
   * to show everything. Both halves go when the tab does.
   */
  const legacyFiles = $derived<Entry[]>(
    (app.applications_files ?? []).map((f) => ({
      kind: "record" as const,
      id: `f${f.id}`,
      at: toDate(f.date_extracted),
      record_type: "message",
      title: f.file?.title || f.file?.filename_download || "Attached file",
      content: f.extracted_text || "",
      step: null,
      contacts: [],
      fileId: f.file?.id ?? null,
      fromFile: true,
    })),
  );

  const statusEntries = $derived<Entry[]>(
    (app.application_status_logs ?? []).map((s) => ({
      kind: "status" as const,
      id: `s${s.id}`,
      at: toDate(s.date_created),
      to_status: s.to_status,
      step: s.step,
      action: s.action,
      description: s.description,
    })),
  );

  let showStatusEvents = $state(true);
  let typeFilter = $state<string | null>(null);

  const stream = $derived(
    [
      ...records,
      ...legacyFiles,
      ...(showStatusEvents ? statusEntries : []),
    ]
      .filter((e) =>
        !typeFilter || (e.kind === "record" && e.record_type === typeFilter)
      )
      // Newest first. Undated entries sort last rather than to the top, where
      // a missing date would otherwise read as "just happened".
      .sort((a, b) => (b.at?.getTime() ?? 0) - (a.at?.getTime() ?? 0)),
  );

  const recordCount = $derived(records.length + legacyFiles.length);
  const shownRecordCount = $derived(
    stream.filter((e) => e.kind === "record").length,
  );

  /** Types actually present, so the filter never offers an empty result. */
  const presentTypes = $derived(
    recordTypes.filter((t) =>
      [...records, ...legacyFiles].some((e) =>
        e.kind === "record" && e.record_type === t.value
      )
    ),
  );

  let expanded = $state<Record<string, boolean>>({});

  /** Long enough that collapsing earns its keep — roughly three lines. */
  const PREVIEW_CHARS = 220;

  function preview(text: string): string {
    const flat = text.replace(/\s+/g, " ").trim();
    return flat.length > PREVIEW_CHARS
      ? flat.slice(0, PREVIEW_CHARS).trimEnd() + "…"
      : flat;
  }

  function formatDate(d: Date | null): string {
    return d ? fmtDate(d, { fallback: "" }) : "";
  }

  /**
   * Built in JS rather than markup because Svelte trims whitespace at a block
   * boundary: `{name}{#if role}\n · {label}{/if}` renders as "Anna Cooper·
   * Technical interviewer", losing the leading space. Joining here sidesteps
   * the rule entirely instead of fighting it with &nbsp;.
   */
  const contactLabel = (c: { name: string; role: string | null }) =>
    [c.name, c.role ? getContactRoleLabel(c.role) : ""]
      .filter(Boolean)
      .join(" · ");

  const statusLabel = (e: Extract<Entry, { kind: "status" }>) =>
    [getStatusLabel(e.to_status), e.step, e.action].filter(Boolean).join(" · ");
</script>

<div class="space-y-5">
  <div class="flex items-center justify-between gap-3 flex-wrap">
    <div class="flex items-center gap-2">
      <FontAwesomeIcon
        icon={faStream}
        class="w-5 h-5 text-[var(--dash-primary)]"
      />
      <h2 class="text-lg font-semibold text-[var(--dash-text)]">Activity</h2>
      {#if recordCount > 0}
        <span class="text-sm text-[var(--dash-text-muted)]">
          <!--
            Shows "1 of 3" while filtered. A bare total next to a single visible
            card reads as a rendering bug rather than as a filter being active.
          -->
          {shownRecordCount === recordCount
          ? `${recordCount} ${recordCount === 1 ? "entry" : "entries"}`
          : `${shownRecordCount} of ${recordCount}`}
        </span>
      {/if}
    </div>

    <label
      class="flex items-center gap-2 text-xs text-[var(--dash-text-secondary)] cursor-pointer"
    >
      <input
        type="checkbox"
        bind:checked={showStatusEvents}
        class="rounded border-[var(--dash-border)]"
      />
      Show status changes
    </label>
  </div>

  {#if presentTypes.length > 1}
    <div class="flex flex-wrap gap-1.5">
      <button
        type="button"
        onclick={() => (typeFilter = null)}
        class="px-2.5 py-1 rounded-full text-xs font-medium transition-colors {typeFilter ===
          null
        ? 'bg-[var(--dash-primary)] text-white'
        : 'bg-[var(--dash-bg)] text-[var(--dash-text-secondary)] hover:bg-[var(--dash-border)]'}"
      >
        All
      </button>
      {#each presentTypes as type}
        <button
          type="button"
          onclick={() =>
          (typeFilter = typeFilter === type.value ? null : type.value)}
          class="px-2.5 py-1 rounded-full text-xs font-medium transition-colors {typeFilter ===
            type.value
          ? 'bg-[var(--dash-primary)] text-white'
          : getRecordTypeColor(type.value)}"
        >
          {type.label}
        </button>
      {/each}
    </div>
  {/if}

  {#if stream.length === 0}
    {#if typeFilter}
      <!--
        Deliberately distinct from the "nothing here yet" state below. The user
        has to be able to tell "there is none" from "your filter excluded it" —
        the same empty-vs-never-looked distinction the prompt context draws.
      -->
      <EmptyState
        icon={faStream}
        title="Nothing of this type yet"
        description="No entries match the filter you picked. Clear it to see everything on this application."
        actionLabel="Clear filter"
        onAction={() => (typeFilter = null)}
      />
    {:else}
      <EmptyState
        icon={faStream}
        title="Nothing recorded yet"
        description="Paste an email, a message, or notes from a call. Anything you keep here feeds your AI cheat sheets and your application writing."
      />
    {/if}
  {:else}
    <div class="space-y-2.5">
      {#each stream as entry (entry.id)}
        {#if entry.kind === "status"}
          <!--
            Status transitions read deliberately unlike records: no card, no
            pill, just a rule. They are context for the entries around them,
            not content in their own right.
          -->
          <div class="flex items-center gap-2.5 px-1 py-1">
            <div
              class="w-2 h-2 rounded-full shrink-0 {getStatusBgColor(
                entry.to_status,
              )}"
            ></div>
            <span class="text-xs text-[var(--dash-text-secondary)]">
              {statusLabel(entry)}
            </span>
            <div class="flex-1 h-px bg-[var(--dash-border)]"></div>
            <span class="text-[11px] text-[var(--dash-text-muted)] shrink-0">
              {formatDate(entry.at)}
            </span>
          </div>
          {#if entry.description}
            <p
              class="text-xs text-[var(--dash-text-secondary)] pl-[18px] -mt-1"
            >
              {entry.description}
            </p>
          {/if}
        {:else}
          <Card padding="sm">
            <div class="flex items-start gap-2 flex-wrap">
              <span
                class="text-xs px-2 py-0.5 rounded-full font-medium shrink-0 {getRecordTypeColor(
                  entry.record_type,
                )}"
              >
                {getRecordTypeLabel(entry.record_type)}
              </span>
              <span
                class="text-sm font-medium text-[var(--dash-text)] flex-1 min-w-0 break-words"
              >
                {entry.title}
              </span>
              {#if entry.at}
                <span
                  class="text-[11px] text-[var(--dash-text-muted)] shrink-0 mt-0.5"
                >
                  {formatDate(entry.at)}
                </span>
              {/if}
            </div>

            {#if entry.contacts.length > 0 || entry.fromFile || entry.step}
              <div
                class="flex items-center gap-3 flex-wrap mt-1.5 text-[11px] text-[var(--dash-text-muted)]"
              >
                {#each entry.contacts as contact}
                  <span>{contactLabel(contact)}</span>
                {/each}
                {#if entry.step}
                  <span class="italic">{entry.step}</span>
                {/if}
                {#if entry.fromFile && entry.fileId}
                  <a
                    href="{basePath}/documents/download?fileId={entry.fileId}"
                    class="inline-flex items-center gap-1 hover:text-[var(--dash-primary)] transition-colors"
                  >
                    <FontAwesomeIcon icon={faPaperclip} class="w-2.5 h-2.5" />
                    Attached file
                    <FontAwesomeIcon icon={faDownload} class="w-2.5 h-2.5" />
                  </a>
                {/if}
              </div>
            {/if}

            {#if entry.content}
              {#if expanded[entry.id]}
                <div
                  class="mt-2 max-h-96 overflow-y-auto rounded-md bg-[var(--dash-bg)] px-2.5 py-2 prose prose-sm max-w-none text-[var(--dash-text)]"
                >
                  {@html renderSafeMarkdown(entry.content)}
                </div>
              {:else}
                <p
                  class="mt-1.5 text-xs text-[var(--dash-text-secondary)] break-words"
                >
                  {preview(entry.content)}
                </p>
              {/if}

              <!--
                Every entry gets the toggle, including short ones. A control
                that appears on some rows and not others is harder to scan than
                one that is always in the same place; a short entry simply has
                nothing hidden behind it.
              -->
              <button
                type="button"
                onclick={() =>
                (expanded = { ...expanded, [entry.id]: !expanded[entry.id] })}
                class="mt-1.5 flex items-center gap-1 text-[11px] text-[var(--dash-primary)] hover:underline"
              >
                <FontAwesomeIcon
                  icon={expanded[entry.id] ? faChevronUp : faChevronDown}
                  class="w-2.5 h-2.5"
                />
                {expanded[entry.id] ? "Show less" : "Show full text"}
              </button>
            {/if}
          </Card>
        {/if}
      {/each}
    </div>
  {/if}
</div>
