<script lang="ts">
  /**
   * Add-task form for the new dynamic search-form flow. The user picks a
   * platform and types search keywords; the scraper handles search-form
   * configuration at run time using the platform's `search_page_url`.
   *
   * No URL templates, no preset picker, no live URL preview. The previous
   * version (which wrapped SourcePicker) is gone with the URL-template
   * system. Edit-task flow still uses the old machinery and will be
   * migrated in a follow-up.
   */
  import { enhance } from "$app/forms";
  import { goto } from "$app/navigation";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import { faMagicWandSparkles } from "@fortawesome/free-solid-svg-icons";
  import { track } from "$lib/tools/analytics";
  import type { SearchFilterValue } from "$lib/job-platforms/search-filters";
  import FilterPicker from "./FilterPicker.svelte";

  export type ImportablePlatform = {
    id: number;
    key: string;
    name: string;
    url: string;
  };

  interface Props {
    platforms: ImportablePlatform[];
    defaultMaxJobs: number | null;
    onCancel: () => void;
  }

  let { platforms, defaultMaxJobs, onCancel }: Props = $props();

  let platformId = $state<number | null>(
    platforms.length > 0 ? platforms[0].id : null,
  );
  let keywords = $state("");
  let note = $state("");
  let filters = $state<Record<string, SearchFilterValue>>({});
  let submitting = $state(false);

  const selectedPlatform = $derived(
    platforms.find((p) => p.id === platformId) ?? null,
  );

  const canSubmit = $derived(!submitting && platformId !== null);
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

  {#if platforms.length === 0}
    <p class="text-sm text-[var(--dash-text-muted)]">
      No platforms are configured for the import flow yet. An admin needs to set
      a <code>search_page_url</code> on a platform before it can be used here.
    </p>
  {:else}
    <div>
      <label
        class="block text-xs font-medium text-[var(--dash-text-secondary)] mb-1"
        for="add-platform"
      >Platform</label>
      <select
        id="add-platform"
        bind:value={platformId}
        class="w-full px-2 py-1.5 text-sm border border-[var(--dash-border)] rounded bg-[var(--dash-bg)] text-[var(--dash-text)]"
      >
        {#each platforms as p (p.id)}
          <option value={p.id}>{p.name}</option>
        {/each}
      </select>
    </div>

    <div>
      <label
        class="block text-xs font-medium text-[var(--dash-text-secondary)] mb-1"
        for="add-keywords"
      >Search keywords <span class="font-normal text-[var(--dash-text-muted)]">(optional)</span></label>
      <input
        id="add-keywords"
        type="text"
        bind:value={keywords}
        placeholder="e.g. python developer — leave empty to import all listings"
        class="w-full px-2 py-1.5 text-sm border border-[var(--dash-border)] rounded bg-[var(--dash-bg)] text-[var(--dash-text)]"
      />
      <p class="text-xs text-[var(--dash-text-muted)] mt-1">
        Typed into the platform's search input if it has one. Leave empty for
        curated-listing sites (e.g. SvelteJobs) where you want to import everything.
      </p>
    </div>

    <div class="border-t border-[var(--dash-border)] pt-3">
      <p class="text-xs font-medium text-[var(--dash-text-secondary)] mb-2">
        Filter preferences <span
          class="font-normal text-[var(--dash-text-muted)]"
        >(optional — the scraper applies them per-platform)</span>
      </p>
      <FilterPicker bind:filters compact={true} />
    </div>

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
  {/if}

  <!-- Hidden fields the server action expects. -->
  {#if selectedPlatform}
    <input type="hidden" name="platform_id" value={selectedPlatform.id} />
  {/if}
  <input type="hidden" name="search_term" value={keywords} />
  <input type="hidden" name="search_filters" value={JSON.stringify(filters)} />
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
