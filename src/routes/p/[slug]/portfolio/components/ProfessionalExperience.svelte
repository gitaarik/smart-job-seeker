<script lang="ts">
  import InfoSection from "./InfoSection.svelte";
  import EmploymentSection from "./EmploymentSection.svelte";
  import { faGlobe } from "@fortawesome/free-solid-svg-icons";

  let props = $props();
  const profile = props.profile;
</script>

<InfoSection title="Professional Experience" icon={faGlobe}>
  <!-- All Work Experiences -->
  {#each profile.work_experiences as work, index (work.name)}
    <EmploymentSection
      data={work}
      isFirst={index === 0}
    />
    {#if index < profile.work_experiences.length - 1}
      <hr class="border-cloud my-12" />
    {/if}
  {/each}
</InfoSection>
