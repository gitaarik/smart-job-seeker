<script lang="ts">
  import ResumeSection from "./ResumeSection.svelte";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import { faBuilding } from "@fortawesome/free-solid-svg-icons";
  import { resume } from "$lib/data/resume";
</script>

<ResumeSection title="Ideal Company" icon={faBuilding}>
  <div class="space-y-4">
    {#each resume.idealCompany as item, index (index)}
      <div class="flex items-start">
        <div class="mr-4 flex-shrink-0">
          <FontAwesomeIcon icon={item.icon} class="w-5 h-5 text-ocean mt-0.5" />
        </div>
        <p class="text-slate leading-relaxed">{item.description}</p>
      </div>
    {/each}
  </div>
</ResumeSection>