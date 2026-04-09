<script lang="ts">
  import type { PageData } from "./$types";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faCheck,
  } from "@fortawesome/free-solid-svg-icons";
  import Card from "../../../components/Card.svelte";
  import ToggleSwitch from "../../../components/ToggleSwitch.svelte";
  import Spinner from "$lib/components/Spinner.svelte";
  import SectionSaveButton from "$lib/components/SectionSaveButton.svelte";

  let { data }: { data: PageData } = $props();

  // Helper to normalize saved values to match our option labels (case-insensitive)
  function normalizeToOptions(saved: string[], options: string[]): string[] {
    const lowerToOption = new Map(options.map((o) => [o.toLowerCase(), o]));
    return saved
      .map((s) => lowerToOption.get(s.toLowerCase()))
      .filter((s): s is string => s !== undefined);
  }

  function arraysEqual(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false;
    const sortedA = [...a].sort();
    const sortedB = [...b].sort();
    return sortedA.every((v, i) => v === sortedB[i]);
  }

  // Whether config exists (first-time setup uses PUT, updates use PATCH)
  let configExists = $state(data.config !== null);

  // === Saved state (what's on the server) ===
  let savedJobTypes = $state<string[]>(
    normalizeToOptions(data.config?.job_types || [], data.options.jobTypes),
  );
  let savedWorkLocation = $state<string[]>(
    normalizeToOptions(data.config?.work_location || [], data.options.workLocationOptions),
  );
  let savedExperienceLevels = $state<string[]>(
    normalizeToOptions(data.config?.experience_levels || [], data.options.experienceLevels),
  );
  let savedLocations = $state<string[]>(data.config?.locations || []);
  let savedMatchCommunityJobs = $state<boolean>(data.config?.match_community_jobs ?? false);
  let savedCommunityMaxAgeDays = $state<number | null>(data.config?.community_max_age_days ?? 30);

  // === Current (editable) state ===
  let jobTypes = $state<string[]>([...savedJobTypes]);
  let workLocation = $state<string[]>([...savedWorkLocation]);
  let experienceLevels = $state<string[]>([...savedExperienceLevels]);
  let locations = $state<string[]>([...savedLocations]);
  let matchCommunityJobs = $state<boolean>(savedMatchCommunityJobs);
  let communityMaxAgeDays = $state<number | null>(savedCommunityMaxAgeDays);

  // String proxy for RadioGroup binding
  let communityMaxAgeDaysStr = $derived(communityMaxAgeDays === null ? "all" : String(communityMaxAgeDays));

  // Community job counts per time window
  let communityCounts = $state<Record<string, number> | null>(null);
  let communityCountsLoading = $state(false);

  // Community time window options
  let communityTimeOptions = $derived([
    { value: "7", label: communityCounts ? `7 days (${communityCounts["7"] ?? 0})` : "7 days" },
    { value: "30", label: communityCounts ? `30 days (${communityCounts["30"] ?? 0})` : "30 days" },
    { value: "90", label: communityCounts ? `90 days (${communityCounts["90"] ?? 0})` : "90 days" },
    { value: "all", label: communityCounts ? `All time (${communityCounts["all"] ?? 0})` : "All time" },
  ]);

  async function fetchCommunityCounts() {
    communityCountsLoading = true;
    try {
      const res = await fetch(`/api/matcher/community-counts?profileId=${data.profileId}`);
      if (res.ok) {
        communityCounts = await res.json();
      }
    } finally {
      communityCountsLoading = false;
    }
  }

  // Fetch counts when community toggle is turned on
  $effect(() => {
    if (matchCommunityJobs && !communityCounts && !communityCountsLoading) {
      fetchCommunityCounts();
    }
  });

  // Location input
  let locationInput = $state("");

  // === Per-field saving state ===
  let isSavingJobTypes = $state(false);
  let isSavingWorkLocation = $state(false);
  let isSavingExperienceLevels = $state(false);
  let isSavingLocations = $state(false);
  let isSavingCommunityJobs = $state(false);

  // === Dirty detection ===
  let jobTypesDirty = $derived(!arraysEqual(jobTypes, savedJobTypes));
  let workLocationDirty = $derived(!arraysEqual(workLocation, savedWorkLocation));
  let experienceLevelsDirty = $derived(!arraysEqual(experienceLevels, savedExperienceLevels));
  let locationsDirty = $derived(!arraysEqual(locations, savedLocations));
  let communityJobsDirty = $derived(
    matchCommunityJobs !== savedMatchCommunityJobs ||
    communityMaxAgeDays !== savedCommunityMaxAgeDays
  );

  // === First-time setup state ===
  type SetupState = "idle" | "saving" | "saved" | "error";
  let setupState = $state<SetupState>("idle");
  let setupError = $state("");

  function toggleArrayValue(arr: string[], value: string): string[] {
    return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
  }

  function addLocation() {
    const trimmed = locationInput.trim();
    if (trimmed && !locations.includes(trimmed)) {
      locations = [...locations, trimmed];
      locationInput = "";
    }
  }

  function removeLocation(loc: string) {
    locations = locations.filter((l) => l !== loc);
  }

  function handleLocationKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      addLocation();
    }
  }

  // === Per-field save/cancel (PATCH) ===
  async function patchField(field: string, value: unknown, setSaving: (v: boolean) => void) {
    setSaving(true);
    try {
      const res = await fetch("/api/job-preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile_id: data.profileId, [field]: value }),
      });
      if (!res.ok) {
        const err = await res.json();
        console.error(`Failed to save ${field}:`, err.error || err.message);
        return false;
      }
      return true;
    } catch (err) {
      console.error(`Failed to save ${field}:`, err);
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function saveJobTypes() {
    if (jobTypes.length === 0) return;
    if (await patchField("job_types", jobTypes, (v) => (isSavingJobTypes = v))) {
      savedJobTypes = [...jobTypes];
    }
  }

  async function saveWorkLocation() {
    if (workLocation.length === 0) return;
    if (await patchField("work_location", workLocation, (v) => (isSavingWorkLocation = v))) {
      savedWorkLocation = [...workLocation];
    }
  }

  async function saveExperienceLevels() {
    if (await patchField("experience_levels", experienceLevels, (v) => (isSavingExperienceLevels = v))) {
      savedExperienceLevels = [...experienceLevels];
    }
  }

  async function saveLocations() {
    if (await patchField("locations", locations, (v) => (isSavingLocations = v))) {
      savedLocations = [...locations];
    }
  }

  async function saveCommunityJobs() {
    isSavingCommunityJobs = true;
    try {
      const res = await fetch("/api/job-preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile_id: data.profileId,
          match_community_jobs: matchCommunityJobs,
          community_max_age_days: matchCommunityJobs ? communityMaxAgeDays : null,
        }),
      });
      if (res.ok) {
        savedMatchCommunityJobs = matchCommunityJobs;
        savedCommunityMaxAgeDays = communityMaxAgeDays;
      }
    } finally {
      isSavingCommunityJobs = false;
    }
  }

  // === First-time create (PUT) ===
  async function createConfig() {
    if (jobTypes.length === 0 || workLocation.length === 0) {
      setupError = "Please select at least one job type and one work location option";
      setupState = "error";
      setTimeout(() => (setupState = "idle"), 2000);
      return;
    }

    setupState = "saving";
    setupError = "";

    try {
      const response = await fetch("/api/job-preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile_id: data.profileId,
          job_types: jobTypes,
          experience_levels: experienceLevels,
          work_location: workLocation,
          locations,
          match_community_jobs: matchCommunityJobs,
          community_max_age_days: matchCommunityJobs ? communityMaxAgeDays : null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        setupError = error.message || error.error || "Failed to save config";
        setupState = "error";
        setTimeout(() => (setupState = "idle"), 2000);
        return;
      }

      // Switch to inline-save mode
      configExists = true;
      savedJobTypes = [...jobTypes];
      savedWorkLocation = [...workLocation];
      savedExperienceLevels = [...experienceLevels];
      savedLocations = [...locations];
      savedMatchCommunityJobs = matchCommunityJobs;
      savedCommunityMaxAgeDays = communityMaxAgeDays;
      setupState = "saved";
      setTimeout(() => (setupState = "idle"), 2000);
    } catch (error) {
      console.error("Save failed:", error);
      setupError = "Failed to save config";
      setupState = "error";
      setTimeout(() => (setupState = "idle"), 2000);
    }
  }
