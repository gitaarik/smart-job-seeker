<script lang="ts">
  import type { ActionData, PageData } from "./$types";
  import { goto } from "$app/navigation";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import { faListCheck } from "@fortawesome/free-solid-svg-icons";
  import SectionHeader from "../../profile/components/SectionHeader.svelte";
  import EmptyState from "../../profile/components/EmptyState.svelte";
  import JobCard from "../components/JobCard.svelte";

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let jobMatches = $derived(data.jobMatches);
  let currentStatus = $derived(data.currentStatus);
  let expandedId = $state<number | null>(null);

  // Track saved state for each job (matches with status="saved" are saved)
  let savedJobIds = $state<Record<number, boolean>>(
    Object.fromEntries(
      data.jobMatches
        .filter((m: { status: string }) => m.status === "saved")
        .map((m: { jobs: { id: number } }) => [m.jobs.id, true])
    )
  );

  function isSaved(jobId: number): boolean {
    return savedJobIds[jobId] === true;
  }

  function toggleSaved(jobId: number, saved: boolean) {
    if (saved) {
      savedJobIds[jobId] = true;
    } else {
      delete savedJobIds[jobId];
    }
  }

  const statusFilters = [
    { value: "all", label: "All Matches" },
    { value: "new", label: "New" },
    { value: "viewed", label: "Viewed" },
    { value: "saved", label: "Saved" },
    { value: "applied", label: "Applied" },
    { value: "rejected", label: "Not Interested" },
  ];

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
          : 'bg-[var(--dash-card)] border border-[var(--dash-border)] text-[var(--dash-text)] hover:bg-[var(--dash-bg)]'}
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
        />
      {/each}
    </div>
  {/if}
</div>
