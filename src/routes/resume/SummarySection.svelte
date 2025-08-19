<script lang="ts">
  import ResumeSection from "./ResumeSection.svelte";
  import { faCompass } from "@fortawesome/free-solid-svg-icons";

  export let includesProject: boolean = false;
  export let includesPartTime: boolean = false;
  export let includesFullTime: boolean = false;

  function getLookingForText() {
    function getText() {
      return `I'm currently looking for an exciting and challenging remote ${getTiming()}, where I can apply my expertise and creativity. I thrive in dynamic agile teams or startup environments that realize innovative ideas into real world products.`;
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
    Dutch Senior Full Stack Developer, currently residing in Spain. Specialized
    in Python & Node.js ecosystems, with a wide background in full stack
    engineering, designing complex and high-traffic applications. Through past
    leadership roles developed strong skills for product responsibility, project
    management and team leadership.
  </p>

  <p>
    {getLookingForText()}
  </p>
</ResumeSection>
