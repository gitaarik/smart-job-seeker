<script lang="ts">
  import type { ActionData } from "./$types";
  import type { ResumeData } from "$lib/server/resume/types";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import { faArrowLeft, faUser } from "@fortawesome/free-solid-svg-icons";

  import StepIndicator from "./components/StepIndicator.svelte";
  import StepUpload from "./components/StepUpload.svelte";
  import StepManual from "./components/StepManual.svelte";
  import StepReview from "./components/StepReview.svelte";
  import StepImport from "./components/StepImport.svelte";

  let { form }: { form: ActionData } = $props();

  // Wizard state
  type ImportMethod = "upload" | "manual" | "import";
  let currentStep = $state(1);
  let importMethod = $state<ImportMethod>("upload");
  let parsedData = $state<ResumeData | null>(null);
  let uploadedFileId = $state<string | null>(null);
  let uploadedFileName = $state<string | null>(null);
  let isLoading = $state(false);
  let error = $state<string | null>(form?.error || null);

  const steps = ["Import", "Review", "Done"];

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
    currentStep = 2;
    error = null;
  }

  function handleBack() {
    if (currentStep === 2) {
      // From review, go back to upload
      currentStep = 1;
      importMethod = "upload";
      parsedData = null;
      uploadedFileId = null;
      uploadedFileName = null;
    }
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

<div class="max-w-2xl mx-auto">
  <a
    href="/dashboard"
    class="inline-flex items-center gap-2 text-pearl hover:text-slate transition-colors mb-6"
  >
    <FontAwesomeIcon icon={faArrowLeft} class="w-4 h-4" />
    <span>Back to Dashboard</span>
  </a>

  <div class="bg-snow rounded-lg border border-light p-4 sm:p-6 md:p-8">
    <div class="flex items-center gap-3 mb-4 sm:mb-6">
      <div
        class="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-ocean flex items-center justify-center flex-shrink-0"
      >
        <FontAwesomeIcon icon={faUser} class="w-5 h-5 sm:w-6 sm:h-6 text-pearl" />
      </div>
      <div>
        <h1 class="text-xl sm:text-2xl font-semibold text-slate">Create Your Profile</h1>
        <p class="text-sm sm:text-base text-pearl">
          Set up your professional profile to get started.
        </p>
      </div>
    </div>

    <StepIndicator {currentStep} {steps} />

    {#if currentStep === 1}
      {#if importMethod === "upload"}
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
    {:else if currentStep === 2 && parsedData}
      <StepReview
        {parsedData}
        fileId={uploadedFileId}
        fileName={uploadedFileName}
        {isLoading}
        {error}
        onBack={handleBack}
        onLoadingChange={handleLoadingChange}
      />
    {/if}
  </div>
</div>
