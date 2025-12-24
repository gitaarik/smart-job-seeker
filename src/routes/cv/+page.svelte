<script lang="ts">
  import type { PageData } from "./$types";
  import { ProfileDisplay } from "$lib/components/ProfileDisplay";

  let { data }: { data: PageData } = $props();
</script>

{#if data.profile}
  <ProfileDisplay profile={data.profile} type="cv" />
{/if}
