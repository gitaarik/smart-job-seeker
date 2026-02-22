<script lang="ts">
  import type { PageData } from "./$types";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faArrowLeft,
    faBriefcase,
    faPlus,
    faTimes,
  } from "@fortawesome/free-solid-svg-icons";
  import MediaUpload from "$lib/components/MediaUpload.svelte";
  import SectionSaveButton from "$lib/components/SectionSaveButton.svelte";

  type SaveState = "idle" | "saving" | "saved" | "error";

  let { data }: { data: PageData } = $props();

  let logoUrl = $state(data.logoUrl);
  let bannerUrl = $state(data.bannerUrl);

  let experience = $derived(data.experience);

  // Section save states
  let basicSaveState = $state<SaveState>("idle");
  let techSaveState = $state<SaveState>("idle");
  let achievementsSaveState = $state<SaveState>("idle");

  // Form states
  let editName = $state(experience.name || "");
  let editPosition = $state(experience.position || "");
  let editLocation = $state(experience.location || "");
  let editWebsite = $state(experience.website || "");
  let editSummary = $state(experience.summary || "");
  let editStartDate = $state(formatDate(experience.start_date));
  let editEndDate = $state(formatDate(experience.end_date));
  let editAchievements = $state<{ title: string; description: string }[]>(
    experience.work_experience_achievements.map((a) => ({
      title: a.title || "",
      description: a.description || "",
    })),
  );
  let editTechnologies = $state<string[]>(
    experience.work_experience_technologies.map((t) => t.name || ""),
  );

  function formatDate(date: Date | string | null): string {
    if (!date) return "";
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toISOString().split("T")[0];
  }

  async function saveBasicInfo() {
    basicSaveState = "saving";
    try {
      const response = await fetch(`/api/work-experience/${experience.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section: "basic",
          name: editName,
          position: editPosition,
          location: editLocation,
          website: editWebsite,
          summary: editSummary,
          start_date: editStartDate || null,
          end_date: editEndDate || null,
        }),
      });

      if (response.ok) {
        basicSaveState = "saved";
        setTimeout(() => (basicSaveState = "idle"), 2000);
      } else {
        basicSaveState = "error";
        setTimeout(() => (basicSaveState = "idle"), 3000);
      }
    } catch {
      basicSaveState = "error";
      setTimeout(() => (basicSaveState = "idle"), 3000);
    }
  }

  async function saveTechnologies() {
    techSaveState = "saving";
    try {
      const response = await fetch(`/api/work-experience/${experience.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section: "technologies",
          technologies: editTechnologies.filter((t) => t.trim()),
        }),
      });

      if (response.ok) {
        techSaveState = "saved";
        setTimeout(() => (techSaveState = "idle"), 2000);
      } else {
        techSaveState = "error";
        setTimeout(() => (techSaveState = "idle"), 3000);
      }
    } catch {
      techSaveState = "error";
      setTimeout(() => (techSaveState = "idle"), 3000);
    }
  }

  async function saveAchievements() {
    achievementsSaveState = "saving";
    try {
      const response = await fetch(`/api/work-experience/${experience.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section: "achievements",
          achievements: editAchievements.filter(
            (a) => a.title?.trim() || a.description?.trim(),
          ),
        }),
      });

      if (response.ok) {
        achievementsSaveState = "saved";
        setTimeout(() => (achievementsSaveState = "idle"), 2000);
      } else {
        achievementsSaveState = "error";
        setTimeout(() => (achievementsSaveState = "idle"), 3000);
      }
    } catch {
      achievementsSaveState = "error";
      setTimeout(() => (achievementsSaveState = "idle"), 3000);
    }
  }

  function addAchievement() {
    editAchievements = [...editAchievements, {
      title: "",
      description: "",
    }];
  }

  function removeAchievement(index: number) {
    editAchievements = editAchievements.filter((_, i) => i !== index);
  }

  function addTechnology() {
    editTechnologies = [...editTechnologies, ""];
  }

  function removeTechnology(index: number) {
    editTechnologies = editTechnologies.filter((_, i) => i !== index);
  }
</script>

<div class="space-y-6">
  <!-- Header -->
  <div class="flex items-center gap-4">
    <a
      href="/dashboard/profile/work-experience"
      class="flex items-center gap-2 text-[var(--dash-text-secondary)] hover:text-[var(--dash-primary)] transition-colors"
    >
      <FontAwesomeIcon icon={faArrowLeft} class="w-4 h-4" />
      <span class="text-sm">Back to Work Experience</span>
    </a>
  </div>

  <div class="flex items-center gap-4">
    {#if logoUrl}
      <img
        src={logoUrl}
        alt="{experience.name} logo"
        class="w-12 h-12 rounded-lg object-cover"
      />
    {:else}
      <div
        class="w-12 h-12 rounded-lg bg-[var(--dash-bg)] flex items-center justify-center"
      >
        <FontAwesomeIcon icon={faBriefcase} class="w-6 h-6 text-[var(--dash-primary)]" />
      </div>
    {/if}
    <div>
      <h1 class="text-2xl font-bold text-[var(--dash-text)]">Edit Work Experience</h1>
      <p class="text-[var(--dash-text-secondary)]">{experience.name} - {experience.position}</p>
    </div>
  </div>

  <!-- Basic Info -->
  <div class="bg-[var(--dash-card)] rounded-lg border border-[var(--dash-border)] p-6">
    <h2 class="text-lg font-semibold text-[var(--dash-text)] mb-4">Basic Information</h2>
    <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label
            for="edit-name"
            class="block text-sm font-medium text-[var(--dash-text)] mb-1"
          >
            Company Name <span class="text-[var(--dash-error)]">*</span>
          </label>
          <input
            type="text"
            id="edit-name"
            bind:value={editName}
            required
            class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
          />
        </div>

        <div>
          <label
            for="edit-position"
            class="block text-sm font-medium text-[var(--dash-text)] mb-1"
          >
            Position <span class="text-[var(--dash-error)]">*</span>
          </label>
          <input
            type="text"
            id="edit-position"
            bind:value={editPosition}
            required
            class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
          />
        </div>

        <div>
          <label
            for="edit-location"
            class="block text-sm font-medium text-[var(--dash-text)] mb-1"
          >
            Location
          </label>
          <input
            type="text"
            id="edit-location"
            bind:value={editLocation}
            class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
          />
        </div>

        <div>
          <label
            for="edit-website"
            class="block text-sm font-medium text-[var(--dash-text)] mb-1"
          >
            Website
          </label>
          <input
            type="url"
            id="edit-website"
            bind:value={editWebsite}
            class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
          />
        </div>

        <div>
          <label
            for="edit-start-date"
            class="block text-sm font-medium text-[var(--dash-text)] mb-1"
          >
            Start Date
          </label>
          <input
            type="date"
            id="edit-start-date"
            bind:value={editStartDate}
            class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
          />
        </div>

        <div>
          <label
            for="edit-end-date"
            class="block text-sm font-medium text-[var(--dash-text)] mb-1"
          >
            End Date
          </label>
          <input
            type="date"
            id="edit-end-date"
            bind:value={editEndDate}
            class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
          />
        </div>
      </div>

      <div class="flex flex-col">
        <label
          for="edit-summary"
          class="block text-sm font-medium text-[var(--dash-text)] mb-1"
        >
          Role Summary
        </label>
        <textarea
          id="edit-summary"
          bind:value={editSummary}
          rows={5}
          class="w-full flex-1 min-h-[120px] px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent resize-y"
        ></textarea>
      </div>
    </div>
    <div class="flex justify-end mt-4">
      <SectionSaveButton state={basicSaveState} onClick={saveBasicInfo} />
    </div>
  </div>

  <!-- Technologies -->
  <div class="bg-[var(--dash-card)] rounded-lg border border-[var(--dash-border)] p-6">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-lg font-semibold text-[var(--dash-text)]">Technologies</h2>
      <button
        type="button"
        onclick={addTechnology}
        class="text-[var(--dash-primary)] hover:text-[var(--dash-primary-hover)] text-sm flex items-center gap-1"
      >
        <FontAwesomeIcon icon={faPlus} class="w-3 h-3" />
        Add Technology
      </button>
    </div>

    {#if editTechnologies.length === 0}
      <p class="text-[var(--dash-text-secondary)] text-sm">No technologies added yet.</p>
    {:else}
      <div class="flex flex-wrap gap-2">
        {#each editTechnologies as tech, index}
          <div
            class="flex items-center gap-1 bg-[var(--dash-bg)] rounded-lg pl-3 pr-1 py-1"
          >
            <div class="relative pr-3">
              <span class="invisible whitespace-pre text-sm min-w-[3ch]">{editTechnologies[index] || "Technology"}</span>
              <input
                type="text"
                bind:value={editTechnologies[index]}
                placeholder="Technology"
                class="absolute inset-0 bg-transparent border-none focus:outline-none text-[var(--dash-text)] text-sm w-full pr-3"
              />
            </div>
            <button
              type="button"
              onclick={() => removeTechnology(index)}
              class="p-1 text-[var(--dash-text-secondary)] hover:text-[var(--dash-error)] transition-colors"
              aria-label="Remove"
            >
              <FontAwesomeIcon icon={faTimes} class="w-3 h-3" />
            </button>
          </div>
        {/each}
      </div>
    {/if}
    <div class="flex justify-end mt-4">
      <SectionSaveButton state={techSaveState} onClick={saveTechnologies} />
    </div>
  </div>

  <!-- Achievements -->
  <div class="bg-[var(--dash-card)] rounded-lg border border-[var(--dash-border)] p-6">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-lg font-semibold text-[var(--dash-text)]">Achievements</h2>
      <button
        type="button"
        onclick={addAchievement}
        class="text-[var(--dash-primary)] hover:text-[var(--dash-primary-hover)] text-sm flex items-center gap-1"
      >
        <FontAwesomeIcon icon={faPlus} class="w-3 h-3" />
        Add Achievement
      </button>
    </div>

    {#if editAchievements.length === 0}
      <p class="text-[var(--dash-text-secondary)] text-sm">No achievements added yet.</p>
    {:else}
      <div class="space-y-3">
        {#each editAchievements as achievement, index}
          <div class="flex items-start gap-3 p-3 bg-[var(--dash-bg)] rounded-lg">
            <div class="flex-1 space-y-2">
              <input
                type="text"
                bind:value={editAchievements[index].title}
                placeholder="Title (optional)"
                class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent text-sm"
              />
              <input
                type="text"
                bind:value={editAchievements[index].description}
                placeholder="Description"
                class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent text-sm"
              />
            </div>
            <button
              type="button"
              onclick={() => removeAchievement(index)}
              class="p-2 text-[var(--dash-text-secondary)] hover:text-[var(--dash-error)] transition-colors"
              aria-label="Remove"
            >
              <FontAwesomeIcon icon={faTimes} class="w-4 h-4" />
            </button>
          </div>
        {/each}
      </div>
    {/if}
    <div class="flex justify-end mt-4">
      <SectionSaveButton state={achievementsSaveState} onClick={saveAchievements} />
    </div>
  </div>

  <!-- Portfolio Images -->
  <div class="bg-[var(--dash-card)] rounded-lg border border-[var(--dash-border)] p-6">
    <h2 class="text-lg font-semibold text-[var(--dash-text)] mb-2">Portfolio Images</h2>
    <p class="text-sm text-[var(--dash-text-secondary)] mb-4">
      These images are used for your portfolio display. They are not required for job search or matching.
    </p>
    <div class="flex gap-6">
      <div class="max-w-xs">
        <MediaUpload
          entityType="work_experience"
          entityId={experience.id}
          field="logo_path"
          currentUrl={logoUrl}
          label="Company Logo"
          showHint={false}
          onUpload={(url) => (logoUrl = url)}
          onDelete={() => (logoUrl = null)}
        />
      </div>
      <div class="flex-1">
        <MediaUpload
          entityType="work_experience"
          entityId={experience.id}
          field="banner_path"
          currentUrl={bannerUrl}
          label="Company Banner"
          showHint={false}
          onUpload={(url) => (bannerUrl = url)}
          onDelete={() => (bannerUrl = null)}
        />
      </div>
    </div>
    <p class="text-xs text-[var(--dash-text-secondary)] mt-3">
      JPEG, PNG, WebP, or GIF. Max 5MB.
    </p>
  </div>
</div>
