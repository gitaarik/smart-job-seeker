<script lang="ts">
  import InfoSection from "./InfoSection.svelte";
  import { faCompass } from "@fortawesome/free-solid-svg-icons";
  import { resume } from "$lib/data/resume";
</script>

<InfoSection title="Summary" icon={faCompass} class="leading-relaxed">
  <p class="mb-4">
    {resume.basics.summary}
  </p>
</InfoSection>
