<script lang="ts">
  import InfoSection from "./InfoSection.svelte";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import { faQuestionCircle, faLightbulb, faTasks, faRocket, faCheckCircle, faChevronDown, faChevronRight } from "@fortawesome/free-solid-svg-icons";
  import { resume } from "$lib/data/resume";

  // Track expanded state for each question - using array for reactivity
  let expandedQuestions: string[] = [];

  function toggleQuestion(categoryIndex: number, questionIndex: number) {
    const key = `${categoryIndex}-${questionIndex}`;
    
    const index = expandedQuestions.indexOf(key);
    if (index > -1) {
      expandedQuestions = expandedQuestions.filter(q => q !== key);
    } else {
      expandedQuestions = [...expandedQuestions, key];
    }
  }

  function isExpanded(categoryIndex: number, questionIndex: number): boolean {
    const key = `${categoryIndex}-${questionIndex}`;
    return expandedQuestions.includes(key);
  }
</script>

<InfoSection title="Common Interview Questions" icon={faQuestionCircle}>
  <div class="mb-6 p-4 bg-blue-50/50 border border-blue-200 rounded-lg">
    <p class="text-blue-800 text-sm leading-relaxed">
      <strong>STAR Method:</strong> These responses follow the STAR framework:
      <strong>Situation</strong> (context), <strong>Task</strong> (what needed to be done), 
      <strong>Action</strong> (what I did), and <strong>Result</strong> (outcome achieved).
      All examples are drawn from my real professional experience at {resume.work.map(job => job.name).join(', ')}.
    </p>
  </div>

  <div class="space-y-8">
    {#each resume.interviewQuestions as category, categoryIndex (categoryIndex)}
      <div class="border border-slate/20 rounded-xl p-6 bg-white/50">
        <h3 class="text-xl font-bold text-slate mb-6 flex items-center">
          <FontAwesomeIcon icon={faLightbulb} class="w-5 h-5 mr-3 text-ocean" />
          {category.category}
        </h3>

        <div class="space-y-6">
          {#each category.questions as questionItem, questionIndex (questionIndex)}
            <div class="border-l-4 border-ocean pl-6">
              <div class="mb-4">
                <button 
                  class="w-full text-left flex items-start justify-between group hover:bg-slate-50/50 p-3 -ml-3 rounded-lg transition-colors duration-200"
                  on:click={() => toggleQuestion(categoryIndex, questionIndex)}
                >
                  <h4 class="font-semibold text-slate text-lg pr-4 group-hover:text-ocean transition-colors duration-200">
                    {questionItem.question}
                  </h4>
                  <div class="flex-shrink-0 mt-1 text-slate/60 group-hover:text-ocean transition-colors duration-200">
                    <FontAwesomeIcon 
                      icon={isExpanded(categoryIndex, questionIndex) ? faChevronDown : faChevronRight} 
                      class="w-4 h-4" 
                    />
                  </div>
                </button>
              </div>

              <!-- Force reactivity by referencing expandedQuestions -->
              {#if expandedQuestions && isExpanded(categoryIndex, questionIndex)}
                <div class="space-y-4">
                <!-- Situation -->
                <div class="bg-blue-50/30 border border-blue-200/50 rounded-lg p-4">
                  <div class="flex items-start mb-2">
                    <div class="mr-3 flex-shrink-0 mt-1">
                      <FontAwesomeIcon icon={faLightbulb} class="w-4 h-4 text-blue-600" />
                    </div>
                    <div class="w-full">
                      <h5 class="font-semibold text-blue-800 text-sm mb-2">SITUATION</h5>
                      <p class="text-blue-700 text-sm leading-relaxed">{questionItem.answer.situation}</p>
                    </div>
                  </div>
                </div>

                <!-- Task -->
                <div class="bg-yellow-50/30 border border-yellow-200/50 rounded-lg p-4">
                  <div class="flex items-start mb-2">
                    <div class="mr-3 flex-shrink-0 mt-1">
                      <FontAwesomeIcon icon={faTasks} class="w-4 h-4 text-yellow-600" />
                    </div>
                    <div class="w-full">
                      <h5 class="font-semibold text-yellow-800 text-sm mb-2">TASK</h5>
                      <p class="text-yellow-700 text-sm leading-relaxed">{questionItem.answer.task}</p>
                    </div>
                  </div>
                </div>

                <!-- Action -->
                <div class="bg-purple-50/30 border border-purple-200/50 rounded-lg p-4">
                  <div class="flex items-start mb-2">
                    <div class="mr-3 flex-shrink-0 mt-1">
                      <FontAwesomeIcon icon={faRocket} class="w-4 h-4 text-purple-600" />
                    </div>
                    <div class="w-full">
                      <h5 class="font-semibold text-purple-800 text-sm mb-2">ACTION</h5>
                      <p class="text-purple-700 text-sm leading-relaxed">{questionItem.answer.action}</p>
                    </div>
                  </div>
                </div>

                <!-- Result -->
                <div class="bg-green-50/30 border border-green-200/50 rounded-lg p-4">
                  <div class="flex items-start mb-2">
                    <div class="mr-3 flex-shrink-0 mt-1">
                      <FontAwesomeIcon icon={faCheckCircle} class="w-4 h-4 text-green-600" />
                    </div>
                    <div class="w-full">
                      <h5 class="font-semibold text-green-800 text-sm mb-2">RESULT</h5>
                      <p class="text-green-700 text-sm leading-relaxed">{questionItem.answer.result}</p>
                    </div>
                  </div>
                </div>
                </div>
              {/if}
            </div>
          {/each}
        </div>
      </div>
    {/each}
  </div>

  <div class="mt-8 p-4 bg-slate-50/50 border border-slate-200 rounded-lg">
    <p class="text-slate-700 text-sm leading-relaxed">
      <strong>Note:</strong> These examples represent real situations from my professional experience. 
      I can provide additional details, metrics, or technical specifics for any of these scenarios during our conversation. 
      All outcomes mentioned are measurable and verifiable through references or project documentation.
    </p>
  </div>
</InfoSection>