<script lang="ts">
  import ResumeSection from "./ResumeSection.svelte";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import { faExclamationTriangle, faLightbulb } from "@fortawesome/free-solid-svg-icons";
  import { resume } from "$lib/data/resume";
</script>

<ResumeSection title="Areas for Growth" icon={faExclamationTriangle}>
  <div class="space-y-6">
    {#each resume.weaknesses as weakness, index (index)}
      <div class="border-l-2 border-orange-400 pl-4 pb-4 bg-orange-50/30 rounded-r-lg p-4">
        <div class="mb-3">
          <h3 class="font-semibold text-slate text-lg mb-2">{weakness.title}</h3>
          <p class="text-slate/80 leading-relaxed mb-3">{weakness.description}</p>
        </div>
        
        <div class="bg-green-50/50 border-l-2 border-green-400 pl-3 py-2">
          <div class="flex items-start">
            <div class="mr-2 flex-shrink-0 mt-0.5">
              <FontAwesomeIcon icon={faLightbulb} class="w-4 h-4 text-green-600" />
            </div>
            <div>
              <h4 class="font-medium text-green-800 text-sm mb-1">How I'm addressing it:</h4>
              <p class="text-green-700 text-sm leading-relaxed">{weakness.mitigation}</p>
            </div>
          </div>
        </div>
      </div>
    {/each}
  </div>

  <div class="mt-6 p-4 bg-blue-50/50 border border-blue-200 rounded-lg">
    <p class="text-blue-800 text-sm leading-relaxed">
      <strong>Self-awareness note:</strong> I believe acknowledging areas for improvement is crucial for professional growth. 
      These weaknesses are areas I actively work on, and I welcome feedback and mentorship to continue developing in these areas.
    </p>
  </div>
</ResumeSection>