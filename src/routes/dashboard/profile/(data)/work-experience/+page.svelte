<script lang="ts">
  import type { ActionData, PageData } from "./$types";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faArrowRight,
    faBriefcase,
    faExternalLink,
  } from "@fortawesome/free-solid-svg-icons";
  import SectionHeader from "../../components/SectionHeader.svelte";
  import EmptyState from "../../components/EmptyState.svelte";
  import ItemCard from "../../components/ItemCard.svelte";
  import { getWorkExperienceLogoUrl } from "$lib/utils/entity-media-url";

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let experiences = $derived(data.experiences);
  let expandedId = $state<number | null>(null);
  let showAddForm = $state(false);

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
        <ItemCard
          id={exp.id}
          {expandedId}
          onToggle={toggleExpand}
          icon={faBriefcase}
          imageUrl={getWorkExperienceLogoUrl(exp)}
          imageAlt="{exp.name} logo"
        >
          {#snippet title()}
            {exp.position}
          {/snippet}

          {#snippet subtitle()}
            <span class="truncate max-w-[150px] sm:max-w-none">{exp.name}</span>
            {#if exp.location}
              <span class="text-[var(--dash-text-muted)]">•</span>
              <span class="truncate max-w-[100px] sm:max-w-none">{exp.location}</span>
            {/if}
          {/snippet}

          {#snippet dateline()}
            {formatDisplayDate(exp.start_date) || "N/A"} – {formatDisplayDate(exp.end_date) || "Present"}
          {/snippet}

          {#snippet expandedContent()}
            <!-- Website link in top right -->
            {#if exp.website}
              <a
                href={exp.website}
                target="_blank"
                rel="noopener"
                class="absolute top-3 right-3 px-3 py-1.5 text-xs bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-lg text-[var(--dash-text)] hover:bg-[var(--dash-border)] transition-colors flex items-center gap-1.5"
              >
                Website
                <FontAwesomeIcon icon={faExternalLink} class="w-3 h-3" />
              </a>
            {/if}

            {#if exp.summary}
              <div>
                <p class="text-xs text-[var(--dash-text-secondary)] uppercase tracking-wide mb-1">Summary</p>
                <p class="text-sm text-[var(--dash-text)]">{exp.summary}</p>
              </div>
            {/if}

            {#if exp.work_experience_technologies.length > 0}
              <div>
                <p class="text-xs text-[var(--dash-text-secondary)] uppercase tracking-wide mb-2">Technologies</p>
                <div class="flex flex-wrap gap-1">
                  {#each exp.work_experience_technologies as tech}
                    <span class="px-2 py-1 text-xs bg-[var(--dash-bg)] text-[var(--dash-text)] rounded">{tech.name}</span>
                  {/each}
                </div>
              </div>
            {/if}

            {#if exp.work_experience_achievements.length > 0}
              <div>
                <p class="text-xs text-[var(--dash-text-secondary)] uppercase tracking-wide mb-2">Achievements</p>
                <ul class="text-sm text-[var(--dash-text)] space-y-1">
                  {#each exp.work_experience_achievements as achievement}
                    <li class="flex items-start gap-2">
                      <span class="text-[var(--dash-primary)] mt-1">•</span>
                      <span>
                        {#if achievement.title}
                          <span class="font-medium">{achievement.title}</span>
                          {#if achievement.description} – {achievement.description}{/if}
                        {:else}
                          {achievement.description}
                        {/if}
                      </span>
                    </li>
                  {/each}
                </ul>
              </div>
            {/if}

          {/snippet}

          {#snippet footer()}
            <a
              href="/dashboard/profile/work-experience/{exp.id}"
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
