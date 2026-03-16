<script lang="ts">
  import type { PageData } from "./$types";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faArrowRight,
    faFileAlt,
    faSearch,
    faSliders,
  } from "@fortawesome/free-solid-svg-icons";
  import Card from "./components/Card.svelte";
  import MatchStatsGrid from "./components/MatchStatsGrid.svelte";
  import SearchTasksSummary from "./components/SearchTasksSummary.svelte";
  import GettingStartedFlow from "./components/GettingStartedFlow.svelte";
  import JobCardList from "./jobs/components/JobCardList.svelte";

  let { data }: { data: PageData } = $props();

  const completeness = $derived(data.profileCompleteness);
  const matchStats = $derived(data.matchStats);
  const searchTasks = $derived(data.searchTasks);
  const topMatches = $derived(data.topMatches);
  const profileSkillLevels = $derived(data.profileSkillLevels);

  const hasMatches = $derived((matchStats?.total ?? 0) > 0);
</script>

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

  <!-- Search Tasks Summary -->
  {#if searchTasks}
    <SearchTasksSummary {searchTasks} />
  {/if}

  <!-- Top Matches -->
  {#if hasMatches && topMatches && topMatches.length > 0}
    <div>
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-base font-semibold text-[var(--dash-text)]">
          Top Matches
        </h3>
        <a
          href="/dashboard/jobs?filter=matches"
          class="text-sm text-[var(--dash-primary)] hover:underline flex items-center gap-1"
        >
          View all
          <FontAwesomeIcon icon={faArrowRight} class="w-3 h-3" />
        </a>
      </div>
      <JobCardList items={topMatches} {profileSkillLevels} />
    </div>
  {/if}

  <!-- Quick Actions -->
  {#if hasMatches}
    <Card padding="md">
      <h3 class="text-base font-semibold text-[var(--dash-text)] mb-3">
        Quick Actions
      </h3>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <a
          href="/dashboard/jobs"
          class="p-3 rounded-lg border border-[var(--dash-border)] hover:border-[var(--dash-primary)] hover:bg-[var(--dash-bg)] transition-colors text-center"
        >
          <FontAwesomeIcon
            icon={faSearch}
            class="w-5 h-5 text-[var(--dash-primary)] mx-auto mb-1.5"
          />
          <p class="font-medium text-[var(--dash-text)]">Browse Jobs</p>
          <p class="text-sm text-[var(--dash-text-secondary)]">
            View all matched jobs
          </p>
        </a>
        <a
          href="/dashboard/jobs/match-config"
          class="p-3 rounded-lg border border-[var(--dash-border)] hover:border-[var(--dash-primary)] hover:bg-[var(--dash-bg)] transition-colors text-center"
        >
          <FontAwesomeIcon
            icon={faSliders}
            class="w-5 h-5 text-[var(--dash-primary)] mx-auto mb-1.5"
          />
          <p class="font-medium text-[var(--dash-text)]">Match Config</p>
          <p class="text-sm text-[var(--dash-text-secondary)]">
            Tune match preferences
          </p>
        </a>
        <a
          href="/dashboard/profile/edit"
          class="p-3 rounded-lg border border-[var(--dash-border)] hover:border-[var(--dash-primary)] hover:bg-[var(--dash-bg)] transition-colors text-center"
        >
          <FontAwesomeIcon
            icon={faFileAlt}
            class="w-5 h-5 text-[var(--dash-primary)] mx-auto mb-1.5"
          />
          <p class="font-medium text-[var(--dash-text)]">Edit Profile</p>
          <p class="text-sm text-[var(--dash-text-secondary)]">
            Update your information
          </p>
        </a>
      </div>
    </Card>
  {/if}
</div>
