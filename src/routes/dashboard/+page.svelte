<script lang="ts">
  import type { PageData } from "./$types";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faArrowRight,
    faPaperPlane,
  } from "@fortawesome/free-solid-svg-icons";
  import MatchStatsGrid from "./components/MatchStatsGrid.svelte";
  import SearchTasksSummary from "./components/SearchTasksSummary.svelte";
  import MatchConfigSummary from "./components/MatchConfigSummary.svelte";
  import GettingStartedFlow from "./components/GettingStartedFlow.svelte";
  import JobCardList from "./jobs/components/JobCardList.svelte";
  import Card from "./components/Card.svelte";
  import {
    getStatusLabel,
    getStatusColor,
  } from "$lib/application-status";

  let { data }: { data: PageData } = $props();

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
          href="/dashboard/applications/active?group=active"
          class="text-sm text-[var(--dash-primary)] hover:underline flex items-center gap-1"
        >
          View all
          <FontAwesomeIcon icon={faArrowRight} class="w-3 h-3" />
        </a>
      </div>
      <div class="space-y-2">
        {#each activeApplications as app (app.id)}
          {@const job = app.jobs}
          <a
            href="/dashboard/applications/{app.id}"
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
                <div class="flex-shrink-0 text-right space-y-0.5">
                  <span class="text-xs px-2 py-0.5 rounded-full font-medium {getStatusColor(app.status)}">
                    {getStatusLabel(app.status)}
                  </span>
                  {#if app.status_step}
                    <p class="text-xs text-[var(--dash-text-secondary)] italic">{app.status_step}</p>
                  {/if}
                  {#if app.status_action}
                    <p class="text-xs text-[var(--dash-primary)] font-medium">
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

  <!-- Job Import & Match Config -->
  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
    {#if searchTasks}
      <SearchTasksSummary {searchTasks} />
    {/if}
    <MatchConfigSummary {matchConfig} />
  </div>

  <!-- Top Matches -->
  {#if hasMatches && topMatches && topMatches.length > 0}
    <div>
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-base font-semibold text-[var(--dash-text)]">
          Top Matches
        </h3>
        <a
          href="/dashboard/jobs?minScore=1"
          class="text-sm text-[var(--dash-primary)] hover:underline flex items-center gap-1"
        >
          View all
          <FontAwesomeIcon icon={faArrowRight} class="w-3 h-3" />
        </a>
      </div>
      <JobCardList items={topMatches} {profileSkillLevels} />
    </div>
  {/if}

</div>
