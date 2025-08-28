<script lang="ts">
  import ResumeSection from "./ResumeSection.svelte";
  import { faCompass } from "@fortawesome/free-solid-svg-icons";
  import { resume } from "$lib/data/resume";
</script>

<ResumeSection title="Summary" icon={faCompass} class="leading-relaxed">
  <p class="mb-4">
    {resume.basics.summary}
  </p>
</ResumeSection>
