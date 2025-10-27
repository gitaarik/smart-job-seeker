<script lang="ts">
  import type { PageData } from "./$types";
  import HeaderSection from "./HeaderSection.svelte";
  import OverviewSection from "./OverviewSection.svelte";
  import TechnicalExpertiseSection from "./TechnicalExpertiseSection.svelte";
  import ProfessionalExperience from "./ProfessionalExperience.svelte";
  import ReferencesSection from "./ReferencesSection.svelte";
  import EducationSection from "./EducationSection.svelte";
  import ProjectsSection from "./ProjectsSection.svelte";
  import HobbiesInterestsSection from "./HobbiesInterestsSection.svelte";
  import PersonalityAndMethodologies from "./PersonalityAndMethodologies.svelte";
  import ThemeSwitcher from "$lib/components/ThemeSwitcher.svelte";

  export let data: PageData;
</script>

<svelte:head>
  <title>
    {data.profile.name} - {data.profile.title}
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
    <HeaderSection profile={data.profile} />
    <OverviewSection profile={data.profile} />
    <TechnicalExpertiseSection profile={data.profile} />
    <PersonalityAndMethodologies profile={data.profile} />
    <ProfessionalExperience profile={data.profile} />
    <EducationSection profile={data.profile} />
    <ProjectsSection />
    <HobbiesInterestsSection />
    <ReferencesSection />
  </div>
</div>
