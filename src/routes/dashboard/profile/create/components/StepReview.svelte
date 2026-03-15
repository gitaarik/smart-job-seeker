<script lang="ts">
  import { enhance } from "$app/forms";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import { faCheck, faSpinner } from "@fortawesome/free-solid-svg-icons";
  import type { ResumeData } from "$lib/server/resume/types";
  import BasicsSection from "./sections/BasicsSection.svelte";
  import WorkSection from "./sections/WorkSection.svelte";
  import EducationSection from "./sections/EducationSection.svelte";
  import SkillsSection from "./sections/SkillsSection.svelte";
  import LanguagesSection from "./sections/LanguagesSection.svelte";
  import ProjectsSection from "./sections/ProjectsSection.svelte";
  import ReferencesSection from "./sections/ReferencesSection.svelte";

  interface Props {
    parsedData: ResumeData;
    fileId: string | null;
    fileName: string | null;
    isLoading: boolean;
    error: string | null;
    onBack: () => void;
    onLoadingChange: (loading: boolean) => void;
  }

  let {
    parsedData,
    fileId,
    fileName,
    isLoading,
    error,
    onBack,
    onLoadingChange,
  }: Props = $props();

  // Editable copy of the parsed data
  let editableData = $state<ResumeData>($state.snapshot(parsedData) as ResumeData);

  // Stats for display
  let stats = $derived({
    work: editableData.work?.length || 0,
    education: editableData.education?.length || 0,
    skills: editableData.skills?.reduce((sum, cat) =>
      sum + cat.skills.length, 0) ||
      0,
    languages: editableData.languages?.length || 0,
    projects: editableData.projects?.length || 0,
    references: editableData.references?.length || 0,
  });

  // Validation
  let isValid = $derived(editableData.basics?.name?.trim().length > 0);
</script>

<div class="space-y-4">
  <div
    class="bg-[var(--dash-card)] rounded-lg border border-[var(--dash-border)] p-4 sm:p-6"
  >
    <h3 class="font-medium text-[var(--dash-text)] mb-1">
      Review Your Profile
    </h3>
    <p class="text-sm text-[var(--dash-text-secondary)]">
      We extracted the following information from
      {#if fileName}
        <span class="font-medium">{fileName}</span>
      {:else}
        your resume
      {/if}
    </p>

    <!-- Stats summary -->
    <div
      class="grid grid-cols-3 md:grid-cols-6 gap-2 p-3 sm:p-4 bg-[var(--dash-bg)] rounded-lg mt-4"
    >
      <div class="text-center">
        <div
          class="text-lg sm:text-xl font-semibold text-[var(--dash-primary)]"
        >
          {stats.work}
        </div>
        <div class="text-[10px] sm:text-xs text-[var(--dash-text-muted)]">
          Jobs
        </div>
      </div>
      <div class="text-center">
        <div
          class="text-lg sm:text-xl font-semibold text-[var(--dash-primary)]"
        >
          {stats.education}
        </div>
        <div class="text-[10px] sm:text-xs text-[var(--dash-text-muted)]">
          Education
        </div>
      </div>
      <div class="text-center">
        <div
          class="text-lg sm:text-xl font-semibold text-[var(--dash-primary)]"
        >
          {stats.skills}
        </div>
        <div class="text-[10px] sm:text-xs text-[var(--dash-text-muted)]">
          Skills
        </div>
      </div>
      <div class="text-center">
        <div
          class="text-lg sm:text-xl font-semibold text-[var(--dash-primary)]"
        >
          {stats.languages}
        </div>
        <div class="text-[10px] sm:text-xs text-[var(--dash-text-muted)]">
          Languages
        </div>
      </div>
      <div class="text-center">
        <div
          class="text-lg sm:text-xl font-semibold text-[var(--dash-primary)]"
        >
          {stats.projects}
        </div>
        <div class="text-[10px] sm:text-xs text-[var(--dash-text-muted)]">
          Projects
        </div>
      </div>
      <div class="text-center">
        <div
          class="text-lg sm:text-xl font-semibold text-[var(--dash-primary)]"
        >
          {stats.references}
        </div>
        <div class="text-[10px] sm:text-xs text-[var(--dash-text-muted)]">
          References
        </div>
      </div>
    </div>
  </div>

  {#if error}
    <div
      class="bg-[var(--dash-error-light)] border border-[var(--dash-error)] rounded-lg p-4"
    >
      <p class="text-sm text-[var(--dash-error)]">{error}</p>
    </div>
  {/if}

  <!-- Editable sections -->
  <BasicsSection bind:basics={editableData.basics} />

  {#if editableData.work && editableData.work.length > 0}
    <WorkSection bind:work={editableData.work} />
  {/if}

  {#if editableData.education && editableData.education.length > 0}
    <EducationSection bind:education={editableData.education} />
  {/if}

  {#if editableData.skills && editableData.skills.length > 0}
    <SkillsSection bind:skills={editableData.skills} />
  {/if}

  {#if editableData.languages && editableData.languages.length > 0}
    <LanguagesSection bind:languages={editableData.languages} />
  {/if}

  {#if editableData.projects && editableData.projects.length > 0}
    <ProjectsSection bind:projects={editableData.projects} />
  {/if}

  {#if editableData.references && editableData.references.length > 0}
    <ReferencesSection bind:references={editableData.references} />
  {/if}

  <!-- Submit form -->
  <form
    method="POST"
    action="?/create"
    use:enhance={() => {
      onLoadingChange(true);
      return async ({ update }) => {
        onLoadingChange(false);
        await update();
      };
    }}
    class="bg-[var(--dash-card)] rounded-lg border border-[var(--dash-border)] p-4 sm:p-6"
  >
    <input type="hidden" name="data" value={JSON.stringify(editableData)} />
    {#if fileId}
      <input type="hidden" name="fileId" value={fileId} />
    {/if}

    {#if !isValid}
      <div
        class="bg-[var(--dash-error-light)] border border-[var(--dash-error)] rounded-lg p-4 mb-4"
      >
        <p class="text-sm text-[var(--dash-error)]">
          Please enter a name to continue.
        </p>
      </div>
    {/if}

    <div class="flex justify-end gap-2">
      <button
        type="button"
        onclick={onBack}
        class="px-4 py-2 border border-[var(--dash-border)] rounded-lg text-[var(--dash-text)] hover:bg-[var(--dash-bg)] transition-colors"
      >
        Back
      </button>

      <button
        type="submit"
        disabled={!isValid || isLoading}
        class="px-4 py-2 bg-[var(--dash-primary)] text-white rounded-lg hover:bg-[var(--dash-primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
      >
        {#if isLoading}
          <FontAwesomeIcon icon={faSpinner} class="w-4 h-4 animate-spin" />
          Creating Profile...
        {:else}
          <FontAwesomeIcon icon={faCheck} class="w-4 h-4" />
          Create Profile
        {/if}
      </button>
    </div>
  </form>
</div>
