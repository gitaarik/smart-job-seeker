<script lang="ts">
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import { faSliders } from "@fortawesome/free-solid-svg-icons";
  import CategoryPill from "$lib/components/CategoryPill.svelte";
  import Card from "./Card.svelte";

  interface MatchConfig {
    id: number;
    job_types: unknown;
    experience_levels: unknown;
    work_location: unknown;
    locations: unknown;
  }

  interface Props {
    matchConfig: MatchConfig | null;
  }

  let { matchConfig }: Props = $props();

  function asStringArray(value: unknown): string[] {
    return Array.isArray(value) ? value : [];
  }

  const jobTypes = $derived(asStringArray(matchConfig?.job_types));
  const experienceLevels = $derived(asStringArray(matchConfig?.experience_levels));
  const workLocations = $derived(asStringArray(matchConfig?.work_location));
  const locations = $derived(asStringArray(matchConfig?.locations));
</script>

<Card padding="md">
  <div class="flex items-start justify-between gap-3 mb-3">
    <div class="flex items-center gap-2.5">
      <div
        class="w-8 h-8 rounded-lg bg-[var(--dash-bg)] flex items-center justify-center shrink-0"
      >
        <FontAwesomeIcon
          icon={faSliders}
          class="w-4 h-4 text-[var(--dash-text-muted)]"
        />
      </div>
      <p class="text-sm font-medium text-[var(--dash-text)]">Match Config</p>
    </div>
    <a
      href="/dashboard/jobs/matching/config"
      class="px-2.5 py-1 text-xs bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-lg text-[var(--dash-text)] hover:border-[var(--dash-primary)] hover:text-[var(--dash-primary)] transition-colors whitespace-nowrap shrink-0"
    >
      {matchConfig ? "Edit" : "Configure"}
    </a>
  </div>

  {#if !matchConfig}
    <p class="text-xs text-[var(--dash-text-secondary)]">
      No match config set yet. Configure what types of jobs you're looking for.
    </p>
  {:else}
    <div class="space-y-2 text-xs">
      <div class="flex items-baseline gap-2">
        <span class="text-[var(--dash-text-secondary)] shrink-0">Work location</span>
        {#if workLocations.length > 0}
          <div class="flex flex-wrap gap-1.5">
            {#each workLocations as loc}
              <CategoryPill category="work_location" value={loc} />
            {/each}
          </div>
        {:else}
          <span class="text-[var(--dash-text-muted)]">Any</span>
        {/if}
      </div>
      <div class="flex items-baseline gap-2">
        <span class="text-[var(--dash-text-secondary)] shrink-0">Job type</span>
        {#if jobTypes.length > 0}
          <div class="flex flex-wrap gap-1.5">
            {#each jobTypes as type}
              <CategoryPill category="job_type" value={type} />
            {/each}
          </div>
        {:else}
          <span class="text-[var(--dash-text-muted)]">Any</span>
        {/if}
      </div>
      <div class="flex items-baseline gap-2">
        <span class="text-[var(--dash-text-secondary)] shrink-0">Experience</span>
        {#if experienceLevels.length > 0}
          <div class="flex flex-wrap gap-1.5">
            {#each experienceLevels as level}
              <CategoryPill category="experience_level" value={level} />
            {/each}
          </div>
        {:else}
          <span class="text-[var(--dash-text-muted)]">Any</span>
        {/if}
      </div>
      {#if locations.length > 0}
        <div class="flex items-baseline gap-2">
          <span class="text-[var(--dash-text-secondary)] shrink-0">Locations</span>
          <div class="flex flex-wrap gap-1.5">
            {#each locations as loc}
              <span class="px-2 py-0.5 rounded border border-amber-500/20 bg-amber-500/10 text-amber-700">
                {loc}
              </span>
            {/each}
          </div>
        </div>
      {/if}
    </div>
  {/if}
</Card>
