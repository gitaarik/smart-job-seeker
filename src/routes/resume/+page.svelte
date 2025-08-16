<script>
  import HeaderSection from './HeaderSection.svelte';
  import ProfileSection from './ProfileSection.svelte';
  import SummarySection from './SummarySection.svelte';
  import KeyQualificationsSection from './KeyQualificationsSection.svelte';
  import TechnicalExpertiseSection from './TechnicalExpertiseSection.svelte';
  import MethodologiesSection from './MethodologiesSection.svelte';
  import PersonalityTraitsSection from './PersonalityTraitsSection.svelte';
  import ProfessionalExperience from './ProfessionalExperience.svelte';
  import ReferencesSection from './ReferencesSection.svelte';
</script>

<svelte:head>
  <title>Rik Wanders - Senior Full Stack Developer</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />
</svelte:head>

<!-- Font definitions and custom classes -->
<style>
  @font-face {
    font-family: "Noto Sans";
    font-style: normal;
    font-weight: 300;
    font-display: swap;
    src: url("/fonts/NotoSans-Light.woff2") format("woff2");
  }
  
  @font-face {
    font-family: "Noto Sans";
    font-style: normal;
    font-weight: 400;
    font-display: swap;
    src: url("/fonts/NotoSans-Regular.woff2") format("woff2");
  }
  
  @font-face {
    font-family: "Noto Sans";
    font-style: normal;
    font-weight: 500;
    font-display: swap;
    src: url("/fonts/NotoSans-Medium.woff2") format("woff2");
  }
  
  @font-face {
    font-family: "Noto Sans";
    font-style: normal;
    font-weight: 600;
    font-display: swap;
    src: url("/fonts/NotoSans-SemiBold.woff2") format("woff2");
  }
  
  @font-face {
    font-family: "Noto Sans";
    font-style: normal;
    font-weight: 700;
    font-display: swap;
    src: url("/fonts/NotoSans-Bold.woff2") format("woff2");
  }
</style>

<!-- SVG Icons -->
<svg id="icons" class="hidden">
  <defs>
    <!-- Add your SVG icon definitions here -->
  </defs>
</svg>

<div class="min-h-screen bg-slate-300 text-cyan-900 font-['Noto_Sans',sans-serif] print:bg-white">
  <div class="py-8 px-4 print:py-0 print:px-0">
    <div class="max-w-4xl mx-auto">
      <HeaderSection />
      <ProfileSection />
      <SummarySection />
      <KeyQualificationsSection />
      <TechnicalExpertiseSection />
      <MethodologiesSection />
      <PersonalityTraitsSection />
      <ProfessionalExperience />
      <ReferencesSection />

    </div>
  </div>
</div>
