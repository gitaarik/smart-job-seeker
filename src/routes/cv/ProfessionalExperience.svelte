<script lang="ts">
  import InfoSection from "./InfoSection.svelte";
  import EmploymentSection from "./EmploymentSection.svelte";
  import { resume } from "$lib/data/resume";
  import { faGlobe } from "@fortawesome/free-solid-svg-icons";
</script>

<InfoSection title="Professional Experience" icon={faGlobe}>
  <!-- All Work Experiences -->
  {#each resume.work as work, index (work.name)}
    <EmploymentSection
      data={work}
      isFirst={index === 0}
    />
    {#if index < resume.work.length - 1}
      <hr class="border-cloud my-12" />
    {/if}
  {/each}
</InfoSection>
