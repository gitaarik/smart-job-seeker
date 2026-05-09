<script lang="ts">
  import { enhance } from "$app/forms";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faArrowRight,
    faBan,
    faBuilding,
    faCalendar,
    faCheck,
    faChevronRight,
    faGlobe,
    faMapMarkerAlt,
    faMoneyBillWave,
    faStar as faStarSolid,
  } from "@fortawesome/free-solid-svg-icons";
  import { faStar as faStarRegular } from "@fortawesome/free-regular-svg-icons";
  import type { Snippet } from "svelte";
  import CategoryPill from "$lib/components/CategoryPill.svelte";
  import ScoreBadge from "./ScoreBadge.svelte";
  import SkillPill from "./SkillPill.svelte";
  import { formatSalaryRange, timeAgo } from "$lib/format";
  import { formatDate as fmtDate, formatMonthDay } from "$lib/format-date";

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
    skills_required: unknown;
    work_location?: unknown; // JsonValue - string[]
    job_types?: unknown; // JsonValue - string[]
    experience_levels?: unknown; // JsonValue - string[]
    date_posted: Date | string | null;
    date_created: Date | string | null;
    job_platform?: { name: string; url?: string } | null;
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
    matched?: boolean;
    profileSkillLevels?: Record<string, "strong" | "weak">;
    isSaved?: boolean;
    isRejected?: boolean;
    isExpanded?: boolean;
    onToggleExpand?: () => void;
    onToggleSaved?: (saved: boolean) => void;
    onToggleRejected?: (rejected: boolean) => void;
    saveAction?: string;
    unsaveAction?: string;
    rejectAction?: string;
    unrejectAction?: string;
    showSaveButton?: boolean;
    expandedContent?: Snippet;
    borderless?: boolean;
  }

  let {
    job,
    match = null,
    matched = false,
    profileSkillLevels = {},
    isSaved = false,
    isRejected = false,
    isExpanded = false,
    onToggleExpand,
    onToggleSaved,
    onToggleRejected,
    saveAction = "?/saveJob",
    unsaveAction = "?/unsaveJob",
    rejectAction = "?/rejectJob",
    unrejectAction = "?/unrejectJob",
    showSaveButton = true,
    expandedContent,
    borderless = false,
  }: Props = $props();

  let saving = $state(false);
  let rejecting = $state(false);

  function formatSalary(
    min: number | null,
    max: number | null,
    currency: string | null,
    period: string | null,
  ): string {
    const result = formatSalaryRange(min, max, currency, period);
    return result === "Not specified" ? "" : result;
  }

  function formatDate(date: Date | string | null): string {
    return fmtDate(date, { fallback: "" });
  }

  function truncate(text: string | null, maxLength: number): string {
    if (!text) return "";
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  }

  function asStringArray(value: unknown): string[] {
    return Array.isArray(value) ? value : [];
  }

  const salaryText = $derived(formatSalary(job.salary_min, job.salary_max, job.salary_currency, job.salary_period));
  const skillsRequired = $derived(asStringArray(job.skills_required));
  const workLocations = $derived(asStringArray(job.work_location));
  const jobTypes = $derived(asStringArray(job.job_types));
  const experienceLevels = $derived(asStringArray(job.experience_levels));
  const matchedSkillsSet = $derived(new Set(match?.matched_skills || []));

  /**
   * Returns the match strength for a skill:
   * - "strong": matched and user is proficient/expert
   * - "weak": matched but user is beginner/intermediate
   * - null: not matched
   */
  function getSkillMatchStrength(skill: string): "strong" | "weak" | null {
    if (!matchedSkillsSet.has(skill)) return null;
    const level = profileSkillLevels[skill.toLowerCase()];
    if (level === "weak") return "weak";
    return "strong";
  }
</script>

<div
  data-job-id={job.id}
  class="bg-[var(--dash-card)] overflow-hidden relative transition-all {borderless ? '' : 'rounded-lg border'} {isRejected ? 'opacity-50 grayscale border-[var(--dash-border)]' : isSaved && !borderless ? 'border-green-500 ring-2 ring-green-500/30' : isExpanded ? 'border-[var(--dash-primary)] ring-2 ring-[var(--dash-primary)]/20' : 'border-[var(--dash-border)]'}"
