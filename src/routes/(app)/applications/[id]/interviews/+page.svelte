<script lang="ts">
import type { ActionData, PageData } from "./$types";
import { enhance } from "$app/forms";
import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
import {
  faCalendar,
  faChevronDown,
  faChevronRight,
  faComments,
  faEllipsisVertical,
  faHistory,
  faPencil,
  faPlus,
  faTrash,
} from "@fortawesome/free-solid-svg-icons";
import Card from "../../../components/Card.svelte";
import FilterTabs from "../../../components/FilterTabs.svelte";
import EmptyState from "../../../profile/components/EmptyState.svelte";
import ConfirmModal from "../../../profile/components/ConfirmModal.svelte";
import { page } from "$app/stores";
import {
  getRecordTypeColor,
  getRecordTypeLabel,
  recordTypes,
} from "$lib/application-records";
import { stepsByPhase } from "$lib/application-status";
import { formatDate as fmtDate } from "$lib/format-date";
import { renderSafeMarkdown } from "$lib/utils/safe-markdown";

let { data, form }: { data: PageData; form: ActionData } = $props();

let app = $derived(data.application);
let records = $derived(app.application_records || []);
let statusLogs = $derived(app.application_status_logs || []);

const basePath = $derived(`/applications/${app.id}`);

// Every stage a record can be attached to, not just interview rounds — an
// email or a piece of research can belong to the applying phase too.
const allSteps = Object.values(stepsByPhase).flat();

const typeFilters = [
  { value: "all", label: "All" },
  ...recordTypes.map((t) => ({ value: t.value, label: t.label })),
];
let currentType = $state("all");

let filteredRecords = $derived(
  currentType === "all"
    ? records
    : records.filter((r) => r.record_type === currentType),
);

// Only offer filters that would actually return something.
let availableFilters = $derived(
  typeFilters.filter((f) =>
    f.value === "all" || records.some((r) => r.record_type === f.value)
  ),
);

let showAddForm = $state(false);
let editingId = $state<number | null>(null);
let deleteId = $state<number | null>(null);
let menuOpenId = $state<number | null>(null);
let expandedIds = $state<number[]>([]);

// A deep link from the Timeline ("view debrief") lands on a specific record.
let linkedId = $derived.by(() => {
  const hash = $page.url.hash.replace("#record-", "");
  const id = parseInt(hash);
  return isNaN(id) ? null : id;
});

// Prefill: the Timeline's "add debrief" link passes the event it came from.
let prefillLogId = $derived($page.url.searchParams.get("from"));
let prefillLog = $derived(
  statusLogs.find((l) => String(l.id) === prefillLogId) || null,
);

// Open the add form once when arriving from the Timeline — but let a cancel
// stick, so this must not re-fire every time showAddForm flips back.
let prefillApplied = $state(false);
$effect(() => {
  if (prefillLog && !prefillApplied) {
    prefillApplied = true;
    showAddForm = true;
  }
});

$effect(() => {
  if (linkedId !== null && !expandedIds.includes(linkedId)) {
    expandedIds = [...expandedIds, linkedId];
  }
});

function toggleExpanded(id: number) {
  expandedIds = expandedIds.includes(id)
    ? expandedIds.filter((x) => x !== id)
    : [...expandedIds, id];
}

function formatDate(date: Date | string | null): string {
  return fmtDate(date, { fallback: "" });
}

type Record_ = (typeof records)[0];

// Edit form state
let editType = $state("interview_recap");
let editTitle = $state("");
let editContent = $state("");
let editStep = $state("");
let editEventDate = $state("");

function startEdit(record: Record_) {
  editingId = record.id;
  showAddForm = false;
  editType = record.record_type || "interview_recap";
  editTitle = record.title || "";
  editContent = record.content || "";
  editStep = record.step || "";
  editEventDate = record.event_date
    ? String(record.event_date).slice(0, 10)
    : "";
}

function resetAddForm() {
  showAddForm = false;
}

function handleSubmit(onSuccess: () => void) {
  return () =>
  async (
    { result, update }: {
      result: { type: string };
      update: () => Promise<void>;
    },
  ) => {
    await update();
    if (result.type === "success") onSuccess();
  };
}

function statusLogLabel(log: (typeof statusLogs)[0]): string {
  const parts = [log.step || log.to_status, formatDate(log.date_created)]
    .filter(Boolean);
  return parts.join(" — ");
}
</script>

<svelte:window
  onclick={() => { if (menuOpenId !== null) menuOpenId = null; }} />

