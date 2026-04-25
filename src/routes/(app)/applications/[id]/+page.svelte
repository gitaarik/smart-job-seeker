<script lang="ts">
  import type { ActionData, PageData } from "./$types";
  import { enhance } from "$app/forms";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faArrowRight,
    faBuilding,
    faCalendar,
    faCheck,
    faChevronDown,
    faClipboardList,
    faEnvelope,
    faExternalLinkAlt,
    faFileAlt,
    faCalendarCheck,
    faClock,
    faGlobe,
    faHandPointRight,
    faMapMarkerAlt,
    faPencil,
    faMoneyBillWave,
    faSave,
    faStickyNote,
    faWrench,
    faTrash,
  } from "@fortawesome/free-solid-svg-icons";
  import ConfirmModal from "../../profile/components/ConfirmModal.svelte";
  import Card from "../../components/Card.svelte";
  import CategoryPill from "$lib/components/CategoryPill.svelte";
  import {
    statusOptions,
    stepsByPhase,
    actionsByPhase,
    defaultStepByPhase,
    defaultActionByPhase,
    defaultActionByStep,
    getStatusLabel,
    getStatusColor,
    getStatusDotColor,
    getStatusBgColor,
  } from "$lib/application-status";
  import { formatSalaryRange, isSalarySingleValue, timeAgo } from "$lib/format";
  import { formatDate as fmtDate } from "$lib/format-date";
  import { profileDocUrl } from "$lib/utils/profile-doc-url";
  import type { DocType } from "$lib/utils/profile-doc-url";

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let app = $derived(data.application);
  let job = $derived(app.job);
  let profileSlug = $derived((data as any).selectedProfile?.slug as string | undefined);

  let noteValue = $state(app.application_note || "");
  let noteSaving = $state(false);
  let noteSaved = $state(false);

  // Status widget
  let statusPickerOpen = $state(false);
  let pickerPhase = $state("");
  let pickerStep = $state("");
  let pickerAction = $state("");
  let pickerDescription = $state("");
  let statusSaving = $state(false);
  let customStepActive = $state(false);
  let customStepText = $state("");
  let customActionActive = $state(false);
  let customActionText = $state("");
  let pickerActionDate = $state("");

  let pickerStepOptions = $derived(stepsByPhase[pickerPhase] || []);
  let pickerActionOptions = $derived(actionsByPhase[pickerPhase] || []);

  function openStatusPicker() {
    pickerPhase = app.status;
    pickerStep = app.status_step || "";
    pickerAction = app.status_action || "";
    pickerActionDate = app.status_action_date ? new Date(app.status_action_date).toISOString().split("T")[0] : "";
    pickerDescription = "";
    customStepActive = false;
    customStepText = "";
    customActionActive = false;
    customActionText = "";
    statusPickerOpen = true;
  }

  function closeStatusPicker() {
    statusPickerOpen = false;
  }

  $effect(() => {
    noteValue = app.application_note || "";
  });

  function formatDate(date: Date | string | null): string {
    return fmtDate(date, { fallback: "" });
  }

  function formatRelativeDate(date: Date | string | null): string {
    if (!date) return "";
    const d = typeof date === "string" ? new Date(date) : date;
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return formatDate(date);
  }

  function formatCurrency(
    amount: number | string | null,
    currency: string | null,
    period: string | null,
  ): string {
    if (!amount) return "Not set";
    const formatted = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "EUR",
      maximumFractionDigits: 0,
    }).format(Number(amount));
    return period ? `${formatted} / ${period}` : formatted;
  }

  const letterTypeLabels: Record<string, string> = {
    cover_letter: "Cover Letter",
    follow_up_email: "Follow-up Email",
    thank_you_letter: "Thank You Letter",
    cheat_sheet: "Cheat Sheet",
  };

  let letterCount = $derived(app.application_letters?.length || 0);
  let questionCount = $derived(app.application_questions?.length || 0);
  let fileCount = $derived(app.applications_files?.length || 0);
  let statusLogCount = $derived(app.application_status_logs?.length || 0);
  let recentStatusLog = $derived(
    app.application_status_logs?.slice(0, 5) || [],
  );

  let showDeleteConfirm = $state(false);
  let showMore = $state(false);
