<script lang="ts">
  import InfoSection from "./InfoSection.svelte";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import { faListOl, faArrowRight } from "@fortawesome/free-solid-svg-icons";
  import { resume } from "$lib/data/resume";
</script>

<InfoSection title="Career Priorities" icon={faListOl}>
  <div class="space-y-6">
    <p class="text-slate/80 italic mb-6">
      "What are your top priorities in your career at this time?"
    </p>
    
    {#each resume.careerPriorities as priority, index (priority.priority)}
      <div class="border border-ocean/20 rounded-lg p-5 bg-gradient-to-r from-blue-50/30 to-teal-50/30">
        <div class="flex items-start mb-4">
          <div class="flex items-center justify-center w-8 h-8 bg-ocean text-white rounded-full text-sm font-bold mr-4 flex-shrink-0 mt-1">
            {priority.priority}
          </div>
          <div class="flex items-center mb-2 flex-grow">
            <FontAwesomeIcon icon={priority.icon} class="w-5 h-5 text-ocean mr-3" />
            <h3 class="text-lg font-semibold text-slate">{priority.title}</h3>
          </div>
        </div>
        
        <div class="ml-12 space-y-3">
          <p class="text-slate leading-relaxed">{priority.description}</p>
          
          <div class="bg-white/60 border-l-2 border-teal-400 pl-4 py-2 rounded-r">
            <div class="flex items-start">
              <FontAwesomeIcon icon={faArrowRight} class="w-4 h-4 text-teal-600 mr-2 mt-0.5 flex-shrink-0" />
              <div>
                <h4 class="font-medium text-teal-800 text-sm mb-1">Current actions:</h4>
                <p class="text-teal-700 text-sm leading-relaxed">{priority.actions}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    {/each}
  </div>

  <div class="mt-8 p-4 bg-amber-50/50 border border-amber-200 rounded-lg">
    <p class="text-amber-800 text-sm leading-relaxed">
      <strong>Timeframe:</strong> These priorities reflect my current focus for the next 12-24 months. 
      I regularly reassess and adjust based on market opportunities, personal growth, and changing life circumstances.
    </p>
  </div>
</InfoSection>