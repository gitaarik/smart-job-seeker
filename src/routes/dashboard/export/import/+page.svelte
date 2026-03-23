<script lang="ts">
  import type { ActionData, PageData } from "./$types";
  import type { ResumeData } from "$lib/server/resume/types";
  import { faFileImport } from "@fortawesome/free-solid-svg-icons";
  import SectionHeader from "../../profile/components/SectionHeader.svelte";

  import StepUpload from "./components/StepUpload.svelte";
  import StepDiffReview from "./components/StepDiffReview.svelte";

  let { data, form }: { data: PageData; form: ActionData } = $props();

  // Wizard state
  let showDiffReview = $state(false);
  let incomingData = $state<ResumeData | null>(null);
  let isLoading = $state(false);
  let error = $state<string | null>(form?.error || null);

  // Current profile data from server (fall back to empty for diff)
  const emptyProfile: ResumeData = { basics: { name: "" } };
  const currentData = $derived(data.currentProfileData ?? emptyProfile);

  function handleParsed(
    parsed: ResumeData,
    source: "upload" | "import" | "jsonResume",
  ) {
    incomingData = parsed;
    showDiffReview = true;
    error = null;
  }

  function handleBackFromReview() {
    showDiffReview = false;
    incomingData = null;
    error = null;
  }

  function handleError(msg: string) {
    error = msg;
  }

  function handleLoadingChange(loading: boolean) {
    isLoading = loading;
  }
</script>

<svelte:head>
  <title>Import Data - Smart Job Seeker</title>
</svelte:head>

<div class="space-y-6">
  <SectionHeader
    title={showDiffReview ? "Review Changes" : "Import Data"}
    icon={faFileImport}
  />

  {#if showDiffReview && incomingData}
    <StepDiffReview
      {currentData}
      {incomingData}
      {isLoading}
      {error}
      onBack={handleBackFromReview}
      onLoadingChange={handleLoadingChange}
    />
  {:else}
    <StepUpload
      {isLoading}
      {error}
      onParsed={handleParsed}
      onError={handleError}
      onLoadingChange={handleLoadingChange}
    />

    {#if !data.currentProfileData}
      <div
        class="rounded-lg border border-amber-200 bg-amber-50 p-4"
      >
        <p class="text-sm text-amber-800">
          No profile is currently selected. Import will compare against an empty profile.
        </p>
      </div>
    {/if}
  {/if}
</div>