</script>

<svelte:head>
  <title>Match Config - Import Jobs - Smart Job Seeker</title>
</svelte:head>

<div class="space-y-4">
  <p class="text-sm text-[var(--dash-text-secondary)]">
    Configure your job matching preferences. Jobs are filtered based on these settings before being scored by the
    AI. Jobs must have at least one matching skill and meet your job type
    and work location criteria to be considered.
  </p>

  {#if !configExists && setupError && setupState === "error"}
    <div class="bg-[var(--dash-error-light)] border border-[var(--dash-error)] rounded-lg p-4">
      <p class="text-[var(--dash-error)] text-sm">{setupError}</p>
    </div>
  {/if}

  <!-- Job Types -->
  <Card padding="responsive">
    <div class="flex items-start gap-2 mb-4">
      <div>
        <h3 class="font-medium text-[var(--dash-text)]">
          Job Types <span class="text-[var(--dash-error)]">*</span>
        </h3>
        <p class="text-xs text-[var(--dash-text-muted)] mt-0.5">
          Select the types of employment you're interested in
        </p>
      </div>
    </div>
    <div class="flex flex-wrap gap-2">
      {#each data.options.jobTypes as jobType}
        <button
          type="button"
          onclick={() => (jobTypes = toggleArrayValue(jobTypes, jobType))}
          class="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-full border transition-colors {jobTypes.includes(jobType)
            ? 'border-[var(--dash-primary)] bg-[var(--dash-primary)]/10 text-[var(--dash-primary)]'
            : 'border-[var(--dash-border)] text-[var(--dash-text-secondary)] hover:border-[var(--dash-text-muted)]'}"
        >
          <span class="w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 {jobTypes.includes(jobType)
            ? 'border-[var(--dash-primary)] bg-[var(--dash-primary)]'
            : 'border-[var(--dash-border)]'}">
            {#if jobTypes.includes(jobType)}
              <FontAwesomeIcon icon={faCheck} class="w-2.5 h-2.5 text-white" />
            {/if}
          </span>
          {jobType}
        </button>
      {/each}
    </div>
    {#if configExists && jobTypesDirty}
      <div class="flex items-center gap-2 mt-3 pt-3 border-t border-[var(--dash-border)]">
        <button
          type="button"
          onclick={saveJobTypes}
          disabled={isSavingJobTypes || jobTypes.length === 0}
          class="px-3 py-1 text-xs bg-[var(--dash-primary)] text-white rounded-md hover:bg-[var(--dash-primary-hover)] transition-colors disabled:opacity-50 flex items-center gap-1"
        >
          {#if isSavingJobTypes}
            <Spinner size="w-3 h-3" />
          {:else}
            <FontAwesomeIcon icon={faCheck} class="w-3 h-3" />
          {/if}
          Save
        </button>
        <button
          type="button"
          onclick={() => (jobTypes = [...savedJobTypes])}
          class="px-3 py-1 text-xs border border-[var(--dash-border)] rounded-md text-[var(--dash-text)] hover:bg-[var(--dash-bg)] transition-colors"
        >
          Cancel
        </button>
      </div>
    {/if}
  </Card>

  <!-- Work Location -->
  <Card padding="responsive">
    <div class="flex items-start gap-2 mb-4">
      <div>
        <h3 class="font-medium text-[var(--dash-text)]">
          Work Location <span class="text-[var(--dash-error)]">*</span>
        </h3>
        <p class="text-xs text-[var(--dash-text-muted)] mt-0.5">
          Select your preferred work arrangements
        </p>
      </div>
    </div>
    <div class="flex flex-wrap gap-2">
      {#each data.options.workLocationOptions as option}
        <button
          type="button"
          onclick={() => (workLocation = toggleArrayValue(workLocation, option))}
          class="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-full border transition-colors {workLocation.includes(option)
            ? 'border-[var(--dash-primary)] bg-[var(--dash-primary)]/10 text-[var(--dash-primary)]'
            : 'border-[var(--dash-border)] text-[var(--dash-text-secondary)] hover:border-[var(--dash-text-muted)]'}"
        >
          <span class="w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 {workLocation.includes(option)
            ? 'border-[var(--dash-primary)] bg-[var(--dash-primary)]'
            : 'border-[var(--dash-border)]'}">
            {#if workLocation.includes(option)}
              <FontAwesomeIcon icon={faCheck} class="w-2.5 h-2.5 text-white" />
            {/if}
          </span>
          {option}
        </button>
      {/each}
    </div>
    {#if configExists && workLocationDirty}
      <div class="flex items-center gap-2 mt-3 pt-3 border-t border-[var(--dash-border)]">
        <button
          type="button"
          onclick={saveWorkLocation}
          disabled={isSavingWorkLocation || workLocation.length === 0}
          class="px-3 py-1 text-xs bg-[var(--dash-primary)] text-white rounded-md hover:bg-[var(--dash-primary-hover)] transition-colors disabled:opacity-50 flex items-center gap-1"
        >
          {#if isSavingWorkLocation}
            <Spinner size="w-3 h-3" />
          {:else}
            <FontAwesomeIcon icon={faCheck} class="w-3 h-3" />
          {/if}
          Save
        </button>
        <button
          type="button"
          onclick={() => (workLocation = [...savedWorkLocation])}
          class="px-3 py-1 text-xs border border-[var(--dash-border)] rounded-md text-[var(--dash-text)] hover:bg-[var(--dash-bg)] transition-colors"
        >
          Cancel
        </button>
      </div>
    {/if}
  </Card>

  <!-- Preferred Locations (only show when hybrid or on-site is saved) -->
  {#if savedWorkLocation.length > 1 || (savedWorkLocation.length === 1 && savedWorkLocation[0] !== "Remote")}
    <Card padding="responsive">
      <div class="flex items-start gap-2 mb-4">
        <div>
          <h3 class="font-medium text-[var(--dash-text)]">Preferred Locations</h3>
          <p class="text-xs text-[var(--dash-text-muted)] mt-0.5">
            The AI matches based on the location text, not geolocation.
            Only relevant for hybrid and on-site jobs.
          </p>
        </div>
      </div>

      <!-- Location tags -->
      {#if locations.length > 0}
        <div class="flex flex-wrap gap-2 mb-3">
          {#each locations as loc}
            <span
              class="px-3 py-1.5 bg-[var(--dash-primary-light)] text-[var(--dash-primary)] rounded-lg text-sm flex items-center gap-2"
            >
              {loc}
              <button
                type="button"
                onclick={() => removeLocation(loc)}
                class="hover:text-[var(--dash-error)] transition-colors"
                aria-label="Remove {loc}"
              >
                &times;
              </button>
            </span>
          {/each}
        </div>
      {/if}

      <!-- Location input -->
      <div class="flex gap-2">
        <input
          type="text"
          bind:value={locationInput}
          onkeydown={handleLocationKeydown}
          placeholder="Add a city or region..."
          class="flex-1 px-3 py-2 bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-lg text-[var(--dash-text)] placeholder-[var(--dash-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
        />
        <button
          type="button"
          onclick={addLocation}
          class="px-4 py-2 bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-lg text-[var(--dash-text)] hover:bg-[var(--dash-border)] transition-colors"
        >
          Add
        </button>
      </div>

      {#if configExists && locationsDirty}
        <div class="flex items-center gap-2 mt-3 pt-3 border-t border-[var(--dash-border)]">
          <button
            type="button"
            onclick={saveLocations}
            disabled={isSavingLocations}
            class="px-3 py-1 text-xs bg-[var(--dash-primary)] text-white rounded-md hover:bg-[var(--dash-primary-hover)] transition-colors disabled:opacity-50 flex items-center gap-1"
          >
            {#if isSavingLocations}
              <Spinner size="w-3 h-3" />
            {:else}
              <FontAwesomeIcon icon={faCheck} class="w-3 h-3" />
            {/if}
            Save
          </button>
          <button
            type="button"
            onclick={() => (locations = [...savedLocations])}
            class="px-3 py-1 text-xs border border-[var(--dash-border)] rounded-md text-[var(--dash-text)] hover:bg-[var(--dash-bg)] transition-colors"
          >
            Cancel
          </button>
        </div>
      {/if}
    </Card>
  {/if}

  <!-- Experience Levels -->
  <Card padding="responsive">
    <div class="flex items-start gap-2 mb-4">
      <div>
        <h3 class="font-medium text-[var(--dash-text)]">Experience Levels</h3>
        <p class="text-xs text-[var(--dash-text-muted)] mt-0.5">
          Optional - leave empty to match all experience levels
        </p>
      </div>
    </div>
    <div class="flex flex-wrap gap-2">
      {#each data.options.experienceLevels as level}
        <button
          type="button"
          onclick={() => (experienceLevels = toggleArrayValue(experienceLevels, level))}
          class="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-full border transition-colors {experienceLevels.includes(level)
            ? 'border-[var(--dash-primary)] bg-[var(--dash-primary)]/10 text-[var(--dash-primary)]'
            : 'border-[var(--dash-border)] text-[var(--dash-text-secondary)] hover:border-[var(--dash-text-muted)]'}"
        >
          <span class="w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 {experienceLevels.includes(level)
            ? 'border-[var(--dash-primary)] bg-[var(--dash-primary)]'
            : 'border-[var(--dash-border)]'}">
            {#if experienceLevels.includes(level)}
              <FontAwesomeIcon icon={faCheck} class="w-2.5 h-2.5 text-white" />
            {/if}
          </span>
          {level}
        </button>
      {/each}
    </div>
    {#if configExists && experienceLevelsDirty}
      <div class="flex items-center gap-2 mt-3 pt-3 border-t border-[var(--dash-border)]">
        <button
          type="button"
          onclick={saveExperienceLevels}
          disabled={isSavingExperienceLevels}
          class="px-3 py-1 text-xs bg-[var(--dash-primary)] text-white rounded-md hover:bg-[var(--dash-primary-hover)] transition-colors disabled:opacity-50 flex items-center gap-1"
        >
          {#if isSavingExperienceLevels}
            <Spinner size="w-3 h-3" />
          {:else}
            <FontAwesomeIcon icon={faCheck} class="w-3 h-3" />
          {/if}
          Save
        </button>
        <button
          type="button"
          onclick={() => (experienceLevels = [...savedExperienceLevels])}
          class="px-3 py-1 text-xs border border-[var(--dash-border)] rounded-md text-[var(--dash-text)] hover:bg-[var(--dash-bg)] transition-colors"
        >
          Cancel
        </button>
      </div>
    {/if}
  </Card>

  <!-- Community Jobs -->
  <Card padding="responsive">
    <ToggleSwitch
      bind:checked={matchCommunityJobs}
      label="Also match with jobs imported by other users"
      description="When enabled, the matcher will also process jobs you didn't import yourself. This can cause significantly more usage on your plan. Your own-imported jobs are always matched first."
    />
    {#if matchCommunityJobs}
      <div class="mt-4 pt-4 border-t border-[var(--dash-border)]">
        <p class="text-xs text-[var(--dash-text-muted)] mb-2">
          Match community jobs from the last:
        </p>
        <div class="flex flex-wrap gap-2">
          {#each communityTimeOptions as opt}
            <button
              type="button"
              onclick={() => (communityMaxAgeDays = opt.value === "all" ? null : parseInt(opt.value))}
              class="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-full border transition-colors {communityMaxAgeDaysStr === opt.value
                ? 'border-[var(--dash-primary)] bg-[var(--dash-primary)]/10 text-[var(--dash-primary)]'
                : 'border-[var(--dash-border)] text-[var(--dash-text-secondary)] hover:border-[var(--dash-text-muted)]'}"
            >
              <span class="w-3.5 h-3.5 rounded-full border flex items-center justify-center flex-shrink-0 {communityMaxAgeDaysStr === opt.value
                ? 'border-[var(--dash-primary)]'
                : 'border-[var(--dash-border)]'}">
                {#if communityMaxAgeDaysStr === opt.value}
                  <span class="w-2 h-2 rounded-full bg-[var(--dash-primary)]"></span>
                {/if}
              </span>
              {opt.label}
            </button>
          {/each}
        </div>
        {#if communityCountsLoading}
          <p class="text-xs text-[var(--dash-text-muted)] mt-2 flex items-center gap-1">
            <Spinner size="w-3 h-3" /> Loading job counts…
          </p>
        {:else if communityCounts}
          {@const selectedKey = communityMaxAgeDays === null ? "all" : String(communityMaxAgeDays)}
          {@const count = communityCounts[selectedKey] ?? 0}
          <p class="text-xs text-[var(--dash-text-muted)] mt-2">
            {count} unmatched community {count === 1 ? "job" : "jobs"} to process
            {#if count > 0}
              (≈{count}–{count * 2} usage)
            {/if}
          </p>
        {/if}
      </div>
    {/if}
    {#if configExists && communityJobsDirty}
      <div class="flex items-center gap-2 mt-3 pt-3 border-t border-[var(--dash-border)]">
        <button
          type="button"
          onclick={saveCommunityJobs}
          disabled={isSavingCommunityJobs}
          class="px-3 py-1 text-xs bg-[var(--dash-primary)] text-white rounded-md hover:bg-[var(--dash-primary-hover)] transition-colors disabled:opacity-50 flex items-center gap-1"
        >
          {#if isSavingCommunityJobs}
            <Spinner size="w-3 h-3" />
          {:else}
            <FontAwesomeIcon icon={faCheck} class="w-3 h-3" />
          {/if}
          Save
        </button>
        <button
          type="button"
          onclick={() => { matchCommunityJobs = savedMatchCommunityJobs; communityMaxAgeDays = savedCommunityMaxAgeDays; }}
          class="px-3 py-1 text-xs border border-[var(--dash-border)] rounded-md text-[var(--dash-text)] hover:bg-[var(--dash-bg)] transition-colors"
        >
          Cancel
        </button>
      </div>
    {/if}
  </Card>

  <!-- First-time setup: single create button -->
  {#if !configExists}
    <div class="flex justify-end">
      <SectionSaveButton state={setupState} onClick={createConfig} label="Create Config" />
    </div>
  {/if}
</div>
