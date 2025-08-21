<script lang="ts">
  import ResumeSection from "./ResumeSection.svelte";
  import { faCompass } from "@fortawesome/free-solid-svg-icons";
  import resume from "$lib/data/resume.json";

  export let includesProject: boolean = false;
  export let includesPartTime: boolean = false;
  export let includesFullTime: boolean = false;

  function getLookingForText() {
    function getText() {
      return `Seeking challenging remote ${getTiming()} in a dynamic agile team building innovative products.`;
    }

    function getTiming() {
      if (includesFullTime && includesProject && includesPartTime) {
        return "freelance project, or full- / part-time role";
      }

      if (includesFullTime && includesProject) {
        return "freelance project or full-time role";
      }

      if (includesFullTime && includesPartTime) {
        return "full- or part-time role";
      }

      if (includesProject && includesPartTime) {
        return "freelance project or part-time role";
      }

      if (includesFullTime) {
        return "full-time role";
      }

      if (includesPartTime) {
        return "part-time role";
      }

      if (includesProject) {
        return "freelance project";
      }
    }

    return getText();
  }
</script>

<ResumeSection title="Summary" icon={faCompass} class="leading-relaxed">
  <p class="mb-4">
    {resume.basics.summary}
  </p>

  <p>
    {getLookingForText()}
  </p>
</ResumeSection>
