<script lang="ts">
  import type { ActionData, PageData } from "./$types";
  import { enhance } from "$app/forms";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faArrowLeft,
    faLightbulb,
    faPlus,
    faStar,
    faTimes,
  } from "@fortawesome/free-solid-svg-icons";
  import MediaUpload from "$lib/components/MediaUpload.svelte";

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let imageUrl = $state(data.imageUrl);
  let bannerUrl = $state(data.bannerUrl);

  let project = $derived(data.project);
  let saving = $state(false);
  let showSuccess = $state(false);

  // Form states
  let editName = $state(project.name || "");
  let editUrl = $state(project.url || "");
  let editUrlLabel = $state(project.url_label || "");
  let editSummary = $state(project.summary || "");
  let editStars = $state(project.stars?.toString() || "");
  let editStartDate = $state(formatDate(project.start_date));
  let editEndDate = $state(formatDate(project.end_date));
  let editAchievements = $state<string[]>(
    project.side_project_achievements.map((a) => a.description || ""),
  );
  let editTechnologies = $state<string[]>(
    project.side_project_technologies.map((t) => t.name || ""),
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
    editAchievements = [...editAchievements, ""];
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
      href="/dashboard/profile/side-projects"
      class="flex items-center gap-2 text-[var(--dash-text-secondary)] hover:text-[var(--dash-primary)] transition-colors"
    >
      <FontAwesomeIcon icon={faArrowLeft} class="w-4 h-4" />
      <span class="text-sm">Back to Side Projects</span>
    </a>
  </div>

  <div class="flex items-center gap-4">
    {#if imageUrl}
      <img
        src={imageUrl}
        alt="{project.name} image"
        class="w-12 h-12 rounded-lg object-cover"
      />
    {:else}
      <div
        class="w-12 h-12 rounded-lg bg-[var(--dash-bg)] flex items-center justify-center"
      >
        <FontAwesomeIcon icon={faLightbulb} class="w-6 h-6 text-[var(--dash-primary)]" />
      </div>
    {/if}
    <div>
      <h1 class="text-2xl font-bold text-[var(--dash-text)]">
        Edit Side Project
        {#if project.stars}
          <span class="text-amber-500 text-lg ml-2">
            <FontAwesomeIcon icon={faStar} class="w-4 h-4" />
            {project.stars}
          </span>
        {/if}
      </h1>
      <p class="text-[var(--dash-text-secondary)]">{project.name}</p>
    </div>
  </div>

  {#if form?.error}
    <div class="bg-[var(--dash-error-light)] border border-[var(--dash-error)] rounded-lg p-4">
      <p class="text-[var(--dash-error)] text-sm">{form.error}</p>
    </div>
  {/if}

  {#if showSuccess}
    <div class="bg-[var(--dash-success-light)] border border-[var(--dash-success)] rounded-lg p-4">
      <p class="text-[var(--dash-success)] text-sm">Project updated successfully!</p>
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
              Project Name <span class="text-[var(--dash-error)]">*</span>
            </label>
            <input
              type="text"
              id="edit-name"
              name="name"
              bind:value={editName}
              required
              class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
            />
          </div>

          <div>
            <label
              for="edit-url"
              class="block text-sm font-medium text-[var(--dash-text)] mb-1"
            >
              URL
            </label>
            <input
              type="url"
              id="edit-url"
              name="url"
              bind:value={editUrl}
              placeholder="https://github.com/user/project"
              class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
            />
          </div>

          <div>
            <label
              for="edit-url-label"
              class="block text-sm font-medium text-[var(--dash-text)] mb-1"
            >
              URL Label
            </label>
            <input
              type="text"
              id="edit-url-label"
              name="url_label"
              bind:value={editUrlLabel}
              placeholder="e.g., View on GitHub"
              class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
            />
          </div>

          <div>
            <label
              for="edit-stars"
              class="block text-sm font-medium text-[var(--dash-text)] mb-1"
            >
              GitHub Stars
            </label>
            <input
              type="number"
              id="edit-stars"
              name="stars"
              bind:value={editStars}
              min="0"
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
              name="start_date"
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
              name="end_date"
              bind:value={editEndDate}
              class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
            />
          </div>
        </div>

        <div>
          <label
            for="edit-summary"
            class="block text-sm font-medium text-[var(--dash-text)] mb-1"
          >
            Summary
          </label>
          <textarea
            id="edit-summary"
            name="summary"
            bind:value={editSummary}
            rows={3}
            placeholder="Brief description of the project..."
            class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent resize-y"
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
              class="flex items-center gap-1 bg-[var(--dash-bg)] rounded-lg pl-3 pr-1 py-1"
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
            <div class="flex items-center gap-3">
              <input
                type="text"
                bind:value={editAchievements[index]}
                placeholder="Achievement description"
                class="flex-1 px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
              />
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

    <!-- Portfolio Images -->
    <div class="bg-[var(--dash-card)] rounded-lg border border-[var(--dash-border)] p-6">
      <h2 class="text-lg font-semibold text-[var(--dash-text)] mb-2">Portfolio Images</h2>
      <p class="text-sm text-[var(--dash-text-secondary)] mb-4">
        These images are used for your portfolio display. They are not required for job search or matching.
      </p>
      <div class="flex gap-6">
        <div class="max-w-xs">
          <MediaUpload
            entityType="side_project"
            entityId={project.id}
            field="image_path"
            currentUrl={imageUrl}
            label="Project Image"
            showHint={false}
            onUpload={(url) => (imageUrl = url)}
            onDelete={() => (imageUrl = null)}
          />
        </div>
        <div class="flex-1">
          <MediaUpload
            entityType="side_project"
            entityId={project.id}
            field="banner_path"
            currentUrl={bannerUrl}
            label="Project Banner"
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

    <!-- Actions -->
    <div class="flex justify-end gap-3">
      <a
        href="/dashboard/profile/side-projects"
        class="px-4 py-2 border border-[var(--dash-border)] rounded-lg text-[var(--dash-text)] hover:bg-[var(--dash-bg)] transition-colors"
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
