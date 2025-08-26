<script lang="ts">
  import ResumeSection from "./ResumeSection.svelte";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faBuilding,
    faExclamationCircle,
    faThumbsUp,
  } from "@fortawesome/free-solid-svg-icons";
  import { resume } from "$lib/data/resume";
</script>

<ResumeSection title="Ideal Company" icon={faBuilding}>
  <div class="space-y-8">
    <!-- Required Section -->
    <div>
      <div class="flex items-center mb-4">
        <h3 class="text-lg font-semibold text-slate">Required</h3>
        <FontAwesomeIcon icon={faExclamationCircle} class="w-5 h-5 ml-2" />
      </div>
      <div class="space-y-4">
        {#each resume.idealCompany.required as item, index (index)}
          <div class="flex items-start">
            <div class="mr-2 flex-shrink-0">
              <FontAwesomeIcon
                icon={item.icon}
                class="w-5 h-5 text-ocean mt-0.5"
              />
            </div>
            <p class="text-slate leading-relaxed">{item.description}</p>
          </div>
        {/each}
      </div>
    </div>

    <!-- Nice to Have Section -->
    <div>
      <div class="flex items-center mb-4">
        <h3 class="text-lg font-semibold text-slate">Nice to Have</h3>
        <FontAwesomeIcon
          icon={faThumbsUp}
          class="w-5 h-5 ml-2"
        />
      </div>
      <div class="space-y-4">
        {#each resume.idealCompany.niceToHave as item, index (index)}
          <div class="flex items-start">
            <div class="mr-2 flex-shrink-0">
              <FontAwesomeIcon
                icon={item.icon}
                class="w-5 h-5 text-ocean mt-0.5"
              />
            </div>
            <p class="text-slate leading-relaxed">{item.description}</p>
          </div>
        {/each}
      </div>
    </div>
  </div>
</ResumeSection>

