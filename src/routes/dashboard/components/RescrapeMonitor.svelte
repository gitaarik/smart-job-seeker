<script lang="ts">
  import { onMount } from "svelte";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faCheck,
    faCheckCircle,
    faChevronDown,
    faChevronRight,
    faClock,
    faExternalLinkAlt,
    faGlobe,
    faHistory,
    faLink,
    faPlay,
    faSpinner,
    faTimes,
    faTimesCircle,
  } from "@fortawesome/free-solid-svg-icons";
  import BrowserView from "./BrowserView.svelte";
  import LogViewer from "./LogViewer.svelte";
  import CountrySelect from "../jobs/components/CountrySelect.svelte";
  import CredentialSelector from "../jobs/components/CredentialSelector.svelte";
  import BrowserProviderToggle from "../jobs/components/BrowserProviderToggle.svelte";

  interface Props {
    jobId: number;
    sourceUrl: string | null;
    platformName: string | null;
    platformCredentials: { id: number; username: string | null }[];
    platformId: number;
    profileId: number;
    selectedCredentialId: string;
    loginUrl: string | null;
    defaultBrowserProvider: string | null;
    defaultKeepMinimized: boolean;
    defaultCountryCode: string;
    browserFingerprint: {
      language: string;
      timezone: string;
    };
    browserFingerprintDefaults: { language: string; timezone: string };
    /** If the job already has an active rescrape, pass "queued" or "scraping" to resume monitoring */
    initialStatus?: string;
    onclose: () => void;
    oncomplete?: () => void;
  }

  let {
    jobId,
    sourceUrl,
    platformName,
    platformCredentials,
    platformId,
    profileId,
    selectedCredentialId: initialCredentialId,
    loginUrl,
    defaultBrowserProvider,
    defaultKeepMinimized,
    defaultCountryCode,
    browserFingerprint,
    browserFingerprintDefaults,
    initialStatus,
    onclose,
    oncomplete,
  }: Props = $props();

  interface LogEntry {
    id: number | string;
    level: string;
    message: string;
    timestamp: string;
  }

  interface RescrapeRun {
    id: number;
    status: string;
    started_at: string;
    finished_at: string | null;
    message: string | null;
  }

  // If resuming an active rescrape, skip config and go straight to polling
  const resuming = initialStatus === "queued" ||
    initialStatus === "scraping";

  // Config state
  let credentials = $state(platformCredentials);
  let credentialId = $state(initialCredentialId);
  let browserProvider = $state<string | null>(defaultBrowserProvider);
  let keepMinimized = $state(defaultKeepMinimized);
  let countryCode = $state("");
  let browserLanguage = $state(browserFingerprint.language);
  let browserTimezone = $state(browserFingerprint.timezone);
  let showAdvanced = $state(false);
  let started = $state(resuming);

  // Scraping state
  let status = $state<string>(resuming ? initialStatus! : "idle");
  let message = $state<string>(resuming ? "Resuming..." : "");
  let liveUrl = $state<string | null>(null);
  let logs = $state<LogEntry[]>([]);
  let pollInterval: ReturnType<typeof setInterval> | null = null;
  let lastMessage = "";
  let logIdCounter = 0;
  let isActive = $derived(status === "queued" || status === "scraping");
  let isComplete = $derived(status === "completed");
  let isError = $derived(status === "error");

  // Run history
  let history = $state<RescrapeRun[]>([]);
  let historyLoaded = $state(false);

  function addLogEntry(msg: string) {
    if (msg === lastMessage || !msg) return;
    lastMessage = msg;
    logs = [
      ...logs,
      {
        id: ++logIdCounter,
        level: "info",
        message: msg,
        timestamp: new Date().toISOString(),
      },
    ];
  }

  async function triggerRescrape() {
    started = true;
    status = "queued";
    message = "Waiting in queue...";

    try {
      const body: Record<string, unknown> = {};
      if (countryCode) body.countryCode = countryCode;
      if (browserLanguage) body.browserLanguage = browserLanguage;
      if (browserTimezone) body.browserTimezone = browserTimezone;
      if (credentialId !== "none") {
        body.credentialId = parseInt(credentialId);
      }
      if (browserProvider !== null) body.browserProvider = browserProvider;
      if (browserProvider === "local") body.keepMinimized = keepMinimized;

      const hasBody = Object.keys(body).length > 0;
      const response = await fetch(`/api/jobs/${jobId}/rescrape`, {
        method: "POST",
        headers: hasBody ? { "Content-Type": "application/json" } : {},
        body: hasBody ? JSON.stringify(body) : undefined,
      });
      const result = await response.json();

      if (!response.ok) {
        status = "error";
        message = result.error || "Failed to start rescrape";
        addLogEntry(`Error: ${message}`);
        return;
      }

      if (result.status === "already_queued") {
        addLogEntry("Already queued for rescrape");
      } else {
        addLogEntry("Queued for rescrape");
      }

      startPolling();
    } catch (err) {
      status = "error";
      message = err instanceof Error
        ? err.message
        : "Failed to start rescrape";
      addLogEntry(`Error: ${message}`);
    }
  }

  function startPolling() {
    if (pollInterval) return;
    pollInterval = setInterval(pollStatus, 1500);
  }

  function stopPolling() {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
  }

  async function pollStatus() {
    try {
      const response = await fetch(`/api/jobs/${jobId}/rescrape`);
      if (!response.ok) return;

      const result = await response.json();
      status = result.status;
      message = result.message || "";
      liveUrl = result.liveUrl || null;

      // Add progress messages as log entries
      if (
        result.message && !result.message.startsWith("✓") &&
        !result.message.includes("Extracted data:")
      ) {
        addLogEntry(result.message);
      }

      if (!["queued", "scraping"].includes(result.status)) {
        stopPolling();

        if (result.status === "completed") {
          addLogEntry("Rescrape completed successfully");
          // Reload history
          loadHistory();
          if (oncomplete) {
            setTimeout(oncomplete, 1500);
          }
        } else if (result.status === "error") {
          logs = [
            ...logs,
            {
              id: ++logIdCounter,
              level: "error",
              message: result.message || "Rescrape failed",
              timestamp: new Date().toISOString(),
            },
          ];
          loadHistory();
        }
      }
    } catch {
      // Ignore polling errors
    }
  }

  async function loadHistory() {
    try {
      const response = await fetch(`/api/jobs/${jobId}/rescrape`);
      if (!response.ok) return;
      const result = await response.json();
      if (result.history) {
        history = result.history;
      }
      historyLoaded = true;
    } catch {
      // Ignore
    }
  }

  function formatRunDate(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function statusColor(s: string): string {
    switch (s) {
      case "completed":
        return "text-[var(--dash-success)]";
      case "error":
        return "text-[var(--dash-error)]";
      case "scraping":
        return "text-[var(--dash-primary)]";
      case "queued":
        return "text-[var(--dash-text-muted)]";
      default:
        return "text-[var(--dash-text-secondary)]";
    }
  }

  onMount(() => {
    if (resuming) {
      pollStatus();
      startPolling();
    }
    loadHistory();
    return () => stopPolling();
  });
</script>

<!-- Modal backdrop -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
  onkeydown={(e) => {
    if (e.key === "Escape") onclose();
  }}
>
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div
    class="bg-[var(--dash-bg)] rounded-xl border border-[var(--dash-border)] shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto"
    onclick={(e) => e.stopPropagation()}
  >
    <!-- Header -->
    <div
      class="flex items-center justify-between p-4 border-b border-[var(--dash-border)]"
    >
      <div class="flex items-center gap-3">
        <h2 class="text-lg font-semibold text-[var(--dash-text)]">
          Rescrape Job #{jobId}
        </h2>
        {#if isActive}
          <FontAwesomeIcon
            icon={faSpinner}
            class="w-4 h-4 text-[var(--dash-primary)] animate-spin"
          />
        {:else if isComplete}
          <FontAwesomeIcon
            icon={faCheckCircle}
            class="w-4 h-4 text-[var(--dash-success)]"
          />
        {:else if isError}
          <FontAwesomeIcon
            icon={faTimesCircle}
            class="w-4 h-4 text-[var(--dash-error)]"
          />
        {/if}
      </div>
      <button
        onclick={onclose}
        class="p-1 text-[var(--dash-text-secondary)] hover:text-[var(--dash-text)] transition-colors"
      >
        <FontAwesomeIcon icon={faTimes} class="w-5 h-5" />
      </button>
    </div>

    <!-- Content -->
    <div class="p-4 space-y-4">
      {#if !resuming}
        <!-- Config section — visible when not resuming an existing rescrape -->
        <div class="space-y-3">
          <!-- Source URL -->
          {#if sourceUrl}
            <div>
              <label
                class="block text-xs font-medium text-[var(--dash-text-secondary)] mb-1"
              >Source URL</label>
              <a
                href={sourceUrl}
                target="_blank"
                rel="noopener"
                class="text-sm text-[var(--dash-primary)] hover:underline break-all flex items-center gap-1"
              >
                {sourceUrl}
                <FontAwesomeIcon
                  icon={faExternalLinkAlt}
                  class="w-3 h-3 flex-shrink-0"
                />
              </a>
            </div>
          {/if}

          <!-- Login URL -->
          <div>
            <label
              class="block text-xs font-medium text-[var(--dash-text-secondary)] mb-1"
            >
              <FontAwesomeIcon icon={faLink} class="w-3 h-3" />
              Login URL
            </label>
            {#if loginUrl}
              <a
                href={loginUrl}
                target="_blank"
                rel="noopener"
                class="text-sm text-[var(--dash-primary)] hover:underline break-all flex items-center gap-1"
              >
                {loginUrl}
                <FontAwesomeIcon
                  icon={faExternalLinkAlt}
                  class="w-3 h-3 flex-shrink-0"
                />
              </a>
            {:else}
              <p class="text-sm text-[var(--dash-text-muted)]">
                Not configured
              </p>
            {/if}
          </div>

          <!-- Credentials -->
          <CredentialSelector
            bind:credentials
            bind:selectedId={credentialId}
            {platformId}
            {profileId}
            {platformName}
            disabled={started}
          />

          <!-- Browser Provider -->
          <div>
            <label
              class="block text-xs font-medium text-[var(--dash-text-secondary)] mb-2"
            >Browser Provider</label>
            <BrowserProviderToggle
              bind:value={browserProvider}
              disabled={started}
            />
          </div>

          <!-- Browser Location (hosted mode only) -->
          {#if browserProvider === "hosted"}
            <div>
              <div class="flex items-center gap-1.5 mb-1">
                <FontAwesomeIcon
                  icon={faGlobe}
                  class="w-3 h-3 text-[var(--dash-text-secondary)]"
                />
                <label
                  class="text-xs font-medium text-[var(--dash-text-secondary)]"
                >Browser Location</label>
              </div>
              <div class="max-w-xs">
                <CountrySelect
                  bind:value={countryCode}
                  fallback={defaultCountryCode}
                  disabled={started}
                />
              </div>
              {#if !started}
                <p class="text-xs text-[var(--dash-text-muted)] mt-1">
                  The country the browser will appear to browse from. If empty,
                  your profile's country is used.
                </p>
              {/if}
            </div>

            <!-- Advanced: browser fingerprint toggle -->
            <button
              type="button"
              onclick={() => (showAdvanced = !showAdvanced)}
              class="flex items-center gap-1.5 text-xs text-[var(--dash-text-muted)] hover:text-[var(--dash-text-secondary)] transition-colors"
            >
              <FontAwesomeIcon
                icon={showAdvanced ? faChevronDown : faChevronRight}
                class="w-2.5 h-2.5"
              />
              Advanced
            </button>

            {#if showAdvanced}
              <div class="pt-2 border-t border-[var(--dash-border)] space-y-3">
                <div>
                  <label
                    for="rescrape_language"
                    class="block text-xs font-medium text-[var(--dash-text-secondary)] mb-1"
                  >
                    Language
                  </label>
                  <input
                    type="text"
                    id="rescrape_language"
                    bind:value={browserLanguage}
                    placeholder={browserFingerprintDefaults.language}
                    disabled={started}
                    class="w-full px-2.5 py-1.5 text-sm border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent disabled:opacity-50"
                  />
                  {#if !browserLanguage}
                    <p class="text-xs text-[var(--dash-text-muted)] mt-0.5">
                      Defaults to <span class="font-mono">{
                        browserFingerprintDefaults.language
                      }</span> based on country
                    </p>
                  {/if}
                </div>

                <div>
                  <label
                    for="rescrape_timezone"
                    class="block text-xs font-medium text-[var(--dash-text-secondary)] mb-1"
                  >
                    Timezone
                  </label>
                  <input
                    type="text"
                    id="rescrape_timezone"
                    bind:value={browserTimezone}
                    placeholder={browserFingerprintDefaults.timezone}
                    disabled={started}
                    class="w-full px-2.5 py-1.5 text-sm border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent disabled:opacity-50"
                  />
                  {#if !browserTimezone}
                    <p class="text-xs text-[var(--dash-text-muted)] mt-0.5">
                      Defaults to <span class="font-mono">{
                        browserFingerprintDefaults.timezone
                      }</span> based on country
                    </p>
                  {/if}
                </div>

              </div>
            {/if}
          {/if}

          <!-- Keep Minimized (desktop/local mode only) -->
          {#if browserProvider === "local"}
            <label
              class="flex items-center gap-2 text-sm text-[var(--dash-text)]"
            >
              <input
                type="checkbox"
                bind:checked={keepMinimized}
                disabled={started}
                class="rounded border-[var(--dash-border)] text-[var(--dash-primary)] focus:ring-[var(--dash-primary)]"
              />
              Keep browser minimized
            </label>
          {/if}
        </div>
      {/if}

      {#if started}
        <!-- Scraping progress -->
        <div class="pt-4 border-t border-[var(--dash-border)] space-y-4">
          <!-- Status -->
          <div class="flex items-center gap-2 text-sm">
            {#if isActive}
              <span class="text-[var(--dash-primary)]">
                {
                  status === "queued"
                    ? "Waiting in queue..."
                    : message || "Processing..."
                }
              </span>
            {:else if isComplete}
              <span class="text-[var(--dash-success)]">Completed</span>
            {:else if isError}
              <span class="text-[var(--dash-error)]">{
                message || "Failed"
              }</span>
            {/if}
          </div>

          <!-- Browser View -->
          {#if isActive || liveUrl}
            <BrowserView
              {liveUrl}
              statusMessage={isActive
                ? "Watch the rescrape progress. You may need to intervene if a CAPTCHA or login is required."
                : ""}
            />
          {/if}

          <!-- Logs -->
          <LogViewer {logs} loading={isActive} maxHeight="max-h-48" />

          <!-- Completed extraction summary -->
          {#if           isComplete && message &&
            message.includes("Extracted data:")}
            <div
              class="p-3 bg-[var(--dash-success-light)] border border-[var(--dash-success)] rounded-lg"
            >
              <p class="text-sm text-[var(--dash-success)] whitespace-pre-line">
                {message}
              </p>
            </div>
          {/if}
        </div>
      {/if}

      <!-- Run History -->
      {#if historyLoaded && history.length > 0}
        <div class="pt-4 border-t border-[var(--dash-border)]">
          <div class="flex items-center gap-2 mb-2">
            <FontAwesomeIcon
              icon={faHistory}
              class="w-3.5 h-3.5 text-[var(--dash-text-secondary)]"
            />
            <h3 class="text-sm font-medium text-[var(--dash-text-secondary)]">
              Run History
            </h3>
          </div>
          <div class="space-y-1.5">
            {#each history as run}
              <div
                class="flex items-center gap-3 px-3 py-1.5 text-xs bg-[var(--dash-bg)] rounded-md"
              >
                <span
                  class="text-[var(--dash-text-muted)] flex items-center gap-1"
                >
                  <FontAwesomeIcon icon={faClock} class="w-3 h-3" />
                  {formatRunDate(run.started_at)}
                </span>
                <span class="font-medium {statusColor(run.status)}">{
                  run.status
                }</span>
                {#if run.message}
                  <span
                    class="text-[var(--dash-text-muted)] truncate flex-1"
                    title={run.message}
                  >
                    {
                      run.message.length > 80
                        ? run.message.slice(0, 80) + "..."
                        : run.message
                    }
                  </span>
                {/if}
              </div>
            {/each}
          </div>
        </div>
      {/if}
    </div>

    <!-- Footer -->
    <div class="flex justify-end p-4 border-t border-[var(--dash-border)]">
      {#if !started}
        <div class="flex gap-2">
          <button
            onclick={onclose}
            class="px-4 py-2 rounded-lg text-sm border border-[var(--dash-border)] text-[var(--dash-text)] hover:bg-[var(--dash-bg)] transition-colors"
          >
            Cancel
          </button>
          <button
            onclick={triggerRescrape}
            class="px-4 py-2 rounded-lg text-sm bg-[var(--dash-primary)] text-white hover:bg-[var(--dash-primary-hover)] transition-colors flex items-center gap-2"
          >
            <FontAwesomeIcon icon={faPlay} class="w-3 h-3" />
            Start Rescrape
          </button>
        </div>
      {:else}
        <button
          onclick={onclose}
          class="
            px-4 py-2 rounded-lg text-sm {isActive
            ? 'border border-[var(--dash-border)] text-[var(--dash-text)] hover:bg-[var(--dash-bg)]'
            : 'bg-[var(--dash-primary)] text-white hover:bg-[var(--dash-primary-hover)]'} transition-colors
          "
        >
          {#if isActive}
            Close
          {:else if isComplete}
            <span class="flex items-center gap-2">
              <FontAwesomeIcon icon={faCheck} class="w-3 h-3" />
              Done
            </span>
          {:else}
            Close
          {/if}
        </button>
      {/if}
    </div>
  </div>
</div>
