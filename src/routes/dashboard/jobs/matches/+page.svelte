<script lang="ts">
  import type { ActionData, PageData } from "./$types";
  import { enhance } from "$app/forms";
  import { goto } from "$app/navigation";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faBookmark,
    faBriefcase,
    faCheck,
    faChevronDown,
    faChevronUp,
    faExternalLinkAlt,
    faListCheck,
    faMapMarkerAlt,
    faMoneyBillWave,
    faTimes,
  } from "@fortawesome/free-solid-svg-icons";
  import SectionHeader from "../../profile/components/SectionHeader.svelte";
  import EmptyState from "../../profile/components/EmptyState.svelte";

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let jobMatches = $derived(data.jobMatches);
  let currentStatus = $derived(data.currentStatus);
  let expandedId = $state<number | null>(null);

  const statusFilters = [
    { value: "all", label: "All Matches" },
    { value: "new", label: "New" },
    { value: "viewed", label: "Viewed" },
    { value: "saved", label: "Saved" },
    { value: "applied", label: "Applied" },
    { value: "rejected", label: "Not Interested" },
  ];

  const statusOptions = [
    { value: "new", label: "New" },
    { value: "viewed", label: "Viewed" },
    { value: "saved", label: "Saved" },
    { value: "applied", label: "Applied" },
    { value: "rejected", label: "Not Interested" },
  ];

  function getScoreColor(score: number): string {
    if (score >= 80) return "text-green-600 bg-green-100";
    if (score >= 60) return "text-yellow-600 bg-yellow-100";
    return "text-gray-600 bg-gray-100";
  }

  function getRecommendationLabel(rec: string | null): string {
    switch (rec) {
      case "strong_match":
        return "Strong Match";
      case "good_match":
        return "Good Match";
      case "consider":
        return "Consider";
      case "weak_match":
        return "Weak Match";
      default:
        return rec || "Unknown";
    }
  }

  function formatSalary(
    min: number | null,
    max: number | null,
    currency: string | null,
  ): string {
    if (!min && !max) return "";
    const curr = currency || "USD";
    const formatter = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: curr,
      maximumFractionDigits: 0,
    });
    if (min && max) {
      return `${formatter.format(min)} - ${formatter.format(max)}`;
    }
    if (min) return `From ${formatter.format(min)}`;
    if (max) return `Up to ${formatter.format(max)}`;
    return "";
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
    title="Job Matches"
    icon={faListCheck}
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
          : 'bg-[var(--dash-card)] border border-[var(--dash-border)] text-[var(--dash-text)] hover:bg-gray-100'}
        "
      >
        {filter.label}
      </button>
    {/each}
  </div>

  <!-- Job Matches List -->
  {#if jobMatches.length === 0}
    <EmptyState
      icon={faListCheck}
      title="No job matches yet"
      description={currentStatus === "all"
        ? "Job matches will appear here once you set up job searches and run the matching process."
        : `No jobs with status "${currentStatus}" found.`}
    />
  {:else}
    <div class="space-y-3">
      {#each jobMatches as match (match.id)}
        {@const job = match.jobs}
        <div
          class="bg-[var(--dash-card)] rounded-lg border border-[var(--dash-border)] overflow-hidden"
        >
          <!-- Header -->
          <button
            type="button"
            onclick={() => toggleExpand(match.id)}
            class="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors text-left"
          >
            <div class="flex items-center gap-4 flex-1 min-w-0">
              <!-- Score Badge -->
              <div
                class="
                  w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 {getScoreColor(
                  match.score,
                  )}
                "
              >
                <span class="font-bold text-lg">{match.score}</span>
              </div>

              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <h3 class="font-medium text-[var(--dash-text)] truncate">
                    {job.title || "Untitled Job"}
                  </h3>
                  <span
                    class="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600"
                  >
                    {match.status}
                  </span>
                </div>
                <p class="text-sm text-[var(--dash-text-secondary)] truncate">
                  {#if job.job_platforms}
                    {job.job_platforms.name}
                  {/if}
                  {#if job.office_location}
                    <span class="mx-1">•</span>
                    <FontAwesomeIcon icon={faMapMarkerAlt} class="w-3 h-3" />
                    {job.office_location}
                  {/if}
                </p>
              </div>
            </div>

            <div class="flex items-center gap-3 ml-4">
              {#if job.source_url}
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
                icon={expandedId === match.id ? faChevronUp : faChevronDown}
                class="w-4 h-4 text-[var(--dash-text-secondary)]"
              />
            </div>
          </button>

          <!-- Expanded Content -->
          {#if expandedId === match.id}
            <div class="border-t border-[var(--dash-border)] p-4 space-y-4">
              <!-- Match Info -->
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p
                    class="text-xs text-[var(--dash-text-secondary)] uppercase tracking-wide mb-1"
                  >
                    Recommendation
                  </p>
                  <p class="font-medium text-[var(--dash-text)]">
                    {getRecommendationLabel(match.recommendation)}
                  </p>
                </div>
                {#if match.skill_match_percentage}
                  <div>
                    <p
                      class="text-xs text-[var(--dash-text-secondary)] uppercase tracking-wide mb-1"
                    >
                      Skill Match
                    </p>
                    <p class="font-medium text-[var(--dash-text)]">
                      {match.skill_match_percentage}%
                    </p>
                  </div>
                {/if}
                {#if job.salary_min || job.salary_max}
                  <div>
                    <p
                      class="text-xs text-[var(--dash-text-secondary)] uppercase tracking-wide mb-1"
                    >
                      Salary Range
                    </p>
                    <p class="font-medium text-[var(--dash-text)]">
                      {
                        formatSalary(
                          job.salary_min,
                          job.salary_max,
                          job.salary_currency,
                        )
                      }
                    </p>
                  </div>
                {/if}
              </div>

              <!-- Reasoning -->
              {#if match.reasoning}
                <div>
                  <p
                    class="text-xs text-[var(--dash-text-secondary)] uppercase tracking-wide mb-1"
                  >
                    Analysis
                  </p>
                  <p class="text-sm text-[var(--dash-text)]">
                    {match.reasoning}
                  </p>
                </div>
              {/if}

              <!-- Strengths & Gaps -->
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                {#if             match.strengths && Array.isArray(match.strengths) &&
              match.strengths.length > 0}
                  <div>
                    <p
                      class="text-xs text-[var(--dash-text-secondary)] uppercase tracking-wide mb-2"
                    >
                      Strengths
                    </p>
                    <ul class="space-y-1">
                      {#each match.strengths as strength}
                        <li class="flex items-start gap-2 text-sm">
                          <FontAwesomeIcon
                            icon={faCheck}
                            class="w-3 h-3 text-green-600 mt-1 flex-shrink-0"
                          />
                          <span class="text-[var(--dash-text)]">{
                            strength
                          }</span>
                        </li>
                      {/each}
                    </ul>
                  </div>
                {/if}
                {#if             match.gaps && Array.isArray(match.gaps) &&
              match.gaps.length > 0}
                  <div>
                    <p
                      class="text-xs text-[var(--dash-text-secondary)] uppercase tracking-wide mb-2"
                    >
                      Gaps
                    </p>
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
              </div>

              <!-- Status Update -->
              <div
                class="flex items-center gap-2 pt-2 border-t border-[var(--dash-border)]"
              >
                <span class="text-sm text-[var(--dash-text-secondary)]"
                >Mark as:</span>
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
                    <input type="hidden" name="id" value={match.id} />
                    <input type="hidden" name="status" value={option.value} />
                    <button
                      type="submit"
                      class="
                        px-2 py-1 text-xs rounded transition-colors {match.status ===
                        option.value
                        ? 'bg-[var(--dash-primary)] text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}
                      "
                    >
                      {option.label}
                    </button>
                  </form>
                {/each}
              </div>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>
