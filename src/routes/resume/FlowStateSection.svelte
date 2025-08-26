<script lang="ts">
  import ResumeSection from "./ResumeSection.svelte";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import { faWater, faClock, faPlus } from "@fortawesome/free-solid-svg-icons";
  import { resume } from "$lib/data/resume";
</script>

<ResumeSection title="Flow State & Ideal Activities" icon={faWater}>
  <div class="space-y-8">
    <p class="text-slate/80 italic text-center mb-8 text-lg">
      "{resume.flowState.question}"
    </p>
    
    <!-- When I Get Lost in Work -->
    <div>
      <div class="flex items-center mb-6">
        <FontAwesomeIcon icon={faClock} class="w-5 h-5 text-blue-600 mr-3" />
        <h3 class="text-xl font-semibold text-slate">When I Get Lost in Work (The Good Kind)</h3>
      </div>
      
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        {#each resume.flowState.lostInWork as activity, index (index)}
          <div class="border-l-4 border-blue-400 pl-5 bg-blue-50/40 rounded-r-lg p-5">
            <div class="flex items-center mb-3">
              <FontAwesomeIcon icon={activity.icon} class="w-5 h-5 text-blue-600 mr-3" />
              <h4 class="font-semibold text-slate">{activity.title}</h4>
            </div>
            
            <p class="text-slate/80 text-sm leading-relaxed mb-3">{activity.description}</p>
            
            <div class="bg-blue-100/60 border border-blue-200 rounded-lg p-3">
              <p class="text-blue-800 text-xs leading-relaxed italic">
                <strong>Example:</strong> {activity.example}
              </p>
            </div>
          </div>
        {/each}
      </div>
    </div>

    <!-- Activities I Want More Of -->
    <div>
      <div class="flex items-center mb-6">
        <FontAwesomeIcon icon={faPlus} class="w-5 h-5 text-green-600 mr-3" />
        <h3 class="text-xl font-semibold text-slate">Activities I Want More Of</h3>
      </div>
      
      <div class="space-y-5">
        {#each resume.flowState.wantMoreOf as activity, index (index)}
          <div class="border border-green-200 rounded-lg p-5 bg-gradient-to-r from-green-50/50 to-teal-50/50">
            <div class="mb-3">
              <h4 class="font-semibold text-green-800 text-lg mb-2">{activity.title}</h4>
              <p class="text-green-700 leading-relaxed mb-3">{activity.description}</p>
            </div>
            
            <div class="bg-green-100/60 border-l-4 border-green-500 pl-4 py-2">
              <p class="text-green-800 text-sm">
                <strong>Why this matters to me:</strong> {activity.why}
              </p>
            </div>
          </div>
        {/each}
      </div>
    </div>
  </div>

  <div class="mt-8 p-4 bg-purple-50/50 border border-purple-200 rounded-lg">
    <p class="text-purple-800 text-sm leading-relaxed">
      <strong>Connection insight:</strong> The work that puts me in flow state involves complex problem-solving, 
      creative technical challenges, and meaningful impact. The activities I want more of represent the natural 
      evolution of these interests toward leadership, innovation, and community contribution.
    </p>
  </div>
</ResumeSection>