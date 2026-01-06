<script lang="ts">
  import type { PageData } from "./$types";
  import ThemeSwitcher from "$lib/components/ThemeSwitcher.svelte";
  import HeaderSection from "./components/HeaderSection.svelte";
  import ProfileSection from "./components/ProfileSection.svelte";
  import HobbiesInterestsSection from "./components/HobbiesInterestsSection.svelte";
  import ProfessionalExperience from "./components/ProfessionalExperience.svelte";
  import ReferencesSection from "./components/ReferencesSection.svelte";
  import SummarySection from "./components/SummarySection.svelte";
  import TechnicalExpertiseSection from "./components/TechnicalExpertiseSection.svelte";

  let { data }: { data: PageData } = $props();
</script>

<svelte:head>
  {#if data.profile}
    <title>{data.profile.name} - {data.profile.title}</title>
  {:else}
    <title>Home</title>
  {/if}
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
    <ProfileSection profile={data.profile} />
    <SummarySection profile={data.profile} />
    <TechnicalExpertiseSection profile={data.profile} />
    <ProfessionalExperience profile={data.profile} />
    <ReferencesSection />
    <HobbiesInterestsSection profile={data.profile} />
  </div>
</div>
