<script lang="ts">
  import type { ActionData, PageData } from "./$types";
  import { enhance } from "$app/forms";
  import { invalidateAll } from "$app/navigation";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faArrowLeft,
    faChartLine,
    faCheck,
    faExternalLinkAlt,
    faFlask,
    faHistory,
    faPlus,
    faPenToSquare,
    faTrash,
    faTriangleExclamation,
    faXmark,
  } from "@fortawesome/free-solid-svg-icons";

  let { data, form }: { data: PageData; form: ActionData } = $props();

  // Bound form values for the platform-level fields.
  let saving = $state(false);
  let name = $state(data.platform.name);
  let key = $state(data.platform.key);
  let url = $state(data.platform.url);
  let type = $state(data.platform.type ?? "");
  let status = $state(data.platform.status);
  let loginPageUrl = $state(data.platform.login_page_url ?? "");
  let suggestionPriority = $state(
    data.platform.suggestion_priority?.toString() ?? "",
  );
  let suggestionHint = $state(data.platform.suggestion_hint ?? "");

  // Preset editing state — track which preset is being edited inline.
  let editingPresetId = $state<number | null>(null);
  let testingPresetId = $state<number | null>(null);
  let lastTestResult = $state<
    | {
      presetId: number;
      testUrl: string;
      status: number;
      contentLength: number;
      lookedLikeJobs: boolean;
      networkError: string | null;
      bodyPreview: string;
    }
    | null
  >(null);

  // Inline-edit working copies (only for the preset currently being edited).
  let editLabel = $state("");
  let editUrlTemplate = $state("");
  let editHint = $state("");
  let editPriority = $state("");

  // Discovery credentials state.
  let credsSaving = $state(false);
  let credsSavedFlash = $state(false);
  let discoveryUsername = $state(data.platform.discovery_username ?? "");
  let discoveryPassword = $state("");
  let editingPassword = $state(!data.platform.discovery_password_set);

  // Add-preset state.
  let addingPreset = $state(false);
  let newLabel = $state("");
  let newUrlTemplate = $state("");
  let newHint = $state("");
  let newPriority = $state("");

  // Test-keywords / test-location used by all preset test buttons.
  let testKeywords = $state("engineer");
  let testLocation = $state("");

  // Phase 1 platform-level signal stats.
  let totalRuns = $derived(
    data.platform.success_count + data.platform.failure_count,
  );
  let successRate = $derived(
    totalRuns > 0
      ? Math.round((data.platform.success_count / totalRuns) * 100)
      : null,
  );

  function startEditing(p: typeof data.presets[number]) {
    editingPresetId = p.id;
    editLabel = p.label;
    editUrlTemplate = p.url_template;
    editHint = p.applicable_hint ?? "";
    editPriority = p.suggestion_priority?.toString() ?? "";
    lastTestResult = null;
  }

  function cancelEditing() {
    editingPresetId = null;
    editLabel = "";
    editUrlTemplate = "";
    editHint = "";
    editPriority = "";
  }

  function resetAddForm() {
    addingPreset = false;
    newLabel = "";
    newUrlTemplate = "";
    newHint = "";
    newPriority = "";
  }

  function formatTimestamp(ts: Date | string | null): string {
    if (!ts) return "";
    const d = typeof ts === "string" ? new Date(ts) : ts;
    return d.toLocaleString();
  }

  function truncate(value: string | null, max: number): string {
    if (!value) return "—";
    return value.length > max ? value.slice(0, max) + "…" : value;
  }
</script>

<svelte:head>
  <title>{data.platform.name} - Job Platforms - Admin</title>
</svelte:head>

