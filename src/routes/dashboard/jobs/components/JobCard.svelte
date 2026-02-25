<script lang="ts">
  import { enhance } from "$app/forms";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faArrowRight,
    faBookmark as faBookmarkSolid,
    faBriefcase,
    faBuilding,
    faCalendar,
    faCheck,
    faChevronDown,
    faChevronUp,
    faExternalLinkAlt,
    faMapMarkerAlt,
    faMoneyBillWave,
  } from "@fortawesome/free-solid-svg-icons";
  import { faBookmark as faBookmarkRegular } from "@fortawesome/free-regular-svg-icons";
  import type { Snippet } from "svelte";

  interface Job {
    id: number;
    title: string | null;
    company: string | null;
    office_location: string | null;
    source_url: string | null;
    job_description: string | null;
    salary_min: number | null;
    salary_max: number | null;
    salary_currency: string | null;
    salary_period: string | null;
    skills_required: unknown; // JsonValue from Prisma
    date_posted: Date | string | null;
    date_created: Date | string | null;
    job_platforms?: { name: string } | null;
  }

  interface Match {
    id: number;
    score: number;
    skill_match_percentage: number | null;
    matched_skills?: string[] | null;
    match_summary?: string | null;
    status: string;
  }

  interface Props {
    job: Job;
    match?: Match | null;
    isSaved?: boolean;
    isExpanded?: boolean;
    onToggleExpand?: () => void;
    onToggleSaved?: (saved: boolean) => void;
    saveAction?: string;
    unsaveAction?: string;
    showSaveButton?: boolean;
    expandedContent?: Snippet;
  }

  let {
    job,
    match = null,
    isSaved = false,
    isExpanded = false,
    onToggleExpand,
    onToggleSaved,
    saveAction = "?/saveJob",
    unsaveAction = "?/unsaveJob",
    showSaveButton = true,
    expandedContent,
  }: Props = $props();

  let saving = $state(false);

  function getScoreColor(score: number): string {
    if (score >= 75) return "text-[var(--dash-success)] bg-[var(--dash-success-light)]"; // green - strong match
    if (score >= 60) return "text-[var(--dash-info)] bg-[var(--dash-info-light)]"; // blue - good match
    return "text-[var(--dash-text-muted)] bg-[var(--dash-bg)]"; // gray - moderate/weak match
  }

  function formatSalary(
    min: number | null,
    max: number | null,
    currency: string | null,
    period: string | null,
  ): string {
    if (!min && !max) return "";
    const curr = currency || "USD";
    const formatter = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: curr,
      maximumFractionDigits: 0,
    });
    let result = "";
    if (min && max) {
      result = `${formatter.format(min)} - ${formatter.format(max)}`;
    } else if (min) {
      result = `From ${formatter.format(min)}`;
    } else if (max) {
      result = `Up to ${formatter.format(max)}`;
    }
    if (period) {
      result += ` / ${period}`;
    }
    return result;
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

  function truncate(text: string | null, maxLength: number): string {
    if (!text) return "";
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  }

  function asStringArray(value: unknown): string[] {
    return Array.isArray(value) ? value : [];
  }

  const hasMatch = $derived(match !== null && match.score > 0);
  const salaryText = $derived(formatSalary(job.salary_min, job.salary_max, job.salary_currency, job.salary_period));
  const skillsRequired = $derived(asStringArray(job.skills_required));
  const matchedSkillsSet = $derived(new Set(match?.matched_skills || []));

  function isSkillMatched(skill: string): boolean {
    // Exact match - matched_skills contains validated skill strings from the job's skill lists
    return matchedSkillsSet.has(skill);
  }
</script>

