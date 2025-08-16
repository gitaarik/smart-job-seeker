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

<!-- SVG Icons -->
<svg id="icons" class="hidden">
  <defs>
    <!-- Add your SVG icon definitions here -->
  </defs>
</svg>

<div class="min-h-screen bg-slate-200 text-cyan-900 font-['Noto_Sans',sans-serif]">
  <div class="py-8 px-4 print:py-0 print:px-0">
    <div class="max-w-[800px] mx-auto">
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
