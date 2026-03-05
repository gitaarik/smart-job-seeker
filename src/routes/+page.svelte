<script lang="ts">
  import "./dashboard/dashboard.css";
  import ThemeSwitcher from "$lib/components/ThemeSwitcher.svelte";
</script>

<svelte:head>
  <title>Smart Job Seeker</title>
  <meta
    name="description"
    content="What if you didn't have to hunt for a job, but if the jobs were hunting you?"
  />
</svelte:head>

<div class="fixed top-0 right-0 z-50 p-4">
  <ThemeSwitcher />
</div>

<main
  class="min-h-screen flex flex-col items-center justify-center bg-[var(--dash-bg)] text-[var(--dash-text)] transition-colors px-6 text-center"
>
  <!-- Logo + name -->
  <div class="flex items-center gap-6">
    <div>
      <svg
        class="h-14 w-14"
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle
          cx="16"
          cy="16"
          r="12"
          stroke="currentColor"
          stroke-width="3"
          fill="none"
        />
        <line
          x1="25"
          y1="25"
          x2="36"
          y2="36"
          stroke="currentColor"
          stroke-width="4"
          stroke-linecap="round"
        />
        <path
          d="M10 17l4 4 8-8"
          stroke="currentColor"
          stroke-width="3"
          stroke-linecap="round"
          stroke-linejoin="round"
          fill="none"
        />
      </svg>
    </div>
    <div class="flex flex-col items-start gap-1">
      <h1 class="text-2xl font-semibold tracking-wide uppercase sm:text-3xl">
        Smart Job Seeker
      </h1>
      <h2 class="text-[var(--dash-text-secondary)] text-xl">
        The future of job seeking
      </h2>
    </div>
  </div>

  <!-- Slogan -->
  <p
    class="mt-12 max-w-lg leading-relaxed text-[var(--dash-text-secondary)] text-xl"
  >
    What if you didn't have to hunt for a job,<br />
    but if the jobs were hunting you?
  </p>

  <!-- Divider -->
  <div class="mt-12 h-px w-16 bg-[var(--dash-border)]"></div>

  <!-- CTA -->
  <div class="mt-12 flex gap-4">
    <a
      href="/signup"
      class="inline-flex items-center justify-center rounded-lg bg-[var(--dash-primary)] px-8 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[var(--dash-primary-hover)] transition-colors"
    >Join</a>
    <a
      href="/login"
      class="inline-flex items-center justify-center rounded-lg border border-[var(--dash-border)] px-8 py-3 text-sm font-semibold text-[var(--dash-text-secondary)] hover:bg-[var(--dash-card)] transition-colors"
    >Sign in</a>
  </div>

  <!-- Footer -->
  <p class="absolute bottom-8 text-xs text-[var(--dash-text-muted)]">
    &copy; {new Date().getFullYear()} Smart Job Seeker
  </p>
</main>
