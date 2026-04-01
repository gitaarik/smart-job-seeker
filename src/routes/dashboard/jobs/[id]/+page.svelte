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
    faMapMarkerAlt,
    faMoneyBillWave,
    faPaperPlane,
    faSearch,
    faStar as faStarSolid,
    faSync,
    faTimes,
  } from "@fortawesome/free-solid-svg-icons";
  import { faStar as faStarRegular } from "@fortawesome/free-regular-svg-icons";
  import SectionHeader from "../../profile/components/SectionHeader.svelte";
  import ScoreBadge from "../components/ScoreBadge.svelte";
  import PlatformLogo from "$lib/components/PlatformLogo.svelte";
  import RescrapeMonitor from "../../components/RescrapeMonitor.svelte";
  import Card from "../../components/Card.svelte";
  import Spinner from "$lib/components/Spinner.svelte";
  import ConfirmModal from "../../profile/components/ConfirmModal.svelte";
  import { formatJobStatus } from "$lib/format";
  import CategoryPill from "$lib/components/CategoryPill.svelte";

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let job = $state(data.job);
  let match = $state(data.match);
  let jobStatus = $state(data.jobStatus);
  let isSaving = $state(false);
  let isRematching = $state(false);
  let rematchError = $state("");
  let showRematchConfirm = $state(false);
  let rematchFormEl: HTMLFormElement | undefined = $state();

  // Rescrape monitor modal — auto-show if a rescrape is in progress
  let rescrapeActive = ["queued", "scraping"].includes(
    job.rescrape_status ?? "",
  );
  let showRescrapeMonitor = $state(rescrapeActive);

  // Update status when form action completes
  $effect(() => {
    if (form?.success) {
      if (form.action === "saved") {
        jobStatus = "saved";
      } else if (form.action === "unsaved") {
        jobStatus = "new";
      } else if (form.action === "rematched") {
        // Reload the page to get fresh match data from the server
        window.location.reload();
      } else if (form.status) {
        jobStatus = form.status as string;
      }
    }
  });

  let isSaved = $derived(jobStatus === "saved");

  // Helper for matched skills highlighting
  const matchedSkillsSet = $derived(
    new Set(
      Array.isArray(match?.matched_skills) ? match.matched_skills : [],
    ),
  );

  let profileSkillLevels = $derived(data.profileSkillLevels);

  function getSkillMatchStrength(skill: string): "strong" | "weak" | null {
    if (!matchedSkillsSet.has(skill)) return null;
    const level = profileSkillLevels[skill.toLowerCase()];
    if (level === "weak") return "weak";
    return "strong";
  }

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
  <div>
    <a
      href="/dashboard/jobs"
      onclick={(e) => {
        if (document.referrer && new URL(document.referrer).origin === location.origin) {
          e.preventDefault();
          history.back();
        }
      }}
      class="flex items-center gap-2 text-[var(--dash-text-secondary)] hover:text-[var(--dash-primary)] transition-colors"
    >
      <FontAwesomeIcon icon={faArrowLeft} class="w-4 h-4" />
      <span class="text-sm">Back to all Jobs</span>
    </a>
  </div>
  <SectionHeader
    title={isSaved ? "Saved Job" : match ? "Job Match" : "Job Details"}
    icon={faBriefcase}
  />

  <!-- Main Content -->
  <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
    <!-- Left Column - Job Details -->
    <div class="lg:col-span-2 space-y-6">
      <!-- Job Header Card -->
      <Card padding="lg">
        <!-- Title -->
        <h1 class="text-2xl font-bold text-[var(--dash-text)]">
          {job.title || "Untitled Job"}
        </h1>

        <!-- Company, location, score -->
        <div class="flex items-center justify-between gap-4 mt-2">
          <div
            class="flex items-center gap-3 text-[var(--dash-text-secondary)] flex-wrap"
          >
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
                <PlatformLogo
                  platformUrl={job.job_platforms.url}
                  size="w-4 h-4"
                />
                {job.job_platforms.name}
              </span>
            {/if}
          </div>
          <div class="flex-shrink-0">
            <ScoreBadge
              score={match?.score ?? null}
              matched={!!match?.reasoning}
            />
          </div>
        </div>

        <!-- Tags (status, job types, work location) -->
        <div class="flex flex-wrap gap-2 mt-3">
          {#if job.status !== "hiring"}
            <span
              class="text-xs px-3 py-1 rounded-full bg-[var(--dash-bg)] text-[var(--dash-text-muted)]"
            >
              {formatJobStatus(job.status)}
            </span>
          {/if}
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

        <!-- Action Buttons -->
        <div class="flex flex-col gap-2 mt-4 items-start">
          <div class="flex flex-wrap items-center gap-2">
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
                class="
                  flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors whitespace-nowrap {isSaved
                  ? 'bg-[var(--dash-primary)] text-white border-[var(--dash-primary)]'
                  : 'border-[var(--dash-border)] text-[var(--dash-text)] hover:bg-[var(--dash-bg)]'} disabled:opacity-50
                "
                title={isSaved ? "Unsave job" : "Save job"}
              >
                <FontAwesomeIcon
                  icon={isSaved ? faStarSolid : faStarRegular}
                  class="w-4 h-4"
                />
                {isSaved ? "Saved" : "Save"}
              </button>
            </form>

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
              <input type="hidden" name="status" value="rejected" />
              <button
                type="submit"
                class="
                  flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors whitespace-nowrap {jobStatus === 'rejected'
                  ? 'bg-red-500 text-white border-red-500'
                  : 'border-[var(--dash-border)] text-[var(--dash-text)] hover:bg-[var(--dash-bg)]'}
                "
                title="Not interested in this job"
              >
                <FontAwesomeIcon icon={faTimes} class="w-4 h-4" />
                Not Interested
              </button>
            </form>

            {#if job.source_url}
              <a
                href={job.source_url}
                target="_blank"
                rel="noopener"
                class="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--dash-primary)] text-white hover:bg-[var(--dash-primary-hover)] transition-colors whitespace-nowrap"
              >
                <FontAwesomeIcon icon={faExternalLinkAlt} class="w-4 h-4" />
                Source
              </a>
            {/if}

            {#if data.existingApplication}
              <a
                href="/dashboard/applications/{data.existingApplication.id}"
                class="flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--dash-success)] bg-[var(--dash-success-light)] text-[var(--dash-success)] hover:bg-[var(--dash-success)] hover:text-white transition-colors whitespace-nowrap"
              >
                <FontAwesomeIcon icon={faPaperPlane} class="w-4 h-4" />
                View Application
                <span class="text-xs capitalize">({data.existingApplication.status})</span>
              </a>
            {:else}
              <form
                method="POST"
                action="?/startApplication"
                use:enhance
              >
                <button
                  type="submit"
                  class="flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--dash-primary)] text-[var(--dash-primary)] hover:bg-[var(--dash-primary)] hover:text-white transition-colors whitespace-nowrap"
                >
                  <FontAwesomeIcon icon={faPaperPlane} class="w-4 h-4" />
                  Start Application
                </button>
              </form>
            {/if}
          </div>
        </div>
      </Card>

      <!-- Salary & Details -->
      <Card padding="lg">
        <h2 class="text-lg font-semibold text-[var(--dash-text)] mb-4">
          Details
        </h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <p class="text-sm text-[var(--dash-text-secondary)] mb-1">Salary</p>
            <p
              class="font-medium text-[var(--dash-text)] flex items-center gap-2"
            >
              <FontAwesomeIcon
                icon={faMoneyBillWave}
                class="w-4 h-4 text-[var(--dash-success)]"
              />
              {
                formatSalary(
                  job.salary_min,
                  job.salary_max,
                  job.salary_currency,
                  job.salary_period,
                )
              }
            </p>
          </div>
          <div>
            <p class="text-sm text-[var(--dash-text-secondary)] mb-1">Posted</p>
            <p
              class="font-medium text-[var(--dash-text)] flex items-center gap-2"
            >
              <FontAwesomeIcon icon={faCalendar} class="w-4 h-4" />
              {
                formatDate(
                  job.date_posted || job.date_created,
                )
              }
            </p>
          </div>
          {#if job.job_poster}
            <div>
              <p class="text-sm text-[var(--dash-text-secondary)] mb-1">
                Posted By
              </p>
              <p class="font-medium text-[var(--dash-text)]">
                {job.job_poster}
              </p>
            </div>
          {/if}
        </div>
      </Card>

      <!-- Skills -->
      {#if         (job.skills_required && Array.isArray(job.skills_required) &&
          job.skills_required.length > 0) ||
          (job.skills_preferred &&
            Array.isArray(job.skills_preferred) &&
            job.skills_preferred.length > 0)}
        <Card padding="lg">
          <h2 class="text-lg font-semibold text-[var(--dash-text)] mb-4">
            Skills
          </h2>

          {#if           job.skills_required &&
            Array.isArray(job.skills_required) &&
            job.skills_required.length > 0}
            <div class="mb-4">
              <p class="text-sm text-[var(--dash-text-secondary)] mb-2">
                Required
              </p>
              <div class="flex flex-wrap gap-2">
                {#each job.skills_required as skill}
                  {@const strength = getSkillMatchStrength(skill)}
                  {#if strength === "strong"}
                    <span
                      class="px-3 py-1 text-sm bg-[var(--dash-success-light)] text-[var(--dash-success)] rounded-lg flex items-center gap-1"
                    >
                      <FontAwesomeIcon icon={faCheck} class="w-3 h-3" />
                      {skill}
                    </span>
                  {:else if strength === "weak"}
                    <span
                      class="px-3 py-1 text-sm bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded-lg flex items-center gap-1"
                    >
                      <FontAwesomeIcon icon={faCheck} class="w-3 h-3" />
                      {skill}
                    </span>
                  {:else}
                    <span
                      class="px-3 py-1 text-sm bg-[var(--dash-bg)] text-[var(--dash-text)] rounded-lg"
                    >
                      {skill}
                    </span>
                  {/if}
                {/each}
              </div>
            </div>
          {/if}

          {#if           job.skills_preferred &&
            Array.isArray(job.skills_preferred) &&
            job.skills_preferred.length > 0}
            <div>
              <p class="text-sm text-[var(--dash-text-secondary)] mb-2">
                Preferred
              </p>
              <div class="flex flex-wrap gap-2">
                {#each job.skills_preferred as skill}
                  {@const strength = getSkillMatchStrength(skill)}
                  {#if strength === "strong"}
                    <span
                      class="px-3 py-1 text-sm bg-[var(--dash-success-light)] text-[var(--dash-success)] rounded-lg flex items-center gap-1"
                    >
                      <FontAwesomeIcon icon={faCheck} class="w-3 h-3" />
                      {skill}
                    </span>
                  {:else if strength === "weak"}
                    <span
                      class="px-3 py-1 text-sm bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded-lg flex items-center gap-1"
                    >
                      <FontAwesomeIcon icon={faCheck} class="w-3 h-3" />
                      {skill}
                    </span>
                  {:else}
                    <span
                      class="px-3 py-1 text-sm bg-[var(--dash-primary-light)] text-[var(--dash-primary)] rounded-lg"
                    >
                      {skill}
                    </span>
                  {/if}
                {/each}
              </div>
            </div>
          {/if}
        </Card>
      {/if}

      <!-- Job Description -->
      {#if job.job_description}
        <Card padding="lg">
          <h2 class="text-lg font-semibold text-[var(--dash-text)] mb-4">
            Job Description
          </h2>
          <div
            class="prose prose-sm max-w-none text-[var(--dash-text)] whitespace-pre-wrap"
          >
            {job.job_description}
          </div>
        </Card>
      {/if}

      <!-- Company Description -->
      {#if job.company_description}
        <Card padding="lg">
          <h2 class="text-lg font-semibold text-[var(--dash-text)] mb-4">
            About {job.company || "the Company"}
          </h2>
          <div
            class="prose prose-sm max-w-none text-[var(--dash-text)] whitespace-pre-wrap"
          >
            {job.company_description}
          </div>
        </Card>
      {/if}
    </div>

    <!-- Right Column -->
    <div class="space-y-6">
      <!-- Match Analysis Card -->
      <Card padding="lg">
        <h2 class="text-lg font-semibold text-[var(--dash-text)] mb-4">
          Match Analysis
        </h2>

        {#if           match && match.reasoning &&
            match.recommendation === "filtered_out"}
          <!-- Filtered out - didn't pass eligibility -->
          <p class="text-sm text-[var(--dash-text-secondary)] mb-3">
            This job was filtered out before AI scoring because it doesn't match
            your profile preferences.
          </p>

          {#if           match.gaps && Array.isArray(match.gaps) &&
            match.gaps.length > 0}
            <ul class="space-y-2">
              {#each match.gaps as gap}
                <li class="flex items-start gap-2 text-sm">
                  <FontAwesomeIcon
                    icon={faTimes}
                    class="w-3 h-3 text-red-500 mt-1 flex-shrink-0"
                  />
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

          {#if           match.strengths && Array.isArray(match.strengths) &&
            match.strengths.length > 0}
            <div class="mb-4">
              <p class="text-sm text-[var(--dash-text-secondary)] mb-2">
                Strengths
              </p>
              <ul class="space-y-1">
                {#each match.strengths as strength}
                  <li class="flex items-start gap-2 text-sm">
                    <FontAwesomeIcon
                      icon={faCheck}
                      class="w-3 h-3 text-green-600 mt-1 flex-shrink-0"
                    />
                    <span class="text-[var(--dash-text)]">{strength}</span>
                  </li>
                {/each}
              </ul>
            </div>
          {/if}

          {#if           match.gaps && Array.isArray(match.gaps) &&
            match.gaps.length > 0}
            <div class="mb-4">
              <p class="text-sm text-[var(--dash-text-secondary)] mb-2">Gaps</p>
              <ul class="space-y-1">
                {#each match.gaps as gap}
                  <li class="flex items-start gap-2 text-sm">
                    <FontAwesomeIcon
                      icon={faTimes}
                      class="w-3 h-3 text-red-500 mt-1 flex-shrink-0"
                    />
                    <span class="text-[var(--dash-text)]">{gap}</span>
                  </li>
                {/each}
              </ul>
            </div>
          {/if}

          {#if match.reasoning}
            <div>
              <p class="text-sm text-[var(--dash-text-secondary)] mb-1">
                Analysis
              </p>
              <p class="text-sm text-[var(--dash-text)]">{match.reasoning}</p>
            </div>
          {/if}
        {:else}
          <!-- Not yet matched -->
          <p class="text-sm text-[var(--dash-text-muted)]">
            This job hasn't been matched against your profile yet.
          </p>
        {/if}
      </Card>

      <!-- Staff: Metadata + Actions -->
      {#if data.isStaff}
        <Card padding="lg">
          <h2 class="text-lg font-semibold text-[var(--dash-text)] mb-4">
            Staff Tools
          </h2>

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
              bind:this={rematchFormEl}
              method="POST"
              action="?/rematchJob"
              use:enhance={() => {
                isRematching = true;
                rematchError = "";
                return async ({ result, update }) => {
                  if (result.type === "failure") {
                    rematchError =
                      (result.data as { error?: string })?.error ||
                      "Re-match failed";
                    isRematching = false;
                  } else {
                    await update();
                    isRematching = false;
                  }
                };
              }}
            >
              <button
                type={match?.reasoning ? "button" : "submit"}
                onclick={match?.reasoning ? () => (showRematchConfirm = true) : undefined}
                disabled={isRematching}
                class="flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--dash-border)] text-[var(--dash-text)] hover:bg-[var(--dash-bg)] transition-colors disabled:opacity-50"
                title={match?.reasoning
                  ? "Re-run AI matching for this job"
                  : "Run AI matching for this job"}
              >
                {#if isRematching}
                  <Spinner size="w-4 h-4" />
                {:else}
                  <FontAwesomeIcon
                    icon={match?.reasoning ? faSync : faSearch}
                    class="w-4 h-4"
                  />
                {/if}
                {
                  isRematching
                    ? "Matching..."
                    : match?.reasoning
                    ? "Re-match"
                    : "Check Match"
                }
              </button>
            </form>
          </div>

          <!-- Re-match Error -->
          {#if rematchError}
            <div
              class="mb-4 p-3 bg-[var(--dash-error-light)] border border-[var(--dash-error)] rounded-lg"
            >
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
                <dd
                  class="text-[var(--dash-text)] truncate max-w-32"
                  title={job.source_id}
                >
                  {job.source_id}
                </dd>
              </div>
            {/if}
            <div class="flex justify-between">
              <dt class="text-[var(--dash-text-secondary)]">Added</dt>
              <dd class="text-[var(--dash-text)]">
                {formatDate(job.date_created)}
              </dd>
            </div>
          </dl>

          <!-- Imported By -->
          {#if data.importers.length > 0}
            <div class="mt-4">
              <p class="text-sm text-[var(--dash-text-secondary)] mb-2">
                Imported By
              </p>
              <ul class="space-y-1 text-sm text-[var(--dash-text)]">
                {#each data.importers as imp}
                  <li>
                    <span class="font-medium">{imp.profileName}</span>
                    {#if imp.scrapedAt}
                      <span class="text-[var(--dash-text-muted)]">
                        — {formatDateTime(imp.scrapedAt)}
                      </span>
                    {/if}
                  </li>
                {/each}
              </ul>
            </div>
          {/if}

          <!-- Match History -->
          {#if data.matchHistory.length > 0}
            <div class="mt-4">
              <p class="text-sm text-[var(--dash-text-secondary)] mb-2">
                Match History
              </p>
              <ul class="space-y-2 text-sm">
                {#each data.matchHistory as entry}
                  <li class="flex justify-between items-start gap-2">
                    <div class="text-[var(--dash-text)]">
                      <span class="font-medium">{entry.score}/100</span>
                      {#if entry.skill_match_percentage != null}
                        <span class="text-[var(--dash-text-muted)]">({entry.skill_match_percentage}% skills)</span>
                      {/if}
                      {#if entry.recommendation}
                        <span class="text-[var(--dash-text-muted)]">— {entry.recommendation.replace(/_/g, " ")}</span>
                      {/if}
                    </div>
                    <span class="text-[var(--dash-text-muted)] whitespace-nowrap shrink-0">{formatDateTime(entry.date_created)}</span>
                  </li>
                {/each}
              </ul>
            </div>
          {:else if match}
            <div class="mt-4">
              <p class="text-sm text-[var(--dash-text-secondary)] mb-2">
                Match Info
              </p>
              <dl class="space-y-1 text-sm">
                <div class="flex justify-between">
                  <dt class="text-[var(--dash-text-secondary)]">Matched</dt>
                  <dd class="text-[var(--dash-text)]">{formatDateTime(match.date_created)}</dd>
                </div>
                <div class="flex justify-between">
                  <dt class="text-[var(--dash-text-secondary)]">Score</dt>
                  <dd class="text-[var(--dash-text)]">{match.score}/100</dd>
                </div>
                <div class="flex justify-between">
                  <dt class="text-[var(--dash-text-secondary)]">Recommendation</dt>
                  <dd class="text-[var(--dash-text)]">{match.recommendation?.replace(/_/g, " ") ?? "—"}</dd>
                </div>
              </dl>
            </div>
          {/if}

          <!-- Scrape History -->
          {#if data.scrapeHistory.length > 0}
            <div class="mt-4">
              <p class="text-sm text-[var(--dash-text-secondary)] mb-2">
                Scrape History
              </p>
              <ul class="space-y-1 text-sm text-[var(--dash-text)]">
                {#each data.scrapeHistory as entry}
                  <li>{formatDateTime(entry.processed_at)}</li>
                {/each}
              </ul>
            </div>
          {/if}
        </Card>
      {/if}
    </div>
  </div>
</div>

{#if showRescrapeMonitor}
  <RescrapeMonitor
    jobId={job.id}
    sourceUrl={job.source_url}
    platformName={job.job_platforms?.name ?? null}
    platformCredentials={data.rescrapeConfig?.platformCredentials ?? []}
    platformId={data.rescrapeConfig?.platformId ?? 0}
    profileId={data.profileId}
    selectedCredentialId={data.rescrapeConfig?.selectedCredentialId ?? "none"}
    loginUrl={data.rescrapeConfig?.loginUrl ?? null}
    defaultBrowserProvider={data.rescrapeConfig?.browserProvider ?? null}
    defaultKeepMinimized={data.rescrapeConfig?.keepMinimized ?? true}
    defaultCountryCode={data.rescrapeConfig?.defaultCountryCode ?? ""}
    browserFingerprint={data.rescrapeConfig?.browserFingerprint ??
      { language: "", timezone: "", userAgent: "" }}
    browserFingerprintDefaults={data.rescrapeConfig?.browserFingerprintDefaults ??
      { language: "en-US,en", timezone: "America/New_York" }}
    initialStatus={job.rescrape_status ?? undefined}
    onclose={() => (showRescrapeMonitor = false)}
    oncomplete={() => window.location.reload()}
  />
{/if}

<ConfirmModal
  isOpen={showRematchConfirm}
  title="Re-match Job"
  message="This will re-run AI matching for this job, replacing the current match result. This uses AI credits."
  confirmLabel="Re-match"
  variant="primary"
  onCancel={() => (showRematchConfirm = false)}
  onConfirm={() => {
    showRematchConfirm = false;
    rematchFormEl?.requestSubmit();
  }}
/>
