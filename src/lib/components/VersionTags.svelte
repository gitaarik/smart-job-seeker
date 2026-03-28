<script lang="ts">
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import { faTags, faTimes, faPlus } from "@fortawesome/free-solid-svg-icons";
  import SectionSaveButton from "$lib/components/SectionSaveButton.svelte";

  type SaveState = "idle" | "saving" | "saved" | "error";

  let {
    tags = $bindable([]),
    apiUrl,
    section,
  }: {
    tags: string[];
    apiUrl: string;
    section?: string;
  } = $props();

  let savedTags = $state<string[]>([...tags]);
  let saveState = $state<SaveState>("idle");
  let versionSlugs = $state<string[]>([]);
  let loaded = $state(false);
  let newTag = $state("");

  const builtinTags = ["resume", "cv"];

  let allSuggestions = $derived.by(() => {
    const all = [...builtinTags, ...versionSlugs.filter((v) => !builtinTags.includes(v.toLowerCase()))];
    return all.filter((s) => !tags.some((t) => t.toLowerCase() === s.toLowerCase()));
  });

  let isDirty = $derived(JSON.stringify(tags) !== JSON.stringify(savedTags));

  $effect(() => {
    if (!loaded) {
      loadVersions();
    }
  });

  async function loadVersions() {
    if (loaded) return;
    try {
      const res = await fetch("/dashboard/api/profile-versions");
      if (res.ok) {
        versionSlugs = await res.json();
      }
    } catch {
      // ignore
    }
    loaded = true;
  }

  function removeTag(tag: string) {
    tags = tags.filter((t) => t !== tag);
  }

  function addTag(tag: string) {
    const trimmed = tag.trim();
    if (trimmed && !tags.some((t) => t.toLowerCase() === trimmed.toLowerCase())) {
      tags = [...tags, trimmed];
    }
    newTag = "";
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (newTag.trim()) {
        addTag(newTag);
      }
    }
  }

  function cancel() {
    tags = [...savedTags];
    newTag = "";
  }

  async function save() {
    saveState = "saving";
    try {
      const body: Record<string, unknown> = {
        tags: tags.length > 0 ? tags : null,
      };
      if (section) {
        body.section = section;
      }
      const response = await fetch(apiUrl, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        savedTags = [...tags];
        saveState = "saved";
        setTimeout(() => (saveState = "idle"), 2000);
      } else {
        saveState = "error";
        setTimeout(() => (saveState = "idle"), 3000);
      }
    } catch {
      saveState = "error";
      setTimeout(() => (saveState = "idle"), 3000);
    }
  }
</script>

<div>
  <h2 class="text-lg font-semibold text-[var(--dash-text)] mb-1">
    <FontAwesomeIcon icon={faTags} class="w-4 h-4 mr-1.5 text-[var(--dash-text-secondary)]" />
    CV / Resume Versions
  </h2>
  <p class="text-sm text-[var(--dash-text-secondary)] mb-3">
    Control which versions of your CV or resume include this item. No tags means it appears in all versions.
  </p>

  <!-- Current tags -->
  {#if tags.length > 0}
    <div class="flex flex-wrap gap-1.5 mb-3">
      {#each tags as tag}
        <button
          type="button"
          onclick={() => removeTag(tag)}
          class="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-md bg-[var(--dash-primary)]/10 text-[var(--dash-primary)] border border-[var(--dash-primary)]/20 hover:bg-red-500/15 hover:text-red-500 hover:border-red-500/30 transition-colors cursor-pointer"
        >
          {tag}
          <FontAwesomeIcon icon={faTimes} class="w-2.5 h-2.5" />
        </button>
      {/each}
    </div>
  {:else}
    <p class="text-sm text-[var(--dash-text-muted)] italic mb-3">All versions</p>
  {/if}

  <!-- Suggestions -->
  {#if allSuggestions.length > 0}
    <div class="flex flex-wrap gap-1.5 mb-3">
      {#each allSuggestions as suggestion}
        <button
          type="button"
          onclick={() => addTag(suggestion)}
          class="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-md bg-[var(--dash-bg)] text-[var(--dash-text-secondary)] border border-[var(--dash-border)] hover:border-[var(--dash-primary)]/40 hover:text-[var(--dash-primary)] transition-colors"
        >
          <FontAwesomeIcon icon={faPlus} class="w-2.5 h-2.5" />
          {suggestion}
        </button>
      {/each}
    </div>
  {/if}

  <!-- Custom tag input -->
  <div class="flex gap-2 mb-3">
    <input
      type="text"
      bind:value={newTag}
      onkeydown={handleKeydown}
      placeholder="Custom tag name..."
      class="flex-1 max-w-[200px] px-3 py-1.5 text-sm border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
    />
    <button
      type="button"
      onclick={() => { if (newTag.trim()) addTag(newTag); }}
      disabled={!newTag.trim()}
      class="px-3 py-1.5 text-sm bg-[var(--dash-primary)] text-white rounded-md hover:bg-[var(--dash-primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      Add
    </button>
  </div>

  <!-- Save / Cancel -->
  <div class="flex items-center justify-end gap-2">
    {#if isDirty}
      <button
        type="button"
        onclick={cancel}
        class="px-3 py-1.5 text-sm border border-[var(--dash-border)] rounded-lg text-[var(--dash-text)] hover:bg-[var(--dash-bg)] transition-colors"
      >
        Cancel
      </button>
    {/if}
    <SectionSaveButton state={saveState} onClick={save} disabled={!isDirty} />
  </div>
</div>
