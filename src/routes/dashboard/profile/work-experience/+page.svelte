<script lang="ts">
  import type { ActionData, PageData } from "./$types";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faBriefcase,
    faChevronDown,
    faChevronUp,
    faExternalLink,
    faPencil,
    faPlus,
    faTrash,
  } from "@fortawesome/free-solid-svg-icons";
  import SectionHeader from "../components/SectionHeader.svelte";
  import EmptyState from "../components/EmptyState.svelte";
  import DeleteConfirmModal from "../components/DeleteConfirmModal.svelte";
  import { getWorkExperienceLogoUrl } from "$lib/utils/entity-media-url";

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let experiences = $derived(data.experiences);
  let expandedId = $state<number | null>(null);
  let showAddForm = $state(false);
  let deleteId = $state<number | null>(null);

  // Form states for new entry
  let newName = $state("");
  let newPosition = $state("");
  let newLocation = $state("");
  let newWebsite = $state("");
  let newDescription = $state("");
  let newSummary = $state("");
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
    newPosition = "";
    newLocation = "";
    newWebsite = "";
    newDescription = "";
    newSummary = "";
    newStartDate = "";
    newEndDate = "";
  }

</script>

<div class="space-y-6">
  <SectionHeader
    title="Work Experience"
    icon={faBriefcase}
    showAddButton={!showAddForm && experiences.length > 0}
    addLabel="Add Experience"
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
      <h3 class="font-medium text-[var(--dash-text)] mb-4">Add New Work Experience</h3>
      <div class="space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label
              for="new-name"
              class="block text-sm font-medium text-[var(--dash-text)] mb-1"
            >
              Company Name <span class="text-[var(--dash-error)]">*</span>
            </label>
            <input
              type="text"
              id="new-name"
              name="name"
              bind:value={newName}
              placeholder="e.g., Acme Corp"
              required
              class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
            />
          </div>

          <div>
            <label
              for="new-position"
              class="block text-sm font-medium text-[var(--dash-text)] mb-1"
            >
              Position <span class="text-[var(--dash-error)]">*</span>
            </label>
            <input
              type="text"
              id="new-position"
              name="position"
              bind:value={newPosition}
              placeholder="e.g., Senior Software Engineer"
              required
              class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
            />
          </div>

          <div>
            <label
              for="new-location"
              class="block text-sm font-medium text-[var(--dash-text)] mb-1"
            >
              Location
            </label>
            <input
              type="text"
              id="new-location"
              name="location"
              bind:value={newLocation}
              placeholder="e.g., San Francisco, CA"
              class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
            />
          </div>

          <div>
            <label
              for="new-website"
              class="block text-sm font-medium text-[var(--dash-text)] mb-1"
            >
              Website
            </label>
            <input
              type="url"
              id="new-website"
              name="website"
              bind:value={newWebsite}
              placeholder="https://company.com"
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
            for="new-description"
            class="block text-sm font-medium text-[var(--dash-text)] mb-1"
          >
            Description
          </label>
          <textarea
            id="new-description"
            name="description"
            bind:value={newDescription}
            rows={2}
            placeholder="Brief description of the company..."
            class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent resize-y"
          ></textarea>
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
            placeholder="Summary of your role and responsibilities..."
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

  <!-- Experiences List -->
  {#if experiences.length === 0 && !showAddForm}
    <EmptyState
      icon={faBriefcase}
      title="No work experience yet"
      description="Add your professional work history, including companies, positions, and achievements."
      actionLabel="Add First Experience"
      onAction={() => (showAddForm = true)}
    />
  {:else}
    <div class="space-y-3">
      {#each experiences as exp (exp.id)}
        <div class="bg-[var(--dash-card)] rounded-lg border border-[var(--dash-border)] overflow-hidden">
          <!-- Header -->
          <div
            role="button"
            tabindex="0"
            onclick={() => toggleExpand(exp.id)}
            onkeydown={(e) => e.key === "Enter" && toggleExpand(exp.id)}
            class="w-full flex items-center justify-between p-4 hover:bg-[var(--dash-bg)] transition-colors text-left cursor-pointer"
          >
            <div class="flex items-center gap-4">
              {#if getWorkExperienceLogoUrl(exp)}
                <img
                  src={getWorkExperienceLogoUrl(exp)}
                  alt="{exp.name} logo"
                  class="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                />
              {:else}
                <div
                  class="w-12 h-12 rounded-lg bg-[var(--dash-bg)] flex items-center justify-center flex-shrink-0"
                >
                  <FontAwesomeIcon
                    icon={faBriefcase}
                    class="w-6 h-6 text-[var(--dash-primary)]"
                  />
                </div>
              {/if}
              <div>
                <h3 class="font-medium text-[var(--dash-text)]">{exp.position}</h3>
                <p class="text-sm text-[var(--dash-text-secondary)]">
                  {exp.name}
                  {#if exp.location}
                    <span class="mx-1">•</span> {exp.location}
                  {/if}
                </p>
                <p class="text-sm text-[var(--dash-text-secondary)]">
                  {formatDisplayDate(exp.start_date) || "N/A"} - {
                    formatDisplayDate(exp.end_date) || "Present"
                  }
                </p>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <a
                href="/dashboard/profile/work-experience/{exp.id}"
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
                  deleteId = exp.id;
                }}
                class="p-2 text-[var(--dash-text-secondary)] hover:text-[var(--dash-error)] transition-colors"
                aria-label="Delete"
              >
                <FontAwesomeIcon icon={faTrash} class="w-4 h-4" />
              </button>
              <FontAwesomeIcon
                icon={expandedId === exp.id ? faChevronUp : faChevronDown}
                class="w-4 h-4 text-[var(--dash-text-secondary)]"
              />
            </div>
          </div>

          <!-- Expanded Content -->
          {#if expandedId === exp.id}
            <div class="border-t border-[var(--dash-border)] p-4 space-y-4">
              {#if exp.summary}
                <p class="text-[var(--dash-text)] text-sm">{exp.summary}</p>
              {/if}

              {#if exp.website}
                <p class="text-sm">
                  <a
                    href={exp.website}
                    target="_blank"
                    rel="noopener"
                    class="text-[var(--dash-primary)] hover:text-[var(--dash-primary-hover)] flex items-center gap-1"
                  >
                    {exp.website}
                    <FontAwesomeIcon icon={faExternalLink} class="w-3 h-3" />
                  </a>
                </p>
              {/if}

              {#if exp.work_experience_technologies.length > 0}
                <div>
                  <p class="text-[var(--dash-text-secondary)] text-sm mb-2">Technologies:</p>
                  <div class="flex flex-wrap gap-2">
                    {#each exp.work_experience_technologies as tech}
                      <span
                        class="px-2 py-1 bg-[var(--dash-bg)] text-[var(--dash-text)] text-sm rounded"
                      >{tech.name}</span>
                    {/each}
                  </div>
                </div>
              {/if}

              {#if exp.work_experience_achievements.length > 0}
                <div>
                  <p class="text-[var(--dash-text-secondary)] text-sm mb-2">Achievements:</p>
                  <ul
                    class="list-disc list-inside text-[var(--dash-text)] text-sm space-y-1"
                  >
                    {#each exp.work_experience_achievements as achievement}
                      <li>
                        {#if achievement.title}
                          <span class="font-medium">{achievement.title}</span>
                          {#if achievement.description}
                            - {achievement.description}{/if}
                        {:else}
                          {achievement.description}
                        {/if}
                      </li>
                    {/each}
                  </ul>
                </div>
              {/if}

              <a
                href="/dashboard/profile/work-experience/{exp.id}"
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
  title="Delete Work Experience"
  message="Are you sure you want to delete this work experience? All achievements and technologies will also be deleted. This action cannot be undone."
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