</script>

{#if form?.error}
  <div
    class="bg-[var(--dash-error-light)] border border-[var(--dash-error)] rounded-lg p-4 mb-6"
  >
    <p class="text-[var(--dash-error)] text-sm">{form.error}</p>
  </div>
{/if}

<div class="space-y-6 pb-8">
  <!-- Title -->
  <h2 class="text-2xl font-bold text-[var(--dash-text)]">
    {job?.title || "Untitled Position"}
  </h2>

  <!-- Job Details -->
  <Card padding="lg">
    {#if job}
      <!-- Tags -->
      {#if job.job_types || job.work_location || job.experience_levels}
        <div class="flex flex-wrap gap-2 mb-3">
          {#if job.job_types && Array.isArray(job.job_types)}
            {#each job.job_types as type}
              <CategoryPill category="job_type" value={type} />
            {/each}
          {/if}
          {#if job.work_location && Array.isArray(job.work_location)}
            {#each job.work_location as loc}
              <CategoryPill category="work_location" value={loc} />
            {/each}
          {/if}
          {#if job.experience_levels && Array.isArray(job.experience_levels)}
            {#each job.experience_levels as level}
              <CategoryPill category="experience_level" value={level} />
            {/each}
          {/if}
        </div>
      {/if}

      <!-- Details -->
      <div class="flex flex-col gap-2 text-sm">
        {#if job.company}
          <div class="flex items-center gap-1.5">
            <FontAwesomeIcon icon={faBuilding} class="w-3.5 h-3.5 text-[var(--dash-text-muted)]" />
            <span class="text-[var(--dash-text-muted)]">Company</span>
            <span class="text-[var(--dash-text)]">{job.company}</span>
          </div>
        {/if}
        {#if job.office_location}
          <div class="flex items-center gap-1.5">
            <FontAwesomeIcon icon={faMapMarkerAlt} class="w-3.5 h-3.5 text-[var(--dash-text-muted)]" />
            <span class="text-[var(--dash-text-muted)]">Location</span>
            <span class="text-[var(--dash-text)]">{job.office_location}</span>
          </div>
        {/if}
        {#if job.salary_min || job.salary_max}
          <div class="flex items-center gap-1.5">
            <FontAwesomeIcon icon={faMoneyBillWave} class="w-3.5 h-3.5 text-[var(--dash-text-muted)]" />
            <span class="text-[var(--dash-text-muted)]">Salary</span>
            <span class="text-[var(--dash-text)]">
              {formatSalaryRange(job.salary_min, job.salary_max, job.salary_currency, job.salary_period)}
            </span>
          </div>
        {/if}
        <div class="flex items-center gap-1.5">
          <FontAwesomeIcon icon={faCalendar} class="w-3.5 h-3.5 text-[var(--dash-text-muted)]" />
          <span class="text-[var(--dash-text-muted)]">Posted</span>
          <span class="text-[var(--dash-text)]">{timeAgo(job.date_posted || job.date_created)}</span>
          <span class="text-[var(--dash-text-muted)]/50">{formatDate(job.date_posted || job.date_created)}</span>
        </div>
        {#if job.job_platform}
          <div class="flex items-center gap-1.5">
            <FontAwesomeIcon icon={faGlobe} class="w-3.5 h-3.5 text-[var(--dash-text-muted)]" />
            <span class="text-[var(--dash-text-muted)]">Platform</span>
            <span class="text-[var(--dash-text)]">{job.job_platform.name}</span>
          </div>
        {/if}
        {#if job.source_url}
          <div class="flex items-center gap-1.5">
            <FontAwesomeIcon icon={faExternalLinkAlt} class="w-3.5 h-3.5 text-[var(--dash-text-muted)]" />
            <span class="text-[var(--dash-text-muted)]">Source</span>
            <a
              href={job.source_url}
              target="_blank"
              rel="noopener"
              class="text-[var(--dash-primary)] hover:text-[var(--dash-primary-hover)] transition-colors truncate"
            >
              {job.source_url.replace(/^https?:\/\/(?:www\.)?/, '')}
            </a>
          </div>
        {/if}
      </div>

      <!-- View Job link (footer) -->
      {#if job.id}
        <div class="flex items-center -mx-6 -mb-6 mt-4 px-6 py-3 border-t border-[var(--dash-border)]">
          <a
            href="/jobs/{job.id}"
            class="inline-flex items-center gap-1.5 text-xs text-[var(--dash-primary)] hover:underline"
          >
            View Job Details
            <FontAwesomeIcon icon={faArrowRight} class="w-3 h-3" />
          </a>
        </div>
      {/if}
    {:else}
      <p class="text-sm text-[var(--dash-text-muted)]">No job linked to this application.</p>
    {/if}
  </Card>

  <!-- Status + Application Details -->
  <div class="flex flex-col lg:flex-row gap-6">
  <!-- Status Widget -->
  <Card padding="lg" class="flex-1 min-w-0">
    <div class="space-y-3">
      <div class="flex items-center gap-2 mb-2">
        <FontAwesomeIcon
          icon={faClipboardList}
          class="w-4 h-4 text-[var(--dash-text-secondary)]"
        />
        <h2
          class="text-sm font-semibold text-[var(--dash-text)] uppercase tracking-wide"
        >
          Status
        </h2>
      </div>

      <button
        type="button"
        onclick={openStatusPicker}
        class="inline-flex items-center gap-5 px-4 py-3 rounded-lg border border-[var(--dash-border)] bg-[var(--dash-bg)] hover:border-[var(--dash-primary)] transition-colors text-left"
      >
        <div class="min-w-0 space-y-1">
          <p class="text-sm font-semibold uppercase tracking-wide {getStatusDotColor(app.status)}">
            {getStatusLabel(app.status)}
          </p>
          {#if app.status_step}
            <p class="text-sm text-[var(--dash-text-secondary)] italic">{app.status_step}</p>
          {/if}
          {#if app.status_action}
            {@const isWaiting = app.status_action.startsWith("Awaiting")}
            {@const isScheduled = app.status_action === "Scheduled"}
            <p class="text-sm font-medium flex items-center gap-1.5 {isWaiting ? 'text-[var(--dash-text-muted)]' : isScheduled ? 'text-[var(--dash-success)]' : 'text-[var(--dash-primary)]'}">
              {#key app.status_action}
                <FontAwesomeIcon icon={isWaiting ? faClock : isScheduled ? faCalendarCheck : faHandPointRight} class="w-3.5 h-3.5" />
              {/key}
              {app.status_action}
              {#if isScheduled && app.status_action_date}
                — {formatDate(app.status_action_date)}
              {/if}
            </p>
          {/if}
        </div>
        <FontAwesomeIcon icon={faPencil} class="w-3 h-3 text-[var(--dash-text-muted)] flex-shrink-0" />
      </button>
    </div>
  </Card>

  <!-- Application Details (Texts, Documents, Salary) -->
  <Card padding="lg" class="flex-1 min-w-0">
    <div class="space-y-4">
      <div class="flex items-center gap-2 mb-4">
        <FontAwesomeIcon
          icon={faWrench}
          class="w-4 h-4 text-[var(--dash-text-secondary)]"
        />
        <h2
          class="text-sm font-semibold text-[var(--dash-text)] uppercase tracking-wide"
        >
          Workbench
        </h2>
      </div>

      <div class="flex flex-col gap-3 text-sm">
        <!-- CV/Resume Sent -->
        {#if app.cv_sent_through}
          {@const dt = app.cv_sent_through as DocType}
          <div class="flex items-center gap-1.5">
            <FontAwesomeIcon icon={faFileAlt} class="w-3.5 h-3.5 text-[var(--dash-text-muted)]" />
            <span class="text-[var(--dash-text-secondary)]">{dt === "cv" ? "CV" : "Resume"} sent</span>
            <a href="/applications/{app.id}/documents" class="text-[var(--dash-text)] font-medium hover:text-[var(--dash-primary)] transition-colors">
              {data.cvVersionName || (dt === "cv" ? "CV" : "Resume")}
            </a>
            {#if app.cv_version_sent && profileSlug}
              <a
                href={profileDocUrl({ profileSlug, docType: dt, versionSlug: app.cv_version_sent })}
                target="_blank"
                rel="noopener"
                class="text-[var(--dash-text-muted)] hover:text-[var(--dash-primary)] transition-colors"
              >
                <FontAwesomeIcon icon={faExternalLinkAlt} class="w-3 h-3" />
              </a>
            {/if}
          </div>
        {/if}

        <!-- Letters -->
        {#each app.application_letters || [] as letter}
          <div class="flex items-center gap-1.5">
            <FontAwesomeIcon icon={faEnvelope} class="w-3.5 h-3.5 text-[var(--dash-text-muted)]" />
            <a href="/applications/{app.id}/texts/{letter.id}" class="text-[var(--dash-text)] font-medium hover:text-[var(--dash-primary)] transition-colors">
              {letterTypeLabels[letter.letter_type] || letter.letter_type}
            </a>
            <span class="text-[var(--dash-text-muted)]">({letter.status})</span>
          </div>
        {/each}

        <!-- Questions -->
        {#if questionCount > 0}
          <div class="flex items-center justify-between">
            <span class="text-[var(--dash-text-secondary)] flex items-center gap-1.5">
              <FontAwesomeIcon icon={faClipboardList} class="w-3.5 h-3.5 text-[var(--dash-text-muted)]" />
              Application Questions
            </span>
            <a href="/applications/{app.id}/texts" class="text-[var(--dash-text)] font-medium hover:text-[var(--dash-primary)] transition-colors">
              {questionCount}
            </a>
          </div>
        {/if}

        <!-- Documents -->
        {#if fileCount > 0}
          <div class="flex items-center justify-between">
            <span class="text-[var(--dash-text-secondary)] flex items-center gap-1.5">
              <FontAwesomeIcon icon={faFileAlt} class="w-3.5 h-3.5 text-[var(--dash-text-muted)]" />
              Documents
            </span>
            <a href="/applications/{app.id}/documents" class="text-[var(--dash-text)] font-medium hover:text-[var(--dash-primary)] transition-colors">
              {fileCount} attached
            </a>
          </div>
        {/if}

        <!-- Salary Expectation -->
        {#if app.salary_expectation}
          <div class="flex items-center gap-1.5">
            <FontAwesomeIcon icon={faMoneyBillWave} class="w-3.5 h-3.5 text-[var(--dash-text-muted)]" />
            <span class="text-[var(--dash-text-secondary)]">Salary Expectation</span>
            <a href="/applications/{app.id}/salary" class="text-[var(--dash-text)] font-medium hover:text-[var(--dash-primary)] transition-colors">
              {formatCurrency(app.salary_expectation, app.salary_currency, app.salary_period)}
            </a>
          </div>
        {/if}

        <!-- No items -->
        {#if !app.cv_sent_through && letterCount === 0 && questionCount === 0 && fileCount === 0 && !app.salary_expectation}
          <p class="text-sm text-[var(--dash-text-muted)]">No items added yet.</p>
        {/if}
      </div>

      <!-- Footer links -->
      <div class="flex items-center gap-4 -mx-6 -mb-6 mt-2 px-6 py-3 border-t border-[var(--dash-border)]">
        {#if !app.cv_sent_through}
          <a href="/applications/{app.id}/documents" class="inline-flex items-center gap-1.5 text-xs text-[var(--dash-primary)] hover:underline">
            Set resume/CV <FontAwesomeIcon icon={faArrowRight} class="w-3 h-3" />
          </a>
        {/if}
        <a href="/applications/{app.id}/texts" class="inline-flex items-center gap-1.5 text-xs text-[var(--dash-primary)] hover:underline">
          Write texts <FontAwesomeIcon icon={faArrowRight} class="w-3 h-3" />
        </a>
        {#if fileCount === 0}
          <a href="/applications/{app.id}/documents" class="inline-flex items-center gap-1.5 text-xs text-[var(--dash-primary)] hover:underline">
            Add documents <FontAwesomeIcon icon={faArrowRight} class="w-3 h-3" />
          </a>
        {:else}
          <a href="/applications/{app.id}/documents" class="inline-flex items-center gap-1.5 text-xs text-[var(--dash-primary)] hover:underline">
            Manage documents <FontAwesomeIcon icon={faArrowRight} class="w-3 h-3" />
          </a>
        {/if}
        {#if !app.salary_expectation}
          <a href="/applications/{app.id}/salary" class="inline-flex items-center gap-1.5 text-xs text-[var(--dash-primary)] hover:underline">
            Set salary <FontAwesomeIcon icon={faArrowRight} class="w-3 h-3" />
          </a>
        {/if}
      </div>
    </div>
  </Card>
  </div>

  <!-- Notes -->
  <Card padding="lg">
    <div class="space-y-3">
      <div class="flex items-center gap-2 mb-4">
        <FontAwesomeIcon
          icon={faStickyNote}
          class="w-4 h-4 text-[var(--dash-text-secondary)]"
        />
        <h2
          class="text-sm font-semibold text-[var(--dash-text)] uppercase tracking-wide"
        >
          Notes
        </h2>
      </div>

      <form
        method="POST"
        action="?/updateNote"
        use:enhance={() => {
          noteSaving = true;
          noteSaved = false;
          return async ({ update }) => {
            await update();
            noteSaving = false;
            noteSaved = true;
            setTimeout(() => {
              noteSaved = false;
            }, 2000);
          };
        }}
      >
        <textarea
          name="note"
          bind:value={noteValue}
          placeholder="Add notes about this application..."
          rows="4"
          class="w-full px-3 py-2 text-sm rounded-lg border border-[var(--dash-border)] bg-[var(--dash-bg)] text-[var(--dash-text)] focus:outline-none focus:border-[var(--dash-primary)] resize-y"
        ></textarea>

        <div class="flex items-center justify-end gap-3 mt-2">
          {#if noteSaved}
            <span
              class="text-xs text-[var(--dash-success)] flex items-center gap-1"
            >
              <FontAwesomeIcon icon={faCheck} class="w-3 h-3" />
              Saved
            </span>
          {/if}
          <button
            type="submit"
            disabled={noteSaving}
            class="flex items-center gap-2 px-4 py-2 text-sm bg-[var(--dash-primary)] text-white rounded-lg hover:bg-[var(--dash-primary-hover)] transition-colors disabled:opacity-50"
          >
            <FontAwesomeIcon icon={faSave} class="w-3 h-3" />
            {noteSaving ? "Saving..." : "Save Note"}
          </button>
        </div>
      </form>
    </div>
  </Card>

  <!-- Discontinued Info -->
  {#if app.discontinued_reason}
    <Card padding="lg">
      <div
        class="bg-[var(--dash-error-light)] border border-[var(--dash-error)] rounded-lg p-4"
      >
        <p class="text-[var(--dash-error)] font-medium text-sm">
          Discontinued: {app.discontinued_reason}
        </p>
        {#if app.discontinued_note}
          <p class="text-[var(--dash-error)] text-sm mt-1">
            {app.discontinued_note}
          </p>
        {/if}
      </div>
    </Card>
  {/if}

  <!-- Recent Activity -->
  <Card padding="lg">
    <div class="space-y-3">
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-2">
          <FontAwesomeIcon
            icon={faCalendar}
            class="w-4 h-4 text-[var(--dash-text-secondary)]"
          />
          <h2
            class="text-sm font-semibold text-[var(--dash-text)] uppercase tracking-wide"
          >
            Recent Activity
          </h2>
        </div>
        {#if statusLogCount > 5}
          <a
            href="/applications/{app.id}/timeline"
            class="flex items-center gap-1.5 text-xs text-[var(--dash-primary)] hover:underline"
          >
            View all ({statusLogCount})
            <FontAwesomeIcon icon={faArrowRight} class="w-3 h-3" />
          </a>
        {/if}
      </div>

      {#if recentStatusLog.length > 0}
        <div class="relative">
          <div class="absolute left-[13px] top-0 bottom-0 w-0.5 bg-[var(--dash-border)]"></div>
          <div class="space-y-0">
            {#each recentStatusLog as entry}
              <div class="relative flex gap-3.5 pb-4">
                <div class="relative z-10 flex-shrink-0 w-7 flex justify-center">
                  <div class="w-3.5 h-3.5 rounded-full {getStatusBgColor(entry.to_status)} border-2 border-[var(--dash-card)] mt-0.5"></div>
                </div>
                <div class="flex-1 min-w-0 -mt-0.5 space-y-0.5">
                  {#if entry.from_status !== entry.to_status}
                    <div class="mb-1.5">
                      <span class="text-xs px-2 py-0.5 rounded-full font-medium {getStatusColor(entry.to_status)}">
                        {getStatusLabel(entry.to_status)}
                      </span>
                    </div>
                  {/if}
                  {#if entry.step}
                    <p class="text-xs text-[var(--dash-text-secondary)] italic">{entry.step}</p>
                  {/if}
                  {#if entry.action}
                    <p class="text-xs text-[var(--dash-primary)] font-medium">
                      → {entry.action}
                      {#if entry.action_date}
                        — {formatDate(entry.action_date)}
                      {/if}
                    </p>
                  {/if}
                  {#if entry.description}
                    <p class="text-xs text-[var(--dash-text)]">{entry.description}</p>
                  {/if}
                  {#if entry.date_created}
                    <p class="text-xs text-[var(--dash-text-muted)] mt-0.5 flex items-center gap-1">
                      <FontAwesomeIcon icon={faCalendar} class="w-2.5 h-2.5" />
                      {formatDate(entry.date_created)}
                    </p>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        </div>
      {:else}
        <p class="text-sm text-[var(--dash-text-muted)]">
          No activity recorded yet. Activity will be logged when you change the
          application status.
        </p>
      {/if}

      {#if statusLogCount <= 5 && statusLogCount > 0}
        <a
          href="/applications/{app.id}/timeline"
          class="flex items-center gap-1.5 text-xs text-[var(--dash-primary)] hover:underline pt-2"
        >
          View full timeline
          <FontAwesomeIcon icon={faArrowRight} class="w-3 h-3" />
        </a>
      {/if}
    </div>
  </Card>

  <!-- More (collapsible) -->
  <div>
    <button
      type="button"
      onclick={() => showMore = !showMore}
      class="flex items-center gap-2 text-sm text-[var(--dash-text-muted)] hover:text-[var(--dash-text-secondary)] transition-colors"
    >
      <FontAwesomeIcon icon={faChevronDown} class="w-3 h-3 transition-transform {showMore ? 'rotate-180' : ''}" />
      More
    </button>
    {#if showMore}
      <div class="mt-4">
        <button
          type="button"
          onclick={() => showDeleteConfirm = true}
          class="flex items-center gap-2 px-4 py-2 text-sm bg-red-500/10 border border-red-500/30 rounded-lg text-red-500 hover:bg-red-500/20 hover:border-red-500/50 transition-colors"
        >
          <FontAwesomeIcon icon={faTrash} class="w-3 h-3" />
          Delete Application
        </button>
      </div>
    {/if}
  </div>

</div>

<ConfirmModal
  isOpen={showDeleteConfirm}
  title="Delete Application"
  message="Are you sure you want to permanently delete this application? All texts, documents, and timeline history will be removed. This action cannot be undone."
  confirmLabel="Delete"
  onCancel={() => showDeleteConfirm = false}
  onConfirm={() => {
    showDeleteConfirm = false;
    const form = document.createElement("form");
    form.method = "POST";
    form.action = "?/delete";
    document.body.appendChild(form);
    form.submit();
  }}
/>

<!-- Status Picker Modal -->
{#if statusPickerOpen}
  <div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" role="dialog">
    <div class="bg-[var(--dash-card)] rounded-xl shadow-lg max-w-lg w-full p-6">
      <h3 class="text-lg font-semibold text-[var(--dash-text)] mb-4">Update Status</h3>

      <form
        method="POST"
        action="?/updateStatus"
        use:enhance={() => {
          statusSaving = true;
          return async ({ update }) => {
            await update();
            statusSaving = false;
            statusPickerOpen = false;
          };
        }}
      >
        <input type="hidden" name="status" value={pickerPhase} />
        <input type="hidden" name="step" value={customStepActive ? customStepText : pickerStep} />
        <input type="hidden" name="action" value={customActionActive ? customActionText : pickerAction} />
        <input type="hidden" name="action_date" value={(customActionActive ? customActionText : pickerAction) === "Scheduled" ? pickerActionDate : ""} />

        <!-- Phase selection -->
        <div class="mb-4">
          <label for="picker-phase" class="block text-xs text-[var(--dash-text-secondary)] mb-1 uppercase tracking-wide">Phase</label>
          <select
            id="picker-phase"
            value={pickerPhase}
            onchange={(e) => {
              const phase = e.currentTarget.value;
              pickerPhase = phase;
              pickerStep = defaultStepByPhase[phase] || "";
              const stepDefault = pickerStep && defaultActionByStep[pickerStep];
              pickerAction = stepDefault || defaultActionByPhase[phase] || "";
              customStepActive = false;
              customStepText = "";
              customActionActive = false;
              customActionText = "";
            }}
            class="w-full px-3 py-2 text-sm rounded-lg border border-[var(--dash-border)] bg-[var(--dash-bg)] text-[var(--dash-text)] focus:outline-none focus:border-[var(--dash-primary)]"
          >
            {#each statusOptions as option}
              <option value={option.value}>{option.label}</option>
            {/each}
          </select>
        </div>

        <!-- Step selection -->
        {#if pickerStepOptions.length > 0}
          <div class="mb-4">
            <label for="picker-step" class="block text-xs text-[var(--dash-text-secondary)] mb-1 uppercase tracking-wide">Step</label>
            <select
              id="picker-step"
              value={customStepActive ? "__custom__" : pickerStep}
              onchange={(e) => {
                const val = e.currentTarget.value;
                if (val === "__custom__") {
                  customStepActive = true;
                  pickerStep = "";
                } else {
                  customStepActive = false;
                  customStepText = "";
                  pickerStep = val;
                  // Set default action for this step
                  if (val && defaultActionByStep[val]) {
                    pickerAction = defaultActionByStep[val];
                    customActionActive = false;
                    customActionText = "";
                  }
                }
              }}
              class="w-full px-3 py-2 text-sm rounded-lg border border-[var(--dash-border)] bg-[var(--dash-bg)] text-[var(--dash-text)] focus:outline-none focus:border-[var(--dash-primary)]"
            >
              <option value="">— No step —</option>
              {#each pickerStepOptions as step}
                <option value={step}>{step}</option>
              {/each}
              <option value="__custom__">Custom...</option>
            </select>
            {#if customStepActive}
              <input
                type="text"
                bind:value={customStepText}
                placeholder="Custom step..."
                class="mt-2 w-full px-3 py-2 text-sm border border-[var(--dash-border)] rounded-lg bg-[var(--dash-bg)] text-[var(--dash-text)] focus:outline-none focus:border-[var(--dash-primary)]"
              />
            {/if}
          </div>
        {/if}

        <!-- Follow-up action -->
        {#if pickerActionOptions.length > 0}
          <div class="mb-4">
            <label for="picker-action" class="block text-xs text-[var(--dash-text-secondary)] mb-1 uppercase tracking-wide">Action</label>
            <select
              id="picker-action"
              value={customActionActive ? "__custom__" : pickerAction}
              onchange={(e) => {
                const val = e.currentTarget.value;
                if (val === "__custom__") {
                  customActionActive = true;
                  pickerAction = "";
                } else {
                  customActionActive = false;
                  customActionText = "";
                  pickerAction = val;
                }
              }}
              class="w-full px-3 py-2 text-sm rounded-lg border border-[var(--dash-border)] bg-[var(--dash-bg)] text-[var(--dash-text)] focus:outline-none focus:border-[var(--dash-primary)]"
            >
              <option value="">— No action —</option>
              {#each pickerActionOptions as action}
                <option value={action}>{action}</option>
              {/each}
              <option value="__custom__">Custom...</option>
            </select>
            {#if customActionActive}
              <input
                type="text"
                bind:value={customActionText}
                placeholder="Custom action..."
                class="mt-2 w-full px-3 py-2 text-sm border border-[var(--dash-border)] rounded-lg bg-[var(--dash-bg)] text-[var(--dash-text)] focus:outline-none focus:border-[var(--dash-primary)]"
              />
            {/if}
            {#if (customActionActive ? customActionText : pickerAction) === "Scheduled"}
              <div class="mt-2">
                <label for="picker-action-date" class="block text-xs text-[var(--dash-text-secondary)] mb-1 uppercase tracking-wide">Scheduled Date</label>
                <input
                  id="picker-action-date"
                  type="date"
                  bind:value={pickerActionDate}
                  class="w-full px-3 py-2 text-sm border border-[var(--dash-border)] rounded-lg bg-[var(--dash-bg)] text-[var(--dash-text)] focus:outline-none focus:border-[var(--dash-primary)]"
                />
              </div>
            {/if}
          </div>
        {/if}

        <!-- Optional note -->
        <div class="mb-4">
          <label for="picker-description" class="block text-xs text-[var(--dash-text-secondary)] mb-1 uppercase tracking-wide">
            Note <span class="normal-case text-[var(--dash-text-muted)]">(optional)</span>
          </label>
          <textarea
            id="picker-description"
            name="description"
            bind:value={pickerDescription}
            rows={2}
            placeholder="Any additional context..."
            class="w-full px-3 py-2 text-sm border border-[var(--dash-border)] rounded-lg bg-[var(--dash-bg)] text-[var(--dash-text)] focus:outline-none focus:border-[var(--dash-primary)] resize-y"
          ></textarea>
        </div>

        <div class="flex justify-end gap-2">
          <button
            type="button"
            onclick={closeStatusPicker}
            class="px-4 py-2 text-sm border border-[var(--dash-border)] rounded-lg text-[var(--dash-text)] hover:bg-[var(--dash-bg)] transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={statusSaving}
            class="px-4 py-2 text-sm bg-[var(--dash-primary)] text-white rounded-lg hover:bg-[var(--dash-primary-hover)] transition-colors disabled:opacity-50"
          >
            {statusSaving ? "Saving..." : "Save"}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}
