<script lang="ts">
  import type { PageData } from "./$types";
  import ProfileDisplay from "$lib/components/ProfileDisplay.svelte";

  export let data: PageData;
</script>

{#if data.profile}
  <ProfileDisplay profile={data.profile} type="cv" />
{/if}
