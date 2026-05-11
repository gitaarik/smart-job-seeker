<script lang="ts">
  /**
   * Two-step platform → preset picker plus the conditional Keywords/Location
   * inputs (or Custom URL input). Renders the URL preview underneath.
   *
   * Used by SimplifiedAddTaskForm (new tasks) and SourceEditor (edit page).
   * The parent owns save semantics — this component only manages the picker
   * state and exposes the resolved values via $bindable props.
   */
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import { faArrowUpRightFromSquare } from "@fortawesome/free-solid-svg-icons";
  import {
    fillSearchTemplate,
    templatePlaceholders,
  } from "$lib/job-platforms/url-template";

  export type SourcePreset = {
    preset_id: number;
    preset_label: string;
    url_template: string;
    applicable_hint: string | null;
    platform_id: number;
    platform_key: string;
    platform_name: string;
    platform_url: string;
  };

  interface Props {
    presets: SourcePreset[];
    /** Bidirectional. "custom" or a platform key from the presets list. */
    platformValue: string;
    /** Bidirectional. Preset id, or null when platform is "custom". */
    presetId: number | null;
    /** Bidirectional. Keywords value (used when chosen preset has {KEYWORDS}). */
    keywords: string;
    /** Bidirectional. Location value (used when chosen preset has {LOCATION}). */
    location: string;
    /** Bidirectional. Custom URL value (used in custom mode). */
    customUrl: string;
    /** Output (read-only): resolved URL after substitution. */
    resolvedUrl: string;
  }

  let {
    presets,
    platformValue = $bindable("custom"),
    presetId = $bindable(null),
    keywords = $bindable(""),
    location = $bindable(""),
    customUrl = $bindable(""),
    resolvedUrl = $bindable(""),
  }: Props = $props();

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
  // if the current presetId isn't in the new platform's set.
  $effect(() => {
    if (platformValue === "custom") {
      presetId = null;
      return;
    }
    const platform = platforms.find((p) => p.key === platformValue);
    if (!platform) return;
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
      );
    } else {
      resolvedUrl = customUrl.trim();
    }
  });
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

  {#if selectedPlatform && selectedPlatform.items.length > 1}
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
    <label
      class="block text-xs font-medium text-[var(--dash-text-secondary)] mb-1"
      for="picker-custom-url"
    >Search URL *</label>
    <input
      id="picker-custom-url"
      type="url"
      bind:value={customUrl}
      required
      placeholder="https://example.com/jobs?q=react+developer"
      class="w-full px-2 py-1.5 text-sm border border-[var(--dash-border)] rounded bg-[var(--dash-bg)] text-[var(--dash-text)] font-mono"
    />
    <p class="text-xs text-[var(--dash-text-muted)] mt-1">
      Paste a search-result URL from any job site. The platform will be
      auto-detected from the domain.
    </p>
  </div>
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
    </div>
  {/if}
  {#if !placeholders.hasKeywords && !placeholders.hasLocation}
    <p class="text-xs text-[var(--dash-text-secondary)]">
      This preset uses a fixed URL — no keyword or location filter to
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
