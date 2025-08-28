<script lang="ts">
  import ResumeSection from "./ResumeSection.svelte";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import { faFire, faThumbsUp, faThumbsDown } from "@fortawesome/free-solid-svg-icons";
  import { resume } from "$lib/data/resume";
</script>

<ResumeSection title="What Excites Me" icon={faFire}>
  <div class="space-y-8">
    <!-- What Excites Me -->
    <div>
      <div class="flex items-center mb-4">
        <h3 class="text-lg font-semibold text-slate">What Energizes Me</h3>
        <FontAwesomeIcon icon={faThumbsUp} class="w-5 h-5 ml-2 text-green-600" />
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        {#each resume.whatExcitesMe.excites as item, index (index)}
          <div class="border-l-2 border-green-400 pl-4 pb-4 bg-green-50/30 rounded-r-lg p-4">
            <div class="flex items-start mb-2">
              <div class="mr-3 flex-shrink-0 mt-1">
                <FontAwesomeIcon icon={item.icon} class="w-4 h-4 text-green-600" />
              </div>
              <div>
                <h4 class="font-medium text-slate mb-1">{item.title}</h4>
                <p class="text-slate/80 text-sm leading-relaxed">{item.description}</p>
              </div>
            </div>
          </div>
        {/each}
      </div>
    </div>

    <!-- What Doesn't Excite Me -->
    <div>
      <div class="flex items-center mb-4">
        <h3 class="text-lg font-semibold text-slate">What Doesn't Energize Me</h3>
        <FontAwesomeIcon icon={faThumbsDown} class="w-5 h-5 ml-2 text-red-600" />
      </div>
      <div class="space-y-3">
        {#each resume.whatExcitesMe.doesntExcite as item, index (index)}
          <div class="border-l-2 border-red-400 pl-4 pb-3 bg-red-50/30 rounded-r-lg p-3">
            <h4 class="font-medium text-slate mb-1">{item.title}</h4>
            <p class="text-slate/80 text-sm leading-relaxed">{item.description}</p>
          </div>
        {/each}
      </div>
    </div>
  </div>

  <div class="mt-6 p-4 bg-purple-50/50 border border-purple-200 rounded-lg">
    <p class="text-purple-800 text-sm leading-relaxed">
      <strong>Balance note:</strong> While I have preferences, I understand that all aspects of development are important. 
      I'm committed to delivering quality work across all areas, even those that may not be my primary sources of excitement.
    </p>
  </div>
</ResumeSection>