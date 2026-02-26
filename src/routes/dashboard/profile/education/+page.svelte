<script lang="ts">
  import type { ActionData, PageData } from "./$types";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faChevronDown,
    faChevronUp,
    faExternalLink,
    faGraduationCap,
    faPencil,
    faTrash,
  } from "@fortawesome/free-solid-svg-icons";
  import SectionHeader from "../components/SectionHeader.svelte";
  import EmptyState from "../components/EmptyState.svelte";
  import DeleteConfirmModal from "../components/DeleteConfirmModal.svelte";
  import { getEducationLogoUrl } from "$lib/utils/entity-media-url";

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let education = $derived(data.education);
  let expandedId = $state<number | null>(null);
  let showAddForm = $state(false);
  let deleteId = $state<number | null>(null);

  // Form states for new entry
  let newInstitution = $state("");
  let newArea = $state("");
  let newStudyType = $state("");
  let newLocation = $state("");
  let newUrl = $state("");
  let newGraduationYear = $state("");
  let newStartDate = $state("");
  let newEndDate = $state("");
  let newSummary = $state("");

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
    newInstitution = "";
    newArea = "";
    newStudyType = "";
    newLocation = "";
    newUrl = "";
    newGraduationYear = "";
    newStartDate = "";
    newEndDate = "";
    newSummary = "";
  }
</script>

