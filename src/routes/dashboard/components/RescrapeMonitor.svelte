<script lang="ts">
  import { onMount } from "svelte";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faCheck,
    faChevronDown,
    faChevronRight,
    faExternalLinkAlt,
    faGlobe,
    faKey,
    faPlay,
    faSpinner,
    faTimes,
    faTimesCircle,
    faCheckCircle,
  } from "@fortawesome/free-solid-svg-icons";
  import BrowserView from "./BrowserView.svelte";
  import LogViewer from "./LogViewer.svelte";
  import CountrySelect from "../jobs/components/CountrySelect.svelte";

  interface Props {
    jobId: number;
    sourceUrl: string | null;
    platformName: string | null;
    credentials: { username: string | null }[];
    defaultCountryCode: string;
    browserFingerprint: { language: string; timezone: string; userAgent: string };
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
    credentials,
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

  // If resuming an active rescrape, skip config and go straight to polling
  const resuming = initialStatus === "queued" || initialStatus === "scraping";

  // Config state
  let countryCode = $state("");
  let browserLanguage = $state(browserFingerprint.language);
  let browserTimezone = $state(browserFingerprint.timezone);
  let browserUserAgent = $state(browserFingerprint.userAgent);
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
      const body: Record<string, string> = {};
      if (countryCode) body.countryCode = countryCode;
      if (browserLanguage) body.browserLanguage = browserLanguage;
      if (browserTimezone) body.browserTimezone = browserTimezone;
      if (browserUserAgent) body.browserUserAgent = browserUserAgent;

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
      message = err instanceof Error ? err.message : "Failed to start rescrape";
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
      if (result.message && !result.message.startsWith("✓") && !result.message.includes("Extracted data:")) {
        addLogEntry(result.message);
      }

      if (!["queued", "scraping"].includes(result.status)) {
        stopPolling();

        if (result.status === "completed") {
          addLogEntry("Rescrape completed successfully");
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
        }
      }
    } catch {
      // Ignore polling errors
    }
  }

  onMount(() => {
    if (resuming) {
      // Immediately poll once to get current status, then start interval
      pollStatus();
      startPolling();
    }
    return () => stopPolling();
  });
</script>

<!-- Modal backdrop -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
  onkeydown={(e) => { if (e.key === "Escape") onclose(); }}
