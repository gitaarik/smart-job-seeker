<script lang="ts">
  import ResumeSection from "./ResumeSection.svelte";
  import CircleList from "./CircleList.svelte";
  import { faEye } from "@fortawesome/free-solid-svg-icons";

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

<ResumeSection title="Personality Traits" icon={faEye}>
  <CircleList class="grid grid-cols-3 gap-2">
    {#each traits as trait (trait)}
      <li>
        <strong>{trait}</strong>
      </li>
    {/each}
  </CircleList>
</ResumeSection>
