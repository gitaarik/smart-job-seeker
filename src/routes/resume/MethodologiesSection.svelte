<script lang="ts">
  import ResumeSection from "./ResumeSection.svelte";
  import CircleList from "./CircleList.svelte";
  import { faProjectDiagram } from "@fortawesome/free-solid-svg-icons";

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
</script>

<ResumeSection title="Project & Development Methodologies" icon={faProjectDiagram}>
  <CircleList>
    {#each methodologies as methodology}
      <li>
        <strong>{methodology}</strong>
      </li>
    {/each}
  </CircleList>
</ResumeSection>
