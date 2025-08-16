<script lang="ts">
  import ResumeSection from "./ResumeSection.svelte";
  import CircleList from "./CircleList.svelte";
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
  <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
    <div>
      <h3
        class="flex items-center justify-between pt-4 pb-2 mb-5 border-b border-cyan-700"
      >
        <span class="text-lg font-medium">Personality Traits</span>
        <FontAwesomeIcon icon={faEye} class="w-4 h-4" />
      </h3>
      <CircleList>
        {#each traits as trait (trait)}
          <li>
            <strong>{trait}</strong>
          </li>
        {/each}
      </CircleList>
    </div>

    <div>
      <h3
        class="flex items-center justify-between pt-4 pb-2 mb-5 border-b border-cyan-700"
      >
        <span class="text-lg font-medium">Development Methodologies</span>
        <FontAwesomeIcon icon={faProjectDiagram} class="w-4 h-4" />
      </h3>
      <CircleList>
        {#each methodologies as methodology (methodology)}
          <li>
            <strong>{methodology}</strong>
          </li>
        {/each}
      </CircleList>
    </div>
  </div>
</ResumeSection>

