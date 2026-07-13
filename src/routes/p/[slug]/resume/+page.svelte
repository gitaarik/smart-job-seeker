<script lang="ts">
  import type { PageData } from "./$types";
  import { page } from "$app/state";
  import { ProfileDisplay } from "$lib/components/ProfileDisplay";
  import CitrusResume from "$lib/components/CitrusResume/CitrusResume.svelte";

  let { data }: { data: PageData } = $props();

  const template = $derived(page.url.searchParams.get("template"));
</script>

{#if data.profile}
  {#if template === "citrus"}
    <CitrusResume profile={data.profile} type="resume" versionId={data.versionId} />
  {:else}
    <ProfileDisplay profile={data.profile} type="resume" versionId={data.versionId} />
  {/if}
{/if}
