<script lang="ts">
  /**
   * Two-step platform → preset picker plus the conditional Keywords/Location
   * inputs (or Custom URL input). Renders the URL preview underneath.
   *
   * Used by SimplifiedAddTaskForm (new tasks) and SourceEditor (edit page).
   * The parent owns save semantics — this component only manages the picker
   * state and exposes the resolved values via $bindable props.
   */
  import type { Snippet } from "svelte";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faArrowUpRightFromSquare,
    faPenToSquare,
  } from "@fortawesome/free-solid-svg-icons";
  import Collapsible from "$lib/components/Collapsible.svelte";
  import {
    fillSearchTemplate,
    templatePlaceholders,
  } from "$lib/job-platforms/url-template";
  import {
    SEARCH_FILTER_DEFINITIONS,
    SEARCH_FILTER_NAMES,
    defaultValueKey,
    type PresetFilterConfig,
    type SearchFilterName,
    type SearchFilterValue,
  } from "$lib/job-platforms/search-filters";

  export type SourcePreset = {
    preset_id: number;
    preset_label: string;
    url_template: string;
    applicable_hint: string | null;
    /** Per-preset filter configuration. See PresetFilterConfig. */
    params: Record<string, PresetFilterConfig>;
    platform_id: number;
    platform_key: string;
    platform_name: string;
    platform_url: string;
  };

  interface Props {
    presets: SourcePreset[];
    /** Bidirectional. "custom" or a platform key from the presets list. */
    platformValue: string;
    /** Bidirectional. Preset id, or null when in custom-URL mode (either
     *  top-level — platformValue === "custom" — or within a platform). */
    presetId: number | null;
    /** Bidirectional. Keywords value (used when chosen preset has {KEYWORDS}
     *  and as metadata in custom-within-platform mode). */
    keywords: string;
    /** Bidirectional. Location value (used when chosen preset has {LOCATION}
     *  and as metadata in custom-within-platform mode). */
    location: string;
    /** Bidirectional. Custom URL value (used whenever presetId is null). */
    customUrl: string;
    /** Output (read-only): resolved URL after substitution. */
    resolvedUrl: string;
    /** Bidirectional. Filter selections keyed by canonical filter name
     *  (sort_by, time_posted, work_location, job_type). For single-select
     *  filters the value is a single value_key; for multi-select filters
     *  it's an array. Only non-default selections are kept. */
    filters: Record<string, SearchFilterValue>;
    /** Bidirectional. Whether the custom-URL field is in editable
     *  (textarea) mode vs. wrapped read-only display mode. The parent owns
     *  this so it can collapse the field back to read-only after the
     *  form-level save/cancel commits or reverts the underlying value. */
    urlEditing?: boolean;
    /** Per-field footer snippets. The edit-page parent (SourceEditor) uses
     *  these to render Save/Cancel buttons under each field, matching the
     *  per-field patch-on-blur pattern used elsewhere in the form. The add
     *  form omits them since it submits the whole form at once. */
    urlFooter?: Snippet;
    keywordsFooter?: Snippet;
    locationFooter?: Snippet;
  }

  let {
    presets,
    platformValue = $bindable("custom"),
    presetId = $bindable(null),
    keywords = $bindable(""),
    location = $bindable(""),
    customUrl = $bindable(""),
    resolvedUrl = $bindable(""),
    filters = $bindable({}),
    urlEditing = $bindable(false),
    urlFooter,
    keywordsFooter,
    locationFooter,
  }: Props = $props();

  // In custom-within-platform mode the keyword field is rarely needed (the
  // user typically embeds keywords in the URL itself), so it lives behind
  // a collapsed-by-default Advanced toggle.
  let showCustomKeywords = $state(false);

  // Group presets by platform once. The server orders by platform priority
  // then preset priority then id, so insertion order is the desired display
  // order.
  let platforms = $derived.by(() => {
    const groups = new Map<
      string,
      { key: string; name: string; items: SourcePreset[] }
    >();
    for (const p of presets) {
      const existing = groups.get(p.platform_key);
      if (existing) {
        existing.items.push(p);
      } else {
        groups.set(p.platform_key, {
          key: p.platform_key,
          name: p.platform_name,
          items: [p],
        });
      }
    }
    return Array.from(groups.values());
  });

  // When platform changes, auto-select that platform's top-priority preset
  // if the current presetId isn't in the new platform's set. A null presetId
  // is treated as a user-chosen "Custom URL" intent and preserved across
  // platform switches.
  $effect(() => {
    if (platformValue === "custom") {
      presetId = null;
      return;
    }
    const platform = platforms.find((p) => p.key === platformValue);
    if (!platform) return;
    if (presetId === null) return;
    const currentlyValid = platform.items.some(
      (i) => i.preset_id === presetId,
    );
    if (!currentlyValid) {
      presetId = platform.items[0].preset_id;
    }
  });

  let selectedPlatform = $derived(
    platforms.find((p) => p.key === platformValue) ?? null,
  );
  let selectedPreset = $derived.by<SourcePreset | null>(() => {
    if (platformValue === "custom" || presetId === null) return null;
    return presets.find((p) => p.preset_id === presetId) ?? null;
  });
  let placeholders = $derived(
    selectedPreset
      ? templatePlaceholders(selectedPreset.url_template)
      : { hasKeywords: true, hasLocation: true },
  );

  // Compute the resolved URL whenever inputs change, and surface it on the
  // bindable so the parent can submit/save it.
  $effect(() => {
    if (selectedPreset) {
      resolvedUrl = fillSearchTemplate(
        selectedPreset.url_template,
        placeholders.hasKeywords ? keywords : null,
        placeholders.hasLocation ? location : null,
        filters,
        selectedPreset.params,
      );
    } else {
      // Strip any whitespace (including newlines users may paste into the
      // textarea) — URLs must not contain whitespace.
      resolvedUrl = customUrl.replace(/\s+/g, "");
    }
  });

  // Filters this preset declares any options for, in canonical order.
  // Falls back to [] when no preset is selected (custom URL: filters don't
  // apply because there's no template to weave them into).
  let availableFilters = $derived.by<SearchFilterName[]>(() => {
    if (!selectedPreset) return [];
    return SEARCH_FILTER_NAMES.filter((name) => {
      const config = selectedPreset.params?.[name];
      return !!config && Object.keys(config.options).length > 0;
    });
  });

  function toggleMulti(filterName: string, valueKey: string) {
    const current = filters[filterName];
    // Normalise legacy single-string saves to a one-element array.
    const arr = Array.isArray(current)
      ? current
      : typeof current === "string" && current
      ? [current]
      : [];
    const next = arr.includes(valueKey)
      ? arr.filter((v) => v !== valueKey)
      : [...arr, valueKey];
    if (next.length === 0) {
      const { [filterName]: _, ...rest } = filters;
      filters = rest;
    } else {
      filters = { ...filters, [filterName]: next };
    }
  }

  function isMultiChecked(filterName: string, valueKey: string): boolean {
    const sel = filters[filterName];
    if (Array.isArray(sel)) return sel.includes(valueKey);
    return typeof sel === "string" && sel === valueKey;
  }
