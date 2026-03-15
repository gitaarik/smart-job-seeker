<script lang="ts">
  import type { ActionData } from "./$types";
  import type { ResumeData } from "$lib/server/resume/types";
  import { faUser } from "@fortawesome/free-solid-svg-icons";
  import SectionHeader from "../components/SectionHeader.svelte";

  import StepUpload from "./components/StepUpload.svelte";
  import StepManual from "./components/StepManual.svelte";
  import StepReview from "./components/StepReview.svelte";
  import StepImport from "./components/StepImport.svelte";

  let { form }: { form: ActionData } = $props();

  // Wizard state
  type ImportMethod = "upload" | "manual" | "import";
  let showReview = $state(false);
  let importMethod = $state<ImportMethod>("upload");
  let parsedData = $state<ResumeData | null>(null);
  let uploadedFileId = $state<string | null>(null);
  let uploadedFileName = $state<string | null>(null);
  let isLoading = $state(false);
  let error = $state<string | null>(form?.error || null);

  function handleSwitchMethod(method: ImportMethod) {
    importMethod = method;
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
    showReview = true;
    error = null;
  }

  function handleBackFromReview() {
    showReview = false;
    importMethod = "upload";
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
    title="Create Your Profile"
    icon={faUser}
  />

  {#if showReview && parsedData}
    <StepReview
      {parsedData}
      fileId={uploadedFileId}
      fileName={uploadedFileName}
      {isLoading}
      {error}
      onBack={handleBackFromReview}
      onLoadingChange={handleLoadingChange}
    />
  {:else if importMethod === "upload"}
    <StepUpload
      {isLoading}
      {error}
      onSkipToManual={() => handleSwitchMethod("manual")}
      onImportExport={() => handleSwitchMethod("import")}
      onUploadComplete={handleUploadComplete}
      onError={handleError}
      onLoadingChange={handleLoadingChange}
    />
  {:else if importMethod === "import"}
    <StepImport
      {isLoading}
      {error}
      onBack={() => handleSwitchMethod("upload")}
      onLoadingChange={handleLoadingChange}
    />
  {:else}
    <StepManual
      {isLoading}
      {error}
      onBack={() => handleSwitchMethod("upload")}
      onLoadingChange={handleLoadingChange}
    />
  {/if}
</div>
