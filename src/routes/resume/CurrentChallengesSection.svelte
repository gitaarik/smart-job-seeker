<script lang="ts">
  import ResumeSection from "./ResumeSection.svelte";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import { faRoad, faBullseye } from "@fortawesome/free-solid-svg-icons";
  import { resume } from "$lib/data/resume";
</script>

<ResumeSection title="Current Challenges" icon={faRoad}>
  <div class="space-y-6">
    {#each resume.currentChallenges as challenge, index (index)}
      <div class="border-l-2 border-blue-400 pl-4 pb-4 bg-blue-50/30 rounded-r-lg p-4">
        <div class="mb-3">
          <h3 class="font-semibold text-slate text-lg mb-2">{challenge.title}</h3>
          <p class="text-slate/80 leading-relaxed mb-3">{challenge.description}</p>
        </div>
        
        <div class="bg-green-50/50 border-l-2 border-green-400 pl-3 py-2">
          <div class="flex items-start">
            <div class="mr-2 flex-shrink-0 mt-0.5">
              <FontAwesomeIcon icon={faBullseye} class="w-4 h-4 text-green-600" />
            </div>
            <div>
              <h4 class="font-medium text-green-800 text-sm mb-1">My approach:</h4>
              <p class="text-green-700 text-sm leading-relaxed">{challenge.approach}</p>
            </div>
          </div>
        </div>
      </div>
    {/each}
  </div>

  <div class="mt-6 p-4 bg-amber-50/50 border border-amber-200 rounded-lg">
    <p class="text-amber-800 text-sm leading-relaxed">
      <strong>Transparency note:</strong> I believe in being open about current challenges as they represent opportunities for growth and collaboration. 
      I'm actively working on these areas and welcome discussions about how we can address them together.
    </p>
  </div>
</ResumeSection>