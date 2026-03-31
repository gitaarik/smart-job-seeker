<script lang="ts">
  import type { PageData } from "./$types";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faArrowLeft,
    faBriefcase,
    faPlus,
    faTimes,
    faTrash,
    faUndo,
  } from "@fortawesome/free-solid-svg-icons";
  import MediaUpload from "$lib/components/MediaUpload.svelte";
  import SectionSaveButton from "$lib/components/SectionSaveButton.svelte";
  import AchievementsList, { type AchievementItem } from "$lib/components/AchievementsList.svelte";
  import VersionTags from "$lib/components/VersionTags.svelte";
  import ConfirmModal from "../../components/ConfirmModal.svelte";
  import Card from "../../../components/Card.svelte";

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
  let editTags = $state<string[]>(Array.isArray(experience.tags) ? experience.tags as string[] : []);
  let showDeleteConfirm = $state(false);

  let editAchievements = $state<AchievementItem[]>(
    experience.work_experience_achievements.map((a) => ({
      description: a.description || "",
      tags: Array.isArray(a.tags) ? a.tags as string[] : null,
    })),
  );
  let versionSlugs = $state<string[]>([]);
  let deletedAchievements = $state<Set<number>>(new Set());
  let editTechnologies = $state<string[]>(
    experience.work_experience_technologies.map((t) => t.name || ""),
  );
  let deletedTechnologies = $state<Set<number>>(new Set());
  let lastAddedTechIndex = $state<number | null>(null);

  // Load version slugs for achievement tags
  let versionSlugsLoaded = $state(false);
  $effect(() => {
    if (versionSlugsLoaded) return;
    versionSlugsLoaded = true;
    fetch("/dashboard/api/profile-versions")
      .then((res) => res.ok ? res.json() : [])
      .then((slugs: string[]) => { versionSlugs = slugs; })
      .catch(() => {});
  });

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
          technologies: editTechnologies.filter((t, i) => t.trim() && !deletedTechnologies.has(i)),
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
          achievements: editAchievements
            .filter((a, i) => a.description.trim() && !deletedAchievements.has(i))
            .map((a) => ({ description: a.description, tags: a.tags })),
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

  let lastAddedAchievementIndex = $state<number | null>(null);

  function addAchievement() {
    editAchievements = [...editAchievements, { description: "", tags: null }];
    lastAddedAchievementIndex = editAchievements.length - 1;
  }

  function removeAchievement(index: number) {
    if (!editAchievements[index]?.description.trim()) {
      // Empty item - remove immediately
      editAchievements = editAchievements.filter((_, i) => i !== index);
      // Adjust deleted indices for removed item
      const newDeleted = new Set<number>();
      deletedAchievements.forEach((i) => {
        if (i > index) newDeleted.add(i - 1);
        else if (i < index) newDeleted.add(i);
      });
      deletedAchievements = newDeleted;
    } else {
      // Has content - soft delete
      deletedAchievements = new Set([...deletedAchievements, index]);
    }
  }

  function undoRemoveAchievement(index: number) {
    const newSet = new Set(deletedAchievements);
    newSet.delete(index);
    deletedAchievements = newSet;
  }

  function addTechnology() {
    editTechnologies = [...editTechnologies, ""];
    lastAddedTechIndex = editTechnologies.length - 1;
  }

  function focusIfNew(node: HTMLInputElement, isNew: boolean) {
    if (isNew) {
      node.focus();
      lastAddedTechIndex = null;
    }
  }

  function removeTechnology(index: number) {
    if (!editTechnologies[index]?.trim()) {
      // Empty tag - remove immediately
      editTechnologies = editTechnologies.filter((_, i) => i !== index);
      // Adjust deleted indices for removed item
      const newDeleted = new Set<number>();
      deletedTechnologies.forEach((i) => {
        if (i > index) newDeleted.add(i - 1);
        else if (i < index) newDeleted.add(i);
      });
      deletedTechnologies = newDeleted;
    } else {
      // Has content - soft delete
      deletedTechnologies = new Set([...deletedTechnologies, index]);
    }
  }

  function undoRemoveTechnology(index: number) {
    const newSet = new Set(deletedTechnologies);
    newSet.delete(index);
    deletedTechnologies = newSet;
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
      <span class="text-sm">Back to all Work Experience</span>
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
  <Card padding="lg">
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
  </Card>

  <!-- Technologies -->
  <Card padding="lg">
    <h2 class="text-lg font-semibold text-[var(--dash-text)] mb-4">Technologies</h2>

    <div class="flex flex-wrap gap-2">
        {#each editTechnologies as tech, index}
          {@const isDeleted = deletedTechnologies.has(index)}
          <div
            class="flex items-center gap-1 rounded-lg pl-3 pr-1 py-1 {isDeleted ? 'bg-[var(--dash-bg)]/50 opacity-50' : 'bg-[var(--dash-bg)]'}"
          >
            <div class="relative pr-3">
              <span class="invisible whitespace-pre text-sm min-w-[3ch] {isDeleted ? 'line-through' : ''}">{editTechnologies[index] || "Technology"}</span>
              {#if isDeleted}
                <span class="absolute inset-0 text-[var(--dash-text-secondary)] text-sm line-through pr-3">{editTechnologies[index]}</span>
              {:else}
                <input
                  type="text"
                  bind:value={editTechnologies[index]}
                  placeholder="Technology"
                  use:focusIfNew={index === lastAddedTechIndex}
                  class="absolute inset-0 bg-transparent border-none focus:outline-none text-[var(--dash-text)] text-sm w-full pr-3"
                />
              {/if}
            </div>
            {#if isDeleted}
              <button
                type="button"
                onclick={() => undoRemoveTechnology(index)}
                class="p-1 text-[var(--dash-primary)] hover:text-[var(--dash-primary-hover)] transition-colors"
                aria-label="Undo"
              >
                <FontAwesomeIcon icon={faUndo} class="w-3 h-3" />
              </button>
            {:else}
              <button
                type="button"
                onclick={() => removeTechnology(index)}
                class="p-1 text-[var(--dash-text-secondary)] hover:text-[var(--dash-error)] transition-colors"
                aria-label="Remove"
              >
                <FontAwesomeIcon icon={faTimes} class="w-3 h-3" />
              </button>
            {/if}
          </div>
        {/each}
        <button
          type="button"
          onclick={addTechnology}
          class="flex items-center gap-1 text-[var(--dash-primary)] hover:text-[var(--dash-primary-hover)] text-sm px-3 py-1"
        >
          <FontAwesomeIcon icon={faPlus} class="w-3 h-3" />
          Add
        </button>
      </div>
    <div class="flex justify-end mt-4">
      <SectionSaveButton state={techSaveState} onClick={saveTechnologies} />
    </div>
  </Card>

  <!-- Achievements -->
  <Card padding="lg">
    <h2 class="text-lg font-semibold text-[var(--dash-text)] mb-4">Achievements</h2>

    <AchievementsList
      bind:achievements={editAchievements}
      deletedIndices={deletedAchievements}
      lastAddedIndex={lastAddedAchievementIndex}
      showTags={true}
      {versionSlugs}
      onAdd={addAchievement}
      onRemove={removeAchievement}
      onUndoRemove={undoRemoveAchievement}
      onFocused={() => (lastAddedAchievementIndex = null)}
    />
    <div class="flex justify-end mt-4">
      <SectionSaveButton state={achievementsSaveState} onClick={saveAchievements} />
    </div>
  </Card>

  <!-- Portfolio Images -->
  <Card padding="lg">
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
  </Card>

  <!-- Version Tags -->
  <VersionTags bind:tags={editTags} apiUrl={`/api/work-experience/${experience.id}`} section="basic" />

  <!-- Danger Zone -->
  <Card padding="lg">
    <div class="space-y-3">
      <div class="flex items-center gap-2 mb-2">
        <FontAwesomeIcon
          icon={faTrash}
          class="w-4 h-4 text-[var(--dash-text-secondary)]"
        />
        <h2
          class="text-sm font-semibold text-[var(--dash-text)] uppercase tracking-wide"
        >
          Danger Zone
        </h2>
      </div>

      <p class="text-sm text-[var(--dash-text-secondary)]">
        Permanently remove this work experience and all associated achievements and technologies.
      </p>

      <button
        type="button"
        onclick={() => showDeleteConfirm = true}
        class="flex items-center gap-2 px-4 py-2 text-sm bg-red-500/10 border border-red-500/30 rounded-lg text-red-500 hover:bg-red-500/20 hover:border-red-500/50 transition-colors"
      >
        <FontAwesomeIcon icon={faTrash} class="w-3 h-3" />
        Delete Work Experience
      </button>
    </div>
  </Card>
</div>

<ConfirmModal
  isOpen={showDeleteConfirm}
  title="Delete Work Experience"
  message="Are you sure you want to permanently delete this work experience? All achievements and technologies will also be deleted. This action cannot be undone."
  confirmLabel="Delete"
  onCancel={() => showDeleteConfirm = false}
  onConfirm={() => {
    showDeleteConfirm = false;
    const form = document.createElement("form");
    form.method = "POST";
    form.action = "/dashboard/profile/work-experience?/delete";
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = "id";
    input.value = String(experience.id);
    form.appendChild(input);
    document.body.appendChild(form);
    form.submit();
  }}
/>
