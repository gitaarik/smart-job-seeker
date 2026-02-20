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
  let editableData = $state<ResumeData>(structuredClone(parsedData));

  // Stats for display
  let stats = $derived({
    work: editableData.work?.length || 0,
    education: editableData.education?.length || 0,
    skills: editableData.skills?.reduce((sum, cat) =>
      sum + cat.skills.length, 0) || 0,
    languages: editableData.languages?.length || 0,
    projects: editableData.projects?.length || 0,
    references: editableData.references?.length || 0,
  });

  // Validation
  let isValid = $derived(editableData.basics?.name?.trim().length > 0);
</script>

<div class="space-y-6">
  <div class="text-center">
    <h2 class="text-xl font-semibold text-slate mb-2">Review Your Profile</h2>
    <p class="text-pearl">
      We extracted the following information from
      {#if fileName}
        <span class="font-medium">{fileName}</span>
      {:else}
        your resume
      {/if}
    </p>
  </div>

  {#if error}
    <div class="rounded-md bg-[var(--dash-error-light)] p-4">
      <p class="text-sm text-[var(--dash-error)]">{error}</p>
    </div>
  {/if}

  <!-- Stats summary -->
  <div class="grid grid-cols-3 md:grid-cols-6 gap-2 p-4 bg-ocean/5 rounded-lg">
    <div class="text-center">
      <div class="text-xl font-semibold text-ocean">{stats.work}</div>
      <div class="text-xs text-pearl">Jobs</div>
    </div>
    <div class="text-center">
      <div class="text-xl font-semibold text-ocean">{stats.education}</div>
      <div class="text-xs text-pearl">Education</div>
    </div>
    <div class="text-center">
      <div class="text-xl font-semibold text-ocean">{stats.skills}</div>
      <div class="text-xs text-pearl">Skills</div>
    </div>
    <div class="text-center">
      <div class="text-xl font-semibold text-ocean">{stats.languages}</div>
      <div class="text-xs text-pearl">Languages</div>
    </div>
    <div class="text-center">
      <div class="text-xl font-semibold text-ocean">{stats.projects}</div>
      <div class="text-xs text-pearl">Projects</div>
    </div>
    <div class="text-center">
      <div class="text-xl font-semibold text-ocean">{stats.references}</div>
      <div class="text-xs text-pearl">References</div>
    </div>
  </div>

  <!-- Editable sections -->
  <div class="space-y-4">
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
  </div>

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
    class="pt-4"
  >
    <input type="hidden" name="data" value={JSON.stringify(editableData)} />
    {#if fileId}
      <input type="hidden" name="fileId" value={fileId} />
    {/if}

    {#if !isValid}
      <div class="rounded-md bg-[var(--dash-warning-light)] p-4 mb-4">
        <p class="text-sm text-[var(--dash-warning)]">
          Please enter a name to continue.
        </p>
      </div>
    {/if}

    <div class="flex gap-3">
      <button
        type="button"
        onclick={onBack}
        class="flex-1 py-2 px-4 border border-light rounded-lg text-slate hover:bg-light/50 transition-colors"
      >
        Back
      </button>

      <button
        type="submit"
        disabled={!isValid || isLoading}
        class="flex-1 py-2 px-4 bg-ocean text-pearl font-medium rounded-lg hover:bg-aqua transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
