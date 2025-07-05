<script lang="ts">
  import InfoSection from "./InfoSection.svelte";
  import { faCompass } from "@fortawesome/free-solid-svg-icons";

  let props = $props();
  const profile = props.profile;
</script>

<InfoSection title="Summary" icon={faCompass} class="leading-relaxed">
  <p class="mb-4">
    {profile.summary}
  </p>
</InfoSection>
