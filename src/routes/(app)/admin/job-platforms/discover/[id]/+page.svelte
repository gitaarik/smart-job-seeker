<script lang="ts">
  import type { PageData } from "./$types";
  import { onMount, onDestroy } from "svelte";
  import { invalidateAll } from "$app/navigation";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import { faCheck, faCopy } from "@fortawesome/free-solid-svg-icons";
  import {
    SEARCH_FILTER_DEFINITIONS,
    type SearchFilterName,
    type PresetFilterConfig,
  } from "$lib/job-platforms/search-filters";
  import CredentialSelector from "../../../../jobs/components/CredentialSelector.svelte";

  let { data }: { data: PageData } = $props();
  let copied = $state(false);
  let cancelling = $state(false);
  let cancelError = $state<string | null>(null);

  // Credential / device state. The CredentialSelector mutates `credentials`
  // in place on add/delete, so it must be local $state.
  // For draft runs we pre-select the first available credential (admin will
  // pick + click Start). For non-draft runs we pin selection to the
  // credential the run actually used, so the highlight matches reality.
  let credentials = $state(data.credentials);
  let selectedCredentialId = $state<string>(
    data.run.platform_profile_id != null
      ? String(data.run.platform_profile_id)
      : data.credentials[0]
        ? String(data.credentials[0].id)
        : "",
  );
  // Discovery requires login — pin the toggle to "auto" and hide it.
  let loginMode = $state("auto");
  let selectedDeviceId = $state<string>(
    data.run.sjsbrowser_api_key_id != null
      ? String(data.run.sjsbrowser_api_key_id)
      : "",
  );
  let starting = $state(false);
  let startError = $state<string | null>(null);

  async function copyId() {
    try {
      await navigator.clipboard.writeText(String(data.run.id));
      copied = true;
      setTimeout(() => (copied = false), 1500);
    } catch {
      // Clipboard API rejected (insecure context, permissions, etc.) —
      // silently no-op; admin can still read the id from the URL bar.
    }
  }

  let run = $state(data.run);
  let logs = $state(data.logs);
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let showBrowser = $state(false);

  // Apply form (editable on success). Filter params live in the run's findings
  // and get written to the preset on apply — admin can drop a filter by
  // unchecking its keep-checkbox below.
  let draftTemplate = $state(data.run.findings?.search_url_template ?? "");
  let draftHint = $state(data.run.findings?.applicable_hint ?? "");
  let keepParams = $state<Record<string, boolean>>(
    Object.fromEntries(
      Object.keys(data.run.findings?.params ?? {}).map((k) => [k, true]),
    ),
  );
  let applying = $state(false);
  let applyError = $state<string | null>(null);
  let applyResult = $state<{ platform_id: number; preset_id: number | null } | null>(null);

  function isTerminal(status: string) {
    return ["success", "error", "cancelled"].includes(status);
  }

  async function startRun() {
    starting = true;
    startError = null;
    try {
      const res = await fetch(`/api/admin/discover/${run.id}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform_profile_id: Number(selectedCredentialId),
          sjsbrowser_api_key_id: selectedDeviceId
            ? Number(selectedDeviceId)
            : null,
        }),
      });
      if (!res.ok) {
        startError = (await res.text()) || `HTTP ${res.status}`;
        return;
      }
      const fresh = await res.json();
      run = fresh.run;
      // Re-arm the poll loop now that the run is no longer a draft.
      if (!pollTimer && !isTerminal(run.status)) {
        pollTimer = setInterval(poll, 2000);
      }
    } finally {
      starting = false;
    }
  }

  async function cancelRun() {
    if (!confirm("Cancel this discovery run?")) return;
    cancelling = true;
    cancelError = null;
    try {
      const res = await fetch(`/api/admin/discover/${run.id}/cancel`, {
        method: "POST",
      });
      if (!res.ok) {
        cancelError = (await res.text()) || `HTTP ${res.status}`;
      }
      await poll();
    } finally {
      cancelling = false;
    }
  }

  async function poll() {
    const sinceId = logs.length > 0 ? logs[logs.length - 1].id : 0;
    const res = await fetch(`/api/admin/discover/${run.id}?since=${sinceId}`);
    if (!res.ok) return;
    const fresh = await res.json();
    run = fresh.run;
    if (fresh.logs.length > 0) logs = [...logs, ...fresh.logs];
    if (run.status === "success") {
      if (!draftTemplate) draftTemplate = run.findings?.search_url_template ?? "";
      if (!draftHint) draftHint = run.findings?.applicable_hint ?? "";
      const params = run.findings?.params ?? {};
      for (const name of Object.keys(params)) {
        if (!(name in keepParams)) keepParams[name] = true;
      }
    }
    if (isTerminal(run.status) && pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  onMount(() => {
    // Draft runs don't have a worker yet — nothing to poll for.
    if (!isTerminal(run.status) && run.status !== "draft") {
      pollTimer = setInterval(poll, 2000);
    }
  });
  onDestroy(() => {
    if (pollTimer) clearInterval(pollTimer);
  });

  async function applyFindings() {
    applying = true;
    applyError = null;
    try {
      const allParams = run.findings?.params ?? {};
      const params: Record<string, PresetFilterConfig> = {};
      for (const [name, cfg] of Object.entries(allParams)) {
        if (keepParams[name]) params[name] = cfg;
      }
      const res = await fetch(`/api/admin/discover/${run.id}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          search_url_template: draftTemplate || null,
          applicable_hint: draftHint || null,
          params,
        }),
      });
      if (!res.ok) {
        applyError = (await res.text()) || `HTTP ${res.status}`;
        return;
      }
      applyResult = await res.json();
      await invalidateAll();
    } finally {
      applying = false;
    }
  }

  function filterOptionLabel(
    name: string,
    valueKey: string,
  ): string {
    const def = SEARCH_FILTER_DEFINITIONS[name as SearchFilterName];
    return def?.values[valueKey] ?? valueKey;
  }

  function filterDisplayName(name: string): string {
    const def = SEARCH_FILTER_DEFINITIONS[name as SearchFilterName];
    return def?.label ?? name;
  }

  function statusColor(s: string) {
    if (s === "success") return "text-green-600 dark:text-green-400";
    if (s === "error") return "text-red-600 dark:text-red-400";
    if (s === "running" || s === "queued") return "text-blue-600 dark:text-blue-400";
    if (s === "draft") return "text-amber-600 dark:text-amber-400";
    return "text-[var(--dash-text-muted)]";
  }

  function levelColor(level: string) {
    if (level === "error") return "text-red-600 dark:text-red-400";
    if (level === "warn") return "text-amber-600 dark:text-amber-400";
    if (level === "debug") return "text-[var(--dash-text-muted)]";
    return "text-[var(--dash-text)]";
  }