>
  <!-- Chevron in top right corner -->
  {#if onToggleExpand}
    <button
      type="button"
      onclick={(e) => {
        e.stopPropagation();
        onToggleExpand?.();
      }}
      class="absolute top-3 right-3 p-1.5 text-[var(--dash-text-secondary)] hover:text-[var(--dash-primary)] transition-colors"
      aria-label={isExpanded ? "Collapse" : "Expand"}
    >
      <span class="inline-block transition-transform duration-200 {isExpanded ? 'rotate-90' : ''}">
        <FontAwesomeIcon
          icon={faChevronRight}
          class="w-4 h-4"
        />
      </span>
    </button>
  {/if}

  <!-- Header -->
  <div class="p-3 sm:p-4 hover:bg-[var(--dash-bg)] transition-colors">
    <div class="flex items-start gap-3">
      <!-- Desktop: Score Badge on the left -->
      <div class="hidden md:flex flex-shrink-0">
        <ScoreBadge score={match?.score ?? null} {matched} size="lg" />
      </div>

      <!-- Clickable area for expand/collapse -->
      <button
        type="button"
        onclick={() => onToggleExpand?.()}
        class="flex items-start gap-3 flex-1 min-w-0 text-left"
      >
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
            {#if job.job_platform}
              <span class="flex items-center gap-1">
                <FontAwesomeIcon icon={faGlobe} class="w-3.5 h-3.5 text-[var(--dash-text-muted)]" />
                {job.job_platform.name}
              </span>
            {/if}
          </div>

          <!-- Tags: work location, job type, experience level -->
          {#if workLocations.length > 0 || jobTypes.length > 0 || experienceLevels.length > 0}
            <div class="flex items-center gap-1.5 mt-1.5 flex-wrap">
              {#each workLocations as loc}
                <CategoryPill category="work_location" value={loc} />
              {/each}
              {#each jobTypes as type}
                <CategoryPill category="job_type" value={type} />
              {/each}
              {#each experienceLevels as level}
                <CategoryPill category="experience_level" value={level} />
              {/each}
            </div>
          {/if}

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
                <span class="flex items-center gap-1 text-[var(--dash-text-secondary)]">
                  <FontAwesomeIcon icon={faCalendar} class="w-3 h-3" />
                  {timeAgo(job.date_posted || job.date_created)}
                  <span class="opacity-50">{formatMonthDay(job.date_posted || job.date_created, { fallback: "" })}</span>
                </span>
              {/if}
            </div>
          </div>

        </div>

      </button>

      <!-- Mobile: Score on the right, below chevron -->
      <button
        type="button"
        onclick={() => onToggleExpand?.()}
        class="flex-shrink-0 md:hidden self-end"
      >
        <ScoreBadge score={match?.score ?? null} {matched} size="lg" />
      </button>
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
                <SkillPill {skill} strength={getSkillMatchStrength(skill)} variant="required" size="sm" />
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
      {/if}
    </div>
  {/if}

  <!-- Footer with action buttons -->
  <div class="border-t border-[var(--dash-border)] px-3 py-2 sm:px-4 flex justify-end md:justify-start items-center gap-2">
    {#if showSaveButton}
      <!-- Not interested button -->
      <form
        method="POST"
        action={isRejected ? unrejectAction : rejectAction}
        use:enhance={() => {
          const wasRejected = isRejected;
          rejecting = true;
          onToggleRejected?.(!wasRejected);
          return async ({ result }) => {
            rejecting = false;
            if (result.type === "failure" || result.type === "error") {
              onToggleRejected?.(wasRejected);
            }
          };
        }}
        class="inline"
      >
        <input type="hidden" name="jobId" value={job.id} />
        <button
          type="submit"
          disabled={rejecting}
          class="px-3 py-1.5 text-xs border rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap disabled:opacity-50 {isRejected ? 'bg-gray-500/20 border-gray-500/40 text-gray-500' : 'bg-[var(--dash-bg)] border-[var(--dash-border)] text-[var(--dash-text)] hover:bg-gray-500/10 hover:border-gray-500/30'}"
        >
          <FontAwesomeIcon icon={faBan} class="w-3 h-3" />
          <span class="sm:hidden">No interest</span>
          <span class="hidden sm:inline">Not interested</span>
        </button>
      </form>

      <!-- Save button -->
      <form
        method="POST"
        action={isSaved ? unsaveAction : saveAction}
        use:enhance={() => {
          const wasSaved = isSaved;
          saving = true;
          onToggleSaved?.(!wasSaved);
          return async ({ result }) => {
            saving = false;
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
          class="px-3 py-1.5 text-xs border rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap disabled:opacity-50 {isSaved ? 'bg-green-500/20 border-green-500/40 text-green-600' : 'bg-[var(--dash-bg)] border-[var(--dash-border)] text-[var(--dash-text)] hover:bg-green-500/10 hover:border-green-500/30 hover:text-green-600'}"
        >
          {#key isSaved}
            <FontAwesomeIcon icon={isSaved ? faStarSolid : faStarRegular} class="w-3 h-3" />
          {/key}
          {isSaved ? "Saved" : "Save"}
        </button>
      </form>
    {/if}

    <!-- Details button -->
    <a
      href="/jobs/{job.id}"
      class="px-3 py-1.5 text-xs bg-blue-500/10 border border-blue-500/30 rounded-lg text-blue-500 hover:bg-blue-500/20 hover:border-blue-500/50 transition-colors flex items-center gap-1.5 whitespace-nowrap"
    >
      <span class="sm:hidden">Details</span>
      <span class="hidden sm:inline">Job Description</span>
      <FontAwesomeIcon icon={faArrowRight} class="w-3 h-3" />
    </a>
  </div>
</div>
