<script lang="ts">
  import type { PageData } from "./$types";
  import { onMount, onDestroy } from "svelte";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faArrowLeft,
    faChartBar,
    faExclamationTriangle,
  } from "@fortawesome/free-solid-svg-icons";
  import SectionHeader from "../../../profile/components/SectionHeader.svelte";
  import Card from "../../../components/Card.svelte";
  import Spinner from "$lib/components/Spinner.svelte";

  let { data }: { data: PageData } = $props();

  interface MatcherError {
    jobId: number;
    jobTitle: string;
    message: string;
    timestamp: string;
  }

  interface MatcherState {
    active: boolean;
    profileId: number | null;
    totalCycles: number;
    totalMatched: number;
    totalFailed: number;
    recentErrors: MatcherError[];
    lastUpdated: string;
  }

  interface ProfileInfo {
    id: number;
    name: string;
    totalJobs: number;
    matchedCount: number;
    noMatchCount: number;
    unmatchedCount: number;
  }

  let state = $state<MatcherState | null>(null);
  let profile = $state<ProfileInfo | null>(null);
  let loading = $state(true);
  let error = $state("");
  let pollInterval: ReturnType<typeof setInterval> | null = null;

  async function loadStatus() {
    try {
      const response = await fetch("/api/admin/matcher/status");
      if (response.ok) {
        const result = await response.json();
        state = result.matcherStates.find(
          (s: MatcherState) => s.profileId === data.profileId
        ) ?? null;
        profile = result.profiles.find(
          (p: ProfileInfo) => p.id === data.profileId
        ) ?? null;
        error = "";
      } else {
        error = "Failed to load matcher status";
      }
    } catch (err) {
      console.error("Failed to load matcher status:", err);
      error = "Failed to load matcher status";
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    loadStatus();
    pollInterval = setInterval(loadStatus, 5000);
  });

  onDestroy(() => {
    if (pollInterval) clearInterval(pollInterval);
  });

  function formatDateTime(date: string): string {
    const d = new Date(date);
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
    });
  }
</script>

<div class="space-y-6">
  <div class="flex items-center gap-3">
    <a
      href="/dashboard/admin/matcher"
      class="p-2 rounded-lg hover:bg-[var(--dash-bg)] text-[var(--dash-text-secondary)] transition-colors"
    >
      <FontAwesomeIcon icon={faArrowLeft} class="w-4 h-4" />
    </a>
    <SectionHeader
      title="Matcher Detail — {profile?.name ?? `Profile ${data.profileId}`}"
      icon={faChartBar}
    />
  </div>

  {#if loading}
    <div class="flex items-center justify-center py-12">
      <Spinner size="w-6 h-6" color="var(--dash-primary)" />
    </div>
  {:else if error}
    <Card padding="responsive">
      <p class="text-[var(--dash-error)] text-sm">{error}</p>
    </Card>
  {:else}
    <!-- Session Stats -->
    {#if state}
      <Card padding="responsive">
        <h3 class="text-sm font-medium text-[var(--dash-text)] mb-3">Session Stats</h3>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <div class="text-[var(--dash-text-muted)] text-xs">Cycles</div>
            <div class="font-medium text-[var(--dash-text)]">{state.totalCycles}</div>
          </div>
          <div>
            <div class="text-[var(--dash-text-muted)] text-xs">Matched</div>
            <div class="font-medium text-[var(--dash-success)]">{state.totalMatched}</div>
          </div>
          <div>
            <div class="text-[var(--dash-text-muted)] text-xs">Failed</div>
            <div class="font-medium text-[var(--dash-error)]">{state.totalFailed}</div>
          </div>
          <div>
            <div class="text-[var(--dash-text-muted)] text-xs">DB Unevaluated</div>
            <div class="font-medium text-[var(--dash-warning)]">{profile?.unmatchedCount ?? 0}</div>
          </div>
        </div>
      </Card>
    {:else}
      <Card padding="responsive">
        <p class="text-sm text-[var(--dash-text-muted)]">No matcher session data available for this profile.</p>
      </Card>
    {/if}

    <!-- Recent Errors -->
    <Card padding="responsive">
      <h3 class="text-sm font-medium text-[var(--dash-text)] mb-3">
        Recent Errors
        {#if state && state.recentErrors?.length > 0}
          <span class="text-[var(--dash-text-muted)] font-normal">({state.recentErrors.length})</span>
        {/if}
      </h3>

      {#if !state?.recentErrors?.length}
        <p class="text-sm text-[var(--dash-text-muted)] py-4 text-center">
          No errors in current session.
        </p>
      {:else}
        <div class="space-y-2">
          {#each [...state.recentErrors].reverse() as err}
            <div class="bg-[var(--dash-bg)] rounded-lg p-3 border border-[var(--dash-error)]/20">
              <div class="flex items-start justify-between gap-2">
                <div class="flex items-start gap-2 min-w-0">
                  <FontAwesomeIcon
                    icon={faExclamationTriangle}
                    class="w-3.5 h-3.5 text-[var(--dash-error)] mt-0.5 shrink-0"
                  />
                  <div class="min-w-0">
                    <a
                      href="/dashboard/jobs/{err.jobId}"
                      class="text-sm font-medium text-[var(--dash-primary)] hover:underline"
                    >
                      {err.jobTitle}
                    </a>
                    <span class="text-xs text-[var(--dash-text-muted)]">#{err.jobId}</span>
                    <p class="text-xs text-[var(--dash-error)] mt-0.5 break-words">{err.message}</p>
                  </div>
                </div>
                <span class="text-xs text-[var(--dash-text-muted)] whitespace-nowrap shrink-0">
                  {formatDateTime(err.timestamp)}
                </span>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </Card>
  {/if}
</div>
