<script lang="ts">
  /**
   * Friendly add-task form built on top of the per-platform preset
   * architecture. Wraps the shared SourcePicker (used by both add and edit
   * flows) with the form scaffolding: hidden fields the server expects,
   * note input, submit + cancel buttons.
   */
  import { enhance } from "$app/forms";
  import { goto } from "$app/navigation";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import { faMagicWandSparkles } from "@fortawesome/free-solid-svg-icons";
  import { track } from "$lib/tools/analytics";
  import SourcePicker, { type SourcePreset } from "./SourcePicker.svelte";

  interface Props {
    presets: SourcePreset[];
    defaultMaxJobs: number | null;
    onCancel: () => void;
  }

  let { presets, defaultMaxJobs, onCancel }: Props = $props();

  let platformValue = $state<string>(
    presets.length > 0 ? presets[0].platform_key : "custom",
  );
  let presetId = $state<number | null>(
    presets.length > 0 ? presets[0].preset_id : null,
  );
  let keywords = $state("");
  let location = $state("");
  let customUrl = $state("");
  let resolvedUrl = $state("");
  let note = $state("");
  let submitting = $state(false);

  let selectedPreset = $derived.by<SourcePreset | null>(() => {
    if (platformValue === "custom" || presetId === null) return null;
    return presets.find((p) => p.preset_id === presetId) ?? null;
  });

  let canSubmit = $derived.by(() => {
    if (submitting) return false;
    if (selectedPreset) {
      // For presets with {KEYWORDS}, the keywords field must be non-empty.
      if (
        selectedPreset.url_template.includes("{KEYWORDS}") && !keywords.trim()
      ) return false;
    } else if (!customUrl.trim()) {
      return false;
    }
    return resolvedUrl.length > 0;
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

  <SourcePicker
    {presets}
    bind:platformValue
    bind:presetId
    bind:keywords
    bind:location
    bind:customUrl
    bind:resolvedUrl
  />

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
  <input type="hidden" name="search_url" value={resolvedUrl} />
  {#if selectedPreset}
    <input type="hidden" name="preset_id" value={selectedPreset.preset_id} />
    <input type="hidden" name="platform_id" value={selectedPreset.platform_id} />
    <input type="hidden" name="platform_url" value={selectedPreset.platform_url} />
    <input type="hidden" name="platform_name" value={selectedPreset.platform_name} />
  {:else}
    <input type="hidden" name="platform_url" value={customUrl.trim()} />
  {/if}
  {#if selectedPreset && selectedPreset.url_template.includes("{KEYWORDS}") && keywords.trim()}
    <input type="hidden" name="search_term" value={keywords.trim()} />
  {/if}
  {#if selectedPreset && selectedPreset.url_template.includes("{LOCATION}") && location.trim()}
    <input type="hidden" name="search_location" value={location.trim()} />
  {/if}
  <input type="hidden" name="note" value={note} />
  <input type="hidden" name="browser_provider" value="hosted" />
  <input type="hidden" name="login_mode" value="none" />
  <input type="hidden" name="max_jobs" value={String(defaultMaxJobs ?? 25)} />
  <input type="hidden" name="stop_after_duplicates" value="5" />
  <input type="hidden" name="skip_existing" value="true" />
  <input type="hidden" name="keep_minimized" value="true" />

  <div class="flex justify-between items-center pt-2">
    <p
      class="text-xs text-[var(--dash-text-muted)] inline-flex items-center gap-1.5"
    >
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