</script>

<div class="max-w-5xl mx-auto p-6 space-y-6">
  <header class="space-y-1">
    <a
      href="/admin/job-platforms/discover"
      class="text-xs text-[var(--dash-text-muted)] hover:text-[var(--dash-primary)]"
    >← All discovery runs</a>
    <div class="flex items-center justify-between gap-3">
      <div class="min-w-0">
        <h1 class="text-xl font-semibold text-[var(--dash-text)] truncate">
          {data.platform?.name ?? "(deleted platform)"}
        </h1>
        <p class="text-xs text-[var(--dash-text-muted)] font-mono truncate">
          {run.target_url}
        </p>
        <div class="flex items-center gap-1.5 text-xs text-[var(--dash-text-muted)] mt-1">
          <span>Run</span>
          <span class="font-mono">#{run.id}</span>
          <button
            type="button"
            onclick={copyId}
            class="p-0.5 cursor-pointer hover:text-[var(--dash-primary)] transition-colors"
            aria-label="Copy run ID"
          >
            <FontAwesomeIcon
              icon={copied ? faCheck : faCopy}
              class="w-3 h-3 {copied ? 'text-green-600' : ''}"
            />
          </button>
          {#if copied}
            <span class="text-green-600">Copied!</span>
          {/if}
        </div>
      </div>
      <span class="text-sm font-medium {statusColor(run.status)}">{run.status}</span>
    </div>
    {#if run.error_message}
      <p class="text-xs text-red-600 dark:text-red-400">{run.error_message}</p>
    {/if}
  </header>

  <div class="flex flex-wrap gap-2 items-center">
    {#if run.live_url}
      <button
        type="button"
        onclick={() => (showBrowser = true)}
        class="px-3 py-1.5 text-xs border border-[var(--dash-border)] rounded hover:bg-[var(--dash-bg)]"
      >Open browser view</button>
    {/if}
    {#if !isTerminal(run.status) && run.status !== "cancelling" && run.status !== "draft"}
      <button
        type="button"
        onclick={cancelRun}
        disabled={cancelling}
        class="px-3 py-1.5 text-xs border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 rounded hover:bg-red-50 dark:hover:bg-red-950 disabled:opacity-50"
      >{cancelling ? "Cancelling…" : "Cancel run"}</button>
    {/if}
    {#if run.status === "cancelling"}
      <span class="text-xs text-amber-600 dark:text-amber-400">
        Cancellation requested — waiting for worker to abort…
      </span>
    {/if}
    {#if cancelError}
      <span class="text-xs text-red-600 dark:text-red-400">{cancelError}</span>
    {/if}
  </div>

  <!-- Credentials — always visible so admins can add/edit/delete from any
       run page. Selection drives the Start action for draft runs; for
       non-draft runs the highlight just reflects which credential was used. -->
  <section class="space-y-3">
    <h2 class="text-xs font-medium text-[var(--dash-text-muted)] uppercase tracking-wide">
      Credentials
    </h2>
    <div
      class="bg-[var(--dash-card)] rounded-lg border border-[var(--dash-border)] p-4"
    >
      {#if data.platform && data.profileId !== null}
        <CredentialSelector
          bind:credentials
          bind:selectedId={selectedCredentialId}
          bind:loginMode
          platformId={data.platform.id}
          profileId={data.profileId}
          platformName={data.platform.name}
          hideLoginMode={true}
        />
        {#if run.status !== "draft" && data.run.platform_profile_id != null}
          <p class="text-xs text-[var(--dash-text-muted)] mt-3">
            This run logged in with the highlighted credential. Switching the
            selection here doesn't change the past run — start a new
            discovery to use a different credential.
          </p>
        {/if}
      {:else}
        <p class="text-xs text-amber-600 dark:text-amber-400">
          Can't load credential picker — admin user has no profile yet.
        </p>
      {/if}
    </div>
  </section>

  {#if run.status === "draft"}
    <section class="space-y-3">
      <h2 class="text-xs font-medium text-[var(--dash-text-muted)] uppercase tracking-wide">
        Start run
      </h2>
      <div
        class="bg-[var(--dash-card)] rounded-lg border border-[var(--dash-border)] p-4 space-y-4"
      >
        <div>
          <label
            class="block text-xs font-medium text-[var(--dash-text-secondary)] mb-1"
            for="run-device"
          >Device <span class="font-normal text-[var(--dash-text-muted)]">(optional)</span></label>
          <select
            id="run-device"
            bind:value={selectedDeviceId}
            class="w-full px-2 py-1.5 text-sm border border-[var(--dash-border)] rounded bg-[var(--dash-bg)] text-[var(--dash-text)]"
          >
            <option value="">(default browser provider)</option>
            {#each data.devices as d (d.apiKeyId)}
              <option value={String(d.apiKeyId)}>{d.apiKeyName}</option>
            {/each}
          </select>
          <p class="text-xs text-[var(--dash-text-muted)] mt-1">
            Routes the session through your desktop tunnel instead of the
            hosted browser provider.
          </p>
        </div>

        {#if startError}
          <p class="text-xs text-red-600 dark:text-red-400">{startError}</p>
        {/if}

        <div class="flex justify-end">
          <button
            type="button"
            onclick={startRun}
            disabled={!selectedCredentialId || starting}
            class="px-4 py-2 text-sm bg-[var(--dash-primary)] text-white rounded hover:bg-[var(--dash-primary-hover)] disabled:opacity-60"
          >{starting ? "Starting…" : "Start discovery"}</button>
        </div>
      </div>
    </section>
  {/if}

  {#if run.status !== "draft"}
    <section class="space-y-2">
      <h2 class="text-xs font-medium text-[var(--dash-text-muted)] uppercase tracking-wide">
        Logs
      </h2>
      <div class="bg-black/90 text-xs text-white rounded border border-[var(--dash-border)] p-3 font-mono max-h-[40vh] overflow-y-auto">
        {#each logs as line (line.id)}
          <div class="flex gap-2">
            <span class="text-[var(--dash-text-muted)] shrink-0">
              {new Date(line.timestamp).toLocaleTimeString()}
            </span>
            <span class="shrink-0 uppercase {levelColor(line.level)}">{line.level}</span>
            <span class="text-white">{line.message}</span>
          </div>
        {:else}
          <p class="text-[var(--dash-text-muted)]">No logs yet.</p>
        {/each}
      </div>
    </section>
  {/if}

  {#if run.status === "success"}
    <section class="space-y-3">
      <h2 class="text-xs font-medium text-[var(--dash-text-muted)] uppercase tracking-wide">
        Apply to {data.platform?.name ?? "platform"}
      </h2>
      <div class="bg-[var(--dash-card)] rounded-lg border border-[var(--dash-border)] p-4 space-y-3">
        <div>
          <label class="block text-xs font-medium text-[var(--dash-text-secondary)] mb-1" for="ftpl">
            Search URL template (Generic search preset)
          </label>
          <textarea
            id="ftpl"
            bind:value={draftTemplate}
            rows={3}
            placeholder={"https://…?keywords={KEYWORDS}"}
            class="w-full px-2 py-1.5 text-sm border border-[var(--dash-border)] rounded bg-[var(--dash-bg)] text-[var(--dash-text)] font-mono break-all resize-y"
          ></textarea>
        </div>
        <div>
          <label class="block text-xs font-medium text-[var(--dash-text-secondary)] mb-1" for="fhint">
            Applicable hint <span class="font-normal text-[var(--dash-text-muted)]">(optional)</span>
          </label>
          <input
            id="fhint"
            type="text"
            bind:value={draftHint}
            class="w-full px-2 py-1.5 text-sm border border-[var(--dash-border)] rounded bg-[var(--dash-bg)] text-[var(--dash-text)]"
          />
        </div>

        {#if run.findings?.params && Object.keys(run.findings.params).length > 0}
          <div class="space-y-2">
            <p class="text-xs font-medium text-[var(--dash-text-secondary)]">
              Discovered filter parameters
            </p>
            <div class="space-y-2">
              {#each Object.entries(run.findings.params) as [filterName, cfg] (filterName)}
                <div class="border border-[var(--dash-border)] rounded p-2 text-xs space-y-1">
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      bind:checked={keepParams[filterName]}
                    />
                    <span class="font-medium text-[var(--dash-text)]">
                      {filterDisplayName(filterName)}
                    </span>
                    <code class="text-[var(--dash-text-muted)]">{filterName}</code>
                  </label>
                  <ul class="list-disc pl-6 space-y-0.5 text-[var(--dash-text-secondary)]">
                    {#each Object.entries(cfg.options) as [valueKey, fragment] (valueKey)}
                      <li>
                        <span class="text-[var(--dash-text)]">{filterOptionLabel(filterName, valueKey)}</span>
                        <code class="text-[var(--dash-text-muted)] ml-1">→ {fragment}</code>
                      </li>
                    {/each}
                  </ul>
                </div>
              {/each}
            </div>
            <p class="text-xs text-[var(--dash-text-muted)]">
              Uncheck a filter to omit it from the preset on apply.
            </p>
          </div>
        {/if}
        {#if (run.findings?.notes?.length ?? 0) > 0}
          <details class="text-xs">
            <summary class="cursor-pointer text-[var(--dash-text-muted)]">LLM notes ({run.findings!.notes!.length})</summary>
            <ul class="list-disc pl-5 mt-1 space-y-0.5 text-[var(--dash-text-secondary)]">
              {#each run.findings!.notes! as note (note)}
                <li>{note}</li>
              {/each}
            </ul>
          </details>
        {/if}
        {#if applyError}
          <p class="text-xs text-red-600 dark:text-red-400">{applyError}</p>
        {/if}
        {#if applyResult}
          <p class="text-xs text-green-600 dark:text-green-400">
            Applied to platform #{applyResult.platform_id}
            {#if applyResult.preset_id}
              — preset #{applyResult.preset_id} written
            {/if}
            ·
            <a href={`/admin/job-platforms/${applyResult.platform_id}`} class="underline">
              Open platform
            </a>
          </p>
        {:else if !run.applied_at}
          <div class="flex justify-end">
            <button
              type="button"
              onclick={applyFindings}
              disabled={applying}
              class="px-4 py-2 text-sm bg-[var(--dash-primary)] text-white rounded hover:bg-[var(--dash-primary-hover)] disabled:opacity-50"
            >{applying ? "Applying…" : "Apply"}</button>
          </div>
        {:else}
          <p class="text-xs text-[var(--dash-text-muted)]">
            Already applied {new Date(run.applied_at).toLocaleString()}.
          </p>
        {/if}
      </div>
    </section>
  {/if}
</div>

{#if showBrowser && run.live_url}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center p-4"
    onclick={() => (showBrowser = false)}
    role="presentation"
  >
    <div class="absolute inset-0 bg-black/60"></div>
    <div
      class="relative bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-lg w-full max-w-5xl h-[80vh] flex flex-col"
      onclick={(e) => e.stopPropagation()}
      role="presentation"
    >
      <div class="flex items-center justify-between px-4 py-2 border-b border-[var(--dash-border)]">
        <span class="text-sm font-medium text-[var(--dash-text)]">Browser view</span>
        <button
          type="button"
          onclick={() => (showBrowser = false)}
          class="text-[var(--dash-text-muted)] hover:text-[var(--dash-text)]"
        >Close</button>
      </div>
      <iframe
        src={run.live_url}
        title="Browser view"
        class="flex-1 w-full"
      ></iframe>
    </div>
  </div>
{/if}
