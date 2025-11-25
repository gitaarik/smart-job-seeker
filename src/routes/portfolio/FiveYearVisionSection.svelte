<script lang="ts">
  import InfoSection from "./InfoSection.svelte";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import { 
    faRocket,
    faChartBar,
    faRobot,
    faServer,
    faPalette,
    faBrain
  } from "@fortawesome/free-solid-svg-icons";
  import { resume } from "$lib/data/resume";

  let activeVariation = "hybrid";

  const variations = [
    {
      id: "hybrid",
      label: "AI-Driven Leader",
      icon: faBrain,
    },
    {
      id: "general",
      label: "Technical Leadership",
      icon: faRocket,
    },
    {
      id: "datascience",
      label: "Data Science",
      icon: faChartBar,
    },
    {
      id: "aiml",
      label: "AI/ML Specialist",
      icon: faRobot,
    },
    {
      id: "backend",
      label: "Backend Specialist",
      icon: faServer,
    },
    {
      id: "frontend",
      label: "Frontend Specialist",
      icon: faPalette,
    },
  ];

  function handleVariationClick(variationId: string) {
    activeVariation = variationId;
  }

  // Convert markdown-style bold text to HTML
  function formatContent(content: string): string {
    return content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  }
</script>

<InfoSection title="Me in 5 Years" icon={faRocket}>
  <!-- Career Path Navigation Menu -->
  <div class="print:hidden mb-6">
    <nav class="bg-frost/50 border border-ocean/30 rounded-lg p-2">
      <div class="flex flex-wrap gap-1">
        {#each variations as variation}
          <button
            class="flex items-center px-3 py-2 rounded-md text-sm transition-colors duration-200 {activeVariation === variation.id
              ? 'bg-ocean text-white'
              : 'text-slate hover:bg-ocean/10 hover:text-teal'}"
            onclick={() => handleVariationClick(variation.id)}
          >
            <FontAwesomeIcon icon={variation.icon} class="w-3 h-3 mr-2" />
            <span class="whitespace-nowrap">{variation.label}</span>
          </button>
        {/each}
      </div>
    </nav>
  </div>

  <!-- Active Variation Content -->
  <div class="prose prose-slate max-w-none">
    <h3 class="text-xl font-semibold text-slate mb-4">
      {resume.fiveYearVision.variations[activeVariation as keyof typeof resume.fiveYearVision.variations].title}
    </h3>
    <div class="text-slate leading-relaxed space-y-4">
      {#each resume.fiveYearVision.variations[activeVariation as keyof typeof resume.fiveYearVision.variations].content.split('\n\n') as paragraph}
        {#if paragraph.trim()}
          <p class="mb-4">{@html formatContent(paragraph.trim())}</p>
        {/if}
      {/each}
    </div>
  </div>
</InfoSection>