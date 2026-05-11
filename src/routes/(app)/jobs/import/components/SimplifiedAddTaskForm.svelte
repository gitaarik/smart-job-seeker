<script lang="ts">
  /**
   * Friendly add-task form built on top of the per-platform preset
   * architecture. User picks a preset (grouped by platform) or "Custom URL",
   * fills only the fields the chosen preset's template actually needs
   * (keywords if {KEYWORDS} in template, location if {LOCATION}, neither for
   * literal URLs like Wellfound role pages), and sees a live preview of the
   * URL the scraper will use.
   *
   * Hidden defaults match what the suggestion-accept flow already uses
   * (Cloud browser, no login, 25 max jobs, stop after 5 dupes, skip existing).
   * If a user needs different scraping config they can edit the task after
   * creation — the edit page has the full SearchTaskFields with every knob.
   */
  import { enhance } from "$app/forms";
  import { goto } from "$app/navigation";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faArrowUpRightFromSquare,
    faMagicWandSparkles,
  } from "@fortawesome/free-solid-svg-icons";
  import { fillSearchTemplate, templatePlaceholders } from "$lib/job-platforms/url-template";
  import { track } from "$lib/tools/analytics";

  type Preset = {
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
    presets: Preset[];
    defaultMaxJobs: number | null;
    onCancel: () => void;
  }

  let { presets, defaultMaxJobs, onCancel }: Props = $props();

  // Group presets by platform once. Each platform's presets keep the order
  // they came in (already sorted by priority on the server).
  let platforms = $derived.by(() => {
    const groups = new Map<string, { key: string; name: string; items: Preset[] }>();
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

  // Two-step picker:
  //   platformValue: the chosen platform key, or "custom" for the
  //   any-URL escape hatch.
  //   presetId:     the chosen preset within that platform. Auto-set when
  //   the platform has only one preset; user-driven when multiple.
  let platformValue = $state<string>(
    presets.length > 0 ? presets[0].platform_key : "custom",
  );
  let presetId = $state<number | null>(
    presets.length > 0 ? presets[0].preset_id : null,
  );

  // When the platform changes, default to its highest-priority preset.
  // This effect runs whenever platformValue changes (including the
  // initial value, which is fine — it'll just re-set presetId to the
  // same already-correct value).
  $effect(() => {
    if (platformValue === "custom") {
      presetId = null;
      return;
    }
    const platform = platforms.find((p) => p.key === platformValue);
    if (!platform) return;
    const currentlyValid = platform.items.some((i) => i.preset_id === presetId);
    if (!currentlyValid) {
      presetId = platform.items[0].preset_id;
    }
  });

  let selectedPlatform = $derived(
    platforms.find((p) => p.key === platformValue) ?? null,
  );
  let selectedPreset = $derived.by<Preset | null>(() => {
    if (platformValue === "custom" || presetId === null) return null;
    return presets.find((p) => p.preset_id === presetId) ?? null;
  });
  let placeholders = $derived(
    selectedPreset
      ? templatePlaceholders(selectedPreset.url_template)
      : { hasKeywords: true, hasLocation: true },
  );

  let keywords = $state("");
  let location = $state("");
  let customUrl = $state("");
  let note = $state("");
  let submitting = $state(false);

  // Live URL preview — what the scraper will receive after substitution.
  let previewUrl = $derived.by(() => {
    if (selectedPreset) {
      return fillSearchTemplate(
        selectedPreset.url_template,
        placeholders.hasKeywords ? keywords : null,
        placeholders.hasLocation ? location : null,
      );
    }
    return customUrl.trim();
  });

  // Validation: enabled only when we have a usable URL.
  let canSubmit = $derived.by(() => {
    if (submitting) return false;
    if (selectedPreset) {
      // For presets with placeholders, the corresponding field must be
      // non-empty. For literal-URL presets (no placeholders) we always
      // have a valid URL.
      if (placeholders.hasKeywords && !keywords.trim()) return false;
      // Location is generally optional — most templates work without it
      // (the param gets stripped). Don't gate on location.
      return previewUrl.length > 0;
    }
    return customUrl.trim().length > 0;
  });
</script>

<form
  method="POST"
  action="?/create"
  class="bg-[var(--dash-card)] rounded-lg border border-[var(--dash-primary)] p-4 space-y-4"
  use:enhance={() => {
    submitting = true;
    return async ({ result }) => {
      submitting = false;
      if (result.type === "success" && result.data && "taskId" in result.data) {
        track("search_task_created");
        await goto(`/jobs/import/tasks/${result.data.taskId}`);
      }
    };
  }}
>
  <h3 class="font-medium text-[var(--dash-text)]">Add Import Task</h3>

  <!-- Two-step picker: platform first, then preset (if the platform has >1) -->
  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
    <div>
      <label
        class="block text-xs font-medium text-[var(--dash-text-secondary)] mb-1"
        for="add-platform"
      >Platform</label>
      <select
        id="add-platform"
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
          for="add-preset"
        >Search type</label>
        <select
          id="add-preset"
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
    <p class="text-xs text-[var(--dash-text-secondary)] -mt-2">
      {selectedPreset.applicable_hint}
    </p>
  {/if}

  <!-- Conditional fields based on selection -->
  {#if selectedPreset === null}
    <!-- Custom URL mode -->
    <div>
      <label
        class="block text-xs font-medium text-[var(--dash-text-secondary)] mb-1"
        for="add-custom-url"
      >Search URL *</label>
      <input
        id="add-custom-url"
        type="url"
        bind:value={customUrl}
        required
        placeholder="https://example.com/jobs?q=react+developer"
        class="w-full px-2 py-1.5 text-sm border border-[var(--dash-border)] rounded bg-[var(--dash-bg)] text-[var(--dash-text)] font-mono"
      />
      <p class="text-xs text-[var(--dash-text-muted)] mt-1">
        Paste a search-result URL from LinkedIn, Indeed, or any other job
        site. The platform will be auto-detected from the domain.
      </p>
    </div>
  {:else}
    <!-- Preset mode: conditional fields based on template placeholders -->
    {#if placeholders.hasKeywords}
      <div>
        <label
          class="block text-xs font-medium text-[var(--dash-text-secondary)] mb-1"
          for="add-keywords"
        >Keywords *</label>
        <input
          id="add-keywords"
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
          for="add-location"
        >Location <span
            class="font-normal text-[var(--dash-text-muted)]"
          >(optional)</span></label>
        <input
          id="add-location"
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

  <!-- Live URL preview -->
  {#if previewUrl}
    <div
      class="bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded p-2 text-xs"
    >
      <div class="flex items-center justify-between gap-2 mb-1">
        <span class="font-medium text-[var(--dash-text-secondary)]"
        >Will scrape:</span>
        <a
          href={previewUrl}
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-1 text-[var(--dash-primary)] hover:underline"
        >
          Preview
          <FontAwesomeIcon
            icon={faArrowUpRightFromSquare}
            class="w-3 h-3"
          />
        </a>
      </div>
      <div
        class="font-mono text-[var(--dash-text-secondary)] break-all"
      >{previewUrl}</div>
    </div>
  {/if}

  <!-- Optional note -->
  <div>
    <label
      class="block text-xs font-medium text-[var(--dash-text-secondary)] mb-1"
      for="add-note"
    >Note <span
        class="font-normal text-[var(--dash-text-muted)]"
      >(optional)</span></label>
    <input
      id="add-note"
      type="text"
      bind:value={note}
      placeholder="e.g. Remote-leaning, recent posts only"
      class="w-full px-2 py-1.5 text-sm border border-[var(--dash-border)] rounded bg-[var(--dash-bg)] text-[var(--dash-text)]"
    />
  </div>

  <!-- Hidden fields the server expects. -->
  <input type="hidden" name="search_url" value={previewUrl} />
  {#if selectedPreset}
    <input type="hidden" name="preset_id" value={selectedPreset.preset_id} />
    <input type="hidden" name="platform_id" value={selectedPreset.platform_id} />
    <input type="hidden" name="platform_url" value={selectedPreset.platform_url} />
    <input type="hidden" name="platform_name" value={selectedPreset.platform_name} />
  {:else}
    <!-- Custom URL: let the server's auto-detection assign the platform via
         platform_url = search_url. -->
    <input type="hidden" name="platform_url" value={customUrl.trim()} />
  {/if}
  {#if placeholders.hasKeywords && keywords.trim()}
    <input type="hidden" name="search_term" value={keywords.trim()} />
  {/if}
  <input type="hidden" name="note" value={note} />
  <!-- Sensible defaults — match the suggestion-accept flow so both
       entry points produce equivalent tasks. Users tweak via the edit
       page after creation. -->
  <input type="hidden" name="browser_provider" value="hosted" />
  <input type="hidden" name="login_mode" value="none" />
  <input type="hidden" name="max_jobs" value={String(defaultMaxJobs ?? 25)} />
  <input type="hidden" name="stop_after_duplicates" value="5" />
  <input type="hidden" name="skip_existing" value="true" />
  <input type="hidden" name="keep_minimized" value="true" />

  <div class="flex justify-between items-center pt-2">
    <p class="text-xs text-[var(--dash-text-muted)] inline-flex items-center gap-1.5">
      <FontAwesomeIcon icon={faMagicWandSparkles} class="w-3 h-3" />
      Runs on our cloud scraper. Edit the task after creation for advanced options.
    </p>
    <div class="flex gap-2">
      <button
        type="button"
        onclick={onCancel}
        class="px-4 py-2 border border-[var(--dash-border)] rounded-lg text-[var(--dash-text)] hover:bg-[var(--dash-bg)] transition-colors"
      >Cancel</button>
      <button
        type="submit"
        disabled={!canSubmit}
        class="px-4 py-2 bg-[var(--dash-primary)] text-white rounded-lg hover:bg-[var(--dash-primary-hover)] disabled:opacity-60 transition-colors"
      >{submitting ? "Adding…" : "Add Task"}</button>
    </div>
  </div>
</form>
