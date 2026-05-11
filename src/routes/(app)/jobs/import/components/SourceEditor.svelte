<script lang="ts">
  /**
   * Source-editing block for the task detail page. Replaces the old
   * URL/search-term inputs at the top of SearchTaskFields with the same
   * preset picker used in the add form. URL is read-only (computed from
   * preset + keywords/location) unless the user picks "Custom URL", in
   * which case the URL field becomes editable.
   *
   * Saves via the existing PATCH /api/import-tasks/[id] endpoint, sending
   * preset_id + platform_id + search_url + search_term + search_location
   * together so the four stay in sync.
   */
  import { invalidateAll } from "$app/navigation";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import { faCheck, faXmark, faMagicWandSparkles } from "@fortawesome/free-solid-svg-icons";
  import Spinner from "$lib/components/Spinner.svelte";
  import SourcePicker, { type SourcePreset } from "./SourcePicker.svelte";

  interface Props {
    taskId: number;
    presets: SourcePreset[];
    initial: {
      preset_id: number | null;
      platform_id: number | null;
      search_url: string | null;
      search_term: string | null;
      search_location: string | null;
    };
    /** Called after a successful save with the values that were persisted.
     *  Lets the parent sync its local `searchTask` $state copy so the next
     *  render passes a fresh `initial` and isDirty resets to false. */
    onSaved?: (saved: {
      preset_id: number | null;
      platform_id: number | null;
      search_url: string;
      search_term: string | null;
      search_location: string | null;
    }) => void;
  }

  let { taskId, presets, initial, onSaved }: Props = $props();

  // Compute the initial picker state from the task. Three cases:
  //   1. preset_id set → use its platform_key + preset_id.
  //   2. preset_id null but platform_id set → custom URL on a known platform.
  //   3. both null → top-level custom URL.
  const initialPreset = initial.preset_id != null
    ? presets.find((p) => p.preset_id === initial.preset_id)
    : null;
  const initialPlatformFromId = initial.platform_id != null
    ? presets.find((p) => p.platform_id === initial.platform_id)
    : null;

  let platformValue = $state<string>(
    initialPreset
      ? initialPreset.platform_key
      : initialPlatformFromId
      ? initialPlatformFromId.platform_key
      : "custom",
  );
  let presetId = $state<number | null>(
    initialPreset ? initialPreset.preset_id : null,
  );
  let keywords = $state(initial.search_term ?? "");
  let location = $state(initial.search_location ?? "");
  let customUrl = $state(initial.search_url ?? "");
  let resolvedUrl = $state(initial.search_url ?? "");
  let urlEditing = $state(false);

  let saving = $state(false);
  let saveError = $state<string | null>(null);
  let lastSaveOk = $state(false);

  let selectedPreset = $derived.by<SourcePreset | null>(() => {
    if (platformValue === "custom" || presetId === null) return null;
    return presets.find((p) => p.preset_id === presetId) ?? null;
  });

  // Platform for the current picker state. Falls back to any preset of the
  // selected platform when in custom-within-platform mode.
  let currentPlatformId = $derived.by<number | null>(() => {
    if (selectedPreset) return selectedPreset.platform_id;
    if (platformValue === "custom") return null;
    return presets.find((p) => p.platform_key === platformValue)?.platform_id
      ?? null;
  });

  // Dirty detection: any of the inputs differs from the original task.
  let isDirty = $derived.by(() => {
    const cpid = selectedPreset?.preset_id ?? null;
    if (cpid !== (initial.preset_id ?? null)) return true;
    if (currentPlatformId !== (initial.platform_id ?? null)) return true;
    if (resolvedUrl !== (initial.search_url ?? "")) return true;
    // search_term is only relevant for presets with {KEYWORDS} or for
    // custom URLs (where it gets persisted separately on the task).
    const normalizedKw = keywords.trim() || null;
    if (normalizedKw !== (initial.search_term ?? null)) return true;
    const normalizedLoc = location.trim() || null;
    if (normalizedLoc !== (initial.search_location ?? null)) return true;
    return false;
  });

  let canSave = $derived.by(() => {
    if (!isDirty || saving) return false;
    if (selectedPreset) {
      if (selectedPreset.url_template.includes("{KEYWORDS}") && !keywords.trim()) return false;
    } else if (!customUrl.trim()) {
      return false;
    }
    return resolvedUrl.length > 0;
  });

  function reset() {
    platformValue = initialPreset
      ? initialPreset.platform_key
      : initialPlatformFromId
      ? initialPlatformFromId.platform_key
      : "custom";
    presetId = initialPreset ? initialPreset.preset_id : null;
    keywords = initial.search_term ?? "";
    location = initial.search_location ?? "";
    customUrl = initial.search_url ?? "";
    resolvedUrl = initial.search_url ?? "";
    urlEditing = false;
    saveError = null;
  }

  async function save() {
    if (!canSave) return;
    saving = true;
    saveError = null;
    lastSaveOk = false;
    try {
      const body: Record<string, unknown> = {
        search_url: resolvedUrl,
      };
      if (selectedPreset) {
        body.preset_id = selectedPreset.preset_id;
        body.platform_id = selectedPreset.platform_id;
        body.search_term = selectedPreset.url_template.includes("{KEYWORDS}")
          ? (keywords.trim() || null)
          : null;
        body.search_location =
          selectedPreset.url_template.includes("{LOCATION}")
            ? (location.trim() || null)
            : null;
      } else {
        // Custom URL — either top-level (no platform) or on a specific
        // platform. Keep platform attribution in the latter case so the
        // scraper still picks the right adapter; drop preset_id either way.
        body.preset_id = null;
        body.platform_id = currentPlatformId;
        body.search_term = keywords.trim() || null;
        body.search_location = location.trim() || null;
      }
      const res = await fetch(`/api/import-tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text();
        saveError = text || `HTTP ${res.status}`;
        return;
      }
      lastSaveOk = true;
      urlEditing = false;
      onSaved?.({
        preset_id: (body.preset_id as number | null) ?? null,
        platform_id: (body.platform_id as number | null) ?? null,
        search_url: resolvedUrl,
        search_term: (body.search_term as string | null) ?? null,
        search_location: (body.search_location as string | null) ?? null,
      });
      await invalidateAll();
    } catch (err) {
      saveError = err instanceof Error ? err.message : "Network error";
    } finally {
      saving = false;
    }
  }
</script>

<div class="space-y-3">
  <div class="flex items-center justify-between">
    <h3 class="text-sm font-medium text-[var(--dash-text)] inline-flex items-center gap-2">
      <FontAwesomeIcon icon={faMagicWandSparkles} class="w-3.5 h-3.5 text-[var(--dash-primary)]" />
      Search source
    </h3>
    {#if lastSaveOk && !isDirty}
      <span class="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
        <FontAwesomeIcon icon={faCheck} class="w-3 h-3" />
        Saved
      </span>
    {/if}
  </div>

  <SourcePicker
    {presets}
    bind:platformValue
    bind:presetId
    bind:keywords
    bind:location
    bind:customUrl
    bind:resolvedUrl
    bind:urlEditing
  />

  {#if saveError}
    <p class="text-xs text-red-600 dark:text-red-400 inline-flex items-center gap-1.5">
      <FontAwesomeIcon icon={faXmark} class="w-3 h-3" />
      {saveError}
    </p>
  {/if}

  {#if isDirty}
    <div class="flex justify-end gap-2">
      <button
        type="button"
        onclick={reset}
        disabled={saving}
        class="px-3 py-1.5 text-sm border border-[var(--dash-border)] rounded text-[var(--dash-text)] hover:bg-[var(--dash-bg)] disabled:opacity-50"
      >Cancel</button>
      <button
        type="button"
        onclick={save}
        disabled={!canSave}
        class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-[var(--dash-primary)] text-white rounded hover:bg-[var(--dash-primary-hover)] disabled:opacity-50"
      >
        {#if saving}
          <Spinner size="w-3 h-3" />
          Saving…
        {:else}
          <FontAwesomeIcon icon={faCheck} class="w-3 h-3" />
          Save changes
        {/if}
      </button>
    </div>
  {/if}
</div>
