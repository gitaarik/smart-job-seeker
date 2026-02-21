<script lang="ts">
  import type { ActionData, PageData } from "./$types";
  import { enhance } from "$app/forms";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faCheck,
    faChevronDown,
    faChevronUp,
    faGraduationCap,
    faPencil,
    faTimes,
    faTrash,
  } from "@fortawesome/free-solid-svg-icons";
  import SectionHeader from "../components/SectionHeader.svelte";
  import EmptyState from "../components/EmptyState.svelte";
  import DeleteConfirmModal from "../components/DeleteConfirmModal.svelte";
  import MediaUpload from "$lib/components/MediaUpload.svelte";
  import { getEducationLogoUrl } from "$lib/utils/entity-media-url";

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let education = $derived(data.education);
  let editingId = $state<number | null>(null);
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

  // Form states for editing
  let editInstitution = $state("");
  let editArea = $state("");
  let editStudyType = $state("");
  let editLocation = $state("");
  let editUrl = $state("");
  let editGraduationYear = $state("");
  let editStartDate = $state("");
  let editEndDate = $state("");
  let editSummary = $state("");
  let editLogoUrl = $state<string | null>(null);

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

  function startEdit(edu: typeof education[0]) {
    editingId = edu.id;
    expandedId = edu.id;
    editInstitution = edu.institution || "";
    editArea = edu.area || "";
    editStudyType = edu.study_type || "";
    editLocation = edu.location || "";
    editUrl = edu.url || "";
    editGraduationYear = edu.graduation_year?.toString() || "";
    editStartDate = formatDate(edu.start_date);
    editEndDate = formatDate(edu.end_date);
    editSummary = edu.summary || "";
    editLogoUrl = getEducationLogoUrl(edu);
  }

  function cancelEdit() {
    editingId = null;
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
      use:enhance={handleAddSubmit}
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
          Add Education
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
        <div class="bg-[var(--dash-card)] rounded-lg border border-[var(--dash-border)] overflow-hidden">
          <!-- Header (clickable to expand) -->
          <div
            role="button"
            tabindex="0"
            onclick={() => toggleExpand(edu.id)}
            onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleExpand(edu.id); } }}
            class="w-full flex items-center justify-between p-4 hover:bg-[var(--dash-bg)] transition-colors text-left cursor-pointer"
          >
            <div class="flex items-center gap-4">
              {#if getEducationLogoUrl(edu)}
                <img
                  src={getEducationLogoUrl(edu)}
                  alt="{edu.institution} logo"
                  class="w-10 h-10 rounded-full object-cover flex-shrink-0"
                />
              {:else}
                <div
                  class="w-10 h-10 rounded-full bg-[var(--dash-bg)] flex items-center justify-center flex-shrink-0"
                >
                  <FontAwesomeIcon
                    icon={faGraduationCap}
                    class="w-5 h-5 text-[var(--dash-primary)]"
                  />
                </div>
              {/if}
              <div>
                <h3 class="font-medium text-[var(--dash-text)]">{edu.institution}</h3>
                <p class="text-sm text-[var(--dash-text-secondary)]">
                  {#if edu.study_type}{edu.study_type}{/if}
                  {#if edu.study_type && edu.area}
                    in
                  {/if}
                  {#if edu.area}{edu.area}{/if}
                  {#if edu.graduation_year}
                    <span class="text-[var(--dash-text-secondary)]"> ({edu.graduation_year})</span>
                  {/if}
                </p>
              </div>
            </div>

            <div class="flex items-center gap-2">
              {#if editingId !== edu.id}
                <button
                  type="button"
                  onclick={(e) => {
                    e.stopPropagation();
                    startEdit(edu);
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
                    deleteId = edu.id;
                  }}
                  class="p-2 text-[var(--dash-text-secondary)] hover:text-[var(--dash-error)] transition-colors"
                  aria-label="Delete"
                >
                  <FontAwesomeIcon icon={faTrash} class="w-4 h-4" />
                </button>
              {/if}
              <FontAwesomeIcon
                icon={expandedId === edu.id ? faChevronUp : faChevronDown}
                class="w-4 h-4 text-[var(--dash-text-secondary)]"
              />
            </div>
          </div>

          <!-- Expanded Content -->
          {#if expandedId === edu.id}
            <div class="border-t border-[var(--dash-border)] p-4">
              {#if editingId === edu.id}
                <!-- Edit Mode -->
                <form
                  method="POST"
                  action="?/update"
                  use:enhance={handleEditSubmit}
                >
                  <input type="hidden" name="id" value={edu.id} />
                  <div class="space-y-4">
                    <!-- Institution Logo -->
                    <div class="max-w-xs">
                      <MediaUpload
                        entityType="education"
                        entityId={edu.id}
                        field="logo_path"
                        currentUrl={editLogoUrl}
                        label="Institution Logo"
                        onUpload={(url) => (editLogoUrl = url)}
                        onDelete={() => (editLogoUrl = null)}
                      />
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label
                          for="edit-institution-{edu.id}"
                          class="block text-sm font-medium text-[var(--dash-text)] mb-1"
                        >
                          Institution <span class="text-[var(--dash-error)]">*</span>
                        </label>
                        <input
                          type="text"
                          id="edit-institution-{edu.id}"
                          name="institution"
                          bind:value={editInstitution}
                          required
                          class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
                        />
                      </div>

                      <div>
                        <label
                          for="edit-area-{edu.id}"
                          class="block text-sm font-medium text-[var(--dash-text)] mb-1"
                        >
                          Field of Study
                        </label>
                        <input
                          type="text"
                          id="edit-area-{edu.id}"
                          name="area"
                          bind:value={editArea}
                          class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
                        />
                      </div>

                      <div>
                        <label
                          for="edit-study-type-{edu.id}"
                          class="block text-sm font-medium text-[var(--dash-text)] mb-1"
                        >
                          Degree Type
                        </label>
                        <input
                          type="text"
                          id="edit-study-type-{edu.id}"
                          name="study_type"
                          bind:value={editStudyType}
                          class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
                        />
                      </div>

                      <div>
                        <label
                          for="edit-location-{edu.id}"
                          class="block text-sm font-medium text-[var(--dash-text)] mb-1"
                        >
                          Location
                        </label>
                        <input
                          type="text"
                          id="edit-location-{edu.id}"
                          name="location"
                          bind:value={editLocation}
                          class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
                        />
                      </div>

                      <div>
                        <label
                          for="edit-url-{edu.id}"
                          class="block text-sm font-medium text-[var(--dash-text)] mb-1"
                        >
                          Website URL
                        </label>
                        <input
                          type="url"
                          id="edit-url-{edu.id}"
                          name="url"
                          bind:value={editUrl}
                          class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
                        />
                      </div>

                      <div>
                        <label
                          for="edit-graduation-year-{edu.id}"
                          class="block text-sm font-medium text-[var(--dash-text)] mb-1"
                        >
                          Graduation Year
                        </label>
                        <input
                          type="number"
                          id="edit-graduation-year-{edu.id}"
                          name="graduation_year"
                          bind:value={editGraduationYear}
                          min="1950"
                          max="2100"
                          class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
                        />
                      </div>

                      <div>
                        <label
                          for="edit-start-date-{edu.id}"
                          class="block text-sm font-medium text-[var(--dash-text)] mb-1"
                        >
                          Start Date
                        </label>
                        <input
                          type="date"
                          id="edit-start-date-{edu.id}"
                          name="start_date"
                          bind:value={editStartDate}
                          class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
                        />
                      </div>

                      <div>
                        <label
                          for="edit-end-date-{edu.id}"
                          class="block text-sm font-medium text-[var(--dash-text)] mb-1"
                        >
                          End Date
                        </label>
                        <input
                          type="date"
                          id="edit-end-date-{edu.id}"
                          name="end_date"
                          bind:value={editEndDate}
                          class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
                        />
                      </div>
                    </div>

                    <div>
                      <label
                        for="edit-summary-{edu.id}"
                        class="block text-sm font-medium text-[var(--dash-text)] mb-1"
                      >
                        Summary
                      </label>
                      <textarea
                        id="edit-summary-{edu.id}"
                        name="summary"
                        bind:value={editSummary}
                        rows={3}
                        class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent resize-y"
                      ></textarea>
                    </div>
                  </div>

                  <div class="flex justify-end gap-2 mt-4">
                    <button
                      type="button"
                      onclick={cancelEdit}
                      class="px-4 py-2 border border-[var(--dash-border)] rounded-lg text-[var(--dash-text)] hover:bg-[var(--dash-bg)] transition-colors"
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
                <div class="space-y-3 text-sm">
                  {#if edu.location}
                    <p>
                      <span class="text-[var(--dash-text-secondary)]">Location:</span> <span
                        class="text-[var(--dash-text)]"
                      >{edu.location}</span>
                    </p>
                  {/if}
                  {#if edu.start_date || edu.end_date}
                    <p>
                      <span class="text-[var(--dash-text-secondary)]">Period:</span>
                      <span class="text-[var(--dash-text)]">
                        {formatDisplayDate(edu.start_date) || "N/A"} - {
                          formatDisplayDate(edu.end_date) || "Present"
                        }
                      </span>
                    </p>
                  {/if}
                  {#if edu.url}
                    <p>
                      <span class="text-[var(--dash-text-secondary)]">Website:</span>
                      <a
                        href={edu.url}
                        target="_blank"
                        rel="noopener"
                        class="text-[var(--dash-primary)] hover:text-[var(--dash-primary-hover)]"
                      >{edu.url}</a>
                    </p>
                  {/if}
                  {#if edu.summary}
                    <p class="text-[var(--dash-text)]">{edu.summary}</p>
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
