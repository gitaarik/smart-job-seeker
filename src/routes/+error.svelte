<script lang="ts">
  import { page } from "$app/stores";
</script>

<svelte:head>
  <title>{$page.status} - Smart Job Seeker</title>
</svelte:head>

<main
  class="min-h-screen flex flex-col items-center justify-center bg-[var(--dash-bg)] text-[var(--dash-text)] transition-colors px-6 text-center"
>
  <p class="text-6xl font-bold text-[var(--dash-text-muted)]">
    {$page.status}
  </p>

  <p class="mt-4 text-lg text-[var(--dash-text-secondary)]">
    {$page.error?.message || "Something went wrong"}
  </p>

  <a
    href={$page.url.pathname.startsWith("/login") || $page.url.pathname.startsWith("/signup") ? "/login" : "/home"}
    class="mt-8 inline-flex items-center justify-center rounded-lg bg-[var(--dash-primary)] px-6 py-2.5 text-sm font-medium text-white hover:bg-[var(--dash-primary-hover)] transition-colors"
  >
    Go back
  </a>
</main>