>
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div
    class="bg-[var(--dash-bg)] rounded-xl border border-[var(--dash-border)] shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto"
    onclick={(e) => e.stopPropagation()}
  >
    <!-- Header -->
    <div class="flex items-center justify-between p-4 border-b border-[var(--dash-border)]">
      <div class="flex items-center gap-3">
        <h2 class="text-lg font-semibold text-[var(--dash-text)]">Rescrape Job #{jobId}</h2>
        {#if isActive}
          <FontAwesomeIcon icon={faSpinner} class="w-4 h-4 text-[var(--dash-primary)] animate-spin" />
        {:else if isComplete}
          <FontAwesomeIcon icon={faCheckCircle} class="w-4 h-4 text-[var(--dash-success)]" />
        {:else if isError}
          <FontAwesomeIcon icon={faTimesCircle} class="w-4 h-4 text-[var(--dash-error)]" />
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
              <label class="block text-xs font-medium text-[var(--dash-text-secondary)] mb-1">Source URL</label>
              <a
                href={sourceUrl}
                target="_blank"
                rel="noopener"
                class="text-sm text-[var(--dash-primary)] hover:underline break-all flex items-center gap-1"
              >
                {sourceUrl}
                <FontAwesomeIcon icon={faExternalLinkAlt} class="w-3 h-3 flex-shrink-0" />
              </a>
            </div>
          {/if}

          <!-- Platform & Credentials -->
          <div>
            <label class="block text-xs font-medium text-[var(--dash-text-secondary)] mb-1">
              <FontAwesomeIcon icon={faKey} class="w-3 h-3" />
              Platform Credentials
            </label>
            {#if credentials.length > 0}
              <div class="text-sm text-[var(--dash-text)]">
                {#each credentials as cred}
                  <span class="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-[var(--dash-bg)] border border-[var(--dash-border)]">
                    {#if platformName}
                      <span class="text-[var(--dash-text-muted)]">{platformName}:</span>
                    {/if}
                    {cred.username || "No username"}
                  </span>
                {/each}
              </div>
            {:else}
              <p class="text-sm text-[var(--dash-text-muted)]">
                No credentials configured{platformName ? ` for ${platformName}` : ""}. You may need to log in manually.
              </p>
            {/if}
          </div>

          <!-- Country Select -->
          <div>
            <div class="flex items-center gap-1.5 mb-1">
              <FontAwesomeIcon icon={faGlobe} class="w-3 h-3 text-[var(--dash-text-secondary)]" />
              <label class="text-xs font-medium text-[var(--dash-text-secondary)]">Browser Location</label>
            </div>
            <div class="max-w-xs">
              <CountrySelect bind:value={countryCode} fallback={defaultCountryCode} disabled={started} />
            </div>
            {#if !started}
              <p class="text-xs text-[var(--dash-text-muted)] mt-1">
                The country the browser will appear to browse from. If empty, your profile's country is used.
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
                <label for="rescrape_language" class="block text-xs font-medium text-[var(--dash-text-secondary)] mb-1">
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
                    Defaults to <span class="font-mono">{browserFingerprintDefaults.language}</span> based on country
                  </p>
                {/if}
              </div>

              <div>
                <label for="rescrape_timezone" class="block text-xs font-medium text-[var(--dash-text-secondary)] mb-1">
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
                    Defaults to <span class="font-mono">{browserFingerprintDefaults.timezone}</span> based on country
                  </p>
                {/if}
              </div>

              <div>
                <label for="rescrape_user_agent" class="block text-xs font-medium text-[var(--dash-text-secondary)] mb-1">
                  User Agent
                </label>
                <input
                  type="text"
                  id="rescrape_user_agent"
                  bind:value={browserUserAgent}
                  placeholder="Auto-detected or random"
                  disabled={started}
                  class="w-full px-2.5 py-1.5 text-xs font-mono border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent disabled:opacity-50"
                />
                {#if !browserUserAgent}
                  <p class="text-xs text-[var(--dash-text-muted)] mt-0.5">
                    Auto-detected from your browser, or GoLogin generates a random one
                  </p>
                {/if}
              </div>
            </div>
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
                {status === "queued" ? "Waiting in queue..." : message || "Processing..."}
              </span>
            {:else if isComplete}
              <span class="text-[var(--dash-success)]">Completed</span>
            {:else if isError}
              <span class="text-[var(--dash-error)]">{message || "Failed"}</span>
            {/if}
          </div>

          <!-- Browser View -->
          {#if isActive || liveUrl}
            <BrowserView
              {liveUrl}
              statusMessage={isActive ? "Watch the rescrape progress. You may need to intervene if a CAPTCHA or login is required." : ""}
            />
          {/if}

          <!-- Logs -->
          <LogViewer {logs} loading={isActive} maxHeight="max-h-48" />

          <!-- Completed extraction summary -->
          {#if isComplete && message && message.includes("Extracted data:")}
            <div class="p-3 bg-[var(--dash-success-light)] border border-[var(--dash-success)] rounded-lg">
              <p class="text-sm text-[var(--dash-success)] whitespace-pre-line">{message}</p>
            </div>
          {/if}
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
          class="px-4 py-2 rounded-lg text-sm {isActive
            ? 'border border-[var(--dash-border)] text-[var(--dash-text)] hover:bg-[var(--dash-bg)]'
            : 'bg-[var(--dash-primary)] text-white hover:bg-[var(--dash-primary-hover)]'} transition-colors"
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
