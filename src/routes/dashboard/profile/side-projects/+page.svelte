<script lang="ts">
  import type { ActionData, PageData } from "./$types";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faChevronDown,
    faChevronUp,
    faExternalLink,
    faLightbulb,
    faPencil,
    faStar,
    faTrash,
  } from "@fortawesome/free-solid-svg-icons";
  import SectionHeader from "../components/SectionHeader.svelte";
  import EmptyState from "../components/EmptyState.svelte";
  import DeleteConfirmModal from "../components/DeleteConfirmModal.svelte";
  import { getSideProjectImageUrl } from "$lib/utils/entity-media-url";

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let projects = $derived(data.projects);
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

  function formatDisplayDate(date: Date | string | null): string {
    if (!date) return "";
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    });
  }

  function toggleExpand(id: number) {
    expandedId = expandedId === id ? null : id;
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
          class="px-4 py-2 border border-[var(--dash-border)] rounded-lg text-[var(--dash-text)] hover:bg-[var(--dash-bg)] transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          class="px-4 py-2 bg-[var(--dash-primary)] text-white rounded-lg hover:bg-[var(--dash-primary-hover)] transition-colors"
        >
          Create & Edit Details
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
            onkeydown={(e) => e.key === "Enter" && toggleExpand(project.id)}
            class="w-full flex items-center justify-between p-4 hover:bg-[var(--dash-bg)] transition-colors text-left cursor-pointer"
          >
            <div class="flex items-center gap-4">
              {#if getSideProjectImageUrl(project)}
                <img
                  src={getSideProjectImageUrl(project)}
                  alt="{project.name} image"
                  class="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                />
              {:else}
                <div
                  class="w-12 h-12 rounded-lg bg-[var(--dash-bg)] flex items-center justify-center flex-shrink-0"
                >
                  <FontAwesomeIcon
                    icon={faLightbulb}
                    class="w-6 h-6 text-[var(--dash-primary)]"
                  />
                </div>
              {/if}
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
                    project.side_project_technologies.map((t) => t.name).join(", ") ||
                      "No technologies listed"
                  }
                </p>
                <p class="text-sm text-[var(--dash-text-secondary)]">
                  {formatDisplayDate(project.start_date) || "N/A"} - {
                    formatDisplayDate(project.end_date) || "Present"
                  }
                </p>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <a
                href="/dashboard/profile/side-projects/{project.id}"
                onclick={(e) => e.stopPropagation()}
                class="p-2 text-[var(--dash-text-secondary)] hover:text-[var(--dash-primary)] transition-colors"
                aria-label="Edit"
              >
                <FontAwesomeIcon icon={faPencil} class="w-4 h-4" />
              </a>
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
              <FontAwesomeIcon
                icon={expandedId === project.id ? faChevronUp : faChevronDown}
                class="w-4 h-4 text-[var(--dash-text-secondary)]"
              />
            </div>
          </div>

          <!-- Expanded Content -->
          {#if expandedId === project.id}
            <div class="border-t border-[var(--dash-border)] p-4 space-y-4">
              {#if project.summary}
                <p class="text-[var(--dash-text)] text-sm">{project.summary}</p>
              {/if}

              {#if project.url}
                <p class="text-sm">
                  <a
                    href={project.url}
                    target="_blank"
                    rel="noopener"
                    class="text-[var(--dash-primary)] hover:text-[var(--dash-primary-hover)] flex items-center gap-1"
                  >
                    {project.url_label || project.url}
                    <FontAwesomeIcon icon={faExternalLink} class="w-3 h-3" />
                  </a>
                </p>
              {/if}

              {#if project.side_project_achievements.length > 0}
                <div>
                  <p class="text-[var(--dash-text-secondary)] text-sm mb-1">Achievements:</p>
                  <ul class="list-disc list-inside text-[var(--dash-text)] text-sm space-y-1">
                    {#each project.side_project_achievements as achievement}
                      <li>{achievement.description}</li>
                    {/each}
                  </ul>
                </div>
              {/if}

              <a
                href="/dashboard/profile/side-projects/{project.id}"
                class="inline-flex items-center gap-2 text-[var(--dash-primary)] hover:text-[var(--dash-primary-hover)] text-sm"
              >
                <FontAwesomeIcon icon={faPencil} class="w-3 h-3" />
                Edit full details
              </a>
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