</script>

<!-- Platform / preset pickers -->
<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
  <div>
    <label
      class="block text-xs font-medium text-[var(--dash-text-secondary)] mb-1"
      for="picker-platform"
    >Platform</label>
    <select
      id="picker-platform"
      bind:value={platformValue}
      class="w-full px-2 py-1.5 text-sm border border-[var(--dash-border)] rounded bg-[var(--dash-bg)] text-[var(--dash-text)]"
    >
      {#each platforms as platform (platform.key)}
        <option value={platform.key}>{platform.name}</option>
      {/each}
      <option value="custom">Custom URL (any platform)</option>
    </select>
  </div>

  {#if selectedPlatform}
    <div>
      <label
        class="block text-xs font-medium text-[var(--dash-text-secondary)] mb-1"
        for="picker-preset"
      >Search type</label>
      <select
        id="picker-preset"
        bind:value={presetId}
        class="w-full px-2 py-1.5 text-sm border border-[var(--dash-border)] rounded bg-[var(--dash-bg)] text-[var(--dash-text)]"
      >
        {#each selectedPlatform.items as preset (preset.preset_id)}
          <option value={preset.preset_id}>{preset.preset_label}</option>
        {/each}
        <option value={null}>Custom URL on {selectedPlatform.name}</option>
      </select>
    </div>
  {/if}
</div>

{#if selectedPreset?.applicable_hint}
  <p class="text-xs text-[var(--dash-text-secondary)]">
    {selectedPreset.applicable_hint}
  </p>
{/if}

<!-- Conditional fields -->
{#if selectedPreset === null}
  <div>
    <div class="flex items-center justify-between mb-1">
      <label
        class="block text-xs font-medium text-[var(--dash-text-secondary)]"
        for="picker-custom-url"
      >Search URL *</label>
      {#if !urlEditing && customUrl.trim()}
        <button
          type="button"
          onclick={() => (urlEditing = true)}
          class="inline-flex items-center gap-1 text-xs text-[var(--dash-text-secondary)] hover:text-[var(--dash-primary)] transition-colors"
        >
          <FontAwesomeIcon icon={faPenToSquare} class="w-3 h-3" />
          Edit
        </button>
      {/if}
    </div>
    {#if urlEditing || !customUrl.trim()}
      <textarea
        id="picker-custom-url"
        bind:value={customUrl}
        required
        rows={3}
        placeholder={selectedPlatform
          ? `${selectedPlatform.items[0]?.platform_url ?? "https://example.com"}…`
          : "https://example.com/jobs?q=react+developer"}
        class="w-full px-2 py-1.5 text-sm border border-[var(--dash-border)] rounded bg-[var(--dash-bg)] text-[var(--dash-text)] font-mono resize-y break-all"
      ></textarea>
    {:else}
      <div
        class="w-full px-2 py-1.5 text-sm border border-[var(--dash-border)] rounded bg-[var(--dash-bg)] text-[var(--dash-text-secondary)] font-mono break-all max-h-24 overflow-y-auto"
      >
        {customUrl}
      </div>
    {/if}
    <p class="text-xs text-[var(--dash-text-muted)] mt-1">
      {#if selectedPlatform}
        Paste any search-result URL from {selectedPlatform.name}. Use this for
        URLs with filters (location, salary, date, etc.) that the presets
        above don't cover.
      {:else}
        Paste a search-result URL from any job site. The platform will be
        auto-detected from the domain.
      {/if}
    </p>
    {@render urlFooter?.()}
  </div>
  {#if selectedPlatform}
    <Collapsible label="Advanced" bind:open={showCustomKeywords}>
      {#snippet children()}
        <div>
          <label
            class="block text-xs font-medium text-[var(--dash-text-secondary)] mb-1"
            for="picker-custom-keywords"
          >Keywords <span
              class="font-normal text-[var(--dash-text-muted)]"
            >(optional)</span></label>
          <input
            id="picker-custom-keywords"
            type="text"
            bind:value={keywords}
            placeholder="e.g. react developer"
            class="w-full px-2 py-1.5 text-sm border border-[var(--dash-border)] rounded bg-[var(--dash-bg)] text-[var(--dash-text)]"
          />
          <p class="text-xs text-[var(--dash-text-muted)] mt-1">
            Only used when the site doesn't support keywords in the URL —
            the scraper will type this into the site's search field.
          </p>
          {@render keywordsFooter?.()}
        </div>
      {/snippet}
    </Collapsible>
  {/if}
{:else}
  {#if placeholders.hasKeywords}
    <div>
      <label
        class="block text-xs font-medium text-[var(--dash-text-secondary)] mb-1"
        for="picker-keywords"
      >Keywords *</label>
      <input
        id="picker-keywords"
        type="text"
        bind:value={keywords}
        required
        placeholder="e.g. react developer"
        class="w-full px-2 py-1.5 text-sm border border-[var(--dash-border)] rounded bg-[var(--dash-bg)] text-[var(--dash-text)]"
      />
      {@render keywordsFooter?.()}
    </div>
  {/if}
  {#if placeholders.hasLocation}
    <div>
      <label
        class="block text-xs font-medium text-[var(--dash-text-secondary)] mb-1"
        for="picker-location"
      >Location <span
          class="font-normal text-[var(--dash-text-muted)]"
        >(optional)</span></label>
      <input
        id="picker-location"
        type="text"
        bind:value={location}
        placeholder="e.g. Berlin, Germany"
        class="w-full px-2 py-1.5 text-sm border border-[var(--dash-border)] rounded bg-[var(--dash-bg)] text-[var(--dash-text)]"
      />
      {@render locationFooter?.()}
    </div>
  {/if}
  {#if availableFilters.length > 0}
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {#each availableFilters as filterName (filterName)}
        {@const def = SEARCH_FILTER_DEFINITIONS[filterName]}
        {@const config = selectedPreset!.params[filterName]}
        {@const defaultKey = defaultValueKey(filterName)}
        <div>
          <label
            class="block text-xs font-medium text-[var(--dash-text-secondary)] mb-1"
            for="picker-filter-{filterName}"
          >{def.label}</label>
          {#if config.multi}
            <div
              id="picker-filter-{filterName}"
              class="flex flex-wrap gap-x-3 gap-y-1 px-2 py-1.5 text-sm border border-[var(--dash-border)] rounded bg-[var(--dash-bg)]"
            >
              {#each Object.entries(def.values) as [valueKey, valueLabel] (valueKey)}
                {#if valueKey !== defaultKey && valueKey in config.options}
                  <label
                    class="inline-flex items-center gap-1.5 text-[var(--dash-text)] cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={isMultiChecked(filterName, valueKey)}
                      onchange={() => toggleMulti(filterName, valueKey)}
                      class="accent-[var(--dash-primary)]"
                    />
                    {valueLabel}
                  </label>
                {/if}
              {/each}
            </div>
          {:else}
            <select
              id="picker-filter-{filterName}"
              value={typeof filters[filterName] === "string"
                ? filters[filterName]
                : defaultKey}
              onchange={(e) => {
                const v = (e.currentTarget as HTMLSelectElement).value;
                if (v === defaultKey) {
                  const { [filterName]: _, ...rest } = filters;
                  filters = rest;
                } else {
                  filters = { ...filters, [filterName]: v };
                }
              }}
              class="w-full px-2 py-1.5 text-sm border border-[var(--dash-border)] rounded bg-[var(--dash-bg)] text-[var(--dash-text)]"
            >
              {#each Object.entries(def.values) as [valueKey, valueLabel] (valueKey)}
                {#if valueKey === defaultKey || valueKey in config.options}
                  <option value={valueKey}>{valueLabel}</option>
                {/if}
              {/each}
            </select>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
  {#if !placeholders.hasKeywords && !placeholders.hasLocation && availableFilters.length === 0}
    <p class="text-xs text-[var(--dash-text-secondary)]">
      This preset uses a fixed URL — no keyword, location, or filter to
      configure. The task will scrape the linked page as-is.
    </p>
  {/if}
{/if}

<!-- URL preview -->
{#if resolvedUrl}
  <div
    class="bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded p-2 text-xs"
  >
    <div class="flex items-center justify-between gap-2 mb-1">
      <span class="font-medium text-[var(--dash-text-secondary)]"
      >Will scrape:</span>
      <a
        href={resolvedUrl}
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex items-center gap-1 text-[var(--dash-primary)] hover:underline"
      >
        Preview
        <FontAwesomeIcon icon={faArrowUpRightFromSquare} class="w-3 h-3" />
      </a>
    </div>
    <div class="font-mono text-[var(--dash-text-secondary)] break-all">
      {resolvedUrl}
    </div>
  </div>
{/if}
