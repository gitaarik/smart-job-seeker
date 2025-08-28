<script lang="ts">
  import InfoSection from "./InfoSection.svelte";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import { faStar } from "@fortawesome/free-solid-svg-icons";
  import { resume } from "$lib/data/resume";
</script>

<InfoSection title="Technical Highlights" icon={faStar}>
  <ul class="space-y-4 print:space-y-2 ml-1">
    {#each resume.basics.highlights as
      qualification
      (qualification.description)
    }
      <li class="flex items-start">
        <FontAwesomeIcon
          icon={qualification.icon}
          class="mr-3 mt-1 w-4 h-4"
        />
        <span>{@html qualification.description}</span>
      </li>
    {/each}
  </ul>
</InfoSection>
