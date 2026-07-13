<script lang="ts">
  import type { PageData } from "./$types";
  import { ProfileDisplay } from "$lib/components/ProfileDisplay";
  import StructuredResume from "$lib/components/StructuredResume/StructuredResume.svelte";

  let { data }: { data: PageData } = $props();
</script>

{#if data.profile}
  {#if data.template}
    <StructuredResume profile={data.profile} config={data.template.config} type="resume" versionId={data.versionId} />
  {:else}
    <ProfileDisplay profile={data.profile} type="resume" versionId={data.versionId} />
  {/if}
{/if}
