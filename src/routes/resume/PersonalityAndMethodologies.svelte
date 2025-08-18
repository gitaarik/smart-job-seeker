<script lang="ts">
  import ResumeSection from "./ResumeSection.svelte";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faEye,
    faProjectDiagram,
  } from "@fortawesome/free-solid-svg-icons";

  const methodologies = [
    "Agile, Scrum, Kanban, Extreme Programming (XP)",
    "AI-accelerated development",
    "Test-driven development (TDD)",
    "Secure by design",
    "User experience design (UXD)",
    "Component-based development",
    "Extensive code reviewing",
    "Writing and maintaining documentation",
    "Pair-programming",
  ];

  const traits = [
    "Responsible",
    "Independent",
    "Disciplined",
    "Organized",
    "Proactive",
    "Creative",
    "Problem solving",
    "Result-oriented",
    "Determined",
  ];
</script>

<ResumeSection title="Personality & Methodologies " icon={faProjectDiagram}>
  <div class="space-y-8">
    <div>
      <h3
        class="flex items-center justify-between pt-4 pb-2 mb-5 border-b border-cyan-700"
      >
        <span class="text-lg font-medium">Personality Traits</span>
        <FontAwesomeIcon icon={faEye} class="w-4 h-4" />
      </h3>
      <div class="flex flex-wrap gap-2">
        {#each traits as trait (trait)}
          <div class="text-sm font-semibold px-2 py-2 bg-gray-200 rounded-md border border-gray-400 hover:bg-gray-300 transition-colors duration-200 text-center">
            {trait}
          </div>
        {/each}
      </div>
    </div>

    <div>
      <h3
        class="flex items-center justify-between pt-4 pb-2 mb-5 border-b border-cyan-700"
      >
        <span class="text-lg font-medium">Development Methodologies</span>
        <FontAwesomeIcon icon={faProjectDiagram} class="w-4 h-4" />
      </h3>
      <div class="flex flex-wrap gap-2">
        {#each methodologies as methodology (methodology)}
          <div class="text-sm font-semibold px-2 py-2 bg-gray-200 rounded-md border border-gray-400 hover:bg-gray-300 transition-colors duration-200 text-center">
            {methodology}
          </div>
        {/each}
      </div>
    </div>
  </div>
</ResumeSection>

