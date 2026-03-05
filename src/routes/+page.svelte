<script lang="ts">
  import Logo from "$lib/components/Logo.svelte";
  import ThemeSwitcher from "$lib/components/ThemeSwitcher.svelte";
</script>

<svelte:head>
  <title>Smart Job Seeker</title>
  <meta
    name="description"
    content="Your job search is about to change. Smart Job Seeker — coming soon."
  />
</svelte:head>

<div class="fixed top-0 right-0 z-50">
  <ThemeSwitcher />
</div>

<main class="flex min-h-screen flex-col">
  <!-- Hero -->
  <section
    class="flex flex-1 flex-col items-center justify-center bg-ice px-5 py-28 text-center transition-colors sm:px-10"
  >
    <Logo class="h-32 w-32 sm:h-40 sm:w-40" />

    <h1 class="mt-8 text-4xl font-semibold sm:text-5xl">
      Smart Job Seeker
    </h1>

    <p class="mt-6 max-w-md text-xl opacity-70">
      Something is coming for the way you look for work.
    </p>
  </section>

  <!-- Teaser -->
  <section
    class="bg-navy px-5 py-24 text-center text-pearl transition-colors sm:px-10"
  >
    <p class="mx-auto max-w-lg text-lg leading-relaxed opacity-80">
      What if your next job wasn't something you had to hunt down — but
      something that found its way to you?
    </p>
    <p class="mx-auto mt-8 max-w-sm text-sm tracking-wide uppercase opacity-50">
      Stay curious.
    </p>
  </section>

  <!-- Footer -->
  <footer
    class="bg-midnight px-5 py-8 text-center text-pearl transition-colors sm:px-10"
  >
    <p class="text-sm opacity-70">
      &copy; {new Date().getFullYear()} Smart Job Seeker
    </p>
  </footer>
</main>
