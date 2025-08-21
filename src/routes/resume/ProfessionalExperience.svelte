<script lang="ts">
  import ResumeSection from "./ResumeSection.svelte";
  import EmploymentSection from "./EmploymentSection.svelte";
  import { resume } from "$lib/data/resume";
  import { faGlobe } from "@fortawesome/free-solid-svg-icons";
</script>

<ResumeSection title="Professional Experience" icon={faGlobe}>
  {#each resume.work as work, index (work.name)}
    <EmploymentSection
      data={work}
      isFirst={index === 0}
    />
    {#if index < resume.work.length - 1}
      <hr class="border-cloud my-12 print:hidden" />
      <div class="hidden print:block print:break-before-page"></div>
    {/if}
  {/each}
</ResumeSection>
