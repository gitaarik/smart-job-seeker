<script lang="ts">
  import type { ActionData } from "./$types";
  import type { ResumeData } from "$lib/server/resume/types";
  import { faUser } from "@fortawesome/free-solid-svg-icons";
  import SectionHeader from "../components/SectionHeader.svelte";

  import StepUpload from "./components/StepUpload.svelte";
  import StepReview from "./components/StepReview.svelte";

  let { form }: { form: ActionData } = $props();

  // Wizard state
  let showReview = $state(false);
  let reviewSource = $state<"upload" | "import" | "manual">("upload");
  let parsedData = $state<ResumeData | null>(null);
  let uploadedFileId = $state<string | null>(null);
  let uploadedFileName = $state<string | null>(null);
  let isLoading = $state(false);
  let error = $state<string | null>(form?.error || null);

  function handleSkipToManual() {
    parsedData = { basics: { name: "" } };
    reviewSource = "manual";
    showReview = true;
    error = null;
  }

  function handleUploadComplete(data: {
    parsedData: unknown;
    fileId: string;
    fileName: string;
  }) {
    parsedData = data.parsedData as ResumeData;
    uploadedFileId = data.fileId;
    uploadedFileName = data.fileName;
    reviewSource = "upload";
    showReview = true;
    error = null;
  }

  function handleImportComplete(data: ResumeData) {
    parsedData = data;
    reviewSource = "import";
    showReview = true;
    error = null;
  }

  function handleBackFromReview() {
    showReview = false;
    reviewSource = "upload";
    parsedData = null;
    uploadedFileId = null;
    uploadedFileName = null;
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
  <title>Create Profile - Smart Job Seeker</title>
</svelte:head>

<div class="space-y-6">
  <SectionHeader
    title={showReview && reviewSource !== "manual"
      ? "Review Your Profile"
      : "Create Your Profile"}
    icon={faUser}
  />

  {#if showReview && parsedData}
    <StepReview
      {parsedData}
      fileId={uploadedFileId}
      fileName={uploadedFileName}
      source={reviewSource}
      {isLoading}
      {error}
      onBack={handleBackFromReview}
      onLoadingChange={handleLoadingChange}
    />
  {:else}
    <StepUpload
      {isLoading}
      {error}
      onSkipToManual={handleSkipToManual}
      onUploadComplete={handleUploadComplete}
      onImportComplete={handleImportComplete}
      onError={handleError}
      onLoadingChange={handleLoadingChange}
    />
  {/if}
</div>
