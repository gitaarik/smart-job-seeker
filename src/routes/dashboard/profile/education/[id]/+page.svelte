<script lang="ts">
  import type { ActionData, PageData } from "./$types";
  import { enhance } from "$app/forms";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faArrowLeft,
    faGraduationCap,
  } from "@fortawesome/free-solid-svg-icons";
  import MediaUpload from "$lib/components/MediaUpload.svelte";

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let logoUrl = $state(data.logoUrl);
  let bannerUrl = $state(data.bannerUrl);

  let education = $derived(data.education);
  let saving = $state(false);
  let showSuccess = $state(false);

  // Form states
  let editInstitution = $state(education.institution || "");
  let editArea = $state(education.area || "");
  let editStudyType = $state(education.study_type || "");
  let editLocation = $state(education.location || "");
  let editUrl = $state(education.url || "");
  let editGraduationYear = $state(education.graduation_year?.toString() || "");
  let editStartDate = $state(formatDate(education.start_date));
  let editEndDate = $state(formatDate(education.end_date));
  let editSummary = $state(education.summary || "");

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
</script>

<div class="space-y-6">
  <!-- Header -->
  <div class="flex items-center gap-4">
    <a
      href="/dashboard/profile/education"
      class="flex items-center gap-2 text-[var(--dash-text-secondary)] hover:text-[var(--dash-primary)] transition-colors"
    >
      <FontAwesomeIcon icon={faArrowLeft} class="w-4 h-4" />
      <span class="text-sm">Back to Education</span>
    </a>
  </div>

  <div class="flex items-center gap-4">
    {#if logoUrl}
      <img
        src={logoUrl}
        alt="{education.institution} logo"
        class="w-12 h-12 rounded-lg object-cover"
      />
    {:else}
      <div
        class="w-12 h-12 rounded-lg bg-[var(--dash-bg)] flex items-center justify-center"
      >
        <FontAwesomeIcon icon={faGraduationCap} class="w-6 h-6 text-[var(--dash-primary)]" />
      </div>
    {/if}
    <div>
      <h1 class="text-2xl font-bold text-[var(--dash-text)]">Edit Education</h1>
      <p class="text-[var(--dash-text-secondary)]">
        {education.institution}
        {#if education.area} - {education.area}{/if}
      </p>
    </div>
  </div>

  {#if form?.error}
    <div class="bg-[var(--dash-error-light)] border border-[var(--dash-error)] rounded-lg p-4">
      <p class="text-[var(--dash-error)] text-sm">{form.error}</p>
    </div>
  {/if}

  {#if showSuccess}
    <div class="bg-[var(--dash-success-light)] border border-[var(--dash-success)] rounded-lg p-4">
      <p class="text-[var(--dash-success)] text-sm">Education updated successfully!</p>
    </div>
  {/if}

  <form
    method="POST"
    action="?/update"
    use:enhance={handleSubmit}
    class="space-y-6"
  >
    <!-- Basic Info -->
    <div class="bg-[var(--dash-card)] rounded-lg border border-[var(--dash-border)] p-6">
      <h2 class="text-lg font-semibold text-[var(--dash-text)] mb-4">Basic Information</h2>
      <div class="space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label
              for="edit-institution"
              class="block text-sm font-medium text-[var(--dash-text)] mb-1"
            >
              Institution <span class="text-[var(--dash-error)]">*</span>
            </label>
            <input
              type="text"
              id="edit-institution"
              name="institution"
              bind:value={editInstitution}
              required
              class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
            />
          </div>

          <div>
            <label
              for="edit-area"
              class="block text-sm font-medium text-[var(--dash-text)] mb-1"
            >
              Field of Study
            </label>
            <input
              type="text"
              id="edit-area"
              name="area"
              bind:value={editArea}
              class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
            />
          </div>

          <div>
            <label
              for="edit-study-type"
              class="block text-sm font-medium text-[var(--dash-text)] mb-1"
            >
              Degree Type
            </label>
            <input
              type="text"
              id="edit-study-type"
              name="study_type"
              bind:value={editStudyType}
              placeholder="e.g., Bachelor's, Master's, PhD"
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
              name="location"
              bind:value={editLocation}
              class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
            />
          </div>

          <div>
            <label
              for="edit-url"
              class="block text-sm font-medium text-[var(--dash-text)] mb-1"
            >
              Website URL
            </label>
            <input
              type="url"
              id="edit-url"
              name="url"
              bind:value={editUrl}
              class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
            />
          </div>

          <div>
            <label
              for="edit-graduation-year"
              class="block text-sm font-medium text-[var(--dash-text)] mb-1"
            >
              Graduation Year
            </label>
            <input
              type="number"
              id="edit-graduation-year"
              name="graduation_year"
              bind:value={editGraduationYear}
              min="1950"
              max="2100"
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
            placeholder="Brief description of your studies, achievements, etc."
            class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent resize-y"
          ></textarea>
        </div>
      </div>
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
            entityType="education"
            entityId={education.id}
            field="logo_path"
            currentUrl={logoUrl}
            label="Institution Logo"
            showHint={false}
            onUpload={(url) => (logoUrl = url)}
            onDelete={() => (logoUrl = null)}
          />
        </div>
        <div class="flex-1">
          <MediaUpload
            entityType="education"
            entityId={education.id}
            field="banner_path"
            currentUrl={bannerUrl}
            label="Institution Banner"
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
        href="/dashboard/profile/education"
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
