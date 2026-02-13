<script lang="ts">
  import type { ActionData, PageData } from "./$types";
  import { enhance } from "$app/forms";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faCheck,
    faChevronDown,
    faChevronUp,
    faLightbulb,
    faPencil,
    faPlus,
    faStar,
    faTimes,
    faTrash,
  } from "@fortawesome/free-solid-svg-icons";
  import SectionHeader from "../components/SectionHeader.svelte";
  import EmptyState from "../components/EmptyState.svelte";
  import DeleteConfirmModal from "../components/DeleteConfirmModal.svelte";

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let projects = $derived(data.projects);
  let editingId = $state<number | null>(null);
  let expandedId = $state<number | null>(null);
  let showAddForm = $state(false);
  let deleteId = $state<number | null>(null);

  // Form states for new entry
  let newName = $state("");
  let newUrl = $state("");
  let newUrlLabel = $state("");
  let newSummary = $state("");
  let newStars = $state("");
  let newStartDate = $state("");
  let newEndDate = $state("");

  // Form states for editing
  let editName = $state("");
  let editUrl = $state("");
  let editUrlLabel = $state("");
  let editSummary = $state("");
  let editStars = $state("");
  let editStartDate = $state("");
  let editEndDate = $state("");
  let editAchievements = $state<string[]>([]);
  let editTechnologies = $state<string[]>([]);

  function formatDate(date: Date | string | null): string {
    if (!date) return "";
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toISOString().split("T")[0];
  }

  function formatDisplayDate(date: Date | string | null): string {
    if (!date) return "";
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    });
  }

  function startEdit(project: typeof projects[0]) {
    editingId = project.id;
    expandedId = project.id;
    editName = project.name || "";
    editUrl = project.url || "";
    editUrlLabel = project.url_label || "";
    editSummary = project.summary || "";
    editStars = project.stars?.toString() || "";
    editStartDate = formatDate(project.start_date);
    editEndDate = formatDate(project.end_date);
    editAchievements = project.side_project_achievements.map((a) =>
      a.description || ""
    );
    editTechnologies = project.side_project_technologies.map((t) =>
      t.name || ""
    );
  }

  function cancelEdit() {
    editingId = null;
  }

  function resetAddForm() {
    showAddForm = false;
    newName = "";
    newUrl = "";
    newUrlLabel = "";
    newSummary = "";
    newStars = "";
    newStartDate = "";
    newEndDate = "";
  }

  function handleAddSubmit() {
    return async (
      { result, update }: {
        result: { type: string };
        update: () => Promise<void>;
      },
    ) => {
      await update();
      if (result.type === "success") {
        resetAddForm();
      }
    };
  }

  function handleEditSubmit() {
    return async (
      { result, update }: {
        result: { type: string };
        update: () => Promise<void>;
      },
    ) => {
      await update();
      if (result.type === "success") {
        editingId = null;
      }
    };
  }

  function toggleExpand(id: number) {
    if (editingId === id) return;
    expandedId = expandedId === id ? null : id;
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
  <SectionHeader
    title="Side Projects"
    icon={faLightbulb}
    showAddButton={!showAddForm && projects.length > 0}
    addLabel="Add Project"
    onAdd={() => (showAddForm = true)}
  />

  {#if form?.error}
    <div class="bg-[var(--dash-error-light)] border border-[var(--dash-error)] rounded-lg p-4">
      <p class="text-[var(--dash-error)] text-sm">{form.error}</p>
    </div>
  {/if}

  <!-- Add Form -->
  {#if showAddForm}
    <form
      method="POST"
      action="?/create"
      use:enhance={handleAddSubmit}
      class="bg-[var(--dash-card)] rounded-lg border border-[var(--dash-primary)] p-4"
    >
      <h3 class="font-medium text-[var(--dash-text)] mb-4">Add New Side Project</h3>
      <div class="space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label
              for="new-name"
              class="block text-sm font-medium text-[var(--dash-text)] mb-1"
            >
              Project Name <span class="text-[var(--dash-error)]">*</span>
            </label>
            <input
              type="text"
              id="new-name"
              name="name"
              bind:value={newName}
              placeholder="e.g., Open Source Library"
              required
              class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
            />
          </div>

          <div>
            <label
              for="new-url"
              class="block text-sm font-medium text-[var(--dash-text)] mb-1"
            >
              URL
            </label>
            <input
              type="url"
              id="new-url"
              name="url"
              bind:value={newUrl}
              placeholder="https://github.com/user/project"
              class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
            />
          </div>

          <div>
            <label
              for="new-url-label"
              class="block text-sm font-medium text-[var(--dash-text)] mb-1"
            >
              URL Label
            </label>
            <input
              type="text"
              id="new-url-label"
              name="url_label"
              bind:value={newUrlLabel}
              placeholder="e.g., View on GitHub"
              class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
            />
          </div>

          <div>
            <label
              for="new-stars"
              class="block text-sm font-medium text-[var(--dash-text)] mb-1"
            >
              GitHub Stars
            </label>
            <input
              type="number"
              id="new-stars"
              name="stars"
              bind:value={newStars}
              placeholder="e.g., 150"
              min="0"
              class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
            />
          </div>

          <div>
            <label
              for="new-start-date"
              class="block text-sm font-medium text-[var(--dash-text)] mb-1"
            >
              Start Date
            </label>
            <input
              type="date"
              id="new-start-date"
              name="start_date"
              bind:value={newStartDate}
              class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
            />
          </div>

          <div>
            <label
              for="new-end-date"
              class="block text-sm font-medium text-[var(--dash-text)] mb-1"
            >
              End Date
            </label>
            <input
              type="date"
              id="new-end-date"
              name="end_date"
              bind:value={newEndDate}
              class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
            />
          </div>
        </div>

        <div>
          <label
            for="new-summary"
            class="block text-sm font-medium text-[var(--dash-text)] mb-1"
          >
            Summary
          </label>
          <textarea
            id="new-summary"
            name="summary"
            bind:value={newSummary}
            rows={3}
            placeholder="Brief description of the project..."
            class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent resize-y"
          ></textarea>
        </div>
      </div>

      <div class="flex justify-end gap-2 mt-4">
        <button
          type="button"
          onclick={resetAddForm}
          class="px-4 py-2 border border-[var(--dash-border)] rounded-lg text-[var(--dash-text)] hover:bg-gray-100 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          class="px-4 py-2 bg-[var(--dash-primary)] text-white rounded-lg hover:bg-[var(--dash-primary-hover)] transition-colors"
        >
          Add Project
        </button>
      </div>
    </form>
  {/if}

  <!-- Projects List -->
  {#if projects.length === 0 && !showAddForm}
    <EmptyState
      icon={faLightbulb}
      title="No side projects yet"
      description="Add your personal projects, open source contributions, and experiments to showcase your skills."
      actionLabel="Add First Project"
      onAction={() => (showAddForm = true)}
    />
  {:else}
    <div class="space-y-3">
      {#each projects as project (project.id)}
        <div class="bg-[var(--dash-card)] rounded-lg border border-[var(--dash-border)] overflow-hidden">
          <!-- Header -->
          <div
            role="button"
            tabindex="0"
            onclick={() => toggleExpand(project.id)}
            onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleExpand(project.id); } }}
            class="w-full flex items-center justify-between p-4 hover:bg-gray-100 transition-colors text-left cursor-pointer"
          >
            <div class="flex items-center gap-4">
              <div
                class="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0"
              >
                <FontAwesomeIcon
                  icon={faLightbulb}
                  class="w-5 h-5 text-[var(--dash-primary)]"
                />
              </div>
              <div>
                <h3 class="font-medium text-[var(--dash-text)]">
                  {project.name}
                  {#if project.stars}
                    <span class="text-amber-500 text-sm ml-2">
                      <FontAwesomeIcon icon={faStar} class="w-3 h-3" />
                      {project.stars}
                    </span>
                  {/if}
                </h3>
                <p class="text-sm text-[var(--dash-text-secondary)]">
                  {
                    project.side_project_technologies.map((t) =>
                      t.name
                    ).join(", ") || "No technologies listed"
                  }
                </p>
              </div>
            </div>

            <div class="flex items-center gap-2">
              {#if editingId !== project.id}
                <button
                  type="button"
                  onclick={(e) => {
                    e.stopPropagation();
                    startEdit(project);
                  }}
                  class="p-2 text-[var(--dash-text-secondary)] hover:text-[var(--dash-primary)] transition-colors"
                  aria-label="Edit"
                >
                  <FontAwesomeIcon icon={faPencil} class="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onclick={(e) => {
                    e.stopPropagation();
                    deleteId = project.id;
                  }}
                  class="p-2 text-[var(--dash-text-secondary)] hover:text-[var(--dash-error)] transition-colors"
                  aria-label="Delete"
                >
                  <FontAwesomeIcon icon={faTrash} class="w-4 h-4" />
                </button>
              {/if}
              <FontAwesomeIcon
                icon={expandedId === project.id
                  ? faChevronUp
                  : faChevronDown}
                class="w-4 h-4 text-[var(--dash-text-secondary)]"
              />
            </div>
          </div>

          <!-- Expanded Content -->
          {#if expandedId === project.id}
            <div class="border-t border-[var(--dash-border)] p-4">
              {#if editingId === project.id}
                <!-- Edit Mode -->
                <form
                  method="POST"
                  action="?/update"
                  use:enhance={handleEditSubmit}
                >
                  <input type="hidden" name="id" value={project.id} />
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

                  <div class="space-y-4">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label
                          for="edit-name-{project.id}"
                          class="block text-sm font-medium text-[var(--dash-text)] mb-1"
                        >
                          Project Name <span class="text-[var(--dash-error)]">*</span>
                        </label>
                        <input
                          type="text"
                          id="edit-name-{project.id}"
                          name="name"
                          bind:value={editName}
                          required
                          class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
                        />
                      </div>

                      <div>
                        <label
                          for="edit-url-{project.id}"
                          class="block text-sm font-medium text-[var(--dash-text)] mb-1"
                        >
                          URL
                        </label>
                        <input
                          type="url"
                          id="edit-url-{project.id}"
                          name="url"
                          bind:value={editUrl}
                          class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
                        />
                      </div>

                      <div>
                        <label
                          for="edit-url-label-{project.id}"
                          class="block text-sm font-medium text-[var(--dash-text)] mb-1"
                        >
                          URL Label
                        </label>
                        <input
                          type="text"
                          id="edit-url-label-{project.id}"
                          name="url_label"
                          bind:value={editUrlLabel}
                          class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
                        />
                      </div>

                      <div>
                        <label
                          for="edit-stars-{project.id}"
                          class="block text-sm font-medium text-[var(--dash-text)] mb-1"
                        >
                          GitHub Stars
                        </label>
                        <input
                          type="number"
                          id="edit-stars-{project.id}"
                          name="stars"
                          bind:value={editStars}
                          min="0"
                          class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
                        />
                      </div>

                      <div>
                        <label
                          for="edit-start-date-{project.id}"
                          class="block text-sm font-medium text-[var(--dash-text)] mb-1"
                        >
                          Start Date
                        </label>
                        <input
                          type="date"
                          id="edit-start-date-{project.id}"
                          name="start_date"
                          bind:value={editStartDate}
                          class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
                        />
                      </div>

                      <div>
                        <label
                          for="edit-end-date-{project.id}"
                          class="block text-sm font-medium text-[var(--dash-text)] mb-1"
                        >
                          End Date
                        </label>
                        <input
                          type="date"
                          id="edit-end-date-{project.id}"
                          name="end_date"
                          bind:value={editEndDate}
                          class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
                        />
                      </div>
                    </div>

                    <div>
                      <label
                        for="edit-summary-{project.id}"
                        class="block text-sm font-medium text-[var(--dash-text)] mb-1"
                      >
                        Summary
                      </label>
                      <textarea
                        id="edit-summary-{project.id}"
                        name="summary"
                        bind:value={editSummary}
                        rows={3}
                        class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent resize-y"
                      ></textarea>
                    </div>

                    <!-- Technologies -->
                    <div>
                      <div class="flex items-center justify-between mb-2">
                        <label class="block text-sm font-medium text-[var(--dash-text)]"
                        >Technologies</label>
                        <button
                          type="button"
                          onclick={addTechnology}
                          class="text-[var(--dash-primary)] hover:text-[var(--dash-primary-hover)] text-sm flex items-center gap-1"
                        >
                          <FontAwesomeIcon icon={faPlus} class="w-3 h-3" />
                          Add
                        </button>
                      </div>
                      <div class="space-y-2">
                        {#each editTechnologies as tech, index}
                          <div class="flex items-center gap-2">
                            <input
                              type="text"
                              bind:value={editTechnologies[index]}
                              placeholder="Technology name"
                              class="flex-1 px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
                            />
                            <button
                              type="button"
                              onclick={() => removeTechnology(index)}
                              class="p-2 text-[var(--dash-text-secondary)] hover:text-[var(--dash-error)] transition-colors"
                              aria-label="Remove"
                            >
                              <FontAwesomeIcon icon={faTimes} class="w-4 h-4" />
                            </button>
                          </div>
                        {/each}
                      </div>
                    </div>

                    <!-- Achievements -->
                    <div>
                      <div class="flex items-center justify-between mb-2">
                        <label class="block text-sm font-medium text-[var(--dash-text)]"
                        >Achievements</label>
                        <button
                          type="button"
                          onclick={addAchievement}
                          class="text-[var(--dash-primary)] hover:text-[var(--dash-primary-hover)] text-sm flex items-center gap-1"
                        >
                          <FontAwesomeIcon icon={faPlus} class="w-3 h-3" />
                          Add
                        </button>
                      </div>
                      <div class="space-y-2">
                        {#each editAchievements as achievement, index}
                          <div class="flex items-center gap-2">
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
                    </div>
                  </div>

                  <div class="flex justify-end gap-2 mt-4">
                    <button
                      type="button"
                      onclick={cancelEdit}
                      class="px-4 py-2 border border-[var(--dash-border)] rounded-lg text-[var(--dash-text)] hover:bg-gray-100 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      class="px-4 py-2 bg-[var(--dash-primary)] text-white rounded-lg hover:bg-[var(--dash-primary-hover)] transition-colors"
                    >
                      Save Changes
                    </button>
                  </div>
                </form>
              {:else}
                <!-- View Mode -->
                <div class="space-y-4 text-sm">
                  {#if project.summary}
                    <p class="text-[var(--dash-text)]">{project.summary}</p>
                  {/if}

                  {#if project.url}
                    <p>
                      <a
                        href={project.url}
                        target="_blank"
                        rel="noopener"
                        class="text-[var(--dash-primary)] hover:text-[var(--dash-primary-hover)]"
                      >
                        {project.url_label || project.url}
                      </a>
                    </p>
                  {/if}

                  {#if project.start_date || project.end_date}
                    <p>
                      <span class="text-[var(--dash-text-secondary)]">Period:</span>
                      <span class="text-[var(--dash-text)]">
                        {formatDisplayDate(project.start_date) || "N/A"} - {
                          formatDisplayDate(project.end_date) ||
                            "Present"
                        }
                      </span>
                    </p>
                  {/if}

                  {#if project.side_project_achievements.length > 0}
                    <div>
                      <p class="text-[var(--dash-text-secondary)] mb-1">Achievements:</p>
                      <ul class="list-disc list-inside text-[var(--dash-text)] space-y-1">
                        {#each project.side_project_achievements as achievement}
                          <li>{achievement.description}</li>
                        {/each}
                      </ul>
                    </div>
                  {/if}
                </div>
              {/if}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>

<!-- Delete Confirmation Modal -->
<DeleteConfirmModal
  isOpen={deleteId !== null}
  title="Delete Project"
  message="Are you sure you want to delete this project? All achievements and technologies will also be deleted. This action cannot be undone."
  onCancel={() => (deleteId = null)}
  onConfirm={() => {
    if (deleteId !== null) {
      const form = document.createElement("form");
      form.method = "POST";
      form.action = "?/delete";
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = "id";
      input.value = String(deleteId);
      form.appendChild(input);
      document.body.appendChild(form);
      form.submit();
    }
  }}
/>
