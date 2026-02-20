<script lang="ts">
  import type { ActionData, PageData } from "./$types";
  import { enhance } from "$app/forms";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faBookmark,
    faExternalLinkAlt,
    faMapMarkerAlt,
    faMoneyBillWave,
    faTrash,
  } from "@fortawesome/free-solid-svg-icons";
  import SectionHeader from "../../profile/components/SectionHeader.svelte";
  import EmptyState from "../../profile/components/EmptyState.svelte";

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let savedJobs = $derived(data.savedJobs);

  function getScoreColor(score: number): string {
    if (score >= 80) return "text-green-600 bg-green-100";
    if (score >= 60) return "text-yellow-600 bg-yellow-100";
    return "text-gray-600 bg-[var(--dash-bg)]";
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

  function formatDate(date: Date | string | null): string {
    if (!date) return "";
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }
</script>

<div class="space-y-6">
  <SectionHeader
    title="Saved Jobs"
    icon={faBookmark}
  />

  {#if form?.error}
    <div
      class="bg-[var(--dash-error-light)] border border-[var(--dash-error)] rounded-lg p-4"
    >
      <p class="text-[var(--dash-error)] text-sm">{form.error}</p>
    </div>
  {/if}

  <!-- Saved Jobs List -->
  {#if savedJobs.length === 0}
    <EmptyState
      icon={faBookmark}
      title="No saved jobs yet"
      description="Jobs you save from the matches page will appear here for easy access."
    />
  {:else}
    <div class="space-y-3">
      {#each savedJobs as match (match.id)}
        {@const job = match.jobs}
        <div
          class="bg-[var(--dash-card)] rounded-lg border border-[var(--dash-border)] p-4"
        >
          <div class="flex items-start justify-between gap-4">
            <div class="flex items-start gap-4 flex-1 min-w-0">
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
                <h3 class="font-medium text-[var(--dash-text)]">
                  {job.title || "Untitled Job"}
                </h3>
                <p class="text-sm text-[var(--dash-text-secondary)]">
                  {#if job.job_platforms}
                    {job.job_platforms.name}
                  {/if}
                  {#if job.office_location}
                    <span class="mx-1">•</span>
                    <FontAwesomeIcon icon={faMapMarkerAlt} class="w-3 h-3" />
                    {job.office_location}
                  {/if}
                </p>

                <!-- Additional info -->
                <div
                  class="flex flex-wrap gap-3 mt-2 text-sm text-[var(--dash-text-secondary)]"
                >
                  {#if job.salary_min || job.salary_max}
                    <span class="flex items-center gap-1">
                      <FontAwesomeIcon icon={faMoneyBillWave} class="w-3 h-3" />
                      {
                        formatSalary(
                          job.salary_min,
                          job.salary_max,
                          job.salary_currency,
                        )
                      }
                    </span>
                  {/if}
                  {#if match.date_updated}
                    <span>Saved {formatDate(match.date_updated)}</span>
                  {/if}
                </div>

                {#if match.reasoning}
                  <p class="text-sm text-[var(--dash-text)] mt-2 line-clamp-2">
                    {match.reasoning}
                  </p>
                {/if}
              </div>
            </div>

            <div class="flex items-center gap-2">
              {#if job.source_url}
                <a
                  href={job.source_url}
                  target="_blank"
                  rel="noopener"
                  class="p-2 text-[var(--dash-text-secondary)] hover:text-[var(--dash-primary)] transition-colors"
                  aria-label="View job posting"
                >
                  <FontAwesomeIcon icon={faExternalLinkAlt} class="w-4 h-4" />
                </a>
              {/if}
              <form
                method="POST"
                action="?/unsave"
                use:enhance={() => {
                  return async ({ update }) => {
                    await update();
                  };
                }}
              >
                <input type="hidden" name="id" value={match.id} />
                <button
                  type="submit"
                  class="p-2 text-[var(--dash-text-secondary)] hover:text-[var(--dash-error)] transition-colors"
                  aria-label="Remove from saved"
                  title="Remove from saved"
                >
                  <FontAwesomeIcon icon={faTrash} class="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
