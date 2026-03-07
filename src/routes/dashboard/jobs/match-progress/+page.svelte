<script lang="ts">
  import type { PageData } from "./$types";
  import { onMount, onDestroy } from "svelte";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faChartBar,
    faCircle,
    faSpinner,
  } from "@fortawesome/free-solid-svg-icons";
  import SectionHeader from "../../profile/components/SectionHeader.svelte";
  import ScoreBadge from "../components/ScoreBadge.svelte";

  let { data }: { data: PageData } = $props();

  // Data state
  interface MatcherState {
    active: boolean;
    profileId: number | null;
    currentJobId: number | null;
    currentJobTitle: string | null;
    cycleProcessed: number;
    cycleBatchSize: number;
    totalCycles: number;
    totalMatched: number;
    totalFailed: number;
    lastUpdated: string;
  }

  interface RecentMatch {
    id: number;
    job: number;
    score: number;
    recommendation: string;
    status: string;
    date_created: string | null;
    skill_match_percentage: number | null;
    match_summary: string | null;
    jobs: {
      id: number;
      title: string | null;
      company: string | null;
      office_location: string | null;
      job_types: string[] | null;
      work_location: string[] | null;
    } | null;
  }

  let totalJobs = $state(0);
  let matchedCount = $state(0);
  let unmatchedCount = $state(0);
  let eligibleUnmatched = $state(0);
  let matcherState = $state<MatcherState | null>(null);
  let recentMatches = $state<RecentMatch[]>([]);
  let pollInterval: ReturnType<typeof setInterval> | null = null;
  let loading = $state(true);

  // Derived
  let relevantTotal = $derived(matchedCount + eligibleUnmatched);
  let matchProgress = $derived(relevantTotal > 0 ? (matchedCount / relevantTotal) * 100 : 0);
  let filteredOut = $derived(unmatchedCount - eligibleUnmatched);
  let isMatcherActive = $derived(matcherState?.active === true);
  let isProcessingJob = $derived(isMatcherActive && matcherState?.currentJobId != null);

  async function loadStatus() {
    try {
      const response = await fetch(`/api/matcher/status?profileId=${data.profileId}`);
      if (response.ok) {
        const result = await response.json();
        totalJobs = result.totalJobs;
        matchedCount = result.matchedCount;
        unmatchedCount = result.unmatchedCount;
        eligibleUnmatched = result.eligibleUnmatched;
        matcherState = result.matcherState;
        recentMatches = result.recentMatches;
      }
    } catch (err) {
      console.error("Failed to load matcher status:", err);
    } finally {
      loading = false;
    }
  }

  function startPolling() {
    if (pollInterval) return;
    pollInterval = setInterval(loadStatus, 3000);
  }

  function stopPolling() {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
  }

  onMount(() => {
    loadStatus();
    startPolling();
  });

  onDestroy(() => {
    stopPolling();
  });

  function formatDate(date: string | null): string {
    if (!date) return "Never";
    const d = new Date(date);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function formatRelativeTime(date: string | null): string {
    if (!date) return "";
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffSecs < 30) return "Just now";
    if (diffMins < 1) return `${diffSecs}s ago`;
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return formatDate(date);
  }

  function getRecommendationLabel(rec: string): { text: string; class: string } {
    switch (rec) {
      case "highly_recommend":
        return { text: "Highly recommended", class: "text-[var(--dash-success)]" };
      case "recommend":
        return { text: "Recommended", class: "text-emerald-500" };
      case "consider":
        return { text: "Consider", class: "text-[var(--dash-text-secondary)]" };
      case "not_recommended":
        return { text: "Not recommended", class: "text-[var(--dash-warning)]" };
      default:
        return { text: rec.replace(/_/g, " "), class: "text-[var(--dash-text-secondary)]" };
    }
  }
</script>

