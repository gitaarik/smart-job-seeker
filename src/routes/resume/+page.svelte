<script lang="ts">
  import HeaderSection from "./HeaderSection.svelte";
  import ProfileSection from "./ProfileSection.svelte";
  import SummarySection from "./SummarySection.svelte";
  import KeyQualificationsSection from "./KeyQualificationsSection.svelte";
  import TechnicalExpertiseSection from "./TechnicalExpertiseSection.svelte";
  import PersonalityAndMethodologies from "./PersonalityAndMethodologies.svelte";
  import ProfessionalExperience from "./ProfessionalExperience.svelte";
  import ReferencesSection from "./ReferencesSection.svelte";
</script>

<svelte:head>
  <title>Rik Wanders - Senior Full Stack Developer</title>
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0, user-scalable=no"
  />
</svelte:head>

<div
  class="min-h-screen bg-slate-200 print:bg-white text-cyan-900 font-['Noto_Sans',sans-serif]"
>
  <div class="flex flex-col gap-10 py-6 px-4 print:p-0 max-w-[800px] mx-auto">
    <HeaderSection />
    <ProfileSection />
    <SummarySection />
    <KeyQualificationsSection />
    <TechnicalExpertiseSection />
    <PersonalityAndMethodologies />
    <ProfessionalExperience />
    <ReferencesSection />
  </div>
</div>
