<script lang="ts">
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();
</script>

<svelte:head>
  <title>Smart Job Seeker</title>
</svelte:head>

{#if data.error}
  <div class="min-h-screen flex items-center justify-center bg-gray-50">
    <div class="text-center">
      <h1 class="text-2xl font-bold text-gray-900 mb-4">
        Configuration Error
      </h1>
      <p class="text-gray-600">
        {data.error}
      </p>
      <p class="text-sm text-gray-500 mt-4">
        Please contact the administrator to set up a default profile.
      </p>
    </div>
  </div>
{/if}
