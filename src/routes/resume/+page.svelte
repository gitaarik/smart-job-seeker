<script lang="ts">
  import { page } from "$app/state";
  import HeaderSection from "./HeaderSection.svelte";
  import ProfileSection from "./ProfileSection.svelte";
  import SummarySection from "./SummarySection.svelte";
  import KeyQualificationsSection from "./KeyQualificationsSection.svelte";
  import TechnicalExpertiseSection from "./TechnicalExpertiseSection.svelte";
  import PersonalityAndMethodologies from "./PersonalityAndMethodologies.svelte";
  import ProfessionalExperience from "./ProfessionalExperience.svelte";
  import ReferencesSection from "./ReferencesSection.svelte";
  import ThemeSwitcher from "$lib/components/ThemeSwitcher.svelte";

  // Check for compact mode via query parameter
  const isCompact = page.url.searchParams.get("size") === "compact";

  // Parse timing parameter
  const timingParam = page.url.searchParams.get("timing") || "";
  const timingOptions = timingParam
    ? timingParam.split(",").map((t) => t.trim())
    : [];

  let includesProject = timingOptions.includes("project");
  let includesPartTime = timingOptions.includes("part-time");
  let includesFullTime = timingOptions.includes("full-time");

  if (!includesProject && !includesPartTime && !includesFullTime) {
    includesProject = true;
    includesPartTime = true;
  }
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
    <SummarySection {includesProject} {includesPartTime} {includesFullTime} />
    <KeyQualificationsSection />

    <div class="print:py-10 print:break-inside-avoid">
      <TechnicalExpertiseSection />
    </div>

    <!-- {#if !isCompact} -->
    <!--   <div class="print:py-10 print:break-inside-avoid"> -->
    <!--     <PersonalityAndMethodologies /> -->
    <!--   </div> -->
    <!-- {/if} -->

    <div class="print:py-10 print:break-inside-avoid">
      <ProfessionalExperience {isCompact} />
    </div>

    {#if !isCompact}
      <div class="print:py-10 print:break-inside-avoid">
        <ReferencesSection />
      </div>
    {/if}
  </div>
</div>
