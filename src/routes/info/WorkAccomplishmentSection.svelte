<script lang="ts">
  import InfoSection from "./InfoSection.svelte";
  import { resume } from "$lib/data/resume";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import { faTrophy, faChartLine, faRocket, faMobile, faShieldAlt } from "@fortawesome/free-solid-svg-icons";

  // Get the Chipta work experience (the most impressive one)
  const chiptaWork = resume.work[0];
  
  // Select the most impressive highlights
  const topAccomplishments = [
    {
      title: "Leading Platform Scaling Revolution",
      description: "Led teams of 3-5 developers at innovative ticketing platform for over 10 years, scaling the platform from concept to processing thousands of orders per minute. Optimized platform performance by 30-60%, enabling the company to handle massive traffic spikes during high-demand events.",
      icon: faChartLine,
      impact: "Thousands of orders per minute processing capability",
      metrics: "30-60% performance optimization"
    },
    {
      title: "Mobile Revenue Transformation",
      description: "Built React Native mobile apps that increased revenue by 40% and modernized frontend interfaces with React, increasing user engagement by 30%. This mobile-first approach opened entirely new revenue streams and customer segments.",
      icon: faMobile,
      impact: "40% revenue increase from mobile apps",
      metrics: "30% increase in user engagement"
    },
    {
      title: "System Reliability & Quality Revolution",
      description: "Established comprehensive testing suites with +80% coverage and orchestrated CI/CD systems that reduced deploy time by 80%. This transformed the development process from risky manual deployments to confident, frequent releases.",
      icon: faShieldAlt,
      impact: "90% reduction in regression bugs",
      metrics: "80% reduction in deployment time"
    }
  ];
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
            Scaling Chipta: From Startup to High-Traffic Platform
          </h3>
          <p class="text-slate/80 text-base leading-relaxed">
            My most impressive accomplishment was <strong>leading the complete transformation of Chipta</strong> 
            from a small ticketing concept to a robust, high-traffic platform processing thousands of orders per minute. 
            Over 10 years as Lead Developer, I orchestrated every aspect of the technical evolution while building 
            and managing development teams.
          </p>
        </div>
      </div>
    </div>

    <!-- Key Accomplishments -->
    <div class="space-y-6">
      <h4 class="text-lg font-semibold text-slate border-b border-cloud pb-2">
        Three Pillars of Success
      </h4>
      
      {#each topAccomplishments as accomplishment}
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
            This decade-long technical leadership journey demonstrates my ability to <strong>scale both technology 
            and teams</strong> while maintaining code quality and system reliability. The platform I built became 
            the backbone for processing <strong>tens of millions in payment transactions</strong> and enabled the 
            company to expand internationally. Most importantly, I established sustainable development practices 
            that allowed the team to continue innovating long after each individual project was completed.
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