<script lang="ts">
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
  const isConfigured = $derived(jobTypes.length > 0 && workLocations.length > 0);
</script>

<div>
  <div class="flex items-center justify-between mb-3">
    <h3 class="text-base font-semibold text-[var(--dash-text)]">
      Match Config
    </h3>
    <a
      href="/jobs/import/config"
      class="text-sm text-[var(--dash-primary)] hover:underline"
    >
      {isConfigured ? "Edit" : "Configure"}
    </a>
  </div>
  <Card padding="md">
  {#if !isConfigured}
    <p class="text-xs text-[var(--dash-text-secondary)]">
      No match config set yet. Configure what types of jobs you're looking for.
    </p>
  {:else}
    <div class="space-y-3 text-xs">
      <div>
        <span class="font-semibold text-[var(--dash-text)] block mb-1">Work location</span>
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
      <div>
        <span class="font-semibold text-[var(--dash-text)] block mb-1">Job type</span>
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
      <div>
        <span class="font-semibold text-[var(--dash-text)] block mb-1">Experience</span>
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
        <div>
          <span class="font-semibold text-[var(--dash-text)] block mb-1">Locations</span>
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
</div>
