<script lang="ts">
  import InfoSection from "./InfoSection.svelte";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import { faEye, faArrowUp, faArrowDown, faLightbulb } from "@fortawesome/free-solid-svg-icons";
  import { resume } from "$lib/data/resume";
</script>

<InfoSection title="Candid Self-Reflection" icon={faEye}>
  <div class="space-y-8">
    <!-- Biggest Positive -->
    <div class="border-l-4 border-green-500 pl-6 bg-green-50/40 rounded-r-lg p-6">
      <div class="flex items-center mb-4">
        <FontAwesomeIcon icon={faArrowUp} class="w-5 h-5 text-green-600 mr-3" />
        <h3 class="text-xl font-semibold text-green-800">Biggest Positive in My Success</h3>
      </div>
      
      <div class="space-y-4">
        <div>
          <h4 class="font-medium text-green-800 text-lg mb-2">{resume.selfReflection.biggestPositive.title}</h4>
          <p class="text-green-700 leading-relaxed mb-4">{resume.selfReflection.biggestPositive.description}</p>
        </div>
        
        <div class="bg-green-100/60 border border-green-200 rounded-lg p-4">
          <h5 class="font-medium text-green-800 mb-2">Impact on my career:</h5>
          <p class="text-green-700 text-sm leading-relaxed">{resume.selfReflection.biggestPositive.impact}</p>
        </div>
      </div>
    </div>

    <!-- Biggest Hindrance -->
    <div class="border-l-4 border-red-500 pl-6 bg-red-50/40 rounded-r-lg p-6">
      <div class="flex items-center mb-4">
        <FontAwesomeIcon icon={faArrowDown} class="w-5 h-5 text-red-600 mr-3" />
        <h3 class="text-xl font-semibold text-red-800">What Has Hindered My Success</h3>
      </div>
      
      <div class="space-y-4">
        <div>
          <h4 class="font-medium text-red-800 text-lg mb-2">{resume.selfReflection.biggestHindrance.title}</h4>
          <p class="text-red-700 leading-relaxed mb-4">{resume.selfReflection.biggestHindrance.description}</p>
        </div>
        
        <div class="bg-red-100/60 border border-red-200 rounded-lg p-4">
          <h5 class="font-medium text-red-800 mb-2">How it has affected me:</h5>
          <p class="text-red-700 text-sm leading-relaxed">{resume.selfReflection.biggestHindrance.impact}</p>
        </div>
      </div>
    </div>

    <!-- Growth Insight -->
    <div class="border-l-4 border-blue-500 pl-6 bg-blue-50/40 rounded-r-lg p-6">
      <div class="flex items-center mb-4">
        <FontAwesomeIcon icon={faLightbulb} class="w-5 h-5 text-blue-600 mr-3" />
        <h3 class="text-xl font-semibold text-blue-800">Key Insight</h3>
      </div>
      
      <p class="text-blue-700 leading-relaxed">{resume.selfReflection.growth.description}</p>
    </div>
  </div>

  <div class="mt-8 p-4 bg-gray-50 border border-gray-200 rounded-lg">
    <p class="text-gray-700 text-sm leading-relaxed italic">
      "This level of self-awareness and honesty about both strengths and areas for improvement demonstrates 
      my commitment to continuous growth and my ability to work constructively with teams and stakeholders 
      who value authentic, reflective leadership."
    </p>
  </div>
</InfoSection>