<div class="space-y-6">
  <div class="flex items-center gap-3">
    <a
      href="/admin/job-platforms"
      class="text-[var(--dash-text-secondary)] hover:text-[var(--dash-text)]"
    >
      <FontAwesomeIcon icon={faArrowLeft} class="w-4 h-4" />
    </a>
    <h1 class="text-2xl font-semibold text-[var(--dash-text)]">{data.platform.name}</h1>
    <code
      class="text-sm text-[var(--dash-text-secondary)] font-mono"
    >{data.platform.key}</code>
  </div>

  {#if form && "savedFields" in form && form.savedFields}
    <div
      class="flex items-center gap-2 p-3 rounded bg-green-50 border border-green-200 text-green-800 dark:bg-green-950/30 dark:border-green-800 dark:text-green-200 text-sm"
    >
      <FontAwesomeIcon icon={faCheck} class="w-4 h-4" />
      {#if form.savedFields.length === 0}
        No changes to save.
      {:else}
        Saved: {form.savedFields.join(", ")}
      {/if}
    </div>
  {/if}

  {#if form && "error" in form && form.error}
    <div
      class="flex items-center gap-2 p-3 rounded bg-red-50 border border-red-200 text-red-800 dark:bg-red-950/30 dark:border-red-800 dark:text-red-200 text-sm"
    >
      <FontAwesomeIcon icon={faTriangleExclamation} class="w-4 h-4" />
      {form.error}
    </div>
  {/if}

  <!-- Platform-level fields -->
  <form
    method="POST"
    action="?/save"
    class="bg-[var(--dash-card)] rounded-lg border border-[var(--dash-border)] p-4 space-y-4"
    use:enhance={() => {
      saving = true;
      return async ({ update }) => {
        await update();
        saving = false;
      };
    }}
  >
    <h3 class="text-sm font-medium text-[var(--dash-text)]">Platform details</h3>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label
          class="block text-xs font-medium text-[var(--dash-text-secondary)] mb-1"
          for="field-name"
        >Name</label>
        <input
          id="field-name"
          name="name"
          type="text"
          bind:value={name}
          required
          class="w-full px-2 py-1 text-sm border border-[var(--dash-border)] rounded bg-[var(--dash-bg)] text-[var(--dash-text)]"
        />
      </div>
      <div>
        <label
          class="block text-xs font-medium text-[var(--dash-text-secondary)] mb-1"
          for="field-key"
        >Key</label>
        <input
          id="field-key"
          name="key"
          type="text"
          bind:value={key}
          required
          class="w-full px-2 py-1 text-sm border border-[var(--dash-border)] rounded bg-[var(--dash-bg)] text-[var(--dash-text)] font-mono"
        />
      </div>
      <div class="md:col-span-2">
        <label
          class="block text-xs font-medium text-[var(--dash-text-secondary)] mb-1"
          for="field-url"
        >Base URL</label>
        <div class="flex items-center gap-2">
          <input
            id="field-url"
            name="url"
            type="url"
            bind:value={url}
            required
            class="flex-1 px-2 py-1 text-sm border border-[var(--dash-border)] rounded bg-[var(--dash-bg)] text-[var(--dash-text)]"
          />
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            class="text-[var(--dash-text-muted)] hover:text-[var(--dash-primary)]"
            aria-label="Open base URL"
          >
            <FontAwesomeIcon icon={faExternalLinkAlt} class="w-4 h-4" />
          </a>
        </div>
      </div>
      <div>
        <label
          class="block text-xs font-medium text-[var(--dash-text-secondary)] mb-1"
          for="field-status"
        >Status</label>
        <input
          id="field-status"
          name="status"
          type="text"
          bind:value={status}
          required
          class="w-full px-2 py-1 text-sm border border-[var(--dash-border)] rounded bg-[var(--dash-bg)] text-[var(--dash-text)]"
        />
      </div>
      <div>
        <label
          class="block text-xs font-medium text-[var(--dash-text-secondary)] mb-1"
          for="field-type"
        >Type</label>
        <input
          id="field-type"
          name="type"
          type="text"
          bind:value={type}
          placeholder="job_boards / vetted_platforms / …"
          class="w-full px-2 py-1 text-sm border border-[var(--dash-border)] rounded bg-[var(--dash-bg)] text-[var(--dash-text)]"
        />
      </div>
      <div class="md:col-span-2">
        <label
          class="block text-xs font-medium text-[var(--dash-text-secondary)] mb-1"
          for="field-login"
        >Login page URL</label>
        <input
          id="field-login"
          name="login_page_url"
          type="url"
          bind:value={loginPageUrl}
          placeholder="https://example.com/login"
          class="w-full px-2 py-1 text-sm border border-[var(--dash-border)] rounded bg-[var(--dash-bg)] text-[var(--dash-text)]"
        />
      </div>
      <div>
        <label
          class="block text-xs font-medium text-[var(--dash-text-secondary)] mb-1"
          for="field-priority"
        >Platform suggestion priority</label>
        <input
          id="field-priority"
          name="suggestion_priority"
          type="number"
          bind:value={suggestionPriority}
          placeholder="1 = top, blank = not in pool"
          min="1"
          class="w-full px-2 py-1 text-sm border border-[var(--dash-border)] rounded bg-[var(--dash-bg)] text-[var(--dash-text)]"
        />
      </div>
      <div>
        <label
          class="block text-xs font-medium text-[var(--dash-text-secondary)] mb-1"
          for="field-hint"
        >Platform suggestion hint</label>
        <input
          id="field-hint"
          name="suggestion_hint"
          type="text"
          bind:value={suggestionHint}
          placeholder="When should the LLM consider this platform?"
          class="w-full px-2 py-1 text-sm border border-[var(--dash-border)] rounded bg-[var(--dash-bg)] text-[var(--dash-text)]"
        />
      </div>
    </div>

    <div class="flex justify-end">
      <button
        type="submit"
        disabled={saving}
        class="px-4 py-2 bg-[var(--dash-primary)] text-white rounded hover:bg-[var(--dash-primary-hover)] disabled:opacity-60"
      >{saving ? "Saving…" : "Save platform"}</button>
    </div>
  </form>

  <!-- Discovery credentials -->
  <form
    id="discovery-credentials"
    method="POST"
    action="?/saveCredentials"
    use:enhance={() => {
      credsSaving = true;
      return async ({ result }) => {
        credsSaving = false;
        if (result.type === "success") {
          credsSavedFlash = true;
          discoveryPassword = "";
          editingPassword = false;
          setTimeout(() => (credsSavedFlash = false), 1500);
          await invalidateAll();
        }
      };
    }}
    class="bg-[var(--dash-card)] rounded-lg border border-[var(--dash-border)] p-4 space-y-3"
  >
    <div class="flex items-center justify-between">
      <div>
        <h3 class="text-sm font-medium text-[var(--dash-text)]">
          Discovery credentials
        </h3>
        <p class="text-xs text-[var(--dash-text-secondary)] mt-1">
          Used by the platform-discovery scraper to log in before crawling.
          One pair per platform — set only if the site gates its job listings
          behind login. Password is stored AES-256-GCM encrypted and never
          shipped back to the browser.
        </p>
      </div>
      {#if credsSavedFlash}
        <span class="text-xs text-green-600 dark:text-green-400 inline-flex items-center gap-1">
          <FontAwesomeIcon icon={faCheck} class="w-3 h-3" />
          Saved
        </span>
      {/if}
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div>
        <label
          class="block text-xs font-medium text-[var(--dash-text-secondary)] mb-1"
          for="discovery-username"
        >Username / email</label>
        <input
          id="discovery-username"
          name="discovery_username"
          type="text"
          bind:value={discoveryUsername}
          autocomplete="off"
          class="w-full px-2 py-1 text-sm border border-[var(--dash-border)] rounded bg-[var(--dash-bg)] text-[var(--dash-text)]"
        />
      </div>
      <div>
        <label
          class="block text-xs font-medium text-[var(--dash-text-secondary)] mb-1"
          for="discovery-password"
        >Password</label>
        {#if !editingPassword}
          <div class="flex items-center gap-2">
            <span class="text-xs text-[var(--dash-text-muted)] flex-1">
              ✓ set (encrypted)
            </span>
            <button
              type="button"
              onclick={() => (editingPassword = true)}
              class="text-xs text-[var(--dash-primary)] hover:underline"
            >Change</button>
          </div>
        {:else}
          <input
            id="discovery-password"
            name="discovery_password"
            type="password"
            bind:value={discoveryPassword}
            autocomplete="new-password"
            placeholder={data.platform.discovery_password_set
              ? "(leave empty to keep current)"
              : ""}
            class="w-full px-2 py-1 text-sm border border-[var(--dash-border)] rounded bg-[var(--dash-bg)] text-[var(--dash-text)]"
          />
        {/if}
      </div>
    </div>

    <div class="flex justify-between items-center pt-1">
      {#if data.platform.discovery_password_set || data.platform.discovery_username}
        <button
          type="submit"
          formaction="?/saveCredentials"
          onclick={(e) => {
            if (!confirm("Clear stored discovery credentials?")) {
              e.preventDefault();
            }
          }}
          name="clear"
          value="true"
          class="text-xs text-red-600 dark:text-red-400 hover:underline"
        >Clear credentials</button>
      {:else}
        <span></span>
      {/if}
      <button
        type="submit"
        disabled={credsSaving}
        class="px-4 py-2 bg-[var(--dash-primary)] text-white rounded hover:bg-[var(--dash-primary-hover)] disabled:opacity-60"
      >{credsSaving ? "Saving…" : "Save credentials"}</button>
    </div>
  </form>

  <!-- Search presets -->
  <div class="bg-[var(--dash-card)] rounded-lg border border-[var(--dash-border)] p-4 space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <h3 class="text-sm font-medium text-[var(--dash-text)]">Search presets</h3>
        <p class="text-xs text-[var(--dash-text-secondary)] mt-1">
          One row per ready-to-use URL on this platform. Templates may use
          <code>&#123;KEYWORDS&#125;</code> and <code>&#123;LOCATION&#125;</code>
          placeholders — the server URL-encodes and substitutes values from the
          LLM. Literal URLs (no placeholders) are used as-is.
        </p>
      </div>
      {#if !addingPreset}
        <button
          type="button"
          onclick={() => (addingPreset = true)}
          class="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-[var(--dash-primary)] text-white rounded hover:bg-[var(--dash-primary-hover)]"
        >
          <FontAwesomeIcon icon={faPlus} class="w-3 h-3" />
          Add preset
        </button>
      {/if}
    </div>

    {#if addingPreset}
      <form
        method="POST"
        action="?/addPreset"
        class="border border-[var(--dash-primary)] rounded p-3 space-y-3 bg-[var(--dash-bg)]"
        use:enhance={() => async ({ result, update }) => {
          if (result.type === "success") {
            resetAddForm();
            await invalidateAll();
          } else {
            await update();
          }
        }}
      >
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-medium text-[var(--dash-text-secondary)] mb-1" for="add-label">Label *</label>
            <input id="add-label" name="label" type="text" bind:value={newLabel} required class="w-full px-2 py-1 text-sm border border-[var(--dash-border)] rounded bg-[var(--dash-card)] text-[var(--dash-text)]" />
          </div>
          <div>
            <label class="block text-xs font-medium text-[var(--dash-text-secondary)] mb-1" for="add-priority">Priority (within platform)</label>
            <input id="add-priority" name="suggestion_priority" type="number" bind:value={newPriority} min="1" placeholder="blank = not in pool" class="w-full px-2 py-1 text-sm border border-[var(--dash-border)] rounded bg-[var(--dash-card)] text-[var(--dash-text)]" />
          </div>
        </div>
        <div>
          <label class="block text-xs font-medium text-[var(--dash-text-secondary)] mb-1" for="add-url">URL template *</label>
          <input id="add-url" name="url_template" type="text" bind:value={newUrlTemplate} required placeholder="https://example.com/jobs?q=&#123;KEYWORDS&#125;&l=&#123;LOCATION&#125;" class="w-full px-2 py-1 text-sm border border-[var(--dash-border)] rounded bg-[var(--dash-card)] text-[var(--dash-text)] font-mono" />
        </div>
        <div>
          <label class="block text-xs font-medium text-[var(--dash-text-secondary)] mb-1" for="add-hint">When to pick</label>
          <input id="add-hint" name="applicable_hint" type="text" bind:value={newHint} placeholder="Hint shown to the LLM about when to pick this preset" class="w-full px-2 py-1 text-sm border border-[var(--dash-border)] rounded bg-[var(--dash-card)] text-[var(--dash-text)]" />
        </div>
        <div class="flex justify-end gap-2">
          <button type="button" onclick={resetAddForm} class="px-3 py-1.5 text-sm border border-[var(--dash-border)] rounded text-[var(--dash-text)] hover:bg-[var(--dash-bg)]">Cancel</button>
          <button type="submit" class="px-3 py-1.5 text-sm bg-[var(--dash-primary)] text-white rounded hover:bg-[var(--dash-primary-hover)]">Add preset</button>
        </div>
      </form>
    {/if}

    {#if data.presets.length === 0 && !addingPreset}
      <p class="text-sm text-[var(--dash-text-muted)]">
        No search presets configured yet. Add one above to make this platform
        suggestable.
      </p>
    {/if}

    <div class="space-y-2">
      {#each data.presets as preset (preset.id)}
        {@const presetTotal = preset.success_count + preset.failure_count}
        {@const presetSuccessRate = presetTotal > 0
          ? Math.round((preset.success_count / presetTotal) * 100)
          : null}
        <div
          class="border border-[var(--dash-border)] rounded p-3 space-y-2 {editingPresetId === preset.id
            ? 'bg-[var(--dash-bg)]'
            : ''}"
        >
          {#if editingPresetId === preset.id}
            <!-- Inline edit form -->
            <form
              method="POST"
              action="?/updatePreset"
              class="space-y-3"
              use:enhance={() => async ({ result, update }) => {
                if (result.type === "success") {
                  cancelEditing();
                  await invalidateAll();
                } else {
                  await update();
                }
              }}
            >
              <input type="hidden" name="preset_id" value={preset.id} />
              <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs font-medium text-[var(--dash-text-secondary)] mb-1" for="edit-label-{preset.id}">Label</label>
                  <input id="edit-label-{preset.id}" name="label" type="text" bind:value={editLabel} required class="w-full px-2 py-1 text-sm border border-[var(--dash-border)] rounded bg-[var(--dash-card)] text-[var(--dash-text)]" />
                </div>
                <div>
                  <label class="block text-xs font-medium text-[var(--dash-text-secondary)] mb-1" for="edit-priority-{preset.id}">Priority</label>
                  <input id="edit-priority-{preset.id}" name="suggestion_priority" type="number" bind:value={editPriority} min="1" class="w-full px-2 py-1 text-sm border border-[var(--dash-border)] rounded bg-[var(--dash-card)] text-[var(--dash-text)]" />
                </div>
              </div>
              <div>
                <label class="block text-xs font-medium text-[var(--dash-text-secondary)] mb-1" for="edit-url-{preset.id}">URL template</label>
                <input id="edit-url-{preset.id}" name="url_template" type="text" bind:value={editUrlTemplate} required class="w-full px-2 py-1 text-sm border border-[var(--dash-border)] rounded bg-[var(--dash-card)] text-[var(--dash-text)] font-mono" />
              </div>
              <div>
                <label class="block text-xs font-medium text-[var(--dash-text-secondary)] mb-1" for="edit-hint-{preset.id}">When to pick</label>
                <input id="edit-hint-{preset.id}" name="applicable_hint" type="text" bind:value={editHint} class="w-full px-2 py-1 text-sm border border-[var(--dash-border)] rounded bg-[var(--dash-card)] text-[var(--dash-text)]" />
              </div>
              <div class="flex justify-end gap-2">
                <button type="button" onclick={cancelEditing} class="px-3 py-1.5 text-sm border border-[var(--dash-border)] rounded text-[var(--dash-text)] hover:bg-[var(--dash-bg)]">Cancel</button>
                <button type="submit" class="px-3 py-1.5 text-sm bg-[var(--dash-primary)] text-white rounded hover:bg-[var(--dash-primary-hover)]">Save preset</button>
              </div>
            </form>
          {:else}
            <!-- Read-only row -->
            <div class="flex items-start justify-between gap-3">
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="font-medium text-[var(--dash-text)]">{preset.label}</span>
                  {#if preset.suggestion_priority !== null}
                    <span class="text-xs text-[var(--dash-text-muted)]">priority {preset.suggestion_priority}</span>
                  {:else}
                    <span class="text-xs text-[var(--dash-text-muted)]">(not in suggest pool)</span>
                  {/if}
                </div>
                <div class="text-xs font-mono text-[var(--dash-text-secondary)] mt-1 break-all">
                  {preset.url_template}
                </div>
                {#if preset.applicable_hint}
                  <div class="text-xs text-[var(--dash-text-secondary)] mt-1">{preset.applicable_hint}</div>
                {/if}
                <div class="flex items-center gap-3 text-xs mt-2">
                  <span class="text-[var(--dash-text-muted)]">Signals:</span>
                  {#if presetTotal === 0}
                    <span class="text-[var(--dash-text-muted)]">no runs yet</span>
                  {:else}
                    <span class="text-green-600 dark:text-green-400">{preset.success_count} ok</span>
                    <span class="text-red-600 dark:text-red-400">{preset.failure_count} fail</span>
                    {#if presetSuccessRate != null}
                      <span class="text-[var(--dash-text)]">({presetSuccessRate}%)</span>
                    {/if}
                  {/if}
                </div>
              </div>
              <div class="flex items-start gap-1 flex-shrink-0">
                <button type="button" onclick={() => startEditing(preset)} class="p-1.5 text-[var(--dash-text-secondary)] hover:text-[var(--dash-primary)] rounded hover:bg-[var(--dash-bg)]" title="Edit">
                  <FontAwesomeIcon icon={faPenToSquare} class="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onclick={() => (testingPresetId = testingPresetId === preset.id ? null : preset.id)}
                  class="p-1.5 text-[var(--dash-text-secondary)] hover:text-[var(--dash-primary)] rounded hover:bg-[var(--dash-bg)]"
                  title="Test"
                >
                  <FontAwesomeIcon icon={faFlask} class="w-3 h-3" />
                </button>
                <form
                  method="POST"
                  action="?/deletePreset"
                  use:enhance={() => async ({ result, update }) => {
                    if (result.type === "success") {
                      await invalidateAll();
                    } else {
                      await update();
                    }
                  }}
                >
                  <input type="hidden" name="preset_id" value={preset.id} />
                  <button
                    type="submit"
                    onclick={(e) => {
                      if (!confirm(`Delete preset "${preset.label}"? This can't be undone.`)) e.preventDefault();
                    }}
                    class="p-1.5 text-[var(--dash-text-secondary)] hover:text-red-600 dark:hover:text-red-400 rounded hover:bg-[var(--dash-bg)]"
                    title="Delete"
                  >
                    <FontAwesomeIcon icon={faTrash} class="w-3 h-3" />
                  </button>
                </form>
              </div>
            </div>

            {#if testingPresetId === preset.id}
              <form
                method="POST"
                action="?/testPreset"
                class="mt-2 p-3 bg-[var(--dash-bg)] rounded border border-[var(--dash-border)] space-y-2"
                use:enhance={() => async ({ result }) => {
                  // Read straight from `result.data` rather than the `form`
                  // prop — the prop is the previous-action's data until
                  // SvelteKit re-renders, and we don't want to wait for
                  // that (or risk reading stale state).
                  if (
                    result.type === "success" &&
                    result.data &&
                    "testResult" in result.data &&
                    result.data.testResult
                  ) {
                    lastTestResult = {
                      presetId: preset.id,
                      ...(result.data.testResult as Omit<
                        NonNullable<typeof lastTestResult>,
                        "presetId"
                      >),
                    };
                  }
                }}
              >
                <input type="hidden" name="url_template" value={preset.url_template} />
                <div class="grid grid-cols-2 gap-2">
                  <input name="test_keywords" type="text" bind:value={testKeywords} placeholder="keywords" class="px-2 py-1 text-xs border border-[var(--dash-border)] rounded bg-[var(--dash-card)] text-[var(--dash-text)]" />
                  <input name="test_location" type="text" bind:value={testLocation} placeholder="location (optional)" class="px-2 py-1 text-xs border border-[var(--dash-border)] rounded bg-[var(--dash-card)] text-[var(--dash-text)]" />
                </div>
                <div class="flex items-center justify-between">
                  <p class="text-xs text-[var(--dash-text-muted)]">
                    Many sites 403 anti-bot fetches — that's expected and doesn't mean broken.
                  </p>
                  <button type="submit" class="px-3 py-1 text-xs border border-[var(--dash-border)] rounded text-[var(--dash-text)] hover:bg-[var(--dash-card)]">Run test</button>
                </div>
                {#if lastTestResult && lastTestResult.presetId === preset.id}
                  <div class="text-xs space-y-1 pt-2 border-t border-[var(--dash-border)]">
                    <div class="flex justify-between gap-2">
                      <span class="font-mono break-all flex-1 text-[var(--dash-text-secondary)]">{lastTestResult.testUrl}</span>
                      <a href={lastTestResult.testUrl} target="_blank" rel="noopener noreferrer" class="text-[var(--dash-primary)] hover:underline whitespace-nowrap">Open</a>
                    </div>
                    {#if lastTestResult.networkError}
                      <div class="text-red-600 dark:text-red-400">Network error: {lastTestResult.networkError}</div>
                    {:else}
                      <div class="flex gap-4">
                        <span>HTTP <span class={lastTestResult.status >= 200 && lastTestResult.status < 300 ? 'text-green-600 dark:text-green-400' : lastTestResult.status >= 400 ? 'text-red-600 dark:text-red-400' : ''}>{lastTestResult.status}</span></span>
                        <span class="text-[var(--dash-text-secondary)]">{lastTestResult.contentLength} bytes</span>
                        <span class={lastTestResult.lookedLikeJobs ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}>{lastTestResult.lookedLikeJobs ? "Looks like jobs" : "Inconclusive"}</span>
                      </div>
                    {/if}
                  </div>
                {/if}
              </form>
            {/if}
          {/if}
        </div>
      {/each}
    </div>
  </div>

  <!-- Platform-level usage signals -->
  <div class="bg-[var(--dash-card)] rounded-lg border border-[var(--dash-border)] p-4">
    <div class="flex items-center gap-2 mb-3">
      <FontAwesomeIcon
        icon={faChartLine}
        class="w-4 h-4 text-[var(--dash-text-secondary)]"
      />
      <h3 class="text-sm font-medium text-[var(--dash-text)]">Platform-level signals</h3>
      <span
        class="text-xs text-[var(--dash-text-muted)]"
      >aggregate across all presets</span>
    </div>
    {#if totalRuns === 0}
      <p
        class="text-sm text-[var(--dash-text-muted)]"
      >No runs recorded for this platform yet.</p>
    {:else}
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div>
          <div class="text-[var(--dash-text-muted)]">Successful runs</div>
          <div class="text-base font-medium text-green-600 dark:text-green-400 tabular-nums">{data.platform.success_count}</div>
          {#if data.platform.last_success_at}
            <div class="text-[var(--dash-text-muted)] mt-0.5">last {formatTimestamp(data.platform.last_success_at)}</div>
          {/if}
        </div>
        <div>
          <div class="text-[var(--dash-text-muted)]">Failed runs</div>
          <div class="text-base font-medium text-red-600 dark:text-red-400 tabular-nums">{data.platform.failure_count}</div>
          {#if data.platform.last_failure_at}
            <div class="text-[var(--dash-text-muted)] mt-0.5">last {formatTimestamp(data.platform.last_failure_at)}</div>
          {/if}
        </div>
        <div>
          <div class="text-[var(--dash-text-muted)]">Total runs</div>
          <div class="text-base font-medium text-[var(--dash-text)] tabular-nums">{totalRuns}</div>
        </div>
        <div>
          <div class="text-[var(--dash-text-muted)]">Success rate</div>
          <div
            class="text-base font-medium tabular-nums {successRate != null && successRate >= 70
              ? 'text-green-600 dark:text-green-400'
              : successRate != null && successRate >= 40
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-red-600 dark:text-red-400'}"
          >{successRate}%</div>
        </div>
      </div>
    {/if}
  </div>

  <!-- Change history -->
  <div class="bg-[var(--dash-card)] rounded-lg border border-[var(--dash-border)] p-4">
    <div class="flex items-center gap-2 mb-3">
      <FontAwesomeIcon
        icon={faHistory}
        class="w-4 h-4 text-[var(--dash-text-secondary)]"
      />
      <h3 class="text-sm font-medium text-[var(--dash-text)]">
        Change history
        <span class="text-[var(--dash-text-muted)] font-normal">
          ({data.history.length})
        </span>
      </h3>
    </div>
    {#if data.history.length === 0}
      <p
        class="text-sm text-[var(--dash-text-muted)]"
      >No platform-level edits recorded yet. (Preset CRUD is not audited in v1.)</p>
    {:else}
      <div class="space-y-2 text-xs">
        {#each data.history as entry (entry.id)}
          <div
            class="flex items-start gap-3 py-1 border-b border-[var(--dash-border)] last:border-0"
          >
            <span class="text-[var(--dash-text-muted)] whitespace-nowrap">
              {formatTimestamp(entry.changed_at)}
            </span>
            <span
              class="font-mono px-1.5 py-0.5 bg-[var(--dash-bg)] rounded text-[var(--dash-text)]"
            >{entry.field}</span>
            <div class="flex-1 min-w-0">
              <span class="text-red-600 dark:text-red-400 line-through">
                {truncate(entry.old_value, 80)}
              </span>
              <span class="text-[var(--dash-text-muted)] mx-1">→</span>
              <span class="text-green-600 dark:text-green-400">
                {truncate(entry.new_value, 80)}
              </span>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>
