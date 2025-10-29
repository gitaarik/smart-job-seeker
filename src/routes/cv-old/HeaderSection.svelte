<script lang="ts">
  import Logo from "$lib/components/Logo.svelte";

  export let profile;
</script>

<header class="flex flex-col items-center">
  <div>
    <Logo class="h-30 w-30" />
  </div>

  <h1
    class="text-3xl font-medium mt-2 mb-4"
  >
    {profile.name}
  </h1>

  <h2 class="text-xl">
    {profile.title}
  </h2>
</header>
