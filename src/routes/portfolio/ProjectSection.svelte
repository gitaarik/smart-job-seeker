<script lang="ts">
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import { faCalendarAlt, faCheckCircle, faBullseye } from "@fortawesome/free-solid-svg-icons";

  export let project: any;
  export let companyName: string;
</script>

<div class="bg-white/60 rounded-lg border border-ocean/20 p-4 sm:p-6">
  <!-- Project Header -->
  <div class="mb-6">
    <!-- Breadcrumb -->
    <div class="text-xs text-slate/60 mb-3 flex items-center">
      <span>Professional Experience</span>
      <span class="mx-2">›</span>
      <span>{companyName}</span>
      <span class="mx-2">›</span>
      <span class="text-teal font-medium">{project.name}</span>
    </div>
    
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3">
      <h3 class="text-xl font-bold text-slate">{project.name}</h3>
      <div class="flex items-center text-sm text-teal mt-1 sm:mt-0">
        <FontAwesomeIcon icon={faCalendarAlt} class="w-3 h-3 mr-1" />
        <span>
          {new Date(project.startDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} - 
          {new Date(project.endDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
        </span>
      </div>
    </div>

    <!-- Summary -->
    <div class="bg-teal/5 border-l-4 border-teal p-4 rounded-r-lg">
      <p class="text-slate font-medium">{project.summary}</p>
    </div>
  </div>

  <!-- Project Details -->
  <div class="space-y-6">
    <!-- Description -->
    <div>
      <h4 class="flex items-center text-lg font-semibold text-slate mb-3">
        <FontAwesomeIcon icon={faBullseye} class="w-4 h-4 mr-2 text-ocean" />
        Project Details
      </h4>
      <p class="text-slate leading-relaxed">{project.description}</p>
    </div>

    <!-- Outcome -->
    <div>
      <h4 class="flex items-center text-lg font-semibold text-slate mb-3">
        <FontAwesomeIcon icon={faCheckCircle} class="w-4 h-4 mr-2 text-emerald-500" />
        Outcome & Impact
      </h4>
      <p class="text-slate leading-relaxed">{project.outcome}</p>
    </div>
  </div>
</div>