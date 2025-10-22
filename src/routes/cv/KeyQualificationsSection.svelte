<script lang="ts">
  import InfoSection from "./InfoSection.svelte";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import { faStar } from "@fortawesome/free-solid-svg-icons";

  let props = $props();
  const profile = props.profile;
</script>

<InfoSection title="Technical Highlights" icon={faStar}>
  <ul class="space-y-4 print:space-y-2 ml-1">
    {#each profile.highlights as
      highlight
      (highlight.text)
    }
      <li class="flex items-start">
        <FontAwesomeIcon
          icon={highlight.fa_icon}
          class="mr-3 mt-1 w-4 h-4"
        />
        <span>{@html highlight.text}</span>
      </li>
    {/each}
  </ul>
</InfoSection>
