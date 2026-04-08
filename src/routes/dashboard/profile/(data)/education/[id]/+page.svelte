<script lang="ts">
  import type { PageData } from "./$types";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faArrowLeft,
    faGraduationCap,
    faTrash,
  } from "@fortawesome/free-solid-svg-icons";
  import MediaUpload from "$lib/components/MediaUpload.svelte";
  import SectionSaveButton from "$lib/components/SectionSaveButton.svelte";
  import VersionTags from "$lib/components/VersionTags.svelte";
  import ConfirmModal from "../../../components/ConfirmModal.svelte";
  import Card from "../../../../components/Card.svelte";

  type SaveState = "idle" | "saving" | "saved" | "error";

  let { data }: { data: PageData } = $props();

  let logoUrl = $state(data.logoUrl);
  let bannerUrl = $state(data.bannerUrl);

  let education = $derived(data.education);

  // Section save state
  let basicSaveState = $state<SaveState>("idle");

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
  let editTags = $state<string[]>(Array.isArray(education.tags) ? education.tags as string[] : []);
  let showDeleteConfirm = $state(false);

  function formatDate(date: Date | string | null): string {
    if (!date) return "";
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toISOString().split("T")[0];
  }

  async function saveBasicInfo() {
    basicSaveState = "saving";
    try {
      const response = await fetch(`/api/education/${education.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          institution: editInstitution,
          area: editArea,
          study_type: editStudyType,
          location: editLocation,
          url: editUrl,
          graduation_year: editGraduationYear || null,
          start_date: editStartDate || null,
          end_date: editEndDate || null,
          summary: editSummary,
        }),
      });

      if (response.ok) {
        basicSaveState = "saved";
        setTimeout(() => (basicSaveState = "idle"), 2000);
      } else {
        basicSaveState = "error";
        setTimeout(() => (basicSaveState = "idle"), 3000);
      }
    } catch {
      basicSaveState = "error";
      setTimeout(() => (basicSaveState = "idle"), 3000);
    }
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
      <span class="text-sm">All Education</span>
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

  <!-- Basic Info -->
  <Card padding="lg">
    <h2 class="text-lg font-semibold text-[var(--dash-text)] mb-4">Basic Information</h2>
    <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
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
            bind:value={editEndDate}
            class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
          />
        </div>
      </div>

      <div class="flex flex-col">
        <label
          for="edit-summary"
          class="block text-sm font-medium text-[var(--dash-text)] mb-1"
        >
          Summary
        </label>
        <textarea
          id="edit-summary"
          bind:value={editSummary}
          rows={5}
          placeholder="Brief description of your studies, achievements, etc."
          class="w-full flex-1 min-h-[120px] px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent resize-y"
        ></textarea>
      </div>
    </div>
    <div class="flex justify-end mt-4">
      <SectionSaveButton state={basicSaveState} onClick={saveBasicInfo} />
    </div>
  </Card>

  <!-- Portfolio Images -->
  <Card padding="lg">
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
  </Card>

  <!-- Version Tags -->
  <VersionTags bind:tags={editTags} apiUrl={`/api/education/${education.id}`} />

  <!-- Danger Zone -->
  <Card padding="lg">
    <div class="space-y-3">
      <div class="flex items-center gap-2 mb-2">
        <FontAwesomeIcon
          icon={faTrash}
          class="w-4 h-4 text-[var(--dash-text-secondary)]"
        />
        <h2
          class="text-sm font-semibold text-[var(--dash-text)] uppercase tracking-wide"
        >
          Danger Zone
        </h2>
      </div>

      <p class="text-sm text-[var(--dash-text-secondary)]">
        Permanently remove this education entry and all associated data.
      </p>

      <button
        type="button"
        onclick={() => showDeleteConfirm = true}
        class="flex items-center gap-2 px-4 py-2 text-sm bg-red-500/10 border border-red-500/30 rounded-lg text-red-500 hover:bg-red-500/20 hover:border-red-500/50 transition-colors"
      >
        <FontAwesomeIcon icon={faTrash} class="w-3 h-3" />
        Delete Education
      </button>
    </div>
  </Card>
</div>

<ConfirmModal
  isOpen={showDeleteConfirm}
  title="Delete Education"
  message="Are you sure you want to permanently delete this education entry? This action cannot be undone."
  confirmLabel="Delete"
  onCancel={() => showDeleteConfirm = false}
  onConfirm={() => {
    showDeleteConfirm = false;
    const form = document.createElement("form");
    form.method = "POST";
    form.action = "/dashboard/profile/education?/delete";
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = "id";
    input.value = String(education.id);
    form.appendChild(input);
    document.body.appendChild(form);
    form.submit();
  }}
/>
