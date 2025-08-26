<script lang="ts">
  import HeaderSection from "./HeaderSection.svelte";
  import ResumeMenu from "./ResumeMenu.svelte";
  import OverviewSection from "./OverviewSection.svelte";
  import TechnicalExpertiseSection from "./TechnicalExpertiseSection.svelte";
  import ProfessionalExperience from "./ProfessionalExperience.svelte";
  import ReferencesSection from "./ReferencesSection.svelte";
  import EducationSection from "./EducationSection.svelte";
  import HobbiesInterestsSection from "./HobbiesInterestsSection.svelte";
  import IdealCompanySection from "./IdealCompanySection.svelte";
  import PersonalityAndMethodologies from "./PersonalityAndMethodologies.svelte";
  import ThemeSwitcher from "$lib/components/ThemeSwitcher.svelte";

  let activeSection = "overview";

  function handleSectionChange(event: CustomEvent) {
    activeSection = event.detail.section;
  }

  // Listen for section change events
  import { onMount } from 'svelte';
  
  onMount(() => {
    document.addEventListener('sectionChange', handleSectionChange);
    return () => {
      document.removeEventListener('sectionChange', handleSectionChange);
    };
  });
</script>

<svelte:head>
  <title>
    Rik Wanders - Senior Full Stack Developer
  </title>
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0, user-scalable=no"
  />
</svelte:head>

<div class="print:hidden">
  <ThemeSwitcher />
</div>

<div
  class="min-h-screen bg-mist print:bg-transparent print:my-15 print:mx-12 text-slate"
>
  <div
    class="flex flex-col gap-10 print:gap-7 py-6 px-4 print:p-0 max-w-[800px] mx-auto"
  >
    <HeaderSection />
    
    <div class="print:hidden">
      <ResumeMenu {activeSection} />
    </div>

    <div class="print:break-inside-avoid">
      {#if activeSection === "overview"}
        <OverviewSection />
      {:else if activeSection === "personality"}
        <PersonalityAndMethodologies />
      {:else if activeSection === "technical"}
        <TechnicalExpertiseSection />
      {:else if activeSection === "experience"}
        <ProfessionalExperience />
      {:else if activeSection === "education"}
        <EducationSection />
      {:else if activeSection === "interests"}
        <HobbiesInterestsSection />
      {:else if activeSection === "idealCompany"}
        <IdealCompanySection />
      {:else if activeSection === "references"}
        <ReferencesSection />
      {/if}
    </div>
  </div>
</div>
