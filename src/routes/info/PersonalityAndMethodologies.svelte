<script lang="ts">
  import ResumeSection from "./ResumeSection.svelte";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faCogs,
    faUser,
    faUserCog,
  } from "@fortawesome/free-solid-svg-icons";

  const methodologies = [
    "Agile",
    "Scrum",
    "Kanban",
    "Extreme Programming (XP)",
    "AI-accelerated development",
    "Secure by design",
    "Test-driven development (TDD)",
    "User experience design (UXD)",
    "Asynchronous Workflows",
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

<ResumeSection title="Personality & Methodologies " icon={faUserCog}>
  <div class="space-y-8">
    <div>
      <h3
        class="flex items-center pt-4 pb-2 mb-5 border-b border-ocean"
      >
        <span class="text-lg font-medium">Personality Traits</span>
        <FontAwesomeIcon icon={faUser} class="w-4 h-4 ml-2" />
      </h3>
      <ul class="flex flex-wrap gap-2">
        {#each traits as trait (trait)}
          <li
            class="text-sm font-semibold px-2 py-2 bg-mist hover:bg-ice rounded-md border border-aqua transition-colors duration-200 text-center"
          >
            {trait}
          </li>
        {/each}
      </ul>
    </div>

    <div>
      <h3
        class="flex items-center pt-4 pb-2 mb-5 border-b border-ocean"
      >
        <span class="text-lg font-medium">Development Methodologies</span>
        <FontAwesomeIcon icon={faCogs} class="w-4 h-4 ml-2" />
      </h3>
      <ul class="flex flex-wrap gap-2">
        {#each methodologies as methodology (methodology)}
          <li
            class="text-sm font-semibold px-2 py-2 bg-mist hover:bg-ice rounded-md border border-aqua transition-colors duration-200 text-center"
          >
            {methodology}
          </li>
        {/each}
      </ul>
    </div>
  </div>
</ResumeSection>
