<script lang="ts">
  import InfoSection from "./InfoSection.svelte";
  import EmploymentSection from "./EmploymentSection.svelte";
  import ProjectSection from "./ProjectSection.svelte";
  import { resume } from "$lib/data/resume";
  import { faGlobe, faFolder, faFileAlt } from "@fortawesome/free-solid-svg-icons";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";

  let activeWorkIndex = 0;
  let activeProjectIndex: number | null = null;
  let showProjects = false;

  function handleWorkClick(index: number) {
    activeWorkIndex = index;
    activeProjectIndex = null;
    showProjects = false;
  }

  function handleProjectClick(projectIndex: number) {
    activeProjectIndex = projectIndex;
    showProjects = true;
  }

  function handleBackToCompany() {
    activeProjectIndex = null;
    showProjects = false;
  }

  $: currentWork = resume.work[activeWorkIndex];
  $: hasProjects = currentWork && currentWork.projects && currentWork.projects.length > 0;
  $: currentProject = activeProjectIndex !== null && currentWork.projects ? currentWork.projects[activeProjectIndex] : null;
</script>

<InfoSection title="Professional Experience" icon={faGlobe}>
  <!-- Work Experience Navigation Menu -->
  <div class="print:hidden mb-6">
    <nav class="bg-frost/50 border border-ocean/30 rounded-lg p-2">
      <div class="flex flex-wrap gap-1">
        {#each resume.work as work, index}
          <button
            class="flex items-center px-3 py-2 rounded-md text-sm transition-colors duration-200 {activeWorkIndex === index && !showProjects
              ? 'bg-ocean text-white'
              : 'text-slate hover:bg-ocean/10 hover:text-teal'}"
            on:click={() => handleWorkClick(index)}
          >
            <FontAwesomeIcon icon={faFolder} class="w-3 h-3 mr-2" />
            <span class="whitespace-nowrap">{work.name}</span>
            <span class="ml-2 text-xs opacity-70">
              {work.startDate.substring(0, 4)}-{work.endDate.substring(0, 4)}
            </span>
            {#if work.projects && work.projects.length > 0}
              <span class="ml-1 text-xs bg-teal/20 text-teal px-2 py-0.5 rounded-full font-medium">
                {work.projects.length} project{work.projects.length > 1 ? 's' : ''}
              </span>
            {/if}
          </button>
        {/each}
      </div>
    </nav>

    <!-- Projects Sub-Menu -->
    {#if hasProjects && activeWorkIndex !== null}
      <div class="mt-4">
        <div class="flex items-center justify-between mb-2">
          <h4 class="text-sm font-medium text-slate flex items-center">
            <FontAwesomeIcon icon={faFileAlt} class="w-3 h-3 mr-2" />
            Projects at {currentWork.name}
          </h4>
          {#if showProjects}
            <button
              on:click={handleBackToCompany}
              class="text-xs text-ocean hover:text-teal transition-colors"
            >
              ← Back to Company Overview
            </button>
          {/if}
        </div>
        <nav class="bg-white/50 border border-ocean/20 rounded-lg p-2">
          <div class="flex flex-wrap gap-1">
            {#each currentWork.projects as project, projectIndex}
              <button
                class="flex items-center px-3 py-2 rounded-md text-sm transition-colors duration-200 {activeProjectIndex === projectIndex
                  ? 'bg-teal text-white'
                  : 'text-slate hover:bg-teal/10 hover:text-teal'}"
                on:click={() => handleProjectClick(projectIndex)}
              >
                <span class="whitespace-nowrap">{project.name}</span>
                <span class="ml-2 text-xs opacity-70">
                  {project.startDate.substring(0, 4)}-{project.endDate.substring(0, 4)}
                </span>
              </button>
            {/each}
          </div>
        </nav>
      </div>
    {/if}
  </div>

  <!-- Active Work Experience or Project -->
  <div class="print:hidden">
    {#if showProjects && currentProject}
      <ProjectSection project={currentProject} companyName={currentWork.name} />
    {:else}
      <EmploymentSection
        data={resume.work[activeWorkIndex]}
        isFirst={true}
      />
    {/if}
  </div>

  <!-- Print Version - All Experiences -->
  <div class="hidden print:block">
    {#each resume.work as work, index (work.name)}
      <EmploymentSection
        data={work}
        isFirst={index === 0}
      />
      {#if index < resume.work.length - 1}
        <hr class="border-cloud my-12" />
        <div class="print:break-before-page"></div>
      {/if}
    {/each}
  </div>
</InfoSection>
