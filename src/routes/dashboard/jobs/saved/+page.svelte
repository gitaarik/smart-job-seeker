<script lang="ts">
  import type { ActionData, PageData } from "./$types";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import { faBookmark } from "@fortawesome/free-solid-svg-icons";
  import SectionHeader from "../../profile/components/SectionHeader.svelte";
  import EmptyState from "../../profile/components/EmptyState.svelte";
  import JobCard from "../components/JobCard.svelte";

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let savedJobs = $state(data.savedJobs);
  let expandedId = $state<number | null>(null);

  // Track saved state - all jobs on this page are saved by default
  let savedJobIds = $state<Record<number, boolean>>(
    Object.fromEntries(data.savedJobs.map((m: { jobs: { id: number } }) => [m.jobs.id, true]))
  );

  function isSaved(jobId: number): boolean {
    return savedJobIds[jobId] === true;
  }

  function toggleSaved(jobId: number, saved: boolean) {
    if (saved) {
      savedJobIds[jobId] = true;
    } else {
      delete savedJobIds[jobId];
      // Remove from the displayed list when unsaved
      savedJobs = savedJobs.filter((m: { jobs: { id: number } }) => m.jobs.id !== jobId);
    }
  }

  function toggleExpand(id: number) {
    expandedId = expandedId === id ? null : id;
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
      description="Jobs you save from the matches or browse page will appear here for easy access."
    />
  {:else}
    <div class="space-y-3">
      {#each savedJobs as match (match.id)}
        <JobCard
          job={match.jobs}
          match={{
            id: match.id,
            score: match.score,
            skill_match_percentage: match.skill_match_percentage,
            status: match.status,
          }}
          isSaved={isSaved(match.jobs.id)}
          isExpanded={expandedId === match.id}
          onToggleExpand={() => toggleExpand(match.id)}
          onToggleSaved={(saved) => toggleSaved(match.jobs.id, saved)}
          unsaveAction="?/unsave"
        />
      {/each}
    </div>
  {/if}
</div>