<div class="bg-[var(--dash-card)] rounded-lg border border-[var(--dash-border)] overflow-hidden">
  <!-- Header -->
  <div class="p-3 sm:p-4 hover:bg-[var(--dash-bg)] transition-colors">
    <!-- Mobile: Stack vertically, Desktop: Horizontal layout -->
    <div class="flex items-start sm:items-center gap-3 sm:gap-4">
      <!-- Clickable area for expand/collapse -->
      <button
        type="button"
        onclick={() => onToggleExpand?.()}
        class="flex items-start sm:items-center gap-3 sm:gap-4 flex-1 min-w-0 text-left"
      >
        <!-- Score Badge or Icon -->
        {#if hasMatch}
          <div
            class="w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center flex-shrink-0 {getScoreColor(match!.score)}"
          >
            <span class="font-bold text-base sm:text-lg">{match!.score}</span>
          </div>
        {:else}
          <div
            class="w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center flex-shrink-0 bg-[var(--dash-bg)] text-[var(--dash-text-muted)]"
          >
            <FontAwesomeIcon icon={faBriefcase} class="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        {/if}

        <div class="flex-1 min-w-0">
          <!-- Title -->
          <h3 class="font-medium text-[var(--dash-text)] text-sm sm:text-base line-clamp-2 sm:truncate">
            {job.title || "Untitled Job"}
          </h3>

          <!-- Company and location -->
          <div class="flex items-center gap-2 sm:gap-3 mt-1 text-xs sm:text-sm text-[var(--dash-text-secondary)] flex-wrap">
            {#if job.company}
              <span class="flex items-center gap-1">
                <FontAwesomeIcon icon={faBuilding} class="w-3 h-3" />
                <span class="truncate max-w-[120px] sm:max-w-none">{job.company}</span>
              </span>
            {/if}
            {#if job.office_location}
              <span class="flex items-center gap-1">
                <FontAwesomeIcon icon={faMapMarkerAlt} class="w-3 h-3" />
                <span class="truncate max-w-[100px] sm:max-w-none">{job.office_location}</span>
              </span>
            {/if}
            {#if job.job_platforms}
              <span class="text-[var(--dash-text-muted)] hidden sm:inline">
                {job.job_platforms.name}
              </span>
            {/if}
          </div>

          <!-- Salary and Date row -->
          <div class="flex items-center justify-between mt-1.5 sm:mt-2">
            <div class="flex items-center gap-2 sm:gap-4 text-xs sm:text-sm flex-wrap">
              {#if salaryText}
                <span class="flex items-center gap-1 text-[var(--dash-success)]">
                  <FontAwesomeIcon icon={faMoneyBillWave} class="w-3 h-3" />
                  <span class="truncate max-w-[140px] sm:max-w-none">{salaryText}</span>
                </span>
              {/if}
              {#if job.date_posted || job.date_created}
                <span class="flex items-center gap-1 text-[var(--dash-text-muted)]">
                  <FontAwesomeIcon icon={faCalendar} class="w-3 h-3" />
                  {formatDate(job.date_posted || job.date_created)}
                </span>
              {/if}
            </div>
          </div>

        </div>
      </button>

      <!-- Action buttons -->
      <div class="flex items-center gap-1 sm:gap-2 flex-shrink-0">
      <!-- Save/Unsave Button -->
      {#if showSaveButton}
        <form
          method="POST"
          action={isSaved ? unsaveAction : saveAction}
          use:enhance={() => {
            const wasSaved = isSaved;
            saving = true;
            // Optimistic update
            onToggleSaved?.(!wasSaved);
            return async ({ result }) => {
              saving = false;
              // Revert on failure
              if (result.type === "failure" || result.type === "error") {
                onToggleSaved?.(wasSaved);
              }
            };
          }}
          class="inline"
        >
          <input type="hidden" name="jobId" value={job.id} />
          <button
            type="submit"
            disabled={saving}
            class="p-1.5 sm:p-2 transition-colors {isSaved ? 'text-[var(--dash-primary)]' : 'text-[var(--dash-text-secondary)] hover:text-[var(--dash-primary)]'} disabled:opacity-50"
            aria-label={isSaved ? "Unsave job" : "Save job"}
            title={isSaved ? "Unsave job" : "Save job"}
            onclick={(e) => e.stopPropagation()}
          >
            {#key isSaved}
              <FontAwesomeIcon
                icon={isSaved ? faBookmarkSolid : faBookmarkRegular}
                class="w-4 h-4"
              />
            {/key}
          </button>
        </form>
      {/if}

      <!-- External Link - hidden on mobile to save space -->
      {#if job.source_url}
        <a
          href={job.source_url}
          target="_blank"
          rel="noopener"
          onclick={(e) => e.stopPropagation()}
          class="p-1.5 sm:p-2 text-[var(--dash-text-secondary)] hover:text-[var(--dash-primary)] transition-colors hidden sm:block"
          aria-label="View job posting"
          title="Open original posting"
        >
          <FontAwesomeIcon icon={faExternalLinkAlt} class="w-4 h-4" />
        </a>
      {/if}

      <!-- Expand/Collapse toggle -->
      {#if onToggleExpand}
        <button
          type="button"
          onclick={(e) => {
            e.stopPropagation();
            onToggleExpand?.();
          }}
          class="p-1.5 sm:p-2 text-[var(--dash-text-secondary)] hover:text-[var(--dash-primary)] transition-colors"
          aria-label={isExpanded ? "Collapse" : "Expand"}
        >
          <FontAwesomeIcon
            icon={isExpanded ? faChevronUp : faChevronDown}
            class="w-4 h-4"
          />
        </button>
      {/if}
    </div>

    <!-- Details Button -->
    <div class="flex justify-end mt-2">
      <a
        href="/dashboard/jobs/{job.id}"
        class="px-3 py-1.5 text-xs bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-lg text-[var(--dash-text)] hover:bg-[var(--dash-border)] transition-colors flex items-center gap-1.5"
      >
        Details
        <FontAwesomeIcon icon={faArrowRight} class="w-3 h-3" />
      </a>
    </div>
    </div>
  </div>

  <!-- Expanded Content -->
  {#if isExpanded}
    <div class="border-t border-[var(--dash-border)] p-3 sm:p-4 space-y-3 sm:space-y-4">
      {#if expandedContent}
        {@render expandedContent()}
      {:else}
        <!-- Default expanded content: Required Skills and Description -->
        {#if skillsRequired.length > 0}
          <div>
            <p class="text-xs text-[var(--dash-text-secondary)] uppercase tracking-wide mb-2">
              Required Skills
            </p>
            <div class="flex flex-wrap gap-1">
              {#each skillsRequired.slice(0, 15) as skill}
                {#if isSkillMatched(skill)}
                  <span class="px-2 py-1 text-xs bg-[var(--dash-success-light)] text-[var(--dash-success)] rounded flex items-center gap-1">
                    <FontAwesomeIcon icon={faCheck} class="w-2.5 h-2.5" />
                    {skill}
                  </span>
                {:else}
                  <span class="px-2 py-1 text-xs bg-[var(--dash-bg)] text-[var(--dash-text)] rounded">
                    {skill}
                  </span>
                {/if}
              {/each}
              {#if skillsRequired.length > 15}
                <span class="px-2 py-1 text-xs text-[var(--dash-text-muted)]">
                  +{skillsRequired.length - 15} more
                </span>
              {/if}
            </div>
          </div>
        {/if}

        {#if job.job_description}
          <div>
            <p class="text-xs text-[var(--dash-text-secondary)] uppercase tracking-wide mb-1">
              Description
            </p>
            <p class="text-sm text-[var(--dash-text)] whitespace-pre-wrap">
              {truncate(job.job_description, 300)}
            </p>
          </div>
        {/if}

        <!-- Match Summary -->
        {#if hasMatch && match!.match_summary}
          <div>
            <p class="text-xs text-[var(--dash-text-secondary)] uppercase tracking-wide mb-1">
              Match Analysis
            </p>
            <p class="text-sm text-[var(--dash-text)]">
              {match!.match_summary}
            </p>
          </div>
        {/if}

        <!-- Details Button -->
        <div class="flex justify-end">
          <a
            href="/dashboard/jobs/{job.id}"
            class="px-3 py-1.5 text-xs bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-lg text-[var(--dash-text)] hover:bg-[var(--dash-border)] transition-colors flex items-center gap-1.5"
          >
            Details
            <FontAwesomeIcon icon={faArrowRight} class="w-3 h-3" />
          </a>
        </div>
      {/if}
    </div>
  {/if}
</div>
