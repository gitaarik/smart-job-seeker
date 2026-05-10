<script lang="ts">
  import type { ActionData, PageData } from "./$types";
  import { enhance } from "$app/forms";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faArrowLeft,
    faCheck,
    faExternalLinkAlt,
    faFlask,
    faHistory,
    faTriangleExclamation,
  } from "@fortawesome/free-solid-svg-icons";

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let saving = $state(false);
  let testing = $state(false);

  // Bound form values, initialized from the loaded platform. Edits stay local
  // until the user clicks Save.
  let name = $state(data.platform.name);
  let key = $state(data.platform.key);
  let url = $state(data.platform.url);
  let type = $state(data.platform.type ?? "");
  let status = $state(data.platform.status);
  let loginPageUrl = $state(data.platform.login_page_url ?? "");
  let searchUrlTemplate = $state(data.platform.search_url_template ?? "");
  let suggestionPriority = $state(
    data.platform.suggestion_priority?.toString() ?? "",
  );
  let suggestionHint = $state(data.platform.suggestion_hint ?? "");

  // For the test action: separate keyword + location inputs.
  let testKeywords = $state("engineer");
  let testLocation = $state("");

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
    </div>

    <hr class="border-[var(--dash-border)]" />

    <div class="space-y-4">
      <h3
        class="text-sm font-medium text-[var(--dash-text)]"
      >Suggestion settings</h3>
      <p class="text-xs text-[var(--dash-text-secondary)]">
        Both <code>search_url_template</code> and <code>suggestion_priority</code>
        must be set for the platform to surface in the AI suggestion flow.
        Leave priority blank to keep the platform out of the pool without
        deleting it.
      </p>

      <div>
        <label
          class="block text-xs font-medium text-[var(--dash-text-secondary)] mb-1"
          for="field-template"
        >Search URL template</label>
        <input
          id="field-template"
          name="search_url_template"
          type="text"
          bind:value={searchUrlTemplate}
          placeholder="https://example.com/jobs?q=&#123;KEYWORDS&#125;&l=&#123;LOCATION&#125;"
          class="w-full px-2 py-1 text-sm border border-[var(--dash-border)] rounded bg-[var(--dash-bg)] text-[var(--dash-text)] font-mono"
        />
        <p class="text-xs text-[var(--dash-text-muted)] mt-1">
          Use <code>{`{KEYWORDS}`}</code> and <code>{`{LOCATION}`}</code> as
          placeholders. The endpoint URL-encodes both before substitution.
        </p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label
            class="block text-xs font-medium text-[var(--dash-text-secondary)] mb-1"
            for="field-priority"
          >Suggestion priority</label>
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
          >Suggestion hint</label>
          <input
            id="field-hint"
            name="suggestion_hint"
            type="text"
            bind:value={suggestionHint}
            placeholder="When should the LLM pick this platform?"
            class="w-full px-2 py-1 text-sm border border-[var(--dash-border)] rounded bg-[var(--dash-bg)] text-[var(--dash-text)]"
          />
        </div>
      </div>
    </div>

    <div class="flex justify-end">
      <button
        type="submit"
        disabled={saving}
        class="px-4 py-2 bg-[var(--dash-primary)] text-white rounded hover:bg-[var(--dash-primary-hover)] disabled:opacity-60"
      >{saving ? "Saving…" : "Save changes"}</button>
    </div>
  </form>

  <!-- Test template -->
  <form
    method="POST"
    action="?/testTemplate"
    class="bg-[var(--dash-card)] rounded-lg border border-[var(--dash-border)] p-4 space-y-4"
    use:enhance={() => {
      testing = true;
      return async ({ update }) => {
        await update();
        testing = false;
      };
    }}
  >
    <div class="flex items-center gap-2">
      <FontAwesomeIcon icon={faFlask} class="w-4 h-4 text-[var(--dash-primary)]" />
      <h3 class="text-sm font-medium text-[var(--dash-text)]">Test template</h3>
    </div>
    <p class="text-xs text-[var(--dash-text-secondary)]">
      Substitutes the keywords + location below into the template above (your
      unsaved edits are used) and fetches the URL once. Many job sites block
      direct fetches with a 403 — that's expected and not necessarily a
      template problem. Use the result as a quick sanity check.
    </p>
    <input type="hidden" name="search_url_template" value={searchUrlTemplate} />
    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div>
        <label
          class="block text-xs font-medium text-[var(--dash-text-secondary)] mb-1"
          for="test-keywords"
        >Test keywords</label>
        <input
          id="test-keywords"
          name="test_keywords"
          type="text"
          bind:value={testKeywords}
          class="w-full px-2 py-1 text-sm border border-[var(--dash-border)] rounded bg-[var(--dash-bg)] text-[var(--dash-text)]"
        />
      </div>
      <div>
        <label
          class="block text-xs font-medium text-[var(--dash-text-secondary)] mb-1"
          for="test-location"
        >Test location</label>
        <input
          id="test-location"
          name="test_location"
          type="text"
          bind:value={testLocation}
          placeholder="(optional)"
          class="w-full px-2 py-1 text-sm border border-[var(--dash-border)] rounded bg-[var(--dash-bg)] text-[var(--dash-text)]"
        />
      </div>
    </div>
    <div class="flex justify-end">
      <button
        type="submit"
        disabled={testing || !searchUrlTemplate}
        class="px-3 py-1.5 text-sm border border-[var(--dash-border)] rounded text-[var(--dash-text)] hover:bg-[var(--dash-bg)] disabled:opacity-50"
      >{testing ? "Testing…" : "Run test fetch"}</button>
    </div>

    {#if form && "testResult" in form && form.testResult}
      {@const r = form.testResult}
      <div
        class="bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded p-3 space-y-2 text-xs"
      >
        <div class="flex items-center justify-between">
          <span
            class="font-mono text-[var(--dash-text-secondary)] break-all flex-1 mr-3"
          >{r.testUrl}</span>
          <a
            href={r.testUrl}
            target="_blank"
            rel="noopener noreferrer"
            class="text-[var(--dash-primary)] hover:underline whitespace-nowrap"
          >Open in browser</a>
        </div>
        {#if r.networkError}
          <div class="text-red-600 dark:text-red-400">
            Network error: {r.networkError}
          </div>
        {:else}
          <div class="grid grid-cols-3 gap-3">
            <div>
              <div class="text-[var(--dash-text-muted)]">HTTP status</div>
              <div
                class="text-[var(--dash-text)] {r.status >= 200 && r.status < 300
                  ? 'text-green-600 dark:text-green-400'
                  : r.status >= 400
                    ? 'text-red-600 dark:text-red-400'
                    : ''}"
              >{r.status}</div>
            </div>
            <div>
              <div class="text-[var(--dash-text-muted)]">Response size</div>
              <div class="text-[var(--dash-text)]">{r.contentLength} bytes</div>
            </div>
            <div>
              <div class="text-[var(--dash-text-muted)]">Looks like jobs?</div>
              <div
                class={r.lookedLikeJobs
                  ? "text-green-600 dark:text-green-400"
                  : "text-amber-600 dark:text-amber-400"}
              >{r.lookedLikeJobs ? "Yes" : "Inconclusive"}</div>
            </div>
          </div>
          <details class="text-[var(--dash-text-secondary)]">
            <summary class="cursor-pointer">Body preview (first 500 bytes)</summary>
            <pre
              class="mt-2 p-2 bg-[var(--dash-card)] rounded text-xs overflow-x-auto whitespace-pre-wrap"
            >{r.bodyPreview}</pre>
          </details>
        {/if}
      </div>
    {/if}
  </form>

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
      >No edits recorded for this platform yet.</p>
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
