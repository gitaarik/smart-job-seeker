<script lang="ts">
  import type { ActionData, PageData } from "./$types";
  import { enhance } from "$app/forms";
  import { untrack } from "svelte";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faArrowLeft,
    faBriefcase,
    faBuilding,
    faCalendar,
    faCheck,
    faExternalLinkAlt,
    faGlobe,
    faMapMarkerAlt,
    faMoneyBillWave,
    faSearch,
    faStar as faStarSolid,
    faSync,
    faTimes,
  } from "@fortawesome/free-solid-svg-icons";
  import { faStar as faStarRegular } from "@fortawesome/free-regular-svg-icons";
  import SectionHeader from "../../profile/components/SectionHeader.svelte";
  import ScoreBadge from "../components/ScoreBadge.svelte";
  import RescrapeMonitor from "../../components/RescrapeMonitor.svelte";
  import { formatJobType, formatJobStatus, formatWorkLocation } from "$lib/format";

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let job = $state(data.job);
  let match = $state(data.match);
  let isSaving = $state(false);
  let isRematching = $state(false);
  let rematchError = $state("");

  // Rescrape monitor modal
  let showRescrapeMonitor = $state(false);

  // Update match when form action completes
  $effect(() => {
    if (form?.success) {
      const currentMatch = untrack(() => match);
      if (form.action === "saved") {
        match = { ...currentMatch, status: "saved" } as typeof match;
      } else if (form.action === "unsaved") {
        if (currentMatch && currentMatch.score === 0 && !currentMatch.reasoning) {
          match = null;
        } else if (currentMatch) {
          match = { ...currentMatch, status: "new" };
        }
      } else if (form.action === "rematched") {
        // Reload the page to get fresh match data from the server
        window.location.reload();
      } else if (form.status) {
        match = { ...currentMatch, status: form.status } as typeof match;
      }
    }
  });

  let isSaved = $derived(match?.status === "saved");

  // Helper for matched skills highlighting
  const matchedSkillsSet = $derived(
    new Set(Array.isArray(match?.matched_skills) ? match.matched_skills : [])
  );

  let profileSkillLevels = $derived(data.profileSkillLevels);

  function getSkillMatchStrength(skill: string): "strong" | "weak" | null {
    if (!matchedSkillsSet.has(skill)) return null;
    const level = profileSkillLevels[skill.toLowerCase()];
    if (level === "weak") return "weak";
    return "strong";
  }

  const statusOptions = [
    { value: "new", label: "New" },
    { value: "viewed", label: "Viewed" },
    { value: "saved", label: "Saved" },
    { value: "applied", label: "Applied" },
    { value: "rejected", label: "Not Interested" },
  ];

  function formatDate(date: Date | string | null): string {
    if (!date) return "N/A";
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }

  function formatDateTime(date: Date | string | null): string {
    if (!date) return "N/A";
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function formatSalary(
    min: number | null,
    max: number | null,
    currency: string | null,
    period: string | null,
  ): string {
    if (!min && !max) return "Not specified";
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

  function getRecommendationLabel(rec: string | null): string {
    switch (rec) {
      case "highly_recommend":
        return "Highly Recommended";
      case "recommend":
        return "Recommended";
      case "consider":
        return "Consider";
      case "not_recommended":
        return "Not Recommended";
      case "filtered_out":
        return "Filtered Out";
      default:
        return rec || "Unknown";
    }
  }
</script>

<div class="space-y-6">
  <!-- Header with Back Button -->
  <div class="flex items-center gap-4">
    <button
      onclick={() => history.back()}
      class="p-2 rounded-lg border border-[var(--dash-border)] text-[var(--dash-text-secondary)] hover:bg-[var(--dash-bg)] transition-colors"
      aria-label="Back to jobs"
    >
      <FontAwesomeIcon icon={faArrowLeft} class="w-4 h-4" />
    </button>
    <SectionHeader
      title={isSaved ? "Saved Job" : match ? "Job Match" : "Job Details"}
      icon={faBriefcase}
    />
  </div>

  <!-- Main Content -->
  <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
    <!-- Left Column - Job Details -->
    <div class="lg:col-span-2 space-y-6">
      <!-- Job Header Card -->
      <div class="bg-[var(--dash-card)] rounded-lg border border-[var(--dash-border)] p-6">
        <!-- Title -->
        <h1 class="text-2xl font-bold text-[var(--dash-text)]">
          {job.title || "Untitled Job"}
        </h1>

        <!-- Company, location, score -->
        <div class="flex items-center justify-between gap-4 mt-2">
          <div class="flex items-center gap-3 text-[var(--dash-text-secondary)] flex-wrap">
            {#if job.company}
              <span class="flex items-center gap-1">
                <FontAwesomeIcon icon={faBuilding} class="w-4 h-4" />
                {job.company}
              </span>
            {/if}
            {#if job.office_location}
              <span class="flex items-center gap-1">
                <FontAwesomeIcon icon={faMapMarkerAlt} class="w-4 h-4" />
                {job.office_location}
              </span>
            {/if}
            {#if job.job_platforms}
              <span class="flex items-center gap-1">
                <FontAwesomeIcon icon={faGlobe} class="w-4 h-4" />
                {job.job_platforms.name}
              </span>
            {/if}
          </div>
          <div class="flex-shrink-0">
            <ScoreBadge score={match?.score ?? null} matched={!!match?.reasoning} />
          </div>
        </div>

        <!-- Tags (status, job types, work location) -->
        <div class="flex flex-wrap gap-2 mt-3">
          {#if job.status !== "hiring"}
            <span class="text-xs px-3 py-1 rounded-full bg-[var(--dash-bg)] text-[var(--dash-text-muted)]">
              {formatJobStatus(job.status)}
            </span>
          {/if}
          {#if job.job_types && Array.isArray(job.job_types)}
            {#each job.job_types as type}
              <span class="text-xs px-3 py-1 rounded-full bg-[var(--dash-bg)] text-[var(--dash-text)]">
                {formatJobType(type)}
              </span>
            {/each}
          {/if}
          {#if job.work_location && Array.isArray(job.work_location)}
            {#each job.work_location as loc}
              <span class="text-xs px-3 py-1 rounded-full bg-[var(--dash-primary-light)] text-[var(--dash-primary)]">
                {formatWorkLocation(loc)}
              </span>
            {/each}
          {/if}
        </div>

        <!-- Action Buttons -->
        <div class="flex flex-col gap-2 mt-4 items-start">
          <!-- Save + Source -->
          <div class="flex items-center gap-2">
            <form
              method="POST"
              action={isSaved ? "?/unsaveJob" : "?/saveJob"}
              use:enhance={() => {
                isSaving = true;
                return async ({ update }) => {
                  await update();
                  isSaving = false;
                };
              }}
            >
              <button
                type="submit"
                disabled={isSaving}
                class="flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors {isSaved
                  ? 'bg-[var(--dash-primary)] text-white border-[var(--dash-primary)]'
                  : 'border-[var(--dash-border)] text-[var(--dash-text)] hover:bg-[var(--dash-bg)]'} disabled:opacity-50"
                title={isSaved ? "Unsave job" : "Save job"}
              >
                <FontAwesomeIcon
                  icon={isSaved ? faStarSolid : faStarRegular}
                  class="w-4 h-4"
                />
                {isSaved ? "Saved" : "Save"}
              </button>
            </form>

            {#if job.source_url}
              <a
                href={job.source_url}
                target="_blank"
                rel="noopener"
                class="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--dash-primary)] text-white hover:bg-[var(--dash-primary-hover)] transition-colors"
              >
                <FontAwesomeIcon icon={faExternalLinkAlt} class="w-4 h-4" />
                Source
              </a>
            {/if}
          </div>

        </div>

      </div>

      <!-- Salary & Details -->
      <div class="bg-[var(--dash-card)] rounded-lg border border-[var(--dash-border)] p-6">
        <h2 class="text-lg font-semibold text-[var(--dash-text)] mb-4">Details</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <p class="text-sm text-[var(--dash-text-secondary)] mb-1">Salary</p>
            <p class="font-medium text-[var(--dash-text)] flex items-center gap-2">
              <FontAwesomeIcon icon={faMoneyBillWave} class="w-4 h-4 text-[var(--dash-success)]" />
              {formatSalary(job.salary_min, job.salary_max, job.salary_currency, job.salary_period)}
            </p>
          </div>
          <div>
            <p class="text-sm text-[var(--dash-text-secondary)] mb-1">Posted</p>
            <p class="font-medium text-[var(--dash-text)] flex items-center gap-2">
              <FontAwesomeIcon icon={faCalendar} class="w-4 h-4" />
              {formatDate(job.date_posted || job.date_created)}
            </p>
          </div>
          {#if job.experience_levels && Array.isArray(job.experience_levels) && job.experience_levels.length > 0}
            <div>
              <p class="text-sm text-[var(--dash-text-secondary)] mb-1">Experience Level</p>
              <p class="font-medium text-[var(--dash-text)]">
                {job.experience_levels.join(", ")}
              </p>
            </div>
          {/if}
          {#if job.job_poster}
            <div>
              <p class="text-sm text-[var(--dash-text-secondary)] mb-1">Posted By</p>
              <p class="font-medium text-[var(--dash-text)]">
                {job.job_poster}
              </p>
            </div>
          {/if}
        </div>
      </div>

      <!-- Skills -->
      {#if (job.skills_required && Array.isArray(job.skills_required) && job.skills_required.length > 0) ||
           (job.skills_preferred && Array.isArray(job.skills_preferred) && job.skills_preferred.length > 0)}
        <div class="bg-[var(--dash-card)] rounded-lg border border-[var(--dash-border)] p-6">
          <h2 class="text-lg font-semibold text-[var(--dash-text)] mb-4">Skills</h2>

          {#if job.skills_required && Array.isArray(job.skills_required) && job.skills_required.length > 0}
            <div class="mb-4">
              <p class="text-sm text-[var(--dash-text-secondary)] mb-2">Required</p>
              <div class="flex flex-wrap gap-2">
                {#each job.skills_required as skill}
                  {@const strength = getSkillMatchStrength(skill)}
                  {#if strength === "strong"}
                    <span class="px-3 py-1 text-sm bg-[var(--dash-success-light)] text-[var(--dash-success)] rounded-lg flex items-center gap-1">
                      <FontAwesomeIcon icon={faCheck} class="w-3 h-3" />
                      {skill}
                    </span>
                  {:else if strength === "weak"}
                    <span class="px-3 py-1 text-sm bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded-lg flex items-center gap-1">
                      <FontAwesomeIcon icon={faCheck} class="w-3 h-3" />
                      {skill}
                    </span>
                  {:else}
                    <span class="px-3 py-1 text-sm bg-[var(--dash-bg)] text-[var(--dash-text)] rounded-lg">
                      {skill}
                    </span>
                  {/if}
                {/each}
              </div>
            </div>
          {/if}

          {#if job.skills_preferred && Array.isArray(job.skills_preferred) && job.skills_preferred.length > 0}
            <div>
              <p class="text-sm text-[var(--dash-text-secondary)] mb-2">Preferred</p>
              <div class="flex flex-wrap gap-2">
                {#each job.skills_preferred as skill}
                  {@const strength = getSkillMatchStrength(skill)}
                  {#if strength === "strong"}
                    <span class="px-3 py-1 text-sm bg-[var(--dash-success-light)] text-[var(--dash-success)] rounded-lg flex items-center gap-1">
                      <FontAwesomeIcon icon={faCheck} class="w-3 h-3" />
                      {skill}
                    </span>
                  {:else if strength === "weak"}
                    <span class="px-3 py-1 text-sm bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded-lg flex items-center gap-1">
                      <FontAwesomeIcon icon={faCheck} class="w-3 h-3" />
                      {skill}
                    </span>
                  {:else}
                    <span class="px-3 py-1 text-sm bg-[var(--dash-primary-light)] text-[var(--dash-primary)] rounded-lg">
                      {skill}
                    </span>
                  {/if}
                {/each}
              </div>
            </div>
          {/if}
        </div>
      {/if}

      <!-- Job Description -->
      {#if job.job_description}
        <div class="bg-[var(--dash-card)] rounded-lg border border-[var(--dash-border)] p-6">
          <h2 class="text-lg font-semibold text-[var(--dash-text)] mb-4">Job Description</h2>
          <div class="prose prose-sm max-w-none text-[var(--dash-text)] whitespace-pre-wrap">
            {job.job_description}
          </div>
        </div>
      {/if}

      <!-- Company Description -->
      {#if job.company_description}
        <div class="bg-[var(--dash-card)] rounded-lg border border-[var(--dash-border)] p-6">
          <h2 class="text-lg font-semibold text-[var(--dash-text)] mb-4">About {job.company || "the Company"}</h2>
          <div class="prose prose-sm max-w-none text-[var(--dash-text)] whitespace-pre-wrap">
            {job.company_description}
          </div>
        </div>
      {/if}
    </div>

    <!-- Right Column -->
    <div class="space-y-6">
      <!-- Staff: Metadata + Actions -->
      {#if data.isStaff}
        <div class="bg-[var(--dash-card)] rounded-lg border border-[var(--dash-border)] p-6">
          <h2 class="text-lg font-semibold text-[var(--dash-text)] mb-4">Staff Tools</h2>

          <!-- Action buttons -->
          <div class="flex flex-wrap gap-2 mb-4">
            {#if job.source_url}
              <button
                type="button"
                onclick={() => (showRescrapeMonitor = true)}
                class="flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--dash-border)] text-[var(--dash-text)] hover:bg-[var(--dash-bg)] transition-colors"
                title="Re-fetch job data from source"
              >
                <FontAwesomeIcon icon={faSync} class="w-4 h-4" />
                Rescrape
              </button>
            {/if}

            <form
              method="POST"
              action="?/rematchJob"
              use:enhance={() => {
                isRematching = true;
                rematchError = "";
                return async ({ result, update }) => {
                  if (result.type === "failure") {
                    rematchError = (result.data as { error?: string })?.error || "Re-match failed";
                    isRematching = false;
                  } else {
                    await update();
                    isRematching = false;
                  }
                };
              }}
            >
              <button
                type="submit"
                disabled={isRematching}
                class="flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--dash-border)] text-[var(--dash-text)] hover:bg-[var(--dash-bg)] transition-colors disabled:opacity-50"
                title={match?.reasoning ? "Re-run AI matching for this job" : "Run AI matching for this job"}
              >
                <FontAwesomeIcon
                  icon={isRematching ? faSync : match?.reasoning ? faSync : faSearch}
                  class="w-4 h-4 {isRematching ? 'animate-spin' : ''}"
                />
                {isRematching ? "Matching..." : match?.reasoning ? "Re-match" : "Check Match"}
              </button>
            </form>
          </div>

          <!-- Re-match Error -->
          {#if rematchError}
            <div class="mb-4 p-3 bg-[var(--dash-error-light)] border border-[var(--dash-error)] rounded-lg">
              <p class="text-sm text-[var(--dash-error)]">
                <strong>Re-match failed:</strong> {rematchError}
              </p>
            </div>
          {/if}

          <!-- Metadata -->
          <dl class="space-y-2 text-sm">
            <div class="flex justify-between">
              <dt class="text-[var(--dash-text-secondary)]">Job ID</dt>
              <dd class="text-[var(--dash-text)]">{job.id}</dd>
            </div>
            {#if job.source_id}
              <div class="flex justify-between">
                <dt class="text-[var(--dash-text-secondary)]">Source ID</dt>
                <dd class="text-[var(--dash-text)] truncate max-w-32" title={job.source_id}>{job.source_id}</dd>
              </div>
            {/if}
            <div class="flex justify-between">
              <dt class="text-[var(--dash-text-secondary)]">Added</dt>
              <dd class="text-[var(--dash-text)]">{formatDate(job.date_created)}</dd>
            </div>
          </dl>

          <!-- Scrape History -->
          {#if data.scrapeHistory.length > 0}
            <div class="mt-4">
              <p class="text-sm text-[var(--dash-text-secondary)] mb-2">Scrape History</p>
              <ul class="space-y-1 text-sm text-[var(--dash-text)]">
                {#each data.scrapeHistory as entry}
                  <li>{formatDateTime(entry.processed_at)}</li>
                {/each}
              </ul>
            </div>
          {/if}
        </div>
      {/if}

      <!-- Match Analysis Card -->
      <div class="bg-[var(--dash-card)] rounded-lg border border-[var(--dash-border)] p-6">
        <h2 class="text-lg font-semibold text-[var(--dash-text)] mb-4">Match Analysis</h2>

        {#if match && match.reasoning && match.recommendation === "filtered_out"}
          <!-- Filtered out - didn't pass eligibility -->
          <p class="text-sm text-[var(--dash-text-secondary)] mb-3">
            This job was filtered out before AI scoring because it doesn't match your profile preferences.
          </p>

          {#if match.gaps && Array.isArray(match.gaps) && match.gaps.length > 0}
            <ul class="space-y-2">
              {#each match.gaps as gap}
                <li class="flex items-start gap-2 text-sm">
                  <FontAwesomeIcon icon={faTimes} class="w-3 h-3 text-red-500 mt-1 flex-shrink-0" />
                  <span class="text-[var(--dash-text)]">{gap}</span>
                </li>
              {/each}
            </ul>
          {/if}

        {:else if match && match.reasoning}
          <!-- AI-scored match -->
          <p class="font-medium text-[var(--dash-text)] mb-4">
            {getRecommendationLabel(match.recommendation)}
          </p>

          {#if match.strengths && Array.isArray(match.strengths) && match.strengths.length > 0}
            <div class="mb-4">
              <p class="text-sm text-[var(--dash-text-secondary)] mb-2">Strengths</p>
              <ul class="space-y-1">
                {#each match.strengths as strength}
                  <li class="flex items-start gap-2 text-sm">
                    <FontAwesomeIcon icon={faCheck} class="w-3 h-3 text-green-600 mt-1 flex-shrink-0" />
                    <span class="text-[var(--dash-text)]">{strength}</span>
                  </li>
                {/each}
              </ul>
            </div>
          {/if}

          {#if match.gaps && Array.isArray(match.gaps) && match.gaps.length > 0}
            <div class="mb-4">
              <p class="text-sm text-[var(--dash-text-secondary)] mb-2">Gaps</p>
              <ul class="space-y-1">
                {#each match.gaps as gap}
                  <li class="flex items-start gap-2 text-sm">
                    <FontAwesomeIcon icon={faTimes} class="w-3 h-3 text-red-500 mt-1 flex-shrink-0" />
                    <span class="text-[var(--dash-text)]">{gap}</span>
                  </li>
                {/each}
              </ul>
            </div>
          {/if}

          {#if match.reasoning}
            <div>
              <p class="text-sm text-[var(--dash-text-secondary)] mb-1">Analysis</p>
              <p class="text-sm text-[var(--dash-text)]">{match.reasoning}</p>
            </div>
          {/if}

        {:else}
          <!-- Not yet matched -->
          <p class="text-sm text-[var(--dash-text-muted)]">
            This job hasn't been matched against your profile yet.
          </p>
        {/if}
      </div>

      <!-- Status Card -->
      {#if match}
        <div class="bg-[var(--dash-card)] rounded-lg border border-[var(--dash-border)] p-6">
          <h2 class="text-lg font-semibold text-[var(--dash-text)] mb-4">Status</h2>
          <div class="flex flex-wrap gap-2">
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
                <input type="hidden" name="status" value={option.value} />
                <button
                  type="submit"
                  class="px-3 py-1.5 text-sm rounded-lg transition-colors {match?.status === option.value
                    ? 'bg-[var(--dash-primary)] text-white'
                    : 'bg-[var(--dash-bg)] text-[var(--dash-text)] hover:bg-[var(--dash-border)]'}"
                >
                  {option.label}
                </button>
              </form>
            {/each}
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>

{#if showRescrapeMonitor}
  <RescrapeMonitor
    jobId={job.id}
    onclose={() => (showRescrapeMonitor = false)}
    oncomplete={() => window.location.reload()}
  />
{/if}
