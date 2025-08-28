<script lang="ts">
  import ResumeSection from "./ResumeSection.svelte";
  import EmploymentSection from "./EmploymentSection.svelte";
  import { resume } from "$lib/data/resume";
  import { faGlobe } from "@fortawesome/free-solid-svg-icons";

  let activeWorkIndex = 0;

  function handleWorkClick(index: number) {
    activeWorkIndex = index;
  }
</script>

<ResumeSection title="Professional Experience" icon={faGlobe}>
  <!-- Work Experience Navigation Menu -->
  <div class="print:hidden mb-6">
    <nav class="bg-frost/50 border border-ocean/30 rounded-lg p-2">
      <div class="flex flex-wrap gap-1">
        {#each resume.work as work, index}
          <button
            class="flex items-center px-3 py-2 rounded-md text-sm transition-colors duration-200 {activeWorkIndex === index
              ? 'bg-ocean text-white'
              : 'text-slate hover:bg-ocean/10 hover:text-teal'}"
            on:click={() => handleWorkClick(index)}
          >
            <span class="whitespace-nowrap">{work.name}</span>
            <span class="ml-2 text-xs opacity-70">
              {work.startDate.substring(0, 4)}-{work.endDate.substring(0, 4)}
            </span>
          </button>
        {/each}
      </div>
    </nav>
  </div>

  <!-- Active Work Experience -->
  <div class="print:hidden">
    <EmploymentSection
      data={resume.work[activeWorkIndex]}
      isFirst={true}
    />
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
</ResumeSection>
