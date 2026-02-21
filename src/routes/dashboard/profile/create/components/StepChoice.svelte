<script lang="ts">
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import { faEdit, faFileUpload } from "@fortawesome/free-solid-svg-icons";

  interface Props {
    onChoose: (method: "upload" | "manual") => void;
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
        Upload your existing CV or resume and we'll automatically extract your
        information using AI.
      </p>
      <p class="text-xs text-pearl mt-2 sm:mt-3">
        Supports PDF, DOCX, and HTML files
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
        Start with a blank profile and enter your information manually. You can
        always add more details later.
      </p>
      <p class="text-xs text-pearl mt-2 sm:mt-3">Quick setup with basic fields</p>
    </button>
  </div>
</div>
