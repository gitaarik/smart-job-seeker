<script lang="ts">
  import type { PageData } from "./$types";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import { faInfoCircle, faSliders } from "@fortawesome/free-solid-svg-icons";
  import SectionHeader from "../../profile/components/SectionHeader.svelte";
  import SectionSaveButton from "$lib/components/SectionSaveButton.svelte";
  import Card from "../../components/Card.svelte";

  let { data }: { data: PageData } = $props();

  // Helper to normalize saved values to match our option labels (case-insensitive)
  function normalizeToOptions(saved: string[], options: string[]): string[] {
    const lowerToOption = new Map(options.map((o) => [o.toLowerCase(), o]));
    return saved
      .map((s) => lowerToOption.get(s.toLowerCase()))
      .filter((s): s is string => s !== undefined);
  }

  // Form state - initialize from existing config, normalizing to match option casing
  let jobTypes = $state<string[]>(
    normalizeToOptions(
      data.config?.job_types || [],
      data.options.jobTypes
    )
  );
  let experienceLevels = $state<string[]>(
    normalizeToOptions(
      data.config?.experience_levels || [],
      data.options.experienceLevels
    )
  );
  let workLocation = $state<string[]>(
    normalizeToOptions(
      data.config?.work_location || [],
      data.options.workLocationOptions
    )
  );
  let locations = $state<string[]>(data.config?.locations || []);

  // Location input state
  let locationInput = $state("");

  // Save state
  type SaveState = "idle" | "saving" | "saved" | "error";
  let saveState = $state<SaveState>("idle");
  let errorMessage = $state("");

  function toggleArrayValue(arr: string[], value: string): string[] {
    if (arr.includes(value)) {
      return arr.filter((v) => v !== value);
    }
    return [...arr, value];
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

  async function saveConfig() {
    // Client-side validation
    if (jobTypes.length === 0) {
      errorMessage = "Please select at least one job type";
      saveState = "error";
      setTimeout(() => (saveState = "idle"), 2000);
      return;
    }

    if (workLocation.length === 0) {
      errorMessage = "Please select at least one work location option";
      saveState = "error";
      setTimeout(() => (saveState = "idle"), 2000);
      return;
    }

    saveState = "saving";
    errorMessage = "";

    try {
      const response = await fetch("/api/job-preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile_id: data.profileId,
          job_types: jobTypes,
          experience_levels: experienceLevels,
          work_location: workLocation,
          locations: locations,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        errorMessage = error.message || error.error || "Failed to save config";
        saveState = "error";
        setTimeout(() => (saveState = "idle"), 2000);
        return;
      }

      saveState = "saved";
      setTimeout(() => (saveState = "idle"), 2000);
    } catch (error) {
      console.error("Save failed:", error);
      errorMessage = "Failed to save config";
      saveState = "error";
      setTimeout(() => (saveState = "idle"), 2000);
    }
  }
</script>

<div class="space-y-6">
  <SectionHeader title="Match Config" icon={faSliders} />

  <p class="text-sm text-[var(--dash-text-secondary)]">
    Configure your job matching preferences. The AI matcher uses these settings
    to filter and score jobs based on your criteria.
  </p>

  {#if errorMessage && saveState === "error"}
    <div
      class="bg-[var(--dash-error-light)] border border-[var(--dash-error)] rounded-lg p-4"
    >
      <p class="text-[var(--dash-error)] text-sm">{errorMessage}</p>
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
        <label
          class="cursor-pointer px-4 py-2 rounded-lg border transition-colors {jobTypes.includes(
            jobType
          )
            ? 'bg-[var(--dash-primary)] border-[var(--dash-primary)] text-white'
            : 'bg-[var(--dash-bg)] border-[var(--dash-border)] text-[var(--dash-text)] hover:border-[var(--dash-primary)]'}"
        >
          <input
            type="checkbox"
            name="job_types"
            value={jobType}
            checked={jobTypes.includes(jobType)}
            onchange={() => (jobTypes = toggleArrayValue(jobTypes, jobType))}
            class="sr-only"
          />
          {jobType}
        </label>
      {/each}
    </div>
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
        <label
          class="cursor-pointer px-4 py-2 rounded-lg border transition-colors {workLocation.includes(
            option
          )
            ? 'bg-[var(--dash-primary)] border-[var(--dash-primary)] text-white'
            : 'bg-[var(--dash-bg)] border-[var(--dash-border)] text-[var(--dash-text)] hover:border-[var(--dash-primary)]'}"
        >
          <input
            type="checkbox"
            name="work_location"
            value={option}
            checked={workLocation.includes(option)}
            onchange={() =>
              (workLocation = toggleArrayValue(workLocation, option))}
            class="sr-only"
          />
          {option}
        </label>
      {/each}
    </div>
  </Card>

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
        <label
          class="cursor-pointer px-4 py-2 rounded-lg border transition-colors {experienceLevels.includes(
            level
          )
            ? 'bg-[var(--dash-primary)] border-[var(--dash-primary)] text-white'
            : 'bg-[var(--dash-bg)] border-[var(--dash-border)] text-[var(--dash-text)] hover:border-[var(--dash-primary)]'}"
        >
          <input
            type="checkbox"
            name="experience_levels"
            value={level}
            checked={experienceLevels.includes(level)}
            onchange={() =>
              (experienceLevels = toggleArrayValue(experienceLevels, level))}
            class="sr-only"
          />
          {level}
        </label>
      {/each}
    </div>
  </Card>

  <!-- Preferred Locations -->
  <Card padding="responsive">
    <div class="flex items-start gap-2 mb-4">
      <div>
        <h3 class="font-medium text-[var(--dash-text)]">Preferred Locations</h3>
        <p class="text-xs text-[var(--dash-text-muted)] mt-0.5">
          Optional - cities or regions you'd like to work in (for non-remote
          jobs)
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

  </Card>

  <!-- Save Button -->
  <div class="flex justify-end">
    <SectionSaveButton state={saveState} onClick={saveConfig} />
  </div>

  <!-- Info Box -->
  <div
    class="bg-[var(--dash-info-light)] border border-[var(--dash-info)] rounded-lg p-4 flex gap-3"
  >
    <FontAwesomeIcon
      icon={faInfoCircle}
      class="w-5 h-5 text-[var(--dash-info)] flex-shrink-0 mt-0.5"
    />
    <div class="text-sm text-[var(--dash-info)]">
      <p class="font-medium">How matching works</p>
      <p class="mt-1">
        Jobs are filtered based on your preferences before being scored by the
        AI. Jobs must have at least one matching skill and meet your job type
        and work location criteria to be considered.
      </p>
    </div>
  </div>
</div>
