<script lang="ts">
  import HeaderSection from "./HeaderSection.svelte";
  import ProfileSection from "./ProfileSection.svelte";
  import SummarySection from "./SummarySection.svelte";
  import KeyQualificationsSection from "./KeyQualificationsSection.svelte";
  import TechnicalExpertiseSection from "./TechnicalExpertiseSection.svelte";
  import ProfessionalExperience from "./ProfessionalExperience.svelte";
  import ReferencesSection from "./ReferencesSection.svelte";
  import EducationSection from "./EducationSection.svelte";
  import HobbiesInterestsSection from "./HobbiesInterestsSection.svelte";
  import ThemeSwitcher from "$lib/components/ThemeSwitcher.svelte";
  import PersonalityAndMethodologies from "./PersonalityAndMethodologies.svelte";
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
    <ProfileSection />
    <SummarySection />
    <KeyQualificationsSection />

    <div class="print:my-15 print:break-inside-avoid">
      <PersonalityAndMethodologies />
    </div>

    <div class="print:py-10 print:break-inside-avoid">
      <TechnicalExpertiseSection />
    </div>

    <div class="print:py-10 print:break-inside-avoid">
      <ProfessionalExperience />
    </div>

    <div class="print:py-10 print:break-inside-avoid">
      <EducationSection />
    </div>

    <div class="print:py-10 print:break-inside-avoid">
      <HobbiesInterestsSection />
    </div>

    <div class="print:py-10 print:break-inside-avoid">
      <ReferencesSection />
    </div>
  </div>
</div>
