<script lang="ts">
  import ResumeSection from "./ResumeSection.svelte";
  import { faCompass } from "@fortawesome/free-solid-svg-icons";

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
    Dutch Senior Full Stack Developer residing in Spain, with 18+ years
    experience specializing in Python & Node.js ecosystems. Experienced in
    scaling complex &amp; high-traffic applications and leading development
    teams.
  </p>

  <p>
    {getLookingForText()}
  </p>
</ResumeSection>
