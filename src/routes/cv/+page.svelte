<script lang="ts">
  import HeaderSection from "./HeaderSection.svelte";
  import InfoMenu from "./InfoMenu.svelte";
  import OverviewSection from "./OverviewSection.svelte";
  import TechnicalExpertiseSection from "./TechnicalExpertiseSection.svelte";
  import ProfessionalExperience from "./ProfessionalExperience.svelte";
  import ReferencesSection from "./ReferencesSection.svelte";
  import EducationSection from "./EducationSection.svelte";
  import ProjectsSection from "./ProjectsSection.svelte";
  import HobbiesInterestsSection from "./HobbiesInterestsSection.svelte";
  import IdealCompanySection from "./IdealCompanySection.svelte";
  import FiveYearVisionSection from "./FiveYearVisionSection.svelte";
  import WeaknessesSection from "./WeaknessesSection.svelte";
  import CurrentChallengesSection from "./CurrentChallengesSection.svelte";
  import SelfReflectionSection from "./SelfReflectionSection.svelte";
  import CareerPrioritiesSection from "./CareerPrioritiesSection.svelte";
  import FlowStateSection from "./FlowStateSection.svelte";
  import WhatExcitesMeSection from "./WhatExcitesMeSection.svelte";
  import PersonalityAndMethodologies from "./PersonalityAndMethodologies.svelte";
  import WorkAccomplishmentSection from "./WorkAccomplishmentSection.svelte";
  import InterviewQuestionsSection from "./InterviewQuestionsSection.svelte";
  import ThemeSwitcher from "$lib/components/ThemeSwitcher.svelte";

  let activeSection = "overview";

  function handleSectionChange(event: CustomEvent) {
    activeSection = event.detail.section;
  }

  // Listen for section change events
  import { onMount } from "svelte";

  onMount(() => {
    document.addEventListener("sectionChange", handleSectionChange);
    return () => {
      document.removeEventListener("sectionChange", handleSectionChange);
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

    <OverviewSection />
    <TechnicalExpertiseSection />
    <PersonalityAndMethodologies />
    <ProfessionalExperience />
    <EducationSection />
    <ProjectsSection />
    <HobbiesInterestsSection />
    <ReferencesSection />
  </div>
</div>
