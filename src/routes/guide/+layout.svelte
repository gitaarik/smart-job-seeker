<script lang="ts">
  import { page } from "$app/state";
  import { guideSections } from "$lib/guide";

  let { children } = $props();

  let activeSlug = $derived(page.url.pathname.split("/")[2] ?? "");
</script>

<svelte:head>
  <title>Guide — Smart Job Seeker</title>
</svelte:head>

<div class="min-h-screen bg-[var(--dash-bg)] text-[var(--dash-text)]">
  <header
    class="border-b border-[var(--dash-border)] px-4 sm:px-6 py-4 flex items-center justify-between"
  >
    <a href="/guide" class="text-lg font-semibold text-[var(--dash-text)]">
      Smart Job Seeker — Guide
    </a>
    <a
      href="/home"
      class="text-sm font-medium text-[var(--dash-primary)] hover:text-[var(--dash-primary-hover)]"
    >
      Back to app
    </a>
  </header>

  <div
    class="max-w-5xl mx-auto px-4 sm:px-6 py-8 flex flex-col md:flex-row gap-8"
  >
    <!-- Section nav -->
    <nav class="md:w-56 md:flex-shrink-0">
      <ul class="flex md:flex-col gap-1 flex-wrap">
        {#each guideSections as section (section.slug)}
          <li>
            <a
              href={`/guide/${section.slug}`}
              class="
                block px-3 py-2 rounded-lg text-sm transition-colors {activeSlug ===
                section.slug
                ? 'bg-[var(--dash-primary-light)] text-[var(--dash-primary)] font-medium'
                : 'text-[var(--dash-text-secondary)] hover:bg-[var(--dash-bg-hover)] hover:text-[var(--dash-text)]'}
              "
            >
              {section.title}
            </a>
          </li>
        {/each}
      </ul>
    </nav>

    <!-- Rendered markdown -->
    <main class="min-w-0 flex-1 guide-prose">
      {@render children()}
    </main>
  </div>
</div>

<style>
  /* Prose styling for the rendered markdown (our trusted content). */
  .guide-prose :global(h1) {
    font-size: 1.875rem;
    font-weight: 800;
    line-height: 1.2;
    margin-bottom: 1rem;
    color: var(--dash-text);
  }
  .guide-prose :global(h2) {
    font-size: 1.25rem;
    font-weight: 700;
    margin-top: 2rem;
    margin-bottom: 0.75rem;
    color: var(--dash-text);
  }
  .guide-prose :global(h3) {
    font-size: 1.05rem;
    font-weight: 600;
    margin-top: 1.5rem;
    margin-bottom: 0.5rem;
    color: var(--dash-text);
  }
  .guide-prose :global(p),
  .guide-prose :global(li) {
    color: var(--dash-text-secondary);
    line-height: 1.7;
  }
  .guide-prose :global(p) {
    margin-bottom: 1rem;
  }
  .guide-prose :global(ul),
  .guide-prose :global(ol) {
    margin: 0.5rem 0 1rem 1.25rem;
    list-style: revert;
  }
  .guide-prose :global(li) {
    margin-bottom: 0.35rem;
  }
  .guide-prose :global(a) {
    color: var(--dash-primary);
    text-decoration: underline;
  }
  .guide-prose :global(a:hover) {
    color: var(--dash-primary-hover);
  }
  .guide-prose :global(strong) {
    color: var(--dash-text);
    font-weight: 600;
  }
  .guide-prose :global(code) {
    background: var(--dash-bg-hover);
    padding: 0.1rem 0.35rem;
    border-radius: 0.25rem;
    font-size: 0.85em;
  }
  .guide-prose :global(pre) {
    background: var(--dash-card);
    border: 1px solid var(--dash-border);
    border-radius: 0.5rem;
    padding: 1rem;
    overflow-x: auto;
    margin-bottom: 1rem;
  }
  .guide-prose :global(pre code) {
    background: none;
    padding: 0;
  }
  .guide-prose :global(blockquote) {
    border-left: 3px solid var(--dash-primary);
    padding-left: 1rem;
    margin: 1rem 0;
    color: var(--dash-text-muted);
  }
  .guide-prose :global(ol) {
    list-style: decimal;
  }
</style>