<div>
  <SectionHeader title="Match Progress" icon={faChartBar} />

  {#if loading}
    <div class="flex items-center justify-center py-12">
      <FontAwesomeIcon icon={faSpinner} class="w-6 h-6 text-[var(--dash-primary)] animate-spin" />
    </div>
  {:else}
    <!-- Stats Overview -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
      <!-- Matched -->
      <div class="bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-lg p-4">
        <div class="text-sm text-[var(--dash-text-secondary)] mb-1">Matched</div>
        <div class="text-2xl font-bold text-[var(--dash-success)]">{matchedCount}</div>
      </div>

      <!-- Pending (eligible but unmatched) -->
      <div class="bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-lg p-4">
        <div class="text-sm text-[var(--dash-text-secondary)] mb-1">Pending</div>
        <div class="text-2xl font-bold text-[var(--dash-warning)]">{eligibleUnmatched}</div>
      </div>

      <!-- Filtered Out -->
      <div class="bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-lg p-4">
        <div class="text-sm text-[var(--dash-text-secondary)] mb-1">Filtered Out</div>
        <div class="text-2xl font-bold text-[var(--dash-text-muted)]">{filteredOut}</div>
        <div class="text-xs text-[var(--dash-text-muted)]">by match config</div>
      </div>

      <!-- Total Jobs -->
      <div class="bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-lg p-4">
        <div class="text-sm text-[var(--dash-text-secondary)] mb-1">Total Jobs</div>
        <div class="text-2xl font-bold text-[var(--dash-text)]">{totalJobs}</div>
      </div>
    </div>

    <!-- Progress Bar -->
    <div class="bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-lg p-4 mb-6">
      <div class="flex items-center justify-between mb-2">
        <span class="text-sm font-medium text-[var(--dash-text)]">Matching Progress</span>
        <span class="text-sm text-[var(--dash-text-secondary)]">
          {matchProgress.toFixed(0)}%
          {#if eligibleUnmatched > 0}
            <span class="text-[var(--dash-text-muted)]">({eligibleUnmatched} pending)</span>
          {/if}
        </span>
      </div>
      <div class="w-full bg-[var(--dash-bg)] rounded-full h-3 overflow-hidden">
        <div
          class="h-full rounded-full transition-all duration-500 ease-out {matchProgress >= 100 ? 'bg-[var(--dash-success)]' : 'bg-[var(--dash-primary)]'}"
          style="width: {matchProgress}%"
        ></div>
      </div>
      <div class="text-xs text-[var(--dash-text-muted)] mt-1">
        {matchedCount} of {relevantTotal} eligible jobs matched
        {#if filteredOut > 0}
          &middot; {filteredOut} jobs don't match your <a href="/dashboard/jobs/match-config" class="text-[var(--dash-primary)] hover:underline">match config</a>
        {/if}
      </div>
    </div>

    <!-- Matcher Status -->
    <div class="bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-lg p-4 mb-6">
      <h3 class="text-sm font-medium text-[var(--dash-text)] mb-3">Matcher Status</h3>

      {#if isMatcherActive}
        <div class="flex items-center gap-2 mb-3">
          <span class="relative flex h-3 w-3">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span class="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
          </span>
          <span class="text-sm text-[var(--dash-success)]">Matcher is running</span>
          {#if matcherState?.lastUpdated}
            <span class="text-xs text-[var(--dash-text-muted)]">
              (updated {formatRelativeTime(matcherState.lastUpdated)})
            </span>
          {/if}
        </div>

        {#if isProcessingJob}
          <!-- Currently Processing -->
          <div class="bg-[var(--dash-bg)] rounded-lg p-3 border border-[var(--dash-primary)]/20">
            <div class="flex items-center gap-2 mb-1">
              <FontAwesomeIcon icon={faSpinner} class="w-4 h-4 text-[var(--dash-primary)] animate-spin" />
              <span class="text-sm font-medium text-[var(--dash-text)]">Currently matching:</span>
            </div>
            <div class="ml-6">
              <a
                href="/dashboard/jobs/{matcherState?.currentJobId}"
                class="text-sm text-[var(--dash-primary)] hover:underline"
              >
                {matcherState?.currentJobTitle || "Unknown job"}
              </a>
              {#if matcherState && matcherState.cycleBatchSize > 0}
                <div class="text-xs text-[var(--dash-text-muted)] mt-0.5">
                  Job {matcherState.cycleProcessed + 1} of {matcherState.cycleBatchSize} in this batch
                </div>
              {/if}
            </div>
          </div>
        {:else}
          <!-- Idle between cycles -->
          <div class="text-sm text-[var(--dash-text-secondary)]">
            Waiting for next cycle...
          </div>
        {/if}

        <!-- Cycle stats -->
        {#if matcherState}
          <div class="flex gap-4 mt-3 text-xs text-[var(--dash-text-muted)]">
            <span>Cycles: {matcherState.totalCycles}</span>
            <span>Matched this session: {matcherState.totalMatched}</span>
            {#if matcherState.totalFailed > 0}
              <span class="text-[var(--dash-error)]">Failed: {matcherState.totalFailed}</span>
            {/if}
          </div>
        {/if}
      {:else}
        <div class="flex items-center gap-2">
          <FontAwesomeIcon icon={faCircle} class="w-3 h-3 text-[var(--dash-text-muted)]" />
          <span class="text-sm text-[var(--dash-text-secondary)]">Matcher is not running</span>
        </div>
        <p class="text-xs text-[var(--dash-text-muted)] mt-2">
          The matcher runs automatically in the background when the worker is active.
          It picks up new unmatched jobs every 30 seconds.
        </p>
      {/if}
    </div>

    <!-- Recently Matched Jobs -->
    <div class="bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-lg p-4">
      <h3 class="text-sm font-medium text-[var(--dash-text)] mb-3">
        Recently Matched Jobs
      </h3>

      {#if recentMatches.length === 0}
        <p class="text-sm text-[var(--dash-text-muted)] py-4 text-center">
          No matches yet. Jobs will appear here as they're matched with your profile.
        </p>
      {:else}
        <div class="space-y-2 max-h-[600px] overflow-y-auto">
          {#each recentMatches as match (match.id)}
            {@const rec = getRecommendationLabel(match.recommendation)}
            <a
              href="/dashboard/jobs/{match.job}"
              class="flex items-center gap-3 p-3 rounded-lg bg-[var(--dash-bg)] hover:bg-[var(--dash-bg)]/80 transition-colors"
            >
              <!-- Score Badge -->
              <ScoreBadge
                score={match.score}
                matched={match.recommendation !== null}
                size="sm"
              />

              <!-- Job Info -->
              <div class="flex-1 min-w-0">
                <div class="text-sm font-medium text-[var(--dash-text)] truncate">
                  {match.jobs?.title || "Untitled Job"}
                </div>
                <div class="flex items-center gap-2 text-xs text-[var(--dash-text-secondary)]">
                  {#if match.jobs?.company}
                    <span>{match.jobs.company}</span>
                  {/if}
                  {#if match.jobs?.office_location}
                    <span class="text-[var(--dash-text-muted)]">
                      {match.jobs.office_location}
                    </span>
                  {/if}
                </div>
                {#if match.match_summary}
                  <div class="text-xs text-[var(--dash-text-muted)] mt-0.5 truncate">
                    {match.match_summary}
                  </div>
                {/if}
              </div>

              <!-- Recommendation + Time -->
              <div class="text-right shrink-0">
                <div class="text-xs font-medium {rec.class}">{rec.text}</div>
                <div class="text-xs text-[var(--dash-text-muted)]">
                  {formatRelativeTime(match.date_created)}
                </div>
              </div>
            </a>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</div>