<div class="space-y-6">
  {#if form?.error}
    <div class="bg-[var(--dash-error-light)] border border-[var(--dash-error)] rounded-lg p-4">
      <p class="text-[var(--dash-error)] text-sm">{form.error}</p>
    </div>
  {/if}

  <!-- Header -->
  <div class="flex items-start justify-between gap-4">
    <div>
      <div class="flex items-center gap-2">
        <FontAwesomeIcon icon={faComments} class="w-5 h-5 text-[var(--dash-primary)]" />
        <h2 class="text-lg font-semibold text-[var(--dash-text)]">Interviews</h2>
      </div>
      <p class="text-sm text-[var(--dash-text-secondary)] mt-1 max-w-xl">
        Everything that was said on this application — interview recaps and transcripts,
        recruiter feedback, email threads, assessment briefs and research. Written down
        here, it stays searchable and your AI cheat sheets can build on the earlier rounds.
      </p>
    </div>
    {#if !showAddForm}
      <button
        type="button"
        onclick={() => { showAddForm = true; editingId = null; }}
        class="flex-shrink-0 flex items-center gap-2 px-3 py-1.5 text-sm bg-[var(--dash-primary)] text-white rounded-lg hover:bg-[var(--dash-primary-hover)] transition-colors"
      >
        <FontAwesomeIcon icon={faPlus} class="w-3 h-3" />
        Add Record
      </button>
    {/if}
  </div>

  <!-- Add form -->
  {#if showAddForm}
    <Card padding="md">
      <form method="POST" action="?/create" use:enhance={handleSubmit(resetAddForm)}>
        <h3 class="font-medium text-[var(--dash-text)] mb-3">Add Record</h3>
        {#if prefillLog}
          <input type="hidden" name="status_log" value={prefillLog.id} />
          <p class="text-xs text-[var(--dash-primary)] mb-3 flex items-center gap-1.5">
            <FontAwesomeIcon icon={faHistory} class="w-3 h-3" />
            Linked to timeline event: {statusLogLabel(prefillLog)}
          </p>
        {/if}
        <div class="space-y-3">
          <div class="grid gap-3 sm:grid-cols-2">
            <div>
              <label for="new-type" class="block text-sm text-[var(--dash-text-secondary)] mb-1">Type</label>
              <select
                id="new-type"
                name="record_type"
                value="interview_recap"
                class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent bg-[var(--dash-card)]"
              >
                {#each recordTypes as type}
                  <option value={type.value}>{type.label} — {type.hint}</option>
                {/each}
              </select>
            </div>
            <div>
              <label for="new-event-date" class="block text-sm text-[var(--dash-text-secondary)] mb-1">
                Date it happened
              </label>
              <input
                id="new-event-date"
                name="event_date"
                type="date"
                value={prefillLog?.action_date ? String(prefillLog.action_date).slice(0, 10) : ""}
                class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent bg-[var(--dash-card)]"
              />
            </div>
          </div>
          <div class="grid gap-3 sm:grid-cols-2">
            <div>
              <label for="new-title" class="block text-sm text-[var(--dash-text-secondary)] mb-1">
                Title <span class="text-[var(--dash-error)]">*</span>
              </label>
              <input
                id="new-title"
                name="title"
                type="text"
                required
                placeholder="e.g., Second round with the platform team"
                class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
              />
            </div>
            <div>
              <label for="new-step" class="block text-sm text-[var(--dash-text-secondary)] mb-1">Stage</label>
              <select
                id="new-step"
                name="step"
                value={prefillLog?.step || ""}
                class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent bg-[var(--dash-card)]"
              >
                <option value="">No specific stage</option>
                {#each allSteps as step}
                  <option value={step}>{step}</option>
                {/each}
              </select>
            </div>
          </div>
          <div>
            <label for="new-content" class="block text-sm text-[var(--dash-text-secondary)] mb-1">
              Content <span class="text-[var(--dash-text-muted)]">(markdown supported — paste transcripts and emails as-is)</span>
            </label>
            <textarea
              id="new-content"
              name="content"
              rows={10}
              placeholder="Who was in the room, what they asked, what you answered, what they said about next steps..."
              class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent resize-y font-mono text-sm"
            ></textarea>
          </div>
          <div class="flex justify-end gap-2">
            <button
              type="button"
              onclick={resetAddForm}
              class="px-4 py-2 border border-[var(--dash-border)] rounded-lg text-[var(--dash-text)] hover:bg-[var(--dash-bg)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="px-4 py-2 bg-[var(--dash-primary)] text-white rounded-lg hover:bg-[var(--dash-primary-hover)] transition-colors"
            >
              Add Record
            </button>
          </div>
        </div>
      </form>
    </Card>
  {/if}

  <!-- Filters -->
  {#if records.length > 0 && availableFilters.length > 2}
    <FilterTabs filters={availableFilters} value={currentType} onchange={(v) => (currentType = v)} />
  {/if}

  <!-- Records -->
  {#if records.length === 0 && !showAddForm}
    <EmptyState
      icon={faComments}
      title="No records yet"
      description="Write down how a call went while it's fresh, paste an email thread, or save the feedback you got. It all becomes context for the next round."
      actionLabel="Add First Record"
      onAction={() => (showAddForm = true)}
    />
  {:else}
    <div class="space-y-3">
      {#each filteredRecords as record (record.id)}
        {@const isExpanded = expandedIds.includes(record.id)}
        <Card padding="md" class={linkedId === record.id ? "ring-2 ring-[var(--dash-primary)]" : ""}>
          <div id="record-{record.id}">
            {#if editingId === record.id}
              <!-- Edit mode -->
              <form method="POST" action="?/update" use:enhance={handleSubmit(() => (editingId = null))}>
                <input type="hidden" name="id" value={record.id} />
                <div class="space-y-3">
                  <div class="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label for="edit-type-{record.id}" class="block text-sm text-[var(--dash-text-secondary)] mb-1">Type</label>
                      <select
                        id="edit-type-{record.id}"
                        name="record_type"
                        bind:value={editType}
                        class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent bg-[var(--dash-card)]"
                      >
                        {#each recordTypes as type}
                          <option value={type.value}>{type.label}</option>
                        {/each}
                      </select>
                    </div>
                    <div>
                      <label for="edit-event-date-{record.id}" class="block text-sm text-[var(--dash-text-secondary)] mb-1">
                        Date it happened
                      </label>
                      <input
                        id="edit-event-date-{record.id}"
                        name="event_date"
                        type="date"
                        bind:value={editEventDate}
                        class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent bg-[var(--dash-card)]"
                      />
                    </div>
                  </div>
                  <div class="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label for="edit-title-{record.id}" class="block text-sm text-[var(--dash-text-secondary)] mb-1">
                        Title <span class="text-[var(--dash-error)]">*</span>
                      </label>
                      <input
                        id="edit-title-{record.id}"
                        name="title"
                        type="text"
                        required
                        bind:value={editTitle}
                        class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label for="edit-step-{record.id}" class="block text-sm text-[var(--dash-text-secondary)] mb-1">Stage</label>
                      <select
                        id="edit-step-{record.id}"
                        name="step"
                        bind:value={editStep}
                        class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent bg-[var(--dash-card)]"
                      >
                        <option value="">No specific stage</option>
                        {#each allSteps as step}
                          <option value={step}>{step}</option>
                        {/each}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label for="edit-content-{record.id}" class="block text-sm text-[var(--dash-text-secondary)] mb-1">
                      Content <span class="text-[var(--dash-text-muted)]">(markdown supported)</span>
                    </label>
                    <textarea
                      id="edit-content-{record.id}"
                      name="content"
                      rows={14}
                      bind:value={editContent}
                      class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent resize-y font-mono text-sm"
                    ></textarea>
                  </div>
                  <div class="flex justify-end gap-2">
                    <button
                      type="button"
                      onclick={() => (editingId = null)}
                      class="px-4 py-2 border border-[var(--dash-border)] rounded-lg text-[var(--dash-text)] hover:bg-[var(--dash-bg)] transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      class="px-4 py-2 bg-[var(--dash-primary)] text-white rounded-lg hover:bg-[var(--dash-primary-hover)] transition-colors"
                    >
                      Save
                    </button>
                  </div>
                </div>
              </form>
            {:else}
              <!-- View mode -->
              <div class="flex items-start justify-between gap-2">
                <button
                  type="button"
                  onclick={() => toggleExpanded(record.id)}
                  class="flex-1 min-w-0 text-left flex items-start gap-3"
                >
                  <FontAwesomeIcon
                    icon={isExpanded ? faChevronDown : faChevronRight}
                    class="w-3 h-3 text-[var(--dash-text-muted)] mt-1.5 flex-shrink-0"
                  />
                  <div class="min-w-0">
                    <div class="flex flex-wrap items-center gap-2">
                      <span class="text-xs px-2 py-0.5 rounded-full font-medium {getRecordTypeColor(record.record_type)}">
                        {getRecordTypeLabel(record.record_type)}
                      </span>
                      {#if record.step}
                        <span class="text-xs text-[var(--dash-text-secondary)] italic">{record.step}</span>
                      {/if}
                    </div>
                    <h3 class="font-medium text-[var(--dash-text)] mt-1 truncate">{record.title}</h3>
                    <p class="text-xs text-[var(--dash-text-muted)] mt-0.5 flex items-center gap-1">
                      <FontAwesomeIcon icon={faCalendar} class="w-3 h-3" />
                      {record.event_date ? formatDate(record.event_date) : `Added ${formatDate(record.date_created)}`}
                    </p>
                  </div>
                </button>
                <div class="relative flex-shrink-0">
                  <button
                    type="button"
                    onclick={(e) => { e.stopPropagation(); menuOpenId = menuOpenId === record.id ? null : record.id; }}
                    class="p-1.5 text-[var(--dash-text-muted)] hover:text-[var(--dash-text)] transition-colors"
                    aria-label="Actions"
                  >
                    <FontAwesomeIcon icon={faEllipsisVertical} class="w-3.5 h-3.5" />
                  </button>
                  {#if menuOpenId === record.id}
                    <div class="absolute right-0 top-8 bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-lg shadow-lg z-20 py-1 min-w-[120px]">
                      <button
                        type="button"
                        onclick={() => { startEdit(record); menuOpenId = null; }}
                        class="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--dash-text)] hover:bg-[var(--dash-bg)] transition-colors"
                      >
                        <FontAwesomeIcon icon={faPencil} class="w-3 h-3" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onclick={() => { deleteId = record.id; menuOpenId = null; }}
                        class="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--dash-error)] hover:bg-[var(--dash-bg)] transition-colors"
                      >
                        <FontAwesomeIcon icon={faTrash} class="w-3 h-3" />
                        Delete
                      </button>
                    </div>
                  {/if}
                </div>
              </div>

              {#if isExpanded}
                <div class="mt-4 pt-4 border-t border-[var(--dash-border)]">
                  {#if record.content}
                    <div class="record-md text-sm text-[var(--dash-text)]">
                      {@html renderSafeMarkdown(record.content)}
                    </div>
                  {:else}
                    <p class="text-sm text-[var(--dash-text-muted)] italic">No content yet.</p>
                  {/if}
                  {#if record.status_log}
                    <a
                      href="{basePath}/timeline"
                      class="inline-flex items-center gap-1.5 mt-4 text-xs text-[var(--dash-primary)] hover:underline"
                    >
                      <FontAwesomeIcon icon={faHistory} class="w-3 h-3" />
                      View on timeline
                    </a>
                  {/if}
                </div>
              {/if}
            {/if}
          </div>
        </Card>
      {/each}

      {#if filteredRecords.length === 0 && records.length > 0}
        <p class="text-sm text-[var(--dash-text-muted)] text-center py-6">
          No records of this type.
        </p>
      {/if}
    </div>
  {/if}
</div>

<!-- Delete Confirmation Modal -->
<ConfirmModal
  isOpen={deleteId !== null}
  title="Delete Record"
  message="Are you sure you want to delete this record? This action cannot be undone."
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

<style>
/* Markdown styling for record bodies — mirrors .agent-md in AgentChat,
   since the Tailwind typography plugin isn't installed. */
.record-md :global(h1),
.record-md :global(h2),
.record-md :global(h3) {
  font-weight: 600;
  margin: 1rem 0 0.4rem;
}
.record-md :global(h1) {
  font-size: 1.05rem;
}
.record-md :global(h2) {
  font-size: 1rem;
}
.record-md :global(h3) {
  font-size: 0.95rem;
}
.record-md :global(p) {
  margin: 0 0 0.6rem;
}
.record-md :global(p:last-child) {
  margin-bottom: 0;
}
.record-md :global(ul),
.record-md :global(ol) {
  margin: 0.25rem 0 0.6rem;
  padding-left: 1.25rem;
  list-style: revert;
}
.record-md :global(li) {
  margin: 0.15rem 0;
}
.record-md :global(strong) {
  font-weight: 600;
}
.record-md :global(a) {
  color: var(--dash-primary);
  text-decoration: underline;
}
.record-md :global(code) {
  background: var(--dash-bg);
  padding: 0.05rem 0.3rem;
  border-radius: 0.25rem;
  font-size: 0.85em;
}
.record-md :global(pre) {
  background: var(--dash-bg);
  padding: 0.6rem 0.8rem;
  border-radius: 0.4rem;
  overflow-x: auto;
  margin: 0 0 0.6rem;
}
.record-md :global(blockquote) {
  border-left: 3px solid var(--dash-border);
  padding-left: 0.75rem;
  margin: 0 0 0.6rem;
  color: var(--dash-text-secondary);
}
</style>
