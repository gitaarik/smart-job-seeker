<script lang="ts">
  import type { ActionData, PageData } from "./$types";
  import { enhance } from "$app/forms";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faArrowLeft,
    faBriefcase,
    faPlus,
    faTimes,
  } from "@fortawesome/free-solid-svg-icons";

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let experience = $derived(data.experience);
  let saving = $state(false);
  let showSuccess = $state(false);

  // Form states
  let editName = $state(experience.name || "");
  let editPosition = $state(experience.position || "");
  let editLocation = $state(experience.location || "");
  let editWebsite = $state(experience.website || "");
  let editDescription = $state(experience.description || "");
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

  function handleSubmit() {
    saving = true;
    showSuccess = false;
    return async (
      { result, update }: {
        result: { type: string };
        update: () => Promise<void>;
      },
    ) => {
      await update();
      saving = false;
      if (result.type === "success") {
        showSuccess = true;
        setTimeout(() => (showSuccess = false), 3000);
      }
    };
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
    <div
      class="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center"
    >
      <FontAwesomeIcon icon={faBriefcase} class="w-6 h-6 text-[var(--dash-primary)]" />
    </div>
    <div>
      <h1 class="text-2xl font-bold text-[var(--dash-text)]">Edit Work Experience</h1>
      <p class="text-[var(--dash-text-secondary)]">{experience.name} - {experience.position}</p>
    </div>
  </div>

  {#if form?.error}
    <div class="bg-[var(--dash-error-light)] border border-[var(--dash-error)] rounded-lg p-4">
      <p class="text-[var(--dash-error)] text-sm">{form.error}</p>
    </div>
  {/if}

  {#if showSuccess}
    <div class="bg-[var(--dash-success-light)] border border-[var(--dash-success)] rounded-lg p-4">
      <p class="text-[var(--dash-success)] text-sm">Work experience updated successfully!</p>
    </div>
  {/if}

  <form
    method="POST"
    action="?/update"
    use:enhance={handleSubmit}
    class="space-y-6"
  >
    <input
      type="hidden"
      name="achievements"
      value={JSON.stringify(editAchievements)}
    />
    <input
      type="hidden"
      name="technologies"
      value={JSON.stringify(editTechnologies)}
    />

    <!-- Basic Info -->
    <div class="bg-[var(--dash-card)] rounded-lg border border-[var(--dash-border)] p-6">
      <h2 class="text-lg font-semibold text-[var(--dash-text)] mb-4">Basic Information</h2>
      <div class="space-y-4">
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
              name="name"
              bind:value={editName}
              required
              class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
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
              name="position"
              bind:value={editPosition}
              required
              class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
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
              name="location"
              bind:value={editLocation}
              class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
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
              name="website"
              bind:value={editWebsite}
              class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
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
              name="start_date"
              bind:value={editStartDate}
              class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
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
              name="end_date"
              bind:value={editEndDate}
              class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
            />
          </div>
        </div>

        <div>
          <label
            for="edit-description"
            class="block text-sm font-medium text-[var(--dash-text)] mb-1"
          >
            Company Description
          </label>
          <textarea
            id="edit-description"
            name="description"
            bind:value={editDescription}
            rows={2}
            class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent resize-y"
          ></textarea>
        </div>

        <div>
          <label
            for="edit-summary"
            class="block text-sm font-medium text-[var(--dash-text)] mb-1"
          >
            Role Summary
          </label>
          <textarea
            id="edit-summary"
            name="summary"
            bind:value={editSummary}
            rows={3}
            class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent resize-y"
          ></textarea>
        </div>
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
              class="flex items-center gap-1 bg-gray-100 rounded-lg pl-3 pr-1 py-1"
            >
              <input
                type="text"
                bind:value={editTechnologies[index]}
                placeholder="Technology"
                class="bg-transparent border-none focus:outline-none text-[var(--dash-text)] text-sm w-24"
              />
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
            <div class="flex items-start gap-3 p-3 bg-gray-100 rounded-lg">
              <div class="flex-1 space-y-2">
                <input
                  type="text"
                  bind:value={editAchievements[index].title}
                  placeholder="Title (optional)"
                  class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent text-sm"
                />
                <input
                  type="text"
                  bind:value={editAchievements[index].description}
                  placeholder="Description"
                  class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent text-sm"
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
    </div>

    <!-- Actions -->
    <div class="flex justify-end gap-3">
      <a
        href="/dashboard/profile/work-experience"
        class="px-4 py-2 border border-[var(--dash-border)] rounded-lg text-[var(--dash-text)] hover:bg-gray-100 transition-colors"
      >
        Cancel
      </a>
      <button
        type="submit"
        disabled={saving}
        class="px-6 py-2 bg-[var(--dash-primary)] text-white rounded-lg hover:bg-[var(--dash-primary-hover)] transition-colors disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save Changes"}
      </button>
    </div>
  </form>
</div>
