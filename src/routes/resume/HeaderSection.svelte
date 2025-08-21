<script lang="ts">
  import Logo from "$lib/components/Logo.svelte";
  import { resume } from "$lib/data/resume";
</script>

<header class="flex flex-col items-center">
  <div>
    <Logo class="h-30 w-30" />
  </div>

  <h1
    class="text-3xl font-medium mt-2 mb-4"
  >
    {resume.basics.name}
  </h1>

  <h2 class="text-xl">
    {resume.basics.label}
  </h2>
  <!---->
  <!-- <h3> -->
  <!--   Python • Django • React • Node.js -->
  <!-- </h3> -->
</header>
