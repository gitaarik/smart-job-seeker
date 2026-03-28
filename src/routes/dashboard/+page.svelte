<script lang="ts">
  import type { PageData } from "./$types";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import { faArrowRight } from "@fortawesome/free-solid-svg-icons";
  import MatchStatsGrid from "./components/MatchStatsGrid.svelte";
  import SearchTasksSummary from "./components/SearchTasksSummary.svelte";
  import MatchConfigSummary from "./components/MatchConfigSummary.svelte";
  import GettingStartedFlow from "./components/GettingStartedFlow.svelte";
  import JobCardList from "./jobs/components/JobCardList.svelte";

  let { data }: { data: PageData } = $props();

  const completeness = $derived(data.profileCompleteness);
  const matchConfig = $derived(data.matchConfig);
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

  <!-- Search Tasks & Match Config -->
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
