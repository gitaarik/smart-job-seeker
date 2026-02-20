<script lang="ts">
  import type { ActionData, PageData } from "./$types";
  import { enhance } from "$app/forms";
  import { goto } from "$app/navigation";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faCalendar,
    faChevronDown,
    faChevronUp,
    faExternalLinkAlt,
    faMapMarkerAlt,
    faPaperPlane,
    faTrash,
  } from "@fortawesome/free-solid-svg-icons";
  import SectionHeader from "../../profile/components/SectionHeader.svelte";
  import EmptyState from "../../profile/components/EmptyState.svelte";
  import DeleteConfirmModal from "../../profile/components/DeleteConfirmModal.svelte";

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let applications = $derived(data.applications);
  let currentStatus = $derived(data.currentStatus);
  let expandedId = $state<number | null>(null);
  let deleteId = $state<number | null>(null);

  const statusFilters = [
    { value: "all", label: "All" },
    { value: "draft", label: "Draft" },
    { value: "sent", label: "Sent" },
    { value: "seen", label: "Seen" },
    { value: "interviewing", label: "Interviewing" },
    { value: "offered", label: "Offered" },
    { value: "rejected", label: "Rejected" },
    { value: "withdrawn", label: "Withdrawn" },
  ];

  const statusOptions = [
    { value: "draft", label: "Draft" },
    { value: "sent", label: "Sent" },
    { value: "seen", label: "Seen" },
    { value: "interviewing", label: "Interviewing" },
    { value: "offered", label: "Offered" },
    { value: "rejected", label: "Rejected" },
    { value: "withdrawn", label: "Withdrawn" },
  ];

  function getStatusColor(status: string): string {
    switch (status) {
      case "draft":
        return "bg-[var(--dash-bg)] text-gray-600";
      case "sent":
        return "bg-blue-100 text-blue-600";
      case "seen":
        return "bg-purple-100 text-purple-600";
      case "interviewing":
        return "bg-yellow-100 text-yellow-700";
      case "offered":
        return "bg-green-100 text-green-600";
      case "rejected":
        return "bg-red-100 text-red-600";
      case "withdrawn":
        return "bg-[var(--dash-bg)] text-gray-500";
      default:
        return "bg-[var(--dash-bg)] text-gray-600";
    }
  }

  function formatDate(date: Date | string | null): string {
    if (!date) return "";
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function toggleExpand(id: number) {
    expandedId = expandedId === id ? null : id;
  }

  function filterByStatus(status: string) {
    const params = new URLSearchParams();
    if (status !== "all") {
      params.set("status", status);
    }
    goto(`?${params.toString()}`);
  }
</script>

<div class="space-y-6">
  <SectionHeader
    title="Active Applications"
    icon={faPaperPlane}
  />

  {#if form?.error}
    <div
      class="bg-[var(--dash-error-light)] border border-[var(--dash-error)] rounded-lg p-4"
    >
      <p class="text-[var(--dash-error)] text-sm">{form.error}</p>
    </div>
  {/if}

  <!-- Status Filter -->
  <div class="flex flex-wrap gap-2">
    {#each statusFilters as filter}
      <button
        type="button"
        onclick={() => filterByStatus(filter.value)}
        class="
          px-3 py-1.5 text-sm rounded-lg transition-colors {currentStatus ===
          filter.value
          ? 'bg-[var(--dash-primary)] text-white'
          : 'bg-[var(--dash-card)] border border-[var(--dash-border)] text-[var(--dash-text)] hover:bg-[var(--dash-bg)]'}
        "
      >
        {filter.label}
      </button>
    {/each}
  </div>

  <!-- Applications List -->
  {#if applications.length === 0}
    <EmptyState
      icon={faPaperPlane}
      title="No applications yet"
      description={currentStatus === "all"
        ? "Your job applications will appear here. Start by applying to jobs from the matches page."
        : `No applications with status "${currentStatus}" found.`}
    />
  {:else}
    <div class="space-y-3">
      {#each applications as app (app.id)}
        {@const job = app.jobs}
        <div
          class="bg-[var(--dash-card)] rounded-lg border border-[var(--dash-border)] overflow-hidden"
        >
          <!-- Header -->
          <button
            type="button"
            onclick={() => toggleExpand(app.id)}
            class="w-full flex items-center justify-between p-4 hover:bg-[var(--dash-bg)] transition-colors text-left"
          >
            <div class="flex items-center gap-4 flex-1 min-w-0">
              <div
                class="
                  w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 {getStatusColor(
                  app.status,
                  )}
                "
              >
                <FontAwesomeIcon icon={faPaperPlane} class="w-4 h-4" />
              </div>

              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <h3 class="font-medium text-[var(--dash-text)] truncate">
                    {job?.title || "Unknown Position"}
                  </h3>
                  <span
                    class="
                      text-xs px-2 py-0.5 rounded-full capitalize {getStatusColor(
                      app.status,
                      )}
                    "
                  >
                    {app.status}
                  </span>
                </div>
                <p class="text-sm text-[var(--dash-text-secondary)] truncate">
                  {#if job?.job_platforms}
                    {job.job_platforms.name}
                  {/if}
                  {#if job?.office_location}
                    <span class="mx-1">•</span>
                    <FontAwesomeIcon icon={faMapMarkerAlt} class="w-3 h-3" />
                    {job.office_location}
                  {/if}
                  {#if app.application_sent_date}
                    <span class="mx-1">•</span>
                    <FontAwesomeIcon icon={faCalendar} class="w-3 h-3" />
                    Sent {formatDate(app.application_sent_date)}
                  {/if}
                </p>
              </div>
            </div>

            <div class="flex items-center gap-3 ml-4">
              {#if job?.source_url}
                <a
                  href={job.source_url}
                  target="_blank"
                  rel="noopener"
                  onclick={(e) => e.stopPropagation()}
                  class="p-2 text-[var(--dash-text-secondary)] hover:text-[var(--dash-primary)] transition-colors"
                  aria-label="View job posting"
                >
                  <FontAwesomeIcon icon={faExternalLinkAlt} class="w-4 h-4" />
                </a>
              {/if}
              <FontAwesomeIcon
                icon={expandedId === app.id ? faChevronUp : faChevronDown}
                class="w-4 h-4 text-[var(--dash-text-secondary)]"
              />
            </div>
          </button>

          <!-- Expanded Content -->
          {#if expandedId === app.id}
            <div class="border-t border-[var(--dash-border)] p-4 space-y-4">
              <!-- Application Details -->
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                {#if app.application_sent_date}
                  <div>
                    <p class="text-[var(--dash-text-secondary)]">Sent Date</p>
                    <p class="font-medium text-[var(--dash-text)]">
                      {formatDate(app.application_sent_date)}
                    </p>
                  </div>
                {/if}
                {#if app.application_seen_date}
                  <div>
                    <p class="text-[var(--dash-text-secondary)]">Seen Date</p>
                    <p class="font-medium text-[var(--dash-text)]">
                      {formatDate(app.application_seen_date)}
                    </p>
                  </div>
                {/if}
                {#if app.cv_sent_through}
                  <div>
                    <p class="text-[var(--dash-text-secondary)]">Applied Via</p>
                    <p class="font-medium text-[var(--dash-text)]">
                      {app.cv_sent_through}
                    </p>
                  </div>
                {/if}
                {#if app.salary_expectation}
                  <div>
                    <p class="text-[var(--dash-text-secondary)]">
                      Salary Expectation
                    </p>
                    <p class="font-medium text-[var(--dash-text)]">
                      {
                        new Intl.NumberFormat("en-US", {
                          style: "currency",
                          currency: app.salary_currency || "EUR",
                          maximumFractionDigits: 0,
                        }).format(Number(app.salary_expectation))
                      }
                      {#if app.salary_period}
                        / {app.salary_period}
                      {/if}
                    </p>
                  </div>
                {/if}
              </div>

              {#if app.application_note}
                <div>
                  <p class="text-sm text-[var(--dash-text-secondary)] mb-1">
                    Notes
                  </p>
                  <p class="text-sm text-[var(--dash-text)]">
                    {app.application_note}
                  </p>
                </div>
              {/if}

              {#if app.discontinued_reason}
                <div
                  class="bg-red-50 border border-red-200 rounded-lg p-3 text-sm"
                >
                  <p class="text-red-700 font-medium">
                    Discontinued: {app.discontinued_reason}
                  </p>
                  {#if app.discontinued_note}
                    <p class="text-red-600 mt-1">{app.discontinued_note}</p>
                  {/if}
                </div>
              {/if}

              <!-- Status Update & Actions -->
              <div
                class="flex items-center justify-between gap-4 pt-2 border-t border-[var(--dash-border)]"
              >
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="text-sm text-[var(--dash-text-secondary)]"
                  >Status:</span>
                  {#each statusOptions as option}
                    <form
                      method="POST"
                      action="?/updateStatus"
                      use:enhance={() => {
                        return async ({ update }) => {
                          await update();
                        };
                      }}
                      class="inline"
                    >
                      <input type="hidden" name="id" value={app.id} />
                      <input type="hidden" name="status" value={option.value} />
                      <button
                        type="submit"
                        class="
                          px-2 py-1 text-xs rounded transition-colors {app.status ===
                          option.value
                          ? 'bg-[var(--dash-primary)] text-white'
                          : 'bg-[var(--dash-bg)] text-gray-600 hover:bg-gray-200'}
                        "
                      >
                        {option.label}
                      </button>
                    </form>
                  {/each}
                </div>

                <button
                  type="button"
                  onclick={() => (deleteId = app.id)}
                  class="p-2 text-[var(--dash-text-secondary)] hover:text-[var(--dash-error)] transition-colors"
                  aria-label="Delete"
                >
                  <FontAwesomeIcon icon={faTrash} class="w-4 h-4" />
                </button>
              </div>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>

<!-- Delete Confirmation Modal -->
<DeleteConfirmModal
  isOpen={deleteId !== null}
  title="Delete Application"
  message="Are you sure you want to delete this application? This will also delete associated letters and activity logs. This action cannot be undone."
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
