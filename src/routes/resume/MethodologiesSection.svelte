<script lang="ts">
  import ResumeSection from "./ResumeSection.svelte";
  import BulletList from "./BulletList.svelte";
  import BulletItem from "./BulletItem.svelte";
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
  <BulletList>
    {#each methodologies as methodology}
      <BulletItem>
        <strong>{methodology}</strong>
      </BulletItem>
    {/each}
  </BulletList>
</ResumeSection>
