<script lang="ts">
  import type { PageData } from "./$types";
  import ProfileDisplay from "$lib/components/ProfileDisplay.svelte";

  export let data: PageData;

  const type = "cv";
</script>

<ProfileDisplay profile={data.profile} {type} />
