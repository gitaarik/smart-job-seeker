<script lang="ts">
  import type { PageData } from "./$types";
  import { page } from "$app/stores";
  import { replaceState } from "$app/navigation";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faArrowRight,
    faCheckCircle,
    faPaperPlane,
    faTimes,
  } from "@fortawesome/free-solid-svg-icons";
  import MatchStatsGrid from "../components/MatchStatsGrid.svelte";
  import SearchTasksSummary from "../components/SearchTasksSummary.svelte";
  import MatchConfigSummary from "../components/MatchConfigSummary.svelte";
  import GettingStartedFlow from "../components/GettingStartedFlow.svelte";
  import JobCardList from "../jobs/components/JobCardList.svelte";
  import Card from "../components/Card.svelte";
  import {
    getStatusLabel,
    getStatusColor,
  } from "$lib/application-status";

  let { data }: { data: PageData } = $props();

  let showCreatedBanner = $state($page.url.searchParams.get("created") === "true");

  // Clear the created param from URL so it doesn't persist on refresh
  if (showCreatedBanner) {
    const url = new URL($page.url);
    url.searchParams.delete("created");
    replaceState(url, {});
  }

  const completeness = $derived(data.profileCompleteness);
  const matchConfig = $derived(data.matchConfig);
  const matchStats = $derived(data.matchStats);
  const searchTasks = $derived(data.searchTasks);
  const topMatches = $derived(data.topMatches);
  const profileSkillLevels = $derived(data.profileSkillLevels);
  const activeApplications = $derived(data.activeApplications);

  const hasMatches = $derived((matchStats?.total ?? 0) > 0);

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

<svelte:head>
  <title>Overview - Smart Job Seeker</title>
</svelte:head>

<div class="space-y-5">
  <!-- Header -->
  <div
    class="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
  >
    <div>
      <h1 class="text-lg font-semibold text-[var(--dash-text)]">Dashboard</h1>
      <p class="text-[var(--dash-text-secondary)] mt-1">
        {#if hasMatches}
          Your job search overview
        {:else}
          Get started with your job search
        {/if}
      </p>
    </div>
  </div>

  <!-- Profile Created Banner -->
  {#if showCreatedBanner}
    <div class="flex items-start gap-3 p-4 rounded-lg bg-green-50 border border-green-200 dark:bg-green-950/30 dark:border-green-800">
      <FontAwesomeIcon icon={faCheckCircle} class="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
      <div class="flex-1 min-w-0">
        <p class="text-sm font-medium text-green-800 dark:text-green-200">
          Profile created successfully!
        </p>
        <p class="text-sm text-green-700 dark:text-green-300 mt-1">
          You can review and add more details on the
          <a href="/profile/edit" class="underline font-medium hover:text-green-900 dark:hover:text-green-100">profile data page</a>.
        </p>
      </div>
      <button
        type="button"
        onclick={() => showCreatedBanner = false}
        class="flex-shrink-0 text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-200"
      >
        <FontAwesomeIcon icon={faTimes} class="w-4 h-4" />
      </button>
    </div>
  {/if}

  <!-- Getting Started (shown when not fully set up yet) -->
  {#if completeness && !hasMatches}
    <GettingStartedFlow
      {completeness}
      hasSearchTasks={(searchTasks?.totalCount ?? 0) > 0}
      {hasMatches}
    />
  {/if}

  <!-- Match Stats Grid -->
  {#if matchStats}
    <MatchStatsGrid stats={matchStats} />
  {/if}

  <!-- Active Applications -->
  {#if activeApplications && activeApplications.length > 0}
    <div>
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-base font-semibold text-[var(--dash-text)]">
          Active Applications
        </h3>
        <a
          href="/applications/active?group=active"
          class="text-sm text-[var(--dash-primary)] hover:underline flex items-center gap-1"
        >
          View all
          <FontAwesomeIcon icon={faArrowRight} class="w-3 h-3" />
        </a>
      </div>
      <div class="space-y-2">
        {#each activeApplications as app (app.id)}
          {@const job = app.job}
          <a
            href="/applications/{app.id}"
            class="block"
          >
            <Card class="hover:bg-[var(--dash-bg)] transition-colors">
              <div class="flex items-center gap-3 p-3">
                <div
                  class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 {getStatusColor(app.status)}"
                >
                  <FontAwesomeIcon icon={faPaperPlane} class="w-3.5 h-3.5" />
                </div>
                <div class="flex-1 min-w-0">
                  <h4 class="text-sm font-medium text-[var(--dash-text)] truncate">
                    {job?.title || "Unknown Position"}
                  </h4>
                  {#if job?.company}
                    <p class="text-xs text-[var(--dash-text-secondary)] truncate">{job.company}</p>
                  {/if}
                </div>
                <div class="flex-shrink-0 text-right">
                  <span class="text-xs px-2 py-0.5 rounded-full font-medium {getStatusColor(app.status)}">
                    {getStatusLabel(app.status)}
                  </span>
                  {#if app.status_step}
                    <p class="text-xs text-[var(--dash-text-secondary)] italic mt-2">{app.status_step}</p>
                  {/if}
                  {#if app.status_action}
                    <p class="text-xs text-[var(--dash-primary)] font-medium mt-2">
                      → {app.status_action}
                      {#if app.status_action === "Scheduled" && app.status_action_date}
                        — {formatDate(app.status_action_date)}
                      {/if}
                    </p>
                  {/if}
                </div>
              </div>
            </Card>
          </a>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Top Matches -->
  {#if hasMatches && topMatches && topMatches.length > 0}
    <div>
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-base font-semibold text-[var(--dash-text)]">
          Top Matches
        </h3>
        <a
          href="/jobs?minScore=1"
          class="text-sm text-[var(--dash-primary)] hover:underline flex items-center gap-1"
        >
          View all
          <FontAwesomeIcon icon={faArrowRight} class="w-3 h-3" />
        </a>
      </div>
      <JobCardList items={topMatches} {profileSkillLevels} />
    </div>
  {/if}

  <!-- Import Tasks & Match Config -->
  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
    {#if searchTasks}
      <SearchTasksSummary {searchTasks} />
    {/if}
    <MatchConfigSummary {matchConfig} />
  </div>

</div>
