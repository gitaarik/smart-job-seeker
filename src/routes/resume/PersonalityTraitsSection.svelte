<script lang="ts">
  import ResumeSection from "./ResumeSection.svelte";
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
  <ul class="grid grid-cols-3 gap-2">
    {#each traits as trait}
      <li class="ml-8 list-disc">
        <strong>{trait}</strong>
      </li>
    {/each}
  </ul>
</ResumeSection>
