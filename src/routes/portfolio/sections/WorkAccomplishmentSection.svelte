<script lang="ts">
  import InfoSection from "./InfoSection.svelte";
  import { resume } from "$lib/data/resume";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import { faTrophy, faChartLine, faRocket, faMobile, faShieldAlt } from "@fortawesome/free-solid-svg-icons";

  // Get the work accomplishment data and Chipta work experience
  const workAccomplishment = resume.workAccomplishment;
  const chiptaWork = resume.work[0];
  
  // Map accomplishments to their respective icons
  const accomplishmentsWithIcons = workAccomplishment.accomplishments.map((acc, index) => ({
    ...acc,
    icon: [faChartLine, faMobile, faShieldAlt][index]
  }));
</script>

<InfoSection title="Most Impressive Work Accomplishment" icon={faTrophy}>
  <div class="space-y-8">
    <!-- Introduction -->
    <div class="bg-gradient-to-r from-frost to-mist border border-ocean/20 rounded-xl p-6">
      <div class="flex items-start gap-4">
        <div class="flex-shrink-0">
          <FontAwesomeIcon icon={faTrophy} class="w-8 h-8 text-amber-500" />
        </div>
        <div>
          <h3 class="text-xl font-semibold text-slate mb-3">
            {workAccomplishment.title}
          </h3>
          <p class="text-slate/80 text-base leading-relaxed">
            {workAccomplishment.description}
          </p>
        </div>
      </div>
    </div>

    <!-- Key Accomplishments -->
    <div class="space-y-6">
      <h4 class="text-lg font-semibold text-slate border-b border-cloud pb-2">
        Three Pillars of Success
      </h4>
      
      {#each accomplishmentsWithIcons as accomplishment}
        <div class="bg-white border border-cloud rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
          <div class="flex items-start gap-4">
            <div class="flex-shrink-0 p-3 bg-frost rounded-lg">
              <FontAwesomeIcon icon={accomplishment.icon} class="w-6 h-6 text-ocean" />
            </div>
            <div class="flex-1">
              <h5 class="text-lg font-semibold text-slate mb-3">
                {accomplishment.title}
              </h5>
              <p class="text-slate/80 mb-4 leading-relaxed">
                {accomplishment.description}
              </p>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="bg-frost/50 rounded-lg p-3">
                  <div class="text-sm font-medium text-teal">Impact</div>
                  <div class="text-slate">{accomplishment.impact}</div>
                </div>
                <div class="bg-frost/50 rounded-lg p-3">
                  <div class="text-sm font-medium text-teal">Metrics</div>
                  <div class="text-slate">{accomplishment.metrics}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      {/each}
    </div>

    <!-- Overall Impact -->
    <div class="bg-gradient-to-r from-teal/5 to-ocean/5 border border-teal/20 rounded-xl p-6">
      <div class="flex items-start gap-4">
        <div class="flex-shrink-0">
          <FontAwesomeIcon icon={faRocket} class="w-6 h-6 text-teal" />
        </div>
        <div>
          <h4 class="text-lg font-semibold text-slate mb-3">
            Long-term Strategic Impact
          </h4>
          <p class="text-slate/80 leading-relaxed">
            {workAccomplishment.impact}
          </p>
        </div>
      </div>
    </div>

    <!-- Technologies Used -->
    <div class="border-t border-cloud pt-6">
      <h4 class="text-base font-semibold text-slate mb-4">Key Technologies Used</h4>
      <div class="flex flex-wrap gap-2">
        {#each chiptaWork.technologies.slice(0, 12) as tech}
          <span class="px-3 py-1 bg-frost text-slate text-sm rounded-full border border-ocean/20">
            {tech}
          </span>
        {/each}
      </div>
    </div>
  </div>
</InfoSection>