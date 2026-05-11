<script lang="ts">
  /**
   * Source-editing block for the task detail page. Wraps the same preset
   * picker as the add form, but with per-field Cancel/Save buttons matching
   * the patch-on-blur pattern used elsewhere in the form:
   *
   *   - URL field (custom mode only): edits search_url
   *   - Keywords field: edits search_term, plus search_url when in preset
   *     mode (URL is template-derived).
   *   - Location field: edits search_location, plus search_url when in
   *     preset mode.
   *
   * Platform/preset dropdowns commit immediately on change, like the other
   * dropdowns in SearchTaskFields. They send the full URL-configuration
   * bundle (preset_id, platform_id, search_url, and the keywords/location
   * adapted to the new template's placeholders).
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
     *  render passes a fresh `initial` and per-field dirty resets to false. */
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

  // Per-field save state — separate so spinners and errors stay scoped.
  let savingField = $state<"url" | "keywords" | "location" | "dropdown" | null>(
    null,
  );
  let saveError = $state<string | null>(null);

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

  // Per-field dirty detection. Each field compares only its own value against
  // the initial task state — independent from the others.
  let urlDirty = $derived.by(() => {
    if (selectedPreset) return false; // URL not user-editable in preset mode
    return customUrl !== (initial.search_url ?? "");
  });
  let keywordsDirty = $derived.by(() => {
    const cur = keywords.trim() || null;
    return cur !== (initial.search_term ?? null);
  });
  let locationDirty = $derived.by(() => {
    const cur = location.trim() || null;
    return cur !== (initial.search_location ?? null);
  });

  let canSaveUrl = $derived(urlDirty && !!customUrl.trim() && savingField === null);
  let canSaveKeywords = $derived(keywordsDirty && savingField === null);
  let canSaveLocation = $derived(locationDirty && savingField === null);

  /**
   * Shared PATCH helper. Sends a partial body, then notifies the parent so it
   * can keep its local searchTask snapshot in sync with the new DB state.
   */
  async function patch(
    field: "url" | "keywords" | "location" | "dropdown",
    body: Record<string, unknown>,
    saved: {
      preset_id: number | null;
      platform_id: number | null;
      search_url: string;
      search_term: string | null;
      search_location: string | null;
    },
  ): Promise<boolean> {
    savingField = field;
    saveError = null;
    try {
      const res = await fetch(`/api/import-tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        saveError = (await res.text()) || `HTTP ${res.status}`;
        return false;
      }
      onSaved?.(saved);
      await invalidateAll();
      return true;
    } catch (err) {
      saveError = err instanceof Error ? err.message : "Network error";
      return false;
    } finally {
      savingField = null;
    }
  }

  async function saveUrl() {
    if (!canSaveUrl) return;
    const url = resolvedUrl;
    const ok = await patch(
      "url",
      { search_url: url },
      {
        preset_id: presetId,
        platform_id: currentPlatformId,
        search_url: url,
        search_term: keywords.trim() || null,
        search_location: location.trim() || null,
      },
    );
    if (ok) urlEditing = false;
  }
  function cancelUrl() {
    customUrl = initial.search_url ?? "";
    urlEditing = false;
    saveError = null;
  }

  async function saveKeywords() {
    if (!canSaveKeywords) return;
    const newKw = keywords.trim() || null;
    // In preset mode, search_url is template-derived and must move with the
    // keyword change to stay consistent.
    const body: Record<string, unknown> = { search_term: newKw };
    if (selectedPreset) body.search_url = resolvedUrl;
    await patch("keywords", body, {
      preset_id: presetId,
      platform_id: currentPlatformId,
      search_url: resolvedUrl,
      search_term: newKw,
      search_location: location.trim() || null,
    });
  }
  function cancelKeywords() {
    keywords = initial.search_term ?? "";
    saveError = null;
  }

  async function saveLocation() {
    if (!canSaveLocation) return;
    const newLoc = location.trim() || null;
    const body: Record<string, unknown> = { search_location: newLoc };
    if (selectedPreset) body.search_url = resolvedUrl;
    await patch("location", body, {
      preset_id: presetId,
      platform_id: currentPlatformId,
      search_url: resolvedUrl,
      search_term: keywords.trim() || null,
      search_location: newLoc,
    });
  }
  function cancelLocation() {
    location = initial.search_location ?? "";
    saveError = null;
  }

  // Immediate commit when the user changes the platform or preset dropdown.
  // Mirrors how other dropdowns elsewhere in the form (login_mode, schedule
  // interval, etc.) auto-save on change. We detect "the dropdowns differ from
  // the last saved state" by comparing against `initial` — after a save the
  // parent updates its local searchTask, so initial reflects the new DB row
  // on the next render and the effect short-circuits.
  $effect(() => {
    const cpid = selectedPreset?.preset_id ?? null;
    const cplat = currentPlatformId;
    const initPid = initial.preset_id ?? null;
    const initPlat = initial.platform_id ?? null;
    if (cpid === initPid && cplat === initPlat) return;
    if (savingField !== null) return;
    // URL adapts to the new template + the user's current keywords/location.
    // search_term/search_location adapt to whether the new preset still has
    // those placeholders (clears them if the new preset is fixed-URL).
    const newKw = selectedPreset
      ? selectedPreset.url_template.includes("{KEYWORDS}")
        ? (keywords.trim() || null)
        : null
      : keywords.trim() || null;
    const newLoc = selectedPreset
      ? selectedPreset.url_template.includes("{LOCATION}")
        ? (location.trim() || null)
        : null
      : location.trim() || null;
    void patch(
      "dropdown",
      {
        preset_id: cpid,
        platform_id: cplat,
        search_url: resolvedUrl,
        search_term: newKw,
        search_location: newLoc,
      },
      {
        preset_id: cpid,
        platform_id: cplat,
        search_url: resolvedUrl,
        search_term: newKw,
        search_location: newLoc,
      },
    );
  });
</script>

<div class="space-y-3">
  <div class="flex items-center justify-between">
    <h3 class="text-sm font-medium text-[var(--dash-text)] inline-flex items-center gap-2">
      <FontAwesomeIcon icon={faMagicWandSparkles} class="w-3.5 h-3.5 text-[var(--dash-primary)]" />
      Search source
    </h3>
    {#if savingField === "dropdown"}
      <span class="inline-flex items-center gap-1 text-xs text-[var(--dash-text-secondary)]">
        <Spinner size="w-3 h-3" />
        Saving…
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
  >
    {#snippet urlFooter()}
      {@render fieldButtons(
        urlDirty,
        canSaveUrl,
        savingField === "url",
        saveUrl,
        cancelUrl,
      )}
    {/snippet}
    {#snippet keywordsFooter()}
      {@render fieldButtons(
        keywordsDirty,
        canSaveKeywords,
        savingField === "keywords",
        saveKeywords,
        cancelKeywords,
      )}
    {/snippet}
    {#snippet locationFooter()}
      {@render fieldButtons(
        locationDirty,
        canSaveLocation,
        savingField === "location",
        saveLocation,
        cancelLocation,
      )}
    {/snippet}
  </SourcePicker>

  {#if saveError}
    <p class="text-xs text-red-600 dark:text-red-400 inline-flex items-center gap-1.5">
      <FontAwesomeIcon icon={faXmark} class="w-3 h-3" />
      {saveError}
    </p>
  {/if}
</div>

{#snippet fieldButtons(
  dirty: boolean,
  canSave: boolean,
  isSaving: boolean,
  onSave: () => void,
  onCancel: () => void,
)}
  {#if dirty}
    <div class="flex items-center gap-2 mt-2">
      <button
        type="button"
        onclick={onSave}
        disabled={!canSave}
        class="px-3 py-1 text-xs bg-[var(--dash-primary)] text-white rounded-md hover:bg-[var(--dash-primary-hover)] transition-colors disabled:opacity-50 inline-flex items-center gap-1"
      >
        {#if isSaving}
          <Spinner size="w-3 h-3" />
        {:else}
          <FontAwesomeIcon icon={faCheck} class="w-3 h-3" />
        {/if}
        Save
      </button>
      <button
        type="button"
        onclick={onCancel}
        disabled={isSaving}
        class="px-3 py-1 text-xs border border-[var(--dash-border)] rounded-md text-[var(--dash-text)] hover:bg-[var(--dash-bg)] transition-colors disabled:opacity-50"
      >
        Cancel
      </button>
    </div>
  {/if}
{/snippet}
