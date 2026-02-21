<script lang="ts">
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import { faEdit, faFileImport, faFileUpload } from "@fortawesome/free-solid-svg-icons";

  interface Props {
    onChoose: (method: "upload" | "manual" | "import") => void;
  }

  let { onChoose }: Props = $props();
</script>

<div class="space-y-3 sm:space-y-4">
  <h2 class="text-lg sm:text-xl font-semibold text-slate text-center mb-3 sm:mb-6">
    How would you like to create your profile?
  </h2>

  <div class="grid gap-3 sm:gap-4 md:grid-cols-2">
    <button
      type="button"
      onclick={() => onChoose("upload")}
      class="group p-4 sm:p-6 rounded-lg border-2 border-light hover:border-ocean bg-snow hover:bg-ocean/5 transition-all text-left"
    >
      <div
        class="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-ocean/10 group-hover:bg-ocean/20 flex items-center justify-center mb-3 sm:mb-4"
      >
        <FontAwesomeIcon
          icon={faFileUpload}
          class="w-5 h-5 sm:w-6 sm:h-6 text-ocean"
        />
      </div>
      <h3 class="text-base sm:text-lg font-semibold text-slate mb-1 sm:mb-2">Upload CV/Resume</h3>
      <p class="text-xs sm:text-sm text-pearl">
        Upload your CV or resume and we'll extract your information using AI.
      </p>
      <p class="text-xs text-pearl mt-2 sm:mt-3">
        PDF, DOCX, HTML
      </p>
    </button>

    <button
      type="button"
      onclick={() => onChoose("manual")}
      class="group p-4 sm:p-6 rounded-lg border-2 border-light hover:border-ocean bg-snow hover:bg-ocean/5 transition-all text-left"
    >
      <div
        class="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-ocean/10 group-hover:bg-ocean/20 flex items-center justify-center mb-3 sm:mb-4"
      >
        <FontAwesomeIcon icon={faEdit} class="w-5 h-5 sm:w-6 sm:h-6 text-ocean" />
      </div>
      <h3 class="text-base sm:text-lg font-semibold text-slate mb-1 sm:mb-2">Create Manually</h3>
      <p class="text-xs sm:text-sm text-pearl">
        Start with a blank profile and enter your information manually.
      </p>
      <p class="text-xs text-pearl mt-2 sm:mt-3">Basic fields</p>
    </button>
  </div>

  <div class="pt-2 sm:pt-4 border-t border-light">
    <button
      type="button"
      onclick={() => onChoose("import")}
      class="w-full flex items-center justify-center gap-2 py-2 text-sm text-pearl hover:text-ocean transition-colors"
    >
      <FontAwesomeIcon icon={faFileImport} class="w-4 h-4" />
      <span>Import from a previous export</span>
    </button>
  </div>
</div>
