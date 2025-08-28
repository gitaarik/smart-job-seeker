<script lang="ts">
  import ResumeSection from "./ResumeSection.svelte";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import { faHeart } from "@fortawesome/free-solid-svg-icons";
  import { resume } from "$lib/data/resume";
</script>

<ResumeSection title="Hobbies / Interests" icon={faHeart}>
  <ul class="grid grid-cols-2 gap-4">
    {#each resume.interests as interest, index (index)}
      <li class="flex items-center">
        <div class="mr-3 flex-shrink-0">
          <FontAwesomeIcon icon={interest.icon} class="w-4 h-4 text-ocean" />
        </div>
        <span class="text-slate">{interest.name}</span>
      </li>
    {/each}
  </ul>
</ResumeSection>