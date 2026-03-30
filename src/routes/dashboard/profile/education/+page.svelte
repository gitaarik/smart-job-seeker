<script lang="ts">
  import type { ActionData, PageData } from "./$types";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faArrowRight,
    faExternalLink,
    faGraduationCap,
  } from "@fortawesome/free-solid-svg-icons";
  import SectionHeader from "../components/SectionHeader.svelte";
  import EmptyState from "../components/EmptyState.svelte";
  import ItemCard from "../components/ItemCard.svelte";
  import { getEducationLogoUrl } from "$lib/utils/entity-media-url";

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let education = $derived(data.education);
  let expandedId = $state<number | null>(null);
  let showAddForm = $state(false);

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
        <ItemCard
          id={edu.id}
          {expandedId}
          onToggle={toggleExpand}
          icon={faGraduationCap}
          imageUrl={getEducationLogoUrl(edu)}
          imageAlt="{edu.institution} logo"
        >
          {#snippet title()}
            {edu.institution}
          {/snippet}

          {#snippet subtitle()}
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
          {/snippet}

          {#snippet dateline()}
            {formatDisplayDate(edu.start_date) || "N/A"} – {formatDisplayDate(edu.end_date) || "Present"}
          {/snippet}

          {#snippet expandedContent()}
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
          {/snippet}

          {#snippet footer()}
            <a
              href="/dashboard/profile/education/{edu.id}"
              class="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-[var(--dash-primary)] text-white hover:bg-[var(--dash-primary-hover)] transition-colors whitespace-nowrap"
            >
              Open
              <FontAwesomeIcon icon={faArrowRight} class="w-3 h-3" />
            </a>
          {/snippet}
        </ItemCard>
      {/each}
    </div>
  {/if}
</div>

