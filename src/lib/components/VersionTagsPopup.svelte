<script lang="ts">
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import { faPlus, faTimes, faTags, faBan } from "@fortawesome/free-solid-svg-icons";
  import { portalToBody } from "$lib/actions/portal";

  /**
   * Modal editor for an item's resume/CV version tags. Edits the bound `tags`
   * array live (the parent persists via its own section save). Supports both
   * positive whitelist tags ("show only on X") and negated excludes ("!X" =
   * hide from X) — the exclude form is what the lean-baseline model relies on
   * and no other tag UI can add it.
   */
  let {
    title = "Resume / CV Versions",
    subtitle,
    tags = $bindable([]),
    versionSlugs = [],
    onClose,
  }: {
    title?: string;
    subtitle?: string;
    tags: string[];
    versionSlugs?: string[];
    onClose: () => void;
  } = $props();

  const builtinTags = ["resume", "cv"];

  let candidates = $derived([
    ...builtinTags,
    ...versionSlugs.filter((v) => !builtinTags.includes(v.toLowerCase())),
  ]);

  function has(tag: string): boolean {
    return tags.some((t) => t.toLowerCase() === tag.toLowerCase());
  }

  // A version is "decided" once it appears in either form; don't re-suggest it.
  let available = $derived(candidates.filter((c) => !has(c) && !has(`!${c}`)));

  function addTag(tag: string) {
    if (!has(tag)) tags = [...tags, tag];
  }

  function removeTag(tag: string) {
    tags = tags.filter((t) => t !== tag);
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  use:portalToBody={{ onClose }}
  class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
  onclick={(e) => { if (e.target === e.currentTarget) onClose(); }}
>
  <div class="bg-[var(--dash-card)] rounded-lg shadow-xl border border-[var(--dash-border)] max-w-lg w-full p-6">
    <h3 class="text-lg font-semibold text-[var(--dash-text)] mb-1 flex items-center gap-2">
      <FontAwesomeIcon icon={faTags} class="w-4 h-4 text-[var(--dash-text-secondary)]" />
      {title}
    </h3>
    {#if subtitle}
      <p class="text-sm text-[var(--dash-text-secondary)] mb-1">{subtitle}</p>
    {/if}
    <p class="text-xs text-[var(--dash-text-secondary)] mb-4">
      No tags means this appears in all versions. Use "show only on" to whitelist,
      or "hide from" to exclude it from specific versions.
    </p>

    <!-- Current tags -->
    {#if tags.length > 0}
      <div class="flex flex-wrap gap-1.5 mb-4">
        {#each tags as tag}
          {@const isExclude = tag.startsWith("!")}
          <button
            type="button"
            onclick={() => removeTag(tag)}
            class="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md border transition-colors cursor-pointer
              {isExclude
                ? 'bg-amber-500/10 text-amber-700 border-amber-500/30 hover:bg-red-500/15 hover:text-red-500 hover:border-red-500/30'
                : 'bg-[var(--dash-primary)]/10 text-[var(--dash-primary)] border-[var(--dash-primary)]/20 hover:bg-red-500/15 hover:text-red-500 hover:border-red-500/30'}"
          >
            {isExclude ? `hide from ${tag.slice(1)}` : tag}
            <FontAwesomeIcon icon={faTimes} class="w-2.5 h-2.5" />
          </button>
        {/each}
      </div>
    {:else}
      <p class="text-xs text-[var(--dash-text-muted)] italic mb-4">All versions</p>
    {/if}

    {#if available.length > 0}
      <!-- Show only on (whitelist) -->
      <p class="text-xs font-medium text-[var(--dash-text-secondary)] mb-1.5">Show only on</p>
      <div class="flex flex-wrap gap-1.5 mb-3">
        {#each available as c}
          <button
            type="button"
            onclick={() => addTag(c)}
            class="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-[var(--dash-bg)] text-[var(--dash-text-secondary)] border border-[var(--dash-border)] hover:border-[var(--dash-primary)]/40 hover:text-[var(--dash-primary)] transition-colors"
          >
            <FontAwesomeIcon icon={faPlus} class="w-2.5 h-2.5" />
            {c}
          </button>
        {/each}
      </div>

      <!-- Hide from (exclude) -->
      <p class="text-xs font-medium text-[var(--dash-text-secondary)] mb-1.5">Hide from</p>
      <div class="flex flex-wrap gap-1.5">
        {#each available as c}
          <button
            type="button"
            onclick={() => addTag(`!${c}`)}
            class="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-[var(--dash-bg)] text-[var(--dash-text-secondary)] border border-[var(--dash-border)] hover:border-amber-500/40 hover:text-amber-700 transition-colors"
          >
            <FontAwesomeIcon icon={faBan} class="w-2.5 h-2.5" />
            {c}
          </button>
        {/each}
      </div>
    {/if}

    <div class="flex justify-end mt-6">
      <button
        type="button"
        onclick={onClose}
        class="px-4 py-2 text-sm bg-[var(--dash-primary)] text-white rounded-lg hover:bg-[var(--dash-primary-hover)] transition-colors"
      >
        Done
      </button>
    </div>
  </div>
</div>
