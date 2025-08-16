<script>
  import ProfileSection from './ProfileSection.svelte';
  import SummarySection from './SummarySection.svelte';
  import KeyQualificationsSection from './KeyQualificationsSection.svelte';
  import TechnicalExpertiseSection from './TechnicalExpertiseSection.svelte';
  import MethodologiesSection from './MethodologiesSection.svelte';
  import PersonalityTraitsSection from './PersonalityTraitsSection.svelte';
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
      
      <!-- Header -->
      <header class="text-center mb-12 print:mb-8">
        <div class="text-cyan-700 mb-4">
          <svg height="100" width="100" class="mx-auto"><use href="#logo-icon" /></svg>
        </div>
        <h1 class="text-4xl font-semibold mt-4 mb-8 print:text-3xl print:mt-2 print:mb-5">Rik Wanders</h1>
        <h2 class="text-2xl font-normal mb-5 print:text-xl print:mb-4">Senior Full Stack Developer</h2>
        <h3 class="text-lg font-normal mb-12 print:text-base print:mb-0">Python • Django • React • Node.js</h3>
      </header>

      <ProfileSection />
      <SummarySection />
      <KeyQualificationsSection />
      <TechnicalExpertiseSection />
      <MethodologiesSection />
      <PersonalityTraitsSection />
      <!-- TODO: Add EmploymentHistorySection here -->
      <ReferencesSection />

    </div>
  </div>
</div>