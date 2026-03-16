<script lang="ts">
  import JobCard from "./JobCard.svelte";

  interface Job {
    id: number;
    title: string | null;
    company: string | null;
    office_location: string | null;
    source_url: string | null;
    job_description: string | null;
    salary_min: number | null;
    salary_max: number | null;
    salary_currency: string | null;
    salary_period: string | null;
    skills_required: unknown;
    date_posted: Date | string | null;
    date_created: Date | string | null;
    job_platforms?: { name: string } | null;
  }

  interface Match {
    id: number;
    score: number;
    skill_match_percentage: number | null;
    matched_skills?: string[] | null;
    match_summary?: string | null;
    status: string;
  }

  interface MatchItem {
    id: number;
    score: number;
    status: string;
    match_summary: string | null;
    matched_skills: unknown;
    skill_match_percentage: number | null;
    job: Job;
  }

  interface Props {
    items: MatchItem[];
    profileSkillLevels?: Record<string, "strong" | "weak">;
    saveAction?: string;
    unsaveAction?: string;
    rejectAction?: string;
    unrejectAction?: string;
  }

  let {
    items,
    profileSkillLevels = {},
    saveAction = "?/saveJob",
    unsaveAction = "?/unsaveJob",
    rejectAction = "?/rejectJob",
    unrejectAction = "?/unrejectJob",
  }: Props = $props();

  let expandedId = $state<number | null>(null);

  // Track saved/rejected state locally for optimistic UI
  let savedJobIds = $state<Record<number, boolean>>(
    Object.fromEntries(
      items.filter((i) => i.status === "saved").map((i) => [i.job.id, true]),
    ),
  );

  let rejectedJobIds = $state<Record<number, boolean>>(
    Object.fromEntries(
      items
        .filter((i) => i.status === "rejected")
        .map((i) => [i.job.id, true]),
    ),
  );

  function toggleExpand(jobId: number) {
    expandedId = expandedId === jobId ? null : jobId;
  }

  function toggleSaved(jobId: number, saved: boolean) {
    if (saved) {
      savedJobIds[jobId] = true;
      delete rejectedJobIds[jobId];
    } else {
      delete savedJobIds[jobId];
    }
  }

  function toggleRejected(jobId: number, rejected: boolean) {
    if (rejected) {
      rejectedJobIds[jobId] = true;
      delete savedJobIds[jobId];
    } else {
      delete rejectedJobIds[jobId];
    }
  }

  function getMatch(item: MatchItem): Match {
    return {
      id: item.id,
      score: item.score,
      skill_match_percentage: item.skill_match_percentage,
      matched_skills: item.matched_skills as string[] | null,
      match_summary: item.match_summary,
      status: item.status,
    };
  }
</script>

<div class="space-y-3">
  {#each items as item (item.id)}
    <JobCard
      job={item.job}
      match={getMatch(item)}
      matched={true}
      {profileSkillLevels}
      isSaved={savedJobIds[item.job.id] === true}
      isRejected={rejectedJobIds[item.job.id] === true}
      isExpanded={expandedId === item.job.id}
      onToggleExpand={() => toggleExpand(item.job.id)}
      onToggleSaved={(saved) => toggleSaved(item.job.id, saved)}
      onToggleRejected={(rejected) => toggleRejected(item.job.id, rejected)}
      {saveAction}
      {unsaveAction}
      {rejectAction}
      {unrejectAction}
    />
  {/each}
</div>