<div class="space-y-6">
  <SectionHeader
    title="Education"
    icon={faGraduationCap}
    showAddButton={!showAddForm && education.length > 0}
    addLabel="Add Education"
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
      <h3 class="font-medium text-[var(--dash-text)] mb-4">Add New Education</h3>
      <div class="space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label
              for="new-institution"
              class="block text-sm font-medium text-[var(--dash-text)] mb-1"
            >
              Institution <span class="text-[var(--dash-error)]">*</span>
            </label>
            <input
              type="text"
              id="new-institution"
              name="institution"
              bind:value={newInstitution}
              placeholder="e.g., University of Technology"
              required
              class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
            />
          </div>

          <div>
            <label
              for="new-area"
              class="block text-sm font-medium text-[var(--dash-text)] mb-1"
            >
              Field of Study
            </label>
            <input
              type="text"
              id="new-area"
              name="area"
              bind:value={newArea}
              placeholder="e.g., Computer Science"
              class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
            />
          </div>

          <div>
            <label
              for="new-study-type"
              class="block text-sm font-medium text-[var(--dash-text)] mb-1"
            >
              Degree Type
            </label>
            <input
              type="text"
              id="new-study-type"
              name="study_type"
              bind:value={newStudyType}
              placeholder="e.g., Bachelor's, Master's, PhD"
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
              placeholder="e.g., Boston, MA"
              class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
            />
          </div>

          <div>
            <label
              for="new-url"
              class="block text-sm font-medium text-[var(--dash-text)] mb-1"
            >
              Website URL
            </label>
            <input
              type="url"
              id="new-url"
              name="url"
              bind:value={newUrl}
              placeholder="https://university.edu"
              class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
            />
          </div>

          <div>
            <label
              for="new-graduation-year"
              class="block text-sm font-medium text-[var(--dash-text)] mb-1"
            >
              Graduation Year
            </label>
            <input
              type="number"
              id="new-graduation-year"
              name="graduation_year"
              bind:value={newGraduationYear}
              placeholder="e.g., 2020"
              min="1950"
              max="2100"
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
            placeholder="Brief description of your studies, achievements, etc."
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

  <!-- Education List -->
  {#if education.length === 0 && !showAddForm}
    <EmptyState
      icon={faGraduationCap}
      title="No education entries yet"
      description="Add your educational background, degrees, and academic achievements."
      actionLabel="Add First Education"
      onAction={() => (showAddForm = true)}
    />
  {:else}
    <div class="space-y-3">
      {#each education as edu (edu.id)}
        <div class="bg-[var(--dash-card)] rounded-lg border border-[var(--dash-border)] overflow-hidden relative transition-all">
          <!-- Chevron in top right corner -->
          <button
            type="button"
            onclick={(e) => {
              e.stopPropagation();
              toggleExpand(edu.id);
            }}
            class="absolute top-3 right-3 p-1.5 text-[var(--dash-text-secondary)] hover:text-[var(--dash-primary)] transition-colors z-10"
            aria-label={expandedId === edu.id ? "Collapse" : "Expand"}
          >
            <FontAwesomeIcon
              icon={expandedId === edu.id ? faChevronUp : faChevronDown}
              class="w-4 h-4"
            />
          </button>

          <!-- Header -->
          <div class="p-3 sm:p-4 hover:bg-[var(--dash-bg)] transition-colors">
            <div class="flex items-start gap-3">
              <!-- Desktop: Logo on the left -->
              <div class="hidden md:flex flex-shrink-0">
                {#if getEducationLogoUrl(edu)}
                  <img
                    src={getEducationLogoUrl(edu)}
                    alt="{edu.institution} logo"
                    class="w-12 h-12 rounded-lg object-cover"
                  />
                {:else}
                  <div class="w-12 h-12 rounded-lg bg-[var(--dash-bg)] flex items-center justify-center">
                    <FontAwesomeIcon icon={faGraduationCap} class="w-6 h-6 text-[var(--dash-primary)]" />
                  </div>
                {/if}
              </div>

              <!-- Clickable area for expand/collapse -->
              <button
                type="button"
                onclick={() => toggleExpand(edu.id)}
                class="flex items-start gap-3 flex-1 min-w-0 text-left"
              >
                <div class="flex-1 min-w-0">
                  <!-- Institution -->
                  <h3 class="font-medium text-[var(--dash-text)] text-sm sm:text-base line-clamp-2 sm:truncate pr-8">
                    {edu.institution}
                  </h3>

                  <!-- Degree and field -->
                  <div class="flex items-center gap-2 sm:gap-3 mt-1 text-xs sm:text-sm text-[var(--dash-text-secondary)] flex-wrap">
                    {#if edu.study_type}
                      <span class="truncate max-w-[150px] sm:max-w-none">{edu.study_type}</span>
                    {/if}
                    {#if edu.study_type && edu.area}
                      <span class="text-[var(--dash-text-muted)]">in</span>
                    {/if}
                    {#if edu.area}
                      <span class="truncate max-w-[150px] sm:max-w-none">{edu.area}</span>
                    {/if}
                    {#if edu.graduation_year}
                      <span class="text-[var(--dash-text-muted)]">({edu.graduation_year})</span>
                    {/if}
                  </div>

                  <!-- Dates -->
                  <div class="mt-1.5 sm:mt-2 text-xs sm:text-sm text-[var(--dash-text-muted)]">
                    {formatDisplayDate(edu.start_date) || "N/A"} – {formatDisplayDate(edu.end_date) || "Present"}
                  </div>
                </div>
              </button>

              <!-- Mobile: Logo on the right, below chevron -->
              <div class="flex-shrink-0 md:hidden flex flex-col items-end">
                <div class="h-6 mb-1"></div> <!-- Spacer for chevron -->
                <button
                  type="button"
                  onclick={() => toggleExpand(edu.id)}
                >
                  {#if getEducationLogoUrl(edu)}
                    <img
                      src={getEducationLogoUrl(edu)}
                      alt="{edu.institution} logo"
                      class="w-12 h-12 rounded-lg object-cover"
                    />
                  {:else}
                    <div class="w-12 h-12 rounded-lg bg-[var(--dash-bg)] flex items-center justify-center">
                      <FontAwesomeIcon icon={faGraduationCap} class="w-6 h-6 text-[var(--dash-primary)]" />
                    </div>
                  {/if}
                </button>
              </div>
            </div>
          </div>

          <!-- Expanded Content -->
          {#if expandedId === edu.id}
            <div class="border-t border-[var(--dash-border)] p-3 sm:p-4 space-y-3 sm:space-y-4 relative">
              <!-- Website link in top right -->
              {#if edu.url}
                <a
                  href={edu.url}
                  target="_blank"
                  rel="noopener"
                  class="absolute top-3 right-3 px-3 py-1.5 text-xs bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-lg text-[var(--dash-text)] hover:bg-[var(--dash-border)] transition-colors flex items-center gap-1.5"
                >
                  Website
                  <FontAwesomeIcon icon={faExternalLink} class="w-3 h-3" />
                </a>
              {/if}

              {#if edu.location}
                <div>
                  <p class="text-xs text-[var(--dash-text-secondary)] uppercase tracking-wide mb-1">Location</p>
                  <p class="text-sm text-[var(--dash-text)]">{edu.location}</p>
                </div>
              {/if}

              {#if edu.summary}
                <div>
                  <p class="text-xs text-[var(--dash-text-secondary)] uppercase tracking-wide mb-1">Summary</p>
                  <p class="text-sm text-[var(--dash-text)]">{edu.summary}</p>
                </div>
              {/if}
            </div>
          {/if}

          <!-- Footer with action buttons -->
          <div class="border-t border-[var(--dash-border)] px-3 py-2 sm:px-4 flex justify-end md:justify-start items-center gap-2">
            <button
              type="button"
              onclick={() => deleteId = edu.id}
              class="px-3 py-1.5 text-xs bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-lg text-[var(--dash-text)] hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-500 transition-colors flex items-center gap-1.5 whitespace-nowrap"
            >
              <FontAwesomeIcon icon={faTrash} class="w-3 h-3" />
              Delete
            </button>
            <a
              href="/dashboard/profile/education/{edu.id}"
              class="px-3 py-1.5 text-xs bg-blue-500/10 border border-blue-500/30 rounded-lg text-blue-500 hover:bg-blue-500/20 hover:border-blue-500/50 transition-colors flex items-center gap-1.5 whitespace-nowrap"
            >
              <FontAwesomeIcon icon={faPencil} class="w-3 h-3" />
              Edit
            </a>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<!-- Delete Confirmation Modal -->
<DeleteConfirmModal
  isOpen={deleteId !== null}
  title="Delete Education"
  message="Are you sure you want to delete this education entry? This action cannot be undone."
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
