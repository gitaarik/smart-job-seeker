<script lang="ts">
  import type { PageData } from "./$types";
  import { onDestroy, onMount } from "svelte";
  import { invalidateAll, goto } from "$app/navigation";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import CountrySelect from "../../components/CountrySelect.svelte";
  import { formatJobType, formatWorkLocation } from "$lib/format";
  import {
    faArrowLeft,
    faBuilding,
    faCheck,
    faChevronDown,
    faChevronRight,
    faCloud,
    faCog,
    faDesktop,
    faExclamationTriangle,
    faExternalLinkAlt,
    faEye,
    faEyeSlash,
    faForward,
    faGlobe,
    faHistory,
    faKey,
    faMapMarkerAlt,
    faMoneyBillWave,
    faPencil,
    faPlay,
    faPlus,
    faSpinner,
    faStop,
    faTimes,
    faTrash,
  } from "@fortawesome/free-solid-svg-icons";

  let { data }: { data: PageData } = $props();

  let jobSearch = $state(data.jobSearch);
  let maxJobsEnabled = $state<boolean>((jobSearch as any).max_jobs != null);
  let maxJobsInput = $state<string>(
    (jobSearch as any).max_jobs?.toString() ?? "",
  );
  let isSavingMaxJobs = $state(false);

  function parseMaxJobs(val: unknown): number | null {
    if (val === undefined || val === null || val === "") return null;
    const n = typeof val === "number" ? val : parseInt(String(val));
    return isNaN(n) || n < 1 ? null : n;
  }
  let maxJobsDirty = $derived(
    (maxJobsEnabled ? parseMaxJobs(maxJobsInput) : null) !==
      ((jobSearch as any).max_jobs ?? null),
  );

  let skipExisting = $state<boolean>(
    (jobSearch as any).skip_existing ?? false,
  );
  let isSavingSkipExisting = $state(false);
  let skipExistingDirty = $derived(
    skipExisting !== ((jobSearch as any).skip_existing ?? false),
  );

  let stopAfterDuplicatesEnabled = $state<boolean>(
    (jobSearch as any).stop_after_duplicates != null,
  );
  let stopAfterDuplicatesInput = $state<string>(
    (jobSearch as any).stop_after_duplicates?.toString() ?? "",
  );
  let isSavingStopAfterDuplicates = $state(false);

  function parseStopAfterDuplicates(val: unknown): number | null {
    if (val === undefined || val === null || val === "") return null;
    const n = typeof val === "number" ? val : parseInt(String(val));
    return isNaN(n) || n < 1 ? null : n;
  }
  let stopAfterDuplicatesDirty = $derived(
    (stopAfterDuplicatesEnabled
      ? parseStopAfterDuplicates(stopAfterDuplicatesInput)
      : null) !== ((jobSearch as any).stop_after_duplicates ?? null),
  );

  let skipFirstEnabled = $state<boolean>(
    (jobSearch as any).skip_first != null,
  );
  let skipFirstInput = $state<string>(
    (jobSearch as any).skip_first?.toString() ?? "",
  );
  let isSavingSkipFirst = $state(false);

  function parseSkipFirst(val: unknown): number | null {
    if (val === undefined || val === null || val === "") return null;
    const n = typeof val === "number" ? val : parseInt(String(val));
    return isNaN(n) || n < 1 ? null : n;
  }
  let skipFirstDirty = $derived(
    (skipFirstEnabled ? parseSkipFirst(skipFirstInput) : null) !==
      ((jobSearch as any).skip_first ?? null),
  );

  // Credentials state
  let platformCredentials = $state(data.platformCredentials);
  const initialCredentialId =
    (jobSearch as any).platform_profile_id?.toString() ?? "none";
  let savedCredentialId = $state<string>(initialCredentialId);
  let selectedCredentialId = $state<string>(initialCredentialId);
  let credentialDirty = $derived(
    selectedCredentialId !== savedCredentialId,
  );
  let isSavingCredential = $state(false);
  let showAddCredential = $state(false);
  let newCredUsername = $state("");
  let newCredPassword = $state("");
  let showPassword = $state(false);

  // Header editing state (name + platform name)
  let isEditingHeader = $state(false);
  let editNameInput = $state(jobSearch.name ?? "");
  let isSavingHeader = $state(false);

  async function saveHeader() {
    isSavingHeader = true;
    try {
      const newName = editNameInput.trim();

      if (newName && newName !== (jobSearch.name ?? "")) {
        await fetch(`/api/job-searches/${jobSearch.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: newName }),
        });
        jobSearch.name = newName;
      }

      isEditingHeader = false;
    } catch (err) {
      console.error("Failed to save header:", err);
    } finally {
      isSavingHeader = false;
    }
  }

  function cancelEditHeader() {
    editNameInput = jobSearch.name ?? "";
    isEditingHeader = false;
  }

  // Collapsible section state (persisted in profile ui_preferences)
  function loadSectionOpen(section: string, defaultOpen = true): boolean {
    const key = `task_sections_${section}`;
    const val = (data.uiPreferences as Record<string, unknown>)[key];
    return val === undefined ? defaultOpen : Boolean(val);
  }

  function toggleSection(section: string) {
    const isOpen = sectionOpen[section];
    sectionOpen[section] = !isOpen;
    // Persist to job search
    const key = `task_sections_${section}`;
    fetch(`/api/job-searches/${data.jobSearch.id}/ui-preferences`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: !isOpen }),
    }).catch(() => {});
  }

  let sectionOpen = $state<Record<string, boolean>>({
    search: loadSectionOpen("search"),
    auth: loadSectionOpen("auth"),
    options: loadSectionOpen("options"),
    settings: loadSectionOpen("settings", false),
  });

  // Delete task
  let isDeleting = $state(false);
  let showDeleteConfirm = $state(false);

  async function deleteTask() {
    isDeleting = true;
    try {
      const res = await fetch(`/api/job-searches/${jobSearch.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        goto("/dashboard/jobs/settings");
      }
    } finally {
      isDeleting = false;
    }
  }

  // URL editing state
  let canEditPlatformUrls = $state(data.canEditPlatformUrls);
  let searchUrlInput = $state<string>(jobSearch.search_url ?? "");
  let searchTermInput = $state<string>(jobSearch.search_term ?? "");
  let loginUrlInput = $state<string>(
    jobSearch.job_platforms?.login_page_url ?? "",
  );
  let isSavingSearchUrl = $state(false);
  let isSavingSearchTerm = $state(false);
  let isSavingLoginUrl = $state(false);
  let searchUrlDirty = $derived(
    searchUrlInput.trim() !== (jobSearch.search_url ?? ""),
  );
  let searchTermDirty = $derived(
    searchTermInput.trim() !== (jobSearch.search_term ?? ""),
  );
  let loginUrlDirty = $derived(
    loginUrlInput.trim() !==
      (jobSearch.job_platforms?.login_page_url ?? ""),
  );

  // Browser provider (hosted vs local) state
  let browserProvider = $state<string | null>(
    (jobSearch as any).browser_provider ?? null,
  );
  let savedBrowserProvider = $state<string | null>(
    (jobSearch as any).browser_provider ?? null,
  );
  let browserProviderDirty = $derived(
    browserProvider !== savedBrowserProvider,
  );
  let isSavingBrowserProvider = $state(false);

  // Keep minimized (for local/tunnel mode)
  let keepMinimized = $state<boolean>(
    (jobSearch as any).keep_minimized ?? true,
  );
  let savedKeepMinimized = $state<boolean>(
    (jobSearch as any).keep_minimized ?? true,
  );
  let keepMinimizedDirty = $derived(keepMinimized !== savedKeepMinimized);
  let isSavingKeepMinimized = $state(false);

  // Browser location state
  let browserCountryCode = $state(data.browserCountryCode || "");
  let savedBrowserCountryCode = $state(data.browserCountryCode || "");
  let browserCountryDirty = $derived(
    browserCountryCode !== savedBrowserCountryCode,
  );
  let isSavingBrowserCountry = $state(false);
  let defaultCountryCode = data.defaultCountryCode || "";

  // Browser fingerprint (advanced settings)
  let showAdvancedSearch = $state(false);
  let showAdvancedBrowser = $state(false);
  let browserLanguage = $state(data.browserFingerprint.language);
  let savedBrowserLanguage = $state(data.browserFingerprint.language);
  let browserTimezone = $state(data.browserFingerprint.timezone);
  let savedBrowserTimezone = $state(data.browserFingerprint.timezone);
  let browserUserAgent = $state(data.browserFingerprint.userAgent);
  let savedBrowserUserAgent = $state(data.browserFingerprint.userAgent);
  let browserFingerprintDirty = $derived(
    browserLanguage !== savedBrowserLanguage ||
      browserTimezone !== savedBrowserTimezone ||
      browserUserAgent !== savedBrowserUserAgent,
  );
  let isSavingBrowserFingerprint = $state(false);
  let defaultBrowserLanguage = data.browserFingerprintDefaults.language;
  let defaultBrowserTimezone = data.browserFingerprintDefaults.timezone;

  let isStarting = $state(false);
  let isStopping = $state(false);
  let isSendingFeedback = $state(false);
  let errorMessage = $state<string | null>(null);
  let rateLimitWarning = $state<string | null>(null);
  let showBrowser = $state(false);
  let liveUrl = $state<string | null>(null);
  let pollInterval: ReturnType<typeof setInterval> | null = null;
  let currentRunId = $state<number | null>(null);

  // Type-text feature (for 2FA codes on mobile)
  let typeTextValue = $state("");
  let isTypingText = $state(false);
  let typeTextMessage = $state<string | null>(null);

  // Navigate-URL feature (for magic link login)
  let navigateUrlValue = $state("");
  let isNavigating = $state(false);
  let navigateUrlMessage = $state<string | null>(null);

  // Runs history
  interface Run {
    id: number;
    status: string;
    started_at: string;
    finished_at: string | null;
    jobs_found: number | null;
    error_message: string | null;
    triggered_by: string;
    live_url: string | null;
  }

  interface LogEntry {
    id: number;
    level: string;
    message: string;
    timestamp: string;
  }

  interface JobDetails {
    id: number;
    title: string | null;
    company: string | null;
    office_location: string | null;
    salary_min: number | null;
    salary_max: number | null;
    salary_currency: string | null;
    salary_period: string | null;
    job_types: string[] | null;
    work_location: string[] | null;
    skills_required: string[] | null;
    skills_preferred: string[] | null;
    job_description: string | null;
    source_url: string | null;
  }

  interface RunItem {
    id: number;
    position: number;
    title: string | null;
    company: string | null;
    location: string | null;
    status: string;
    status_message: string | null;
    job_id: number | null;
    was_created: boolean | null;
    jobs: JobDetails | null;
  }

  interface RunItemsData {
    items: RunItem[];
    stats: {
      total: number;
      pending: number;
      processing: number;
      completed: number;
      skipped: number;
      error: number;
    };
  }

  let runs = $state<Run[]>([]);
  let expandedRunId = $state<number | null>(null);
  let expandedItemId = $state<number | null>(null);
  let runLogs = $state<Record<number, LogEntry[]>>({});
  let runItems = $state<Record<number, RunItemsData>>({});
  let loadingLogs = $state<Record<number, boolean>>({});
  let loadingItems = $state<Record<number, boolean>>({});
  let logPollIntervals = $state<
    Record<number, ReturnType<typeof setInterval>>
  >({});
  let itemPollIntervals = $state<
    Record<number, ReturnType<typeof setInterval>>
  >({});
  let runTabView = $state<Record<number, "jobs" | "logs">>({}); // Tab view per run
  let logLevelFilter = $state<"debug" | "info" | "warn" | "error">("info");

  // Log auto-scroll: track container refs and whether user has scrolled up
  let logContainerRefs = $state<Record<number, HTMLElement | null>>({});
  let logAutoScroll = $state<Record<number, boolean>>({});

  // Reset state when navigating between job searches
  let prevJobSearchId = data.jobSearch.id;
  $effect(() => {
    if (data.jobSearch.id === prevJobSearchId) return;
    prevJobSearchId = data.jobSearch.id;
    // Re-sync all data-derived state
    jobSearch = data.jobSearch;
    isEditingHeader = false;
    editNameInput = data.jobSearch.name ?? "";
    platformCredentials = data.platformCredentials;
    canEditPlatformUrls = data.canEditPlatformUrls;
    maxJobsEnabled = (data.jobSearch as any).max_jobs != null;
    maxJobsInput = (data.jobSearch as any).max_jobs?.toString() ?? "";
    skipFirstEnabled = (data.jobSearch as any).skip_first != null;
    stopAfterDuplicatesEnabled =
      (data.jobSearch as any).stop_after_duplicates != null;
    sectionOpen = {
      search: loadSectionOpen("search"),
      auth: loadSectionOpen("auth"),
      options: loadSectionOpen("options"),
      settings: loadSectionOpen("settings", false),
    };
    searchUrlInput = data.jobSearch.search_url ?? "";
    searchTermInput = data.jobSearch.search_term ?? "";
    loginUrlInput = data.jobSearch.job_platforms?.login_page_url ?? "";
    browserProvider = (data.jobSearch as any).browser_provider ?? null;
    savedBrowserProvider = (data.jobSearch as any).browser_provider ?? null;
    keepMinimized = (data.jobSearch as any).keep_minimized ?? true;
    savedKeepMinimized = (data.jobSearch as any).keep_minimized ?? true;
    browserCountryCode = data.browserCountryCode || "";
    savedBrowserCountryCode = data.browserCountryCode || "";
    browserLanguage = data.browserFingerprint.language;
    savedBrowserLanguage = data.browserFingerprint.language;
    browserTimezone = data.browserFingerprint.timezone;
    savedBrowserTimezone = data.browserFingerprint.timezone;
    browserUserAgent = data.browserFingerprint.userAgent;
    savedBrowserUserAgent = data.browserFingerprint.userAgent;
    defaultCountryCode = data.defaultCountryCode || "";
    defaultBrowserLanguage = data.browserFingerprintDefaults.language;
    defaultBrowserTimezone = data.browserFingerprintDefaults.timezone;
    const credId =
      (data.jobSearch as any).platform_profile_id?.toString() ?? "none";
    savedCredentialId = credId;
    selectedCredentialId = credId;
    // Reset transient input state
    typeTextValue = "";
    typeTextMessage = null;
    navigateUrlValue = "";
    navigateUrlMessage = null;
    errorMessage = null;
    rateLimitWarning = null;
    showBrowser = false;
    liveUrl = null;
    currentRunId = null;
    runs = [];
    expandedRunId = null;
    // Reload runs for the new job search
    loadRuns();
    // Restart polling if needed
    stopPolling();
    if (
      ["running", "blocked", "queued"].includes(data.jobSearch.status ?? "")
    ) {
      startPolling();
    }
  });

  // Computed states
  let isRunning = $derived(jobSearch.status === "running");
  let isBlocked = $derived(jobSearch.status === "blocked");
  let isQueued = $derived(jobSearch.status === "queued");
  let needsIntervention = $derived(isRunning || isBlocked);
  let isCloudMode = $derived(!!liveUrl);
  let isMagicLink = $derived(
    isBlocked && jobSearch.status_message?.includes("login link"),
  );
  // Determine if this search uses a cloud browser (GoLogin) — either per-search override or server default
  let expectsCloudBrowser = $derived(
    savedBrowserProvider === "hosted" ||
      (!savedBrowserProvider && data.browserProvider === "goLogin"),
  );
  // Tunnel mode: uses desktop app browser (no VNC, no live URL by default)
  let isTunnelMode = $derived(
    savedBrowserProvider === "local" ||
      (!savedBrowserProvider && data.browserProvider === "tunnel"),
  );
  // Only fall back to VNC when using local browser; show nothing while waiting for cloud live URL
  let browserViewUrl = $derived(
    liveUrl ||
      (expectsCloudBrowser
        ? null
        : (isTunnelMode
          ? null
          : "/vnc/vnc.html?autoconnect=true&resize=scale")),
  );

  // Screencast state (for tunnel mode — polls JPEG frames from the desktop browser)
  let screencastEnabled = $state(false);
  let screencastSrc = $state<string | null>(null);
  let screencastPollTimer: ReturnType<typeof setTimeout> | null = null;

  let screencastError = $state<string | null>(null);

  function pollScreencastFrame() {
    if (!screencastEnabled) return;

    const url = `/api/tunnel/screencast/${data.profileId}?t=${Date.now()}`;
    fetch(url)
      .then((res) => {
        if (!screencastEnabled) return; // stopped while fetching
        if (res.ok) {
          return res.blob().then((blob) => {
            if (!screencastEnabled) return;
            // Revoke previous object URL to avoid memory leaks
            if (screencastSrc && screencastSrc.startsWith("blob:")) {
              URL.revokeObjectURL(screencastSrc);
            }
            screencastSrc = URL.createObjectURL(blob);
          });
        }
        // 204 = no frame yet, just keep polling
      })
      .catch(() => {
        // Network error, keep polling
      })
      .finally(() => {
        if (screencastEnabled) {
          screencastPollTimer = setTimeout(pollScreencastFrame, 1000);
        }
      });
  }

  function stopScreencast() {
    screencastEnabled = false;
    if (screencastPollTimer) {
      clearTimeout(screencastPollTimer);
      screencastPollTimer = null;
    }
    if (screencastSrc && screencastSrc.startsWith("blob:")) {
      URL.revokeObjectURL(screencastSrc);
    }
    screencastSrc = null;
  }

  function toggleScreencast() {
    screencastError = null;

    if (screencastEnabled) {
      stopScreencast();
    } else {
      screencastEnabled = true;
      pollScreencastFrame();
    }
  }

  // Clean up screencast on destroy
  onDestroy(() => {
    if (screencastEnabled) {
      stopScreencast();
    }
  });

  function formatDate(date: Date | string | null): string {
    if (!date) return "Never";
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function formatRelativeTime(date: Date | string | null): string {
    if (!date) return "";
    const d = typeof date === "string" ? new Date(date) : date;
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDate(date);
  }

  function getRunStatusColor(status: string): string {
    switch (status) {
      case "success":
        return "text-[var(--dash-success)]";
      case "partial":
        return "text-[var(--dash-warning)]";
      case "error":
      case "cancelled":
        return "text-[var(--dash-error)]";
      case "running":
      case "queued":
        return "text-[var(--dash-primary)]";
      case "blocked":
        return "text-[var(--dash-warning)]";
      default:
        return "text-[var(--dash-text-secondary)]";
    }
  }

  function getRunStatusIcon(status: string) {
    switch (status) {
      case "success":
        return faCheck;
      case "partial":
      case "blocked":
        return faExclamationTriangle;
      case "error":
      case "cancelled":
        return faTimes;
      case "running":
      case "queued":
        return faSpinner;
      default:
        return faCog;
    }
  }

  function getLogLevelColor(level: string): string {
    switch (level) {
      case "error":
        return "text-[var(--dash-error)]";
      case "warn":
        return "text-[var(--dash-warning)]";
      case "info":
        return "text-[var(--dash-text)]";
      case "debug":
        return "text-[var(--dash-text-muted)]";
      default:
        return "text-[var(--dash-text-secondary)]";
    }
  }

  async function loadRuns() {
    try {
      const response = await fetch(
        `/api/job-searches/${jobSearch.id}/runs?limit=10`,
      );
      if (response.ok) {
        const data = await response.json();
        // Spread each run object to ensure Svelte 5 reactivity detects changes
        // This forces re-render even when only nested properties change
        runs = data.runs.map((run: Run) => ({ ...run }));
      }
    } catch (err) {
      console.error("Failed to load runs:", err);
    }
  }

  async function loadRunLogs(runId: number) {
    if (loadingLogs[runId]) return;
    loadingLogs[runId] = true;

    try {
      const response = await fetch(
        `/api/job-searches/${jobSearch.id}/runs/${runId}/logs?level=${logLevelFilter}`,
      );
      if (response.ok) {
        const data = await response.json();
        runLogs[runId] = data.logs;
        scrollLogToBottom(runId);
      }
    } catch (err) {
      console.error("Failed to load logs:", err);
    } finally {
      loadingLogs[runId] = false;
    }
  }

  async function loadRunItems(runId: number) {
    if (loadingItems[runId]) return;
    loadingItems[runId] = true;

    try {
      const response = await fetch(
        `/api/job-searches/${jobSearch.id}/runs/${runId}/items`,
      );
      if (response.ok) {
        const data = await response.json();
        runItems[runId] = data;
      } else {
        console.error(
          "Failed to load items:",
          response.status,
          await response.text(),
        );
      }
    } catch (err) {
      console.error("Failed to load items:", err);
    } finally {
      loadingItems[runId] = false;
    }
  }

  function startItemPolling(runId: number) {
    if (itemPollIntervals[runId]) return;

    itemPollIntervals[runId] = setInterval(async () => {
      await loadRunItems(runId);

      // Stop polling if run is complete
      const run = runs.find((r) => r.id === runId);
      if (run && !["running", "blocked", "queued"].includes(run.status)) {
        stopItemPolling(runId);
      }
    }, 2000);
  }

  function stopItemPolling(runId: number) {
    if (itemPollIntervals[runId]) {
      clearInterval(itemPollIntervals[runId]);
      delete itemPollIntervals[runId];
    }
  }

  function getItemStatusColor(status: string): string {
    switch (status) {
      case "completed":
        return "text-[var(--dash-success)]";
      case "processing":
        return "text-[var(--dash-primary)]";
      case "pending":
        return "text-[var(--dash-text-muted)]";
      case "skipped":
        return "text-[var(--dash-warning)]";
      case "error":
        return "text-[var(--dash-error)]";
      default:
        return "text-[var(--dash-text-secondary)]";
    }
  }

  function toggleItemExpanded(itemId: number) {
    expandedItemId = expandedItemId === itemId ? null : itemId;
  }

  function formatSalary(
    min: number | null,
    max: number | null,
    currency: string | null,
    period: string | null,
  ): string {
    if (!min && !max) return "";
    const curr = currency || "USD";
    const formatter = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: curr,
      maximumFractionDigits: 0,
    });
    let result = "";
    if (min && max) {
      result = `${formatter.format(min)} - ${formatter.format(max)}`;
    } else if (min) {
      result = `From ${formatter.format(min)}`;
    } else if (max) {
      result = `Up to ${formatter.format(max)}`;
    }
    if (period) {
      result += ` / ${period}`;
    }
    return result;
  }

  function truncateText(text: string | null, maxLength: number): string {
    if (!text) return "";
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  }

  function getItemStatusBg(status: string): string {
    switch (status) {
      case "completed":
        return "bg-[var(--dash-success-light)]";
      case "processing":
        return "bg-[var(--dash-primary-light)]";
      case "pending":
        return "bg-[var(--dash-bg)]";
      case "skipped":
        return "bg-[var(--dash-warning-light)]";
      case "error":
        return "bg-[var(--dash-error-light)]";
      default:
        return "bg-[var(--dash-bg)]";
    }
  }

  function toggleRunExpanded(runId: number) {
    if (expandedRunId === runId) {
      expandedRunId = null;
      // Stop polling logs and items for this run
      stopItemPolling(runId);
      if (logPollIntervals[runId]) {
        clearInterval(logPollIntervals[runId]);
        delete logPollIntervals[runId];
      }
    } else {
      expandedRunId = runId;
      runTabView[runId] = runTabView[runId] || "jobs"; // Default to jobs tab
      loadRunLogs(runId);
      loadRunItems(runId);

      // Start polling if run is active
      const run = runs.find((r) => r.id === runId);
      if (
        run &&
        (run.status === "running" || run.status === "blocked" ||
          run.status === "queued")
      ) {
        startLogPolling(runId);
        startItemPolling(runId);
      }
    }
  }

  function handleLogScroll(runId: number, event: Event) {
    const el = event.target as HTMLElement;
    // Consider "at bottom" if within 20px of the bottom
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 20;
    logAutoScroll[runId] = atBottom;
  }

  function scrollLogToBottom(runId: number) {
    // Default to auto-scroll if not explicitly set
    if (logAutoScroll[runId] === false) return;
    // Use tick to wait for DOM update
    requestAnimationFrame(() => {
      const el = logContainerRefs[runId];
      if (el) {
        el.scrollTop = el.scrollHeight;
      }
    });
  }

  function scrollJobsToProcessing(runId: number) {
    requestAnimationFrame(() => {
      const container = document.querySelector(
        `[data-jobs-container="${runId}"]`,
      ) as HTMLElement | null;
      if (!container) return;
      const processingEl = container.querySelector(
        '[data-item-status="processing"]',
      ) as HTMLElement | null;
      if (processingEl) {
        container.scrollTop = processingEl.offsetTop - container.offsetTop -
          container.clientHeight / 2 + processingEl.clientHeight / 2;
      }
    });
  }

  function startLogPolling(runId: number) {
    if (logPollIntervals[runId]) return;

    logPollIntervals[runId] = setInterval(async () => {
      const existingLogs = runLogs[runId] || [];
      const lastTimestamp = existingLogs.length > 0
        ? existingLogs[existingLogs.length - 1].timestamp
        : null;

      try {
        let url =
          `/api/job-searches/${jobSearch.id}/runs/${runId}/logs?level=${logLevelFilter}`;
        if (lastTimestamp) {
          url += `&after=${encodeURIComponent(lastTimestamp)}`;
        }

        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          if (data.logs.length > 0) {
            runLogs[runId] = [...existingLogs, ...data.logs];
            scrollLogToBottom(runId);
          }

          // Stop polling if run is complete
          if (!["running", "blocked", "queued"].includes(data.runStatus)) {
            if (logPollIntervals[runId]) {
              clearInterval(logPollIntervals[runId]);
              delete logPollIntervals[runId];
            }
          }
        }
      } catch (err) {
        console.error("Failed to poll logs:", err);
      }
    }, 2000);
  }

  async function saveMaxJobs() {
    const maxJobs = maxJobsEnabled ? parseMaxJobs(maxJobsInput) : null;
    isSavingMaxJobs = true;
    try {
      await fetch(`/api/job-searches/${jobSearch.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ max_jobs: maxJobs }),
      });
      (jobSearch as any).max_jobs = maxJobs;
    } catch (err) {
      console.error("Failed to save max jobs:", err);
    } finally {
      isSavingMaxJobs = false;
    }
  }

  async function saveSkipExisting() {
    isSavingSkipExisting = true;
    try {
      await fetch(`/api/job-searches/${jobSearch.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skip_existing: skipExisting }),
      });
      (jobSearch as any).skip_existing = skipExisting;
    } catch (err) {
      console.error("Failed to save skip existing:", err);
    } finally {
      isSavingSkipExisting = false;
    }
  }

  async function saveStopAfterDuplicates() {
    const stopAfterDuplicates = stopAfterDuplicatesEnabled
      ? parseStopAfterDuplicates(stopAfterDuplicatesInput)
      : null;
    isSavingStopAfterDuplicates = true;
    try {
      await fetch(`/api/job-searches/${jobSearch.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stop_after_duplicates: stopAfterDuplicates,
        }),
      });
      (jobSearch as any).stop_after_duplicates = stopAfterDuplicates;
    } catch (err) {
      console.error("Failed to save stop after duplicates:", err);
    } finally {
      isSavingStopAfterDuplicates = false;
    }
  }

  async function saveSkipFirst() {
    const skipFirst = skipFirstEnabled
      ? parseSkipFirst(skipFirstInput)
      : null;
    isSavingSkipFirst = true;
    try {
      await fetch(`/api/job-searches/${jobSearch.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skip_first: skipFirst }),
      });
      (jobSearch as any).skip_first = skipFirst;
    } catch (err) {
      console.error("Failed to save skip first:", err);
    } finally {
      isSavingSkipFirst = false;
    }
  }

  async function saveSearchUrl() {
    isSavingSearchUrl = true;
    try {
      const url = searchUrlInput.trim() || null;
      await fetch(`/api/job-searches/${jobSearch.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ search_url: url }),
      });
      jobSearch.search_url = url;
    } catch (err) {
      console.error("Failed to save search URL:", err);
    } finally {
      isSavingSearchUrl = false;
    }
  }

  async function saveSearchTerm() {
    isSavingSearchTerm = true;
    try {
      const term = searchTermInput.trim() || null;
      await fetch(`/api/job-searches/${jobSearch.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ search_term: term }),
      });
      jobSearch.search_term = term;
    } catch (err) {
      console.error("Failed to save search term:", err);
    } finally {
      isSavingSearchTerm = false;
    }
  }

  async function saveLoginUrl() {
    if (!jobSearch.platform) return;
    isSavingLoginUrl = true;
    try {
      const url = loginUrlInput.trim() || null;
      await fetch(`/api/platforms/${jobSearch.platform}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login_page_url: url }),
      });
      if (jobSearch.job_platforms) {
        jobSearch.job_platforms.login_page_url = url;
      }
    } catch (err) {
      console.error("Failed to save login URL:", err);
    } finally {
      isSavingLoginUrl = false;
    }
  }

  async function saveBrowserCountryCode() {
    isSavingBrowserCountry = true;
    try {
      const code = browserCountryCode.trim().toUpperCase() || null;
      await fetch(`/api/profile/${data.profileId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ browser_country_code: code }),
      });
      const normalized = code || "";
      browserCountryCode = normalized;
      savedBrowserCountryCode = normalized;
    } catch (err) {
      console.error("Failed to save browser country code:", err);
    } finally {
      isSavingBrowserCountry = false;
    }
  }

  async function saveBrowserProvider() {
    isSavingBrowserProvider = true;
    try {
      await fetch(`/api/job-searches/${jobSearch.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ browser_provider: browserProvider }),
      });
      savedBrowserProvider = browserProvider;
      (jobSearch as any).browser_provider = browserProvider;
    } catch (err) {
      console.error("Failed to save browser provider:", err);
    } finally {
      isSavingBrowserProvider = false;
    }
  }

  async function saveKeepMinimized() {
    isSavingKeepMinimized = true;
    try {
      await fetch(`/api/job-searches/${jobSearch.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keep_minimized: keepMinimized }),
      });
      savedKeepMinimized = keepMinimized;
      (jobSearch as any).keep_minimized = keepMinimized;
    } catch (err) {
      console.error("Failed to save keep minimized:", err);
    } finally {
      isSavingKeepMinimized = false;
    }
  }

  async function saveBrowserFingerprint() {
    isSavingBrowserFingerprint = true;
    try {
      const fields: Record<string, string | null> = {
        browser_language: browserLanguage.trim() || null,
        browser_timezone: browserTimezone.trim() || null,
        browser_user_agent: browserUserAgent.trim() || null,
      };
      await fetch(`/api/profile/${data.profileId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      savedBrowserLanguage = browserLanguage;
      savedBrowserTimezone = browserTimezone;
      savedBrowserUserAgent = browserUserAgent;
    } catch (err) {
      console.error("Failed to save browser fingerprint:", err);
    } finally {
      isSavingBrowserFingerprint = false;
    }
  }

  function resetBrowserFingerprint() {
    browserLanguage = savedBrowserLanguage;
    browserTimezone = savedBrowserTimezone;
    browserUserAgent = savedBrowserUserAgent;
  }

  async function saveCredential() {
    isSavingCredential = true;
    try {
      const profileId = selectedCredentialId === "none"
        ? null
        : parseInt(selectedCredentialId);
      await fetch(`/api/job-searches/${jobSearch.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform_profile_id: profileId }),
      });
      (jobSearch as any).platform_profile_id = profileId;
      savedCredentialId = selectedCredentialId;
    } catch (err) {
      console.error("Failed to save credential:", err);
    } finally {
      isSavingCredential = false;
    }
  }

  async function addNewCredential() {
    if (!newCredUsername.trim()) return;
    isSavingCredential = true;
    try {
      const response = await fetch(`/api/job-searches/${jobSearch.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          new_credential: {
            username: newCredUsername.trim(),
            password: newCredPassword,
          },
        }),
      });
      if (response.ok) {
        // Reload page data to get updated credentials list
        const pageResponse = await fetch(window.location.href, {
          headers: { Accept: "application/json" },
        });
        if (pageResponse.ok) {
          // Simpler: just reload the page
          window.location.reload();
          return;
        }
      }
    } catch (err) {
      console.error("Failed to add credential:", err);
    } finally {
      isSavingCredential = false;
      showAddCredential = false;
      newCredUsername = "";
      newCredPassword = "";
    }
  }

  let isDeletingCredential = $state<number | null>(null);

  async function deleteCredential(credId: number) {
    if (
      !confirm(
        "Delete this credential? Any search tasks using it will be unlinked.",
      )
    ) return;
    isDeletingCredential = credId;
    try {
      const platform = (jobSearch as any).platform;
      const response = await fetch(
        `/api/platforms/${platform}/credentials?profileId=${data.profileId}&credentialId=${credId}`,
        { method: "DELETE" },
      );
      if (response.ok) {
        // Remove from local list
        platformCredentials = platformCredentials.filter((c) =>
          c.id !== credId
        );
        // If this was the saved credential, clear it
        if ((jobSearch as any).platform_profile_id === credId) {
          (jobSearch as any).platform_profile_id = null;
          savedCredentialId = "none";
        }
        // If this was the pending selection, reset to saved
        if (selectedCredentialId === String(credId)) {
          selectedCredentialId = savedCredentialId;
        }
      }
    } catch (err) {
      console.error("Failed to delete credential:", err);
    } finally {
      isDeletingCredential = null;
    }
  }

  async function startScrape() {
    isStarting = true;
    errorMessage = null;
    rateLimitWarning = null;

    try {
      const response = await fetch(
        `/api/job-searches/${jobSearch.id}/run`,
        {
          method: "POST",
        },
      );

      const result = await response.json();

      if (!response.ok) {
        errorMessage = result.message || "Failed to start scrape";
        return;
      }

      if (result.status === "rate_limited") {
        errorMessage =
          `Rate limited: this search has already run ${result.recentRunCount} time${
            result.recentRunCount === 1 ? "" : "s"
          } in the last ${result.cooldownHours} hours (max ${result.maxRuns})`;
        return;
      }

      if (result.status === "already_queued") {
        errorMessage = "This search is already queued";
        return;
      }

      if (result.status === "already_running") {
        errorMessage = "This search is already running";
        return;
      }

      // Staff override warning
      if (result.recentRunCount) {
        rateLimitWarning =
          `Staff override: this search has already run ${result.recentRunCount} time${
            result.recentRunCount === 1 ? "" : "s"
          } in the last ${result.cooldownHours} hours`;
      }

      // Queued successfully
      jobSearch.status = "queued";
      jobSearch.status_message = "Waiting in queue";
      currentRunId = result.runId;

      // Reload runs to show the new one
      await loadRuns();

      // Expand the new run to show logs and jobs
      if (result.runId) {
        expandedRunId = result.runId;
        startLogPolling(result.runId);
        startItemPolling(result.runId);
      }

      // Start polling for status updates
      startPolling();
    } catch (err) {
      errorMessage = "Failed to start scrape";
      console.error(err);
    } finally {
      isStarting = false;
    }
  }

  function startPolling() {
    if (pollInterval) return;

    pollInterval = setInterval(async () => {
      try {
        const response = await fetch(
          `/api/job-searches/${jobSearch.id}/run`,
        );
        const result = await response.json();

        jobSearch.status = result.status;
        jobSearch.status_message = result.statusMessage;
        jobSearch.last_run = result.lastRun;
        jobSearch.last_run_jobs_found = result.jobsFound;
        liveUrl = result.liveUrl || null;
        currentRunId = result.currentRunId || null;

        // Update runs list
        await loadRuns();

        // Stop polling when scrape is complete
        if (!["running", "blocked", "queued"].includes(result.status)) {
          stopPolling();
          showBrowser = false;
          liveUrl = null;
          // Invalidate so overview page shows fresh status on navigation
          invalidateAll();
        }
      } catch (err) {
        console.error("Failed to poll status:", err);
      }
    }, 3000);
  }

  function stopPolling() {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
  }

  async function stopScrape() {
    if (
      !confirm(
        "Are you sure you want to stop the running scrape? This cannot be undone.",
      )
    ) {
      return;
    }

    isStopping = true;
    errorMessage = null;

    try {
      const response = await fetch(
        `/api/job-searches/${jobSearch.id}/run`,
        {
          method: "DELETE",
        },
      );

      const result = await response.json();

      if (!response.ok) {
        errorMessage = result.message || "Failed to stop scrape";
        return;
      }

      if (
        result.status === "removed_from_queue" ||
        result.status === "cancellation_requested" ||
        result.status === "cancelled"
      ) {
        jobSearch.status = "idle";
        jobSearch.status_message = "Cancelled by user";
        stopPolling();
        showBrowser = false;
        liveUrl = null;

        // Reload runs to show updated status
        await loadRuns();
        // Invalidate all data so the overview page shows fresh status
        await invalidateAll();
      }
    } catch (err) {
      errorMessage = "Failed to stop scrape";
      console.error(err);
    } finally {
      isStopping = false;
    }
  }

  async function sendFeedback(response: "continue" | "skip" | "cancel") {
    if (!currentRunId) {
      errorMessage = "No active run to respond to";
      return;
    }

    isSendingFeedback = true;
    errorMessage = null;

    try {
      const res = await fetch(
        `/api/job-searches/${jobSearch.id}/runs/${currentRunId}/respond`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ response }),
        },
      );

      const result = await res.json();

      if (!res.ok) {
        errorMessage = result.message ||
          `Failed to send ${response} response`;
        return;
      }

      // If cancelled, update UI immediately
      if (response === "cancel") {
        jobSearch.status = "cancelled";
        jobSearch.status_message = "Cancelled by user";
        stopPolling();
        showBrowser = false;
        liveUrl = null;
        await loadRuns();
      }
      // For continue/skip, the scraper will pick it up and status will update via polling
    } catch (err) {
      errorMessage = `Failed to send ${response} response`;
      console.error(err);
    } finally {
      isSendingFeedback = false;
    }
  }

  async function sendTypeText(submit = false) {
    if (!currentRunId || !typeTextValue.trim()) return;

    isTypingText = true;
    typeTextMessage = null;

    try {
      const res = await fetch(
        `/api/job-searches/${jobSearch.id}/runs/${currentRunId}/type-text`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: typeTextValue, submit }),
        },
      );

      const result = await res.json();

      if (!res.ok) {
        typeTextMessage = result.message || "Failed to type text";
        return;
      }

      typeTextMessage = submit
        ? "Typed and submitted"
        : "Typed successfully";
      typeTextValue = "";
      // Clear success message after a moment
      setTimeout(() => {
        typeTextMessage = null;
      }, 2000);
    } catch (err) {
      typeTextMessage = "Failed to type text";
      console.error(err);
    } finally {
      isTypingText = false;
    }
  }

  async function sendNavigateUrl() {
    if (!currentRunId || !navigateUrlValue.trim()) return;

    isNavigating = true;
    navigateUrlMessage = null;

    try {
      const res = await fetch(
        `/api/job-searches/${jobSearch.id}/runs/${currentRunId}/navigate-url`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: navigateUrlValue }),
        },
      );

      const result = await res.json();

      if (!res.ok) {
        navigateUrlMessage = result.message || "Failed to navigate";
        return;
      }

      navigateUrlMessage = "Navigated successfully";
      navigateUrlValue = "";
      setTimeout(() => {
        navigateUrlMessage = null;
      }, 2000);
    } catch (err) {
      navigateUrlMessage = "Failed to navigate";
      console.error(err);
    } finally {
      isNavigating = false;
    }
  }

  onMount(() => {
    // Load runs history
    loadRuns();

    // Start polling if already running/blocked/queued
    if (needsIntervention || isQueued) {
      startPolling();
    }
  });

  onDestroy(() => {
    stopPolling();
    // Clean up all log and item polling intervals
    Object.values(logPollIntervals).forEach((interval) =>
      clearInterval(interval)
    );
    Object.values(itemPollIntervals).forEach((interval) =>
      clearInterval(interval)
    );
  });
</script>

<div class="space-y-6">
  <!-- Header -->
  <div class="flex items-center gap-4">
    <a
      href="/dashboard/jobs/settings"
      class="p-2 rounded-lg hover:bg-[var(--dash-bg)] text-[var(--dash-text-secondary)] hover:text-[var(--dash-text)] transition-colors"
    >
      <FontAwesomeIcon icon={faArrowLeft} class="w-5 h-5" />
    </a>
    <div class="flex-1">
      <h1 class="text-xl font-semibold text-[var(--dash-text)]">
        Search Task
      </h1>
    </div>
  </div>

  <!-- Scrape Configuration -->
  <div
    class="bg-[var(--dash-card)] rounded-lg border border-[var(--dash-border)] p-6"
  >
    <!-- Scrape Status (full-width) -->
    <div class="space-y-4 pb-6 mb-6 border-b border-[var(--dash-border)]">
      {#if isEditingHeader}
        <div class="space-y-3">
          <div>
            <label for="edit-task-name" class="block text-xs font-medium text-[var(--dash-text-secondary)] mb-1">Task Name</label>
            <input
              id="edit-task-name"
              type="text"
              bind:value={editNameInput}
              class="w-full px-3 py-2 bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-lg text-[var(--dash-text)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
              onkeydown={(e) => { if (e.key === 'Enter') saveHeader(); if (e.key === 'Escape') cancelEditHeader(); }}
            />
          </div>
          {#if jobSearch.job_platforms}
            <div>
              <label class="block text-xs font-medium text-[var(--dash-text-secondary)] mb-1">Platform</label>
              <p class="text-sm text-[var(--dash-text)]">{jobSearch.job_platforms.name}</p>
            </div>
          {/if}
          <div class="flex items-center gap-2">
            <button
              onclick={saveHeader}
              disabled={isSavingHeader}
              class="flex items-center gap-2 px-3 py-1.5 bg-[var(--dash-primary)] text-white rounded-lg text-sm hover:bg-[var(--dash-primary-hover)] transition-colors disabled:opacity-50"
            >
              {#if isSavingHeader}
                <FontAwesomeIcon icon={faSpinner} class="w-3 h-3 animate-spin" />
              {/if}
              Save
            </button>
            <button
              onclick={cancelEditHeader}
              class="px-3 py-1.5 text-[var(--dash-text-secondary)] hover:text-[var(--dash-text)] text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      {:else}
        <div class="flex items-start justify-between gap-2">
          <h2
            class="text-lg font-semibold text-[var(--dash-text)]"
          >
            {jobSearch.name}
            {#if jobSearch.job_platforms}
              <span class="text-[var(--dash-text-secondary)] font-normal">@</span>
              <span
                class="bg-[var(--dash-bg-inset)] px-2 py-0.5 rounded inline-block"
              >{jobSearch.job_platforms.name}</span>
            {/if}
          </h2>
          <button
            onclick={() => { isEditingHeader = true; }}
            class="p-1.5 text-[var(--dash-text-muted)] hover:text-[var(--dash-text)] transition-colors shrink-0"
            title="Edit name"
          >
            <FontAwesomeIcon icon={faPencil} class="w-3.5 h-3.5" />
          </button>
        </div>
      {/if}

      {#if errorMessage}
        <div
          class="p-3 bg-[var(--dash-error-light)] border border-[var(--dash-error)] rounded-lg"
        >
          <p class="text-[var(--dash-error)] text-sm">{errorMessage}</p>
        </div>
      {/if}

      {#if rateLimitWarning}
        <div
          class="p-3 bg-amber-50 border border-amber-400 rounded-lg dark:bg-amber-950/30 dark:border-amber-600"
        >
          <p class="text-amber-700 text-sm dark:text-amber-400">
            ⚠ {rateLimitWarning}
          </p>
        </div>
      {/if}

      <!-- Status Display -->
      <div class="flex flex-wrap items-center gap-3 p-4 bg-[var(--dash-bg-inset)] rounded-lg">
        <div class="flex items-center gap-3 min-w-0">
          {#if jobSearch.status === "queued"}
            <div
              class="w-10 h-10 rounded-full bg-[var(--dash-primary-light)] flex items-center justify-center shrink-0"
            >
              <FontAwesomeIcon
                icon={faSpinner}
                class="w-5 h-5 text-[var(--dash-primary)] animate-spin"
              />
            </div>
            <div class="min-w-0">
              <p class="font-medium text-[var(--dash-text)]">Queued</p>
              <p class="text-sm text-[var(--dash-text-secondary)]">
                Waiting in queue to start...
              </p>
            </div>
          {:else if jobSearch.status === "running"}
            <div
              class="w-10 h-10 rounded-full bg-[var(--dash-primary-light)] flex items-center justify-center shrink-0"
            >
              <FontAwesomeIcon
                icon={faSpinner}
                class="w-5 h-5 text-[var(--dash-primary)] animate-spin"
              />
            </div>
            <div class="min-w-0">
              <p class="font-medium text-[var(--dash-text)]">
                {jobSearch.status_message || "Running..."}
              </p>
              <p class="text-sm text-[var(--dash-text-secondary)]">
                Scraping jobs from {jobSearch.job_platforms?.name || "platform"}
              </p>
            </div>
          {:else if jobSearch.status === "blocked"}
            <div
              class="w-10 h-10 rounded-full bg-[var(--dash-warning-light)] flex items-center justify-center shrink-0"
            >
              <FontAwesomeIcon
                icon={faExclamationTriangle}
                class="w-5 h-5 text-[var(--dash-warning)]"
              />
            </div>
            <div class="min-w-0">
              <p class="font-medium text-[var(--dash-warning)]">
                {jobSearch.status_message}
              </p>
              <p class="text-sm text-[var(--dash-text-secondary)]">
                {#if isMagicLink}
                  Paste the login URL from your email below, then click Continue
                {:else}
                  Complete the action in the browser view, then click Continue
                {/if}
              </p>
            </div>
          {:else if jobSearch.status === "success"}
            <div
              class="w-10 h-10 rounded-full bg-[var(--dash-success-light)] flex items-center justify-center shrink-0"
            >
              <FontAwesomeIcon
                icon={faCheck}
                class="w-5 h-5 text-[var(--dash-success)]"
              />
            </div>
            <div class="min-w-0">
              <p class="font-medium text-[var(--dash-text)]">Completed</p>
              <p class="text-sm text-[var(--dash-text-secondary)]">
                {formatDate(jobSearch.last_run)}
                {#if jobSearch.last_run_jobs_found}
                  • {jobSearch.last_run_jobs_found} jobs found
                {/if}
              </p>
            </div>
          {:else if jobSearch.status === "partial"}
            <div
              class="w-10 h-10 rounded-full bg-[var(--dash-warning-light)] flex items-center justify-center shrink-0"
            >
              <FontAwesomeIcon
                icon={faExclamationTriangle}
                class="w-5 h-5 text-[var(--dash-warning)]"
              />
            </div>
            <div class="min-w-0">
              <p class="font-medium text-[var(--dash-text)]">
                Completed with issues
              </p>
              <p class="text-sm text-[var(--dash-text-secondary)]">
                {formatDate(jobSearch.last_run)} • {jobSearch.status_message}
              </p>
            </div>
          {:else if jobSearch.status === "error"}
            <div
              class="w-10 h-10 rounded-full bg-[var(--dash-error-light)] flex items-center justify-center shrink-0"
            >
              <FontAwesomeIcon
                icon={faTimes}
                class="w-5 h-5 text-[var(--dash-error)]"
              />
            </div>
            <div class="min-w-0">
              <p class="font-medium text-[var(--dash-error)]">Failed</p>
              <p class="text-sm text-[var(--dash-text-secondary)]">
                {jobSearch.status_message}
              </p>
            </div>
          {:else if jobSearch.status === "cancelled"}
            <div
              class="w-10 h-10 rounded-full bg-[var(--dash-error-light)] flex items-center justify-center shrink-0"
            >
              <FontAwesomeIcon
                icon={faTimes}
                class="w-5 h-5 text-[var(--dash-error)]"
              />
            </div>
            <div class="min-w-0">
              <p class="font-medium text-[var(--dash-text)]">Cancelled</p>
              <p class="text-sm text-[var(--dash-text-secondary)]">
                {jobSearch.status_message || "Cancelled by user"}
              </p>
            </div>
          {:else if jobSearch.last_run}
            <!-- Idle but has run before -->
            <div
              class="w-10 h-10 rounded-full bg-[var(--dash-bg)] flex items-center justify-center border border-[var(--dash-border)] shrink-0"
            >
              <FontAwesomeIcon
                icon={faCog}
                class="w-5 h-5 text-[var(--dash-text-muted)]"
              />
            </div>
            <div class="min-w-0">
              <p class="font-medium text-[var(--dash-text)]">Idle</p>
              <p class="text-sm text-[var(--dash-text-secondary)]">
                Last run: {formatDate(jobSearch.last_run)}
                {#if jobSearch.last_run_jobs_found}
                  • {jobSearch.last_run_jobs_found} jobs found
                {/if}
              </p>
            </div>
          {:else}
            <div
              class="w-10 h-10 rounded-full bg-[var(--dash-bg)] flex items-center justify-center border border-[var(--dash-border)] shrink-0"
            >
              <FontAwesomeIcon
                icon={faCog}
                class="w-5 h-5 text-[var(--dash-text-muted)]"
              />
            </div>
            <div class="min-w-0">
              <p class="font-medium text-[var(--dash-text)]">Never run</p>
              <p class="text-sm text-[var(--dash-text-secondary)]">
                Click "Run Scrape" to start importing jobs
              </p>
            </div>
          {/if}
        </div>

        {#if jobSearch.status === "blocked"}
          <div class="flex items-center gap-2 w-full sm:w-auto sm:ml-auto">
            <button
              onclick={() => sendFeedback("continue")}
              disabled={isSendingFeedback}
              class="flex items-center gap-2 px-4 py-2 bg-[var(--dash-success)] text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {#if isSendingFeedback}
                <FontAwesomeIcon
                  icon={faSpinner}
                  class="w-4 h-4 animate-spin"
                />
              {:else}
                <FontAwesomeIcon icon={faCheck} class="w-4 h-4" />
              {/if}
              <span>Continue</span>
            </button>
            <button
              onclick={() => sendFeedback("skip")}
              disabled={isSendingFeedback}
              class="flex items-center gap-2 px-3 py-2 bg-[var(--dash-bg)] text-[var(--dash-text)] border border-[var(--dash-border)] rounded-lg hover:bg-[var(--dash-border)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Skip current action and move to next"
            >
              <FontAwesomeIcon icon={faForward} class="w-4 h-4" />
              <span>Skip</span>
            </button>
          </div>
        {/if}

        {#if isRunning || isBlocked || isQueued}
          <button
            onclick={stopScrape}
            disabled={isStopping}
            class="w-full sm:w-auto sm:ml-auto flex items-center justify-center gap-2 px-4 py-2 bg-[var(--dash-error)] text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            {#if isStopping}
              <FontAwesomeIcon icon={faSpinner} class="w-4 h-4 animate-spin" />
              <span>Stopping...</span>
            {:else}
              <FontAwesomeIcon icon={faStop} class="w-4 h-4" />
              <span>Stop Scrape</span>
            {/if}
          </button>
        {:else}
          <button
            onclick={startScrape}
            disabled={isStarting || !jobSearch.search_url || !jobSearch.platform}
            class="w-full sm:w-auto sm:ml-auto flex items-center justify-center gap-2 px-4 py-2 bg-[var(--dash-primary)] text-white rounded-lg hover:bg-[var(--dash-primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            {#if isStarting}
              <FontAwesomeIcon icon={faSpinner} class="w-4 h-4 animate-spin" />
              <span>Starting...</span>
            {:else}
              <FontAwesomeIcon icon={faPlay} class="w-4 h-4" />
              <span>Run Scrape</span>
            {/if}
          </button>
        {/if}
      </div>

      <!-- Missing config warnings -->
      {#if !jobSearch.search_url}
        <p class="text-sm text-[var(--dash-warning)]">
          No search URL configured. Please add a search URL to run scrapes.
        </p>
      {/if}
      {#if !jobSearch.platform}
        <p class="text-sm text-[var(--dash-warning)]">
          No platform selected. Please select a platform to run scrapes.
        </p>
      {/if}
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Left column: Search & Credentials -->
      <div class="space-y-4">
        {#if jobSearch.platform}
          <button
            type="button"
            onclick={() => toggleSection("search")}
            class="flex items-center gap-2 w-full text-left"
          >
            {#if sectionOpen.search}
              <FontAwesomeIcon icon={faChevronDown} class="w-3 h-3 text-[var(--dash-text-muted)]" />
            {:else}
              <FontAwesomeIcon icon={faChevronRight} class="w-3 h-3 text-[var(--dash-text-muted)]" />
            {/if}
            <h3
              class="text-sm font-medium text-[var(--dash-text-muted)] uppercase tracking-wide"
            >
              Search
            </h3>
          </button>

          {#if sectionOpen.search}
          <!-- URLs -->
          <div class="space-y-3">
            <div>
              <h3
                class="text-xs font-medium text-[var(--dash-text-secondary)] mb-1"
              >
                Search URL
              </h3>
              <div class="flex items-center gap-2">
                <input
                  type="url"
                  bind:value={searchUrlInput}
                  placeholder="https://..."
                  class="flex-1 px-2 py-1 text-sm rounded border border-[var(--dash-border)] bg-[var(--dash-bg)] text-[var(--dash-text)] placeholder-[var(--dash-text-muted)]"
                />
                {#if jobSearch.search_url}
                  <a
                    href={jobSearch.search_url}
                    target="_blank"
                    rel="noopener"
                    class="p-1 text-[var(--dash-text-secondary)] hover:text-[var(--dash-primary)] transition-colors"
                    title="Open search URL"
                  >
                    <FontAwesomeIcon icon={faExternalLinkAlt} class="w-3 h-3" />
                  </a>
                {/if}
              </div>
              {#if searchUrlDirty}
                <div class="flex items-center gap-2 mt-2">
                  <button
                    type="button"
                    onclick={saveSearchUrl}
                    disabled={isSavingSearchUrl}
                    class="px-3 py-1 text-xs bg-[var(--dash-primary)] text-white rounded-md hover:bg-[var(--dash-primary-hover)] transition-colors disabled:opacity-50 flex items-center gap-1"
                  >
                    {#if isSavingSearchUrl}
                      <FontAwesomeIcon
                        icon={faSpinner}
                        class="w-3 h-3 animate-spin"
                      />
                    {:else}
                      <FontAwesomeIcon icon={faCheck} class="w-3 h-3" />
                    {/if}
                    Save
                  </button>
                  <button
                    type="button"
                    onclick={() => (searchUrlInput = jobSearch.search_url ??
                      "")}
                    class="px-3 py-1 text-xs border border-[var(--dash-border)] rounded-md text-[var(--dash-text)] hover:bg-[var(--dash-bg)] transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              {/if}
            </div>

            <button
              type="button"
              onclick={() => (showAdvancedSearch = !showAdvancedSearch)}
              class="flex items-center gap-1.5 text-xs text-[var(--dash-text-muted)] hover:text-[var(--dash-text-secondary)] transition-colors"
            >
              {#if showAdvancedSearch}
                <FontAwesomeIcon icon={faChevronDown} class="w-2.5 h-2.5" />
              {:else}
                <FontAwesomeIcon icon={faChevronRight} class="w-2.5 h-2.5" />
              {/if}
              Advanced
            </button>

            {#if showAdvancedSearch}
              <div>
                <h3
                  class="text-xs font-medium text-[var(--dash-text-secondary)] mb-1"
                >
                  Search Term <span class="font-normal">(optional)</span>
                </h3>
                <input
                  type="text"
                  bind:value={searchTermInput}
                  placeholder="e.g., frontend developer amsterdam"
                  class="w-full px-2 py-1 text-sm rounded border border-[var(--dash-border)] bg-[var(--dash-bg)] text-[var(--dash-text)] placeholder-[var(--dash-text-muted)]"
                />
                <p class="text-xs text-[var(--dash-text-muted)] mt-1">
                  For sites that don't support search in the URL. The scraper
                  will type this into the search field.
                </p>
                {#if searchTermDirty}
                  <div class="flex items-center gap-2 mt-2">
                    <button
                      type="button"
                      onclick={saveSearchTerm}
                      disabled={isSavingSearchTerm}
                      class="px-3 py-1 text-xs bg-[var(--dash-primary)] text-white rounded-md hover:bg-[var(--dash-primary-hover)] transition-colors disabled:opacity-50 flex items-center gap-1"
                    >
                      {#if isSavingSearchTerm}
                        <FontAwesomeIcon
                          icon={faSpinner}
                          class="w-3 h-3 animate-spin"
                        />
                      {:else}
                        <FontAwesomeIcon icon={faCheck} class="w-3 h-3" />
                      {/if}
                      Save
                    </button>
                    <button
                      type="button"
                      onclick={() => (searchTermInput =
                        jobSearch.search_term ?? "")}
                      class="px-3 py-1 text-xs border border-[var(--dash-border)] rounded-md text-[var(--dash-text)] hover:bg-[var(--dash-bg)] transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                {/if}
              </div>
            {/if}
          </div>
          {/if}

          <!-- Authentication -->
          <div class="pt-4 border-t border-[var(--dash-border)] space-y-3">
            <button
              type="button"
              onclick={() => toggleSection("auth")}
              class="flex items-center gap-2 w-full text-left"
            >
              {#if sectionOpen.auth}
                <FontAwesomeIcon icon={faChevronDown} class="w-3 h-3 text-[var(--dash-text-muted)]" />
              {:else}
                <FontAwesomeIcon icon={faChevronRight} class="w-3 h-3 text-[var(--dash-text-muted)]" />
              {/if}
              <h3
                class="text-sm font-medium text-[var(--dash-text-muted)] uppercase tracking-wide"
              >
                Authentication
              </h3>
            </button>

            {#if sectionOpen.auth}
            <!-- Login URL -->
            <div>
              <h3
                class="text-xs font-medium text-[var(--dash-text-secondary)] mb-1"
              >
                Login URL
              </h3>
              {#if canEditPlatformUrls}
                <div class="flex items-center gap-2">
                  <input
                    type="url"
                    bind:value={loginUrlInput}
                    placeholder="https://..."
                    class="flex-1 px-2 py-1 text-sm rounded border border-[var(--dash-border)] bg-[var(--dash-bg)] text-[var(--dash-text)] placeholder-[var(--dash-text-muted)]"
                  />
                  {#if jobSearch.job_platforms?.login_page_url}
                    <a
                      href={jobSearch.job_platforms.login_page_url}
                      target="_blank"
                      rel="noopener"
                      class="p-1 text-[var(--dash-text-secondary)] hover:text-[var(--dash-primary)] transition-colors"
                      title="Open login URL"
                    >
                      <FontAwesomeIcon
                        icon={faExternalLinkAlt}
                        class="w-3 h-3"
                      />
                    </a>
                  {/if}
                </div>
                {#if loginUrlDirty}
                  <div class="flex items-center gap-2 mt-2">
                    <button
                      type="button"
                      onclick={saveLoginUrl}
                      disabled={isSavingLoginUrl}
                      class="px-3 py-1 text-xs bg-[var(--dash-primary)] text-white rounded-md hover:bg-[var(--dash-primary-hover)] transition-colors disabled:opacity-50 flex items-center gap-1"
                    >
                      {#if isSavingLoginUrl}
                        <FontAwesomeIcon
                          icon={faSpinner}
                          class="w-3 h-3 animate-spin"
                        />
                      {:else}
                        <FontAwesomeIcon icon={faCheck} class="w-3 h-3" />
                      {/if}
                      Save
                    </button>
                    <button
                      type="button"
                      onclick={() => (loginUrlInput =
                        jobSearch.job_platforms?.login_page_url ??
                          "")}
                      class="px-3 py-1 text-xs border border-[var(--dash-border)] rounded-md text-[var(--dash-text)] hover:bg-[var(--dash-bg)] transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                {/if}
              {:else if jobSearch.job_platforms?.login_page_url}
                <a
                  href={jobSearch.job_platforms.login_page_url}
                  target="_blank"
                  rel="noopener"
                  class="text-sm text-[var(--dash-primary)] hover:underline break-all flex items-center gap-1"
                >
                  {jobSearch.job_platforms.login_page_url}
                  <FontAwesomeIcon
                    icon={faExternalLinkAlt}
                    class="w-3 h-3 flex-shrink-0"
                  />
                </a>
              {:else}
                <p class="text-sm text-[var(--dash-text-muted)]">Not set</p>
              {/if}
            </div>

            <!-- Credentials -->
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center gap-2">
                <FontAwesomeIcon
                  icon={faKey}
                  class="w-4 h-4 text-[var(--dash-text-secondary)]"
                />
                <h2 class="font-medium text-[var(--dash-text)] text-sm">
                  Credentials
                </h2>
              </div>
              <div class="flex items-center gap-2">
                {#if isSavingCredential}
                  <FontAwesomeIcon
                    icon={faSpinner}
                    class="w-3 h-3 text-[var(--dash-text-muted)] animate-spin"
                  />
                {/if}
                <button
                  type="button"
                  onclick={() => (showAddCredential = !showAddCredential)}
                  class="flex items-center gap-1 px-2 py-1 text-xs text-[var(--dash-primary)] hover:bg-[var(--dash-bg)] rounded transition-colors"
                >
                  <FontAwesomeIcon icon={faPlus} class="w-3 h-3" />
                  Add
                </button>
              </div>
            </div>

            <!-- Credential list -->
            <div class="space-y-1.5">
              <!-- No credentials option -->
              <button
                type="button"
                onclick={() => {
                  showAddCredential = false;
                  selectedCredentialId = "none";
                }}
                class="
                  w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-md transition-colors {selectedCredentialId === 'none'
                  ? 'bg-[var(--dash-primary)]/10 border border-[var(--dash-primary)]/30 text-[var(--dash-text)]'
                  : 'bg-[var(--dash-bg)] border border-transparent text-[var(--dash-text-secondary)] hover:border-[var(--dash-border)]'}
                "
              >
                <span
                  class="w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 {selectedCredentialId === 'none' ? 'border-[var(--dash-primary)]' : 'border-[var(--dash-border)]'}"
                >
                  {#if selectedCredentialId === "none"}
                    <span
                      class="w-2 h-2 rounded-full bg-[var(--dash-primary)]"
                    ></span>
                  {/if}
                </span>
                <span class="flex-1 text-left"
                >No credentials (public search)</span>
                {#if savedCredentialId === "none"}
                  <span
                    class="text-xs text-[var(--dash-text-muted)] font-medium"
                  >Current</span>
                {/if}
              </button>

              {#each platformCredentials as cred}
                <div
                  class="
                    flex items-center gap-2.5 px-3 py-2 text-sm rounded-md transition-colors {selectedCredentialId === String(cred.id)
                    ? 'bg-[var(--dash-primary)]/10 border border-[var(--dash-primary)]/30'
                    : 'bg-[var(--dash-bg)] border border-transparent hover:border-[var(--dash-border)]'}
                  "
                >
                  <button
                    type="button"
                    onclick={() => {
                      showAddCredential = false;
                      selectedCredentialId = String(cred.id);
                    }}
                    class="flex-1 text-left flex items-center gap-2.5 text-[var(--dash-text)]"
                  >
                    <span
                      class="w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 {selectedCredentialId === String(cred.id) ? 'border-[var(--dash-primary)]' : 'border-[var(--dash-border)]'}"
                    >
                      {#if                     selectedCredentialId ===
                      String(cred.id)}
                        <span
                          class="w-2 h-2 rounded-full bg-[var(--dash-primary)]"
                        ></span>
                      {/if}
                    </span>
                    <span>{cred.username || "No username"}</span>
                    {#if savedCredentialId === String(cred.id)}
                      <span
                        class="text-xs text-[var(--dash-text-muted)] font-medium"
                      >Current</span>
                    {/if}
                  </button>
                  <button
                    type="button"
                    onclick={() => deleteCredential(cred.id)}
                    disabled={isDeletingCredential === cred.id}
                    class="p-1 text-[var(--dash-text-muted)] hover:text-[var(--dash-error)] transition-colors"
                    title="Delete credential"
                  >
                    {#if isDeletingCredential === cred.id}
                      <FontAwesomeIcon
                        icon={faSpinner}
                        class="w-3 h-3 animate-spin"
                      />
                    {:else}
                      <FontAwesomeIcon icon={faTrash} class="w-3 h-3" />
                    {/if}
                  </button>
                </div>
              {/each}
            </div>

            {#if             platformCredentials.length === 0 && !showAddCredential}
              <p class="mt-2 text-xs text-[var(--dash-text-muted)]">
                No credentials configured. Add credentials to enable
                authenticated scraping.
              </p>
            {/if}

            {#if credentialDirty}
              <div class="flex items-center gap-2 mt-3">
                <button
                  type="button"
                  onclick={saveCredential}
                  disabled={isSavingCredential}
                  class="px-3 py-1 text-xs bg-[var(--dash-primary)] text-white rounded-md hover:bg-[var(--dash-primary-hover)] transition-colors disabled:opacity-50 flex items-center gap-1"
                >
                  {#if isSavingCredential}
                    <FontAwesomeIcon
                      icon={faSpinner}
                      class="w-3 h-3 animate-spin"
                    />
                  {:else}
                    <FontAwesomeIcon icon={faCheck} class="w-3 h-3" />
                  {/if}
                  Save
                </button>
                <button
                  type="button"
                  onclick={() => (selectedCredentialId = savedCredentialId)}
                  class="px-3 py-1 text-xs border border-[var(--dash-border)] rounded-md text-[var(--dash-text)] hover:bg-[var(--dash-bg)] transition-colors"
                >
                  Cancel
                </button>
              </div>
            {/if}

            {#if showAddCredential}
              <div class="mt-3 p-3 bg-[var(--dash-bg)] rounded-lg space-y-3">
                <div>
                  <label
                    for="new-cred-username"
                    class="block text-sm text-[var(--dash-text)] mb-1"
                  >
                    Username / Email
                  </label>
                  <input
                    type="text"
                    id="new-cred-username"
                    bind:value={newCredUsername}
                    placeholder="your@email.com"
                    class="w-full px-3 py-2 text-sm border border-[var(--dash-border)] rounded-md bg-[var(--dash-card)] text-[var(--dash-text)] focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
                  />
                </div>
                <div>
                  <label
                    for="new-cred-password"
                    class="block text-sm text-[var(--dash-text)] mb-1"
                  >
                    Password
                  </label>
                  <div class="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      id="new-cred-password"
                      bind:value={newCredPassword}
                      placeholder="Enter password"
                      class="w-full px-3 py-2 pr-10 text-sm border border-[var(--dash-border)] rounded-md bg-[var(--dash-card)] text-[var(--dash-text)] focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
                    />
                    <button
                      type="button"
                      onclick={() => (showPassword = !showPassword)}
                      class="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--dash-text-secondary)] hover:text-[var(--dash-text)]"
                    >
                      <FontAwesomeIcon
                        icon={showPassword ? faEyeSlash : faEye}
                        class="w-4 h-4"
                      />
                    </button>
                  </div>
                </div>
                <div class="flex justify-end gap-2">
                  <button
                    type="button"
                    onclick={() => {
                      showAddCredential = false;
                      newCredUsername = "";
                      newCredPassword = "";
                    }}
                    class="px-3 py-1.5 text-sm border border-[var(--dash-border)] rounded-lg text-[var(--dash-text)] hover:bg-[var(--dash-card)] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onclick={addNewCredential}
                    disabled={!newCredUsername.trim() || isSavingCredential}
                    class="px-3 py-1.5 text-sm bg-[var(--dash-primary)] text-white rounded-lg hover:bg-[var(--dash-primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                  >
                    {#if isSavingCredential}
                      <FontAwesomeIcon
                        icon={faSpinner}
                        class="w-3 h-3 animate-spin"
                      />
                    {:else}
                      <FontAwesomeIcon icon={faPlus} class="w-3 h-3" />
                    {/if}
                    Add & Select
                  </button>
                </div>
              </div>
            {/if}
            {/if}
          </div>
        {/if}
      </div>

      <!-- Right column: Scraping Options -->
      <div class="lg:border-l lg:border-[var(--dash-border)] lg:pl-6 space-y-4">
        <hr class="border-[var(--dash-border)] lg:hidden" />
        <button
          type="button"
          onclick={() => toggleSection("options")}
          class="flex items-center gap-2 w-full text-left"
        >
          {#if sectionOpen.options}
            <FontAwesomeIcon icon={faChevronDown} class="w-3 h-3 text-[var(--dash-text-muted)]" />
          {:else}
            <FontAwesomeIcon icon={faChevronRight} class="w-3 h-3 text-[var(--dash-text-muted)]" />
          {/if}
          <h3
            class="text-sm font-medium text-[var(--dash-text-muted)] uppercase tracking-wide"
          >
            Scraping Options
          </h3>
        </button>

        {#if sectionOpen.options}
        <div class="space-y-3">
          <div class="flex items-center flex-wrap gap-3">
            <label class="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                bind:checked={maxJobsEnabled}
                class="w-4 h-4 rounded border-[var(--dash-border)] text-[var(--dash-primary)] focus:ring-[var(--dash-primary)]"
              />
              <span
                class="text-sm text-[var(--dash-text-secondary)] whitespace-nowrap"
              >Max jobs to import</span>
            </label>
            <input
              id="max-jobs"
              type="number"
              min="1"
              placeholder="No limit"
              bind:value={maxJobsInput}
              disabled={!maxJobsEnabled}
              class="w-24 px-2 py-1 text-sm rounded border border-[var(--dash-border)] bg-[var(--dash-bg)] text-[var(--dash-text)] placeholder-[var(--dash-text-muted)] disabled:opacity-40"
            />
            {#if maxJobsDirty}
              <div class="flex items-center gap-2">
                <button
                  type="button"
                  onclick={saveMaxJobs}
                  disabled={isSavingMaxJobs}
                  class="px-3 py-1 text-xs bg-[var(--dash-primary)] text-white rounded-md hover:bg-[var(--dash-primary-hover)] transition-colors disabled:opacity-50 flex items-center gap-1"
                >
                  {#if isSavingMaxJobs}
                    <FontAwesomeIcon
                      icon={faSpinner}
                      class="w-3 h-3 animate-spin"
                    />
                  {:else}
                    <FontAwesomeIcon icon={faCheck} class="w-3 h-3" />
                  {/if}
                  Save
                </button>
                <button
                  type="button"
                  onclick={() => {
                    maxJobsInput =
                      (jobSearch as any).max_jobs?.toString() ??
                        "";
                    maxJobsEnabled =
                      (jobSearch as any).max_jobs != null;
                  }}
                  class="px-3 py-1 text-xs border border-[var(--dash-border)] rounded-md text-[var(--dash-text)] hover:bg-[var(--dash-bg)] transition-colors"
                >
                  Cancel
                </button>
              </div>
            {/if}
          </div>

          <div class="flex items-center flex-wrap gap-3">
            <label class="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                bind:checked={skipFirstEnabled}
                class="w-4 h-4 rounded border-[var(--dash-border)] text-[var(--dash-primary)] focus:ring-[var(--dash-primary)]"
              />
              <span
                class="text-sm text-[var(--dash-text-secondary)] whitespace-nowrap"
              >Skip first</span>
            </label>
            <input
              id="skip-first"
              type="number"
              min="1"
              placeholder="Off"
              bind:value={skipFirstInput}
              disabled={!skipFirstEnabled}
              class="w-20 px-2 py-1 text-sm rounded border border-[var(--dash-border)] bg-[var(--dash-bg)] text-[var(--dash-text)] placeholder-[var(--dash-text-muted)] disabled:opacity-40"
            />
            <span
              class="text-sm text-[var(--dash-text-secondary)]"
              class:opacity-40={!skipFirstEnabled}
            >jobs</span>
            {#if skipFirstDirty}
              <div class="flex items-center gap-2">
                <button
                  type="button"
                  onclick={saveSkipFirst}
                  disabled={isSavingSkipFirst}
                  class="px-3 py-1 text-xs bg-[var(--dash-primary)] text-white rounded-md hover:bg-[var(--dash-primary-hover)] transition-colors disabled:opacity-50 flex items-center gap-1"
                >
                  {#if isSavingSkipFirst}
                    <FontAwesomeIcon
                      icon={faSpinner}
                      class="w-3 h-3 animate-spin"
                    />
                  {:else}
                    <FontAwesomeIcon icon={faCheck} class="w-3 h-3" />
                  {/if}
                  Save
                </button>
                <button
                  type="button"
                  onclick={() => {
                    skipFirstInput =
                      (jobSearch as any).skip_first?.toString() ??
                        "";
                    skipFirstEnabled =
                      (jobSearch as any).skip_first != null;
                  }}
                  class="px-3 py-1 text-xs border border-[var(--dash-border)] rounded-md text-[var(--dash-text)] hover:bg-[var(--dash-bg)] transition-colors"
                >
                  Cancel
                </button>
              </div>
            {/if}
          </div>

          <div class="flex items-center flex-wrap gap-3">
            <label class="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                bind:checked={stopAfterDuplicatesEnabled}
                class="w-4 h-4 rounded border-[var(--dash-border)] text-[var(--dash-primary)] focus:ring-[var(--dash-primary)]"
              />
              <span
                class="text-sm text-[var(--dash-text-secondary)] whitespace-nowrap"
              >Stop after</span>
            </label>
            <input
              id="stop-after-duplicates"
              type="number"
              min="1"
              placeholder="Off"
              bind:value={stopAfterDuplicatesInput}
              disabled={!stopAfterDuplicatesEnabled}
              class="w-20 px-2 py-1 text-sm rounded border border-[var(--dash-border)] bg-[var(--dash-bg)] text-[var(--dash-text)] placeholder-[var(--dash-text-muted)] disabled:opacity-40"
            />
            <span
              class="text-sm text-[var(--dash-text-secondary)]"
              class:opacity-40={!stopAfterDuplicatesEnabled}
            >already imported jobs in a row</span>
            {#if stopAfterDuplicatesDirty}
              <div class="flex items-center gap-2">
                <button
                  type="button"
                  onclick={saveStopAfterDuplicates}
                  disabled={isSavingStopAfterDuplicates}
                  class="px-3 py-1 text-xs bg-[var(--dash-primary)] text-white rounded-md hover:bg-[var(--dash-primary-hover)] transition-colors disabled:opacity-50 flex items-center gap-1"
                >
                  {#if isSavingStopAfterDuplicates}
                    <FontAwesomeIcon
                      icon={faSpinner}
                      class="w-3 h-3 animate-spin"
                    />
                  {:else}
                    <FontAwesomeIcon icon={faCheck} class="w-3 h-3" />
                  {/if}
                  Save
                </button>
                <button
                  type="button"
                  onclick={() => {
                    stopAfterDuplicatesInput =
                      (jobSearch as any).stop_after_duplicates
                        ?.toString() ?? "";
                    stopAfterDuplicatesEnabled =
                      (jobSearch as any).stop_after_duplicates !=
                        null;
                  }}
                  class="px-3 py-1 text-xs border border-[var(--dash-border)] rounded-md text-[var(--dash-text)] hover:bg-[var(--dash-bg)] transition-colors"
                >
                  Cancel
                </button>
              </div>
            {/if}
          </div>

          <div class="flex items-center flex-wrap gap-3">
            <span
              class="text-sm text-[var(--dash-text-secondary)] whitespace-nowrap"
            >Already imported jobs</span>
            <div
              class="flex rounded-md border border-[var(--dash-border)] overflow-hidden"
            >
              <button
                type="button"
                onclick={() => (skipExisting = false)}
                class={`px-3 py-1 text-xs font-medium transition-colors ${
                  !skipExisting
                    ? "bg-[var(--dash-primary)] text-white"
                    : "bg-[var(--dash-bg)] text-[var(--dash-text-secondary)] hover:bg-[var(--dash-surface)]"
                }`}
              >
                Update
              </button>
              <button
                type="button"
                onclick={() => (skipExisting = true)}
                class={`px-3 py-1 text-xs font-medium transition-colors ${
                  skipExisting
                    ? "bg-[var(--dash-primary)] text-white"
                    : "bg-[var(--dash-bg)] text-[var(--dash-text-secondary)] hover:bg-[var(--dash-surface)]"
                }`}
              >
                Skip
              </button>
            </div>
            {#if skipExistingDirty}
              <div class="flex items-center gap-2">
                <button
                  type="button"
                  onclick={saveSkipExisting}
                  disabled={isSavingSkipExisting}
                  class="px-3 py-1 text-xs bg-[var(--dash-primary)] text-white rounded-md hover:bg-[var(--dash-primary-hover)] transition-colors disabled:opacity-50 flex items-center gap-1"
                >
                  {#if isSavingSkipExisting}
                    <FontAwesomeIcon
                      icon={faSpinner}
                      class="w-3 h-3 animate-spin"
                    />
                  {:else}
                    <FontAwesomeIcon icon={faCheck} class="w-3 h-3" />
                  {/if}
                  Save
                </button>
                <button
                  type="button"
                  onclick={() => (skipExisting =
                    (jobSearch as any).skip_existing ?? false)}
                  class="px-3 py-1 text-xs border border-[var(--dash-border)] rounded-md text-[var(--dash-text)] hover:bg-[var(--dash-bg)] transition-colors"
                >
                  Cancel
                </button>
              </div>
            {/if}
          </div>
        </div>

        <!-- Browser Mode (Hosted vs Local) -->
        <div class="mt-4 pt-4 border-t border-[var(--dash-border)]">
          <div class="flex items-center gap-2 mb-2">
            <FontAwesomeIcon
              icon={faDesktop}
              class="w-3.5 h-3.5 text-[var(--dash-text-secondary)]"
            />
            <h3 class="text-xs font-medium text-[var(--dash-text-secondary)]">
              Browser Mode
            </h3>
          </div>
          <div class="flex items-center gap-2">
            <div
              class="flex rounded-md overflow-hidden border border-[var(--dash-border)]"
            >
              <button
                type="button"
                onclick={() => (browserProvider = null)}
                class="px-3 py-1.5 text-xs flex items-center gap-1.5 transition-colors {browserProvider === null ? 'bg-[var(--dash-primary)] text-white' : 'bg-[var(--dash-bg)] text-[var(--dash-text)] hover:bg-[var(--dash-bg-hover)]'}"
              >
                <FontAwesomeIcon icon={faCog} class="w-3 h-3" />
                Default
              </button>
              <button
                type="button"
                onclick={() => (browserProvider = "hosted")}
                class="px-3 py-1.5 text-xs flex items-center gap-1.5 border-l border-[var(--dash-border)] transition-colors {browserProvider === 'hosted' ? 'bg-[var(--dash-primary)] text-white' : 'bg-[var(--dash-bg)] text-[var(--dash-text)] hover:bg-[var(--dash-bg-hover)]'}"
              >
                <FontAwesomeIcon icon={faCloud} class="w-3 h-3" />
                Hosted
              </button>
              <button
                type="button"
                onclick={() => (browserProvider = "local")}
                class="px-3 py-1.5 text-xs flex items-center gap-1.5 border-l border-[var(--dash-border)] transition-colors {browserProvider === 'local' ? 'bg-[var(--dash-primary)] text-white' : 'bg-[var(--dash-bg)] text-[var(--dash-text)] hover:bg-[var(--dash-bg-hover)]'}"
              >
                <FontAwesomeIcon icon={faDesktop} class="w-3 h-3" />
                Local
              </button>
            </div>
            {#if browserProviderDirty}
              <button
                type="button"
                onclick={saveBrowserProvider}
                disabled={isSavingBrowserProvider}
                class="px-3 py-1 text-xs bg-[var(--dash-primary)] text-white rounded-md hover:bg-[var(--dash-primary-hover)] transition-colors disabled:opacity-50 flex items-center gap-1"
              >
                {#if isSavingBrowserProvider}
                  <FontAwesomeIcon
                    icon={faSpinner}
                    class="w-3 h-3 animate-spin"
                  />
                {:else}
                  <FontAwesomeIcon icon={faCheck} class="w-3 h-3" />
                {/if}
                Save
              </button>
              <button
                type="button"
                onclick={() => (browserProvider = savedBrowserProvider)}
                class="px-3 py-1 text-xs border border-[var(--dash-border)] rounded-md text-[var(--dash-text)] hover:bg-[var(--dash-bg)] transition-colors"
              >
                Cancel
              </button>
            {/if}
          </div>
          <p class="text-xs text-[var(--dash-text-muted)] mt-2">
            {#if browserProvider === "hosted"}
              Uses a cloud-hosted anti-detect browser (datacenter IP). Fast and
              reliable, but may trigger bot detection on some platforms.
            {:else if browserProvider === "local"}
              Uses your own computer's browser via the desktop app (residential
              IP). Less likely to be detected, but requires the desktop app to
              be running.
            {:else}
              Uses the server default ({
                data.browserProvider === "goLogin"
                  ? "Hosted"
                  : data.browserProvider === "tunnel"
                  ? "Local"
                  : data.browserProvider
              }).
            {/if}
          </p>
        </div>

        <!-- Browser Location (hosted mode only) -->
        {#if           savedBrowserProvider === "hosted" ||
            (!savedBrowserProvider &&
              data.browserProvider === "goLogin")}
          <div class="mt-4 pt-4 border-t border-[var(--dash-border)]">
            <div class="flex items-center gap-2 mb-2">
              <FontAwesomeIcon
                icon={faGlobe}
                class="w-3.5 h-3.5 text-[var(--dash-text-secondary)]"
              />
              <h3 class="text-xs font-medium text-[var(--dash-text-secondary)]">
                Browser Location
              </h3>
            </div>
            <div class="flex items-center gap-2">
              <div class="flex-1">
                <CountrySelect
                  bind:value={browserCountryCode}
                  fallback={defaultCountryCode}
                />
              </div>
              {#if browserCountryDirty}
                <button
                  type="button"
                  onclick={saveBrowserCountryCode}
                  disabled={isSavingBrowserCountry}
                  class="px-3 py-1 text-xs bg-[var(--dash-primary)] text-white rounded-md hover:bg-[var(--dash-primary-hover)] transition-colors disabled:opacity-50 flex items-center gap-1"
                >
                  {#if isSavingBrowserCountry}
                    <FontAwesomeIcon
                      icon={faSpinner}
                      class="w-3 h-3 animate-spin"
                    />
                  {:else}
                    <FontAwesomeIcon icon={faCheck} class="w-3 h-3" />
                  {/if}
                  Save
                </button>
                <button
                  type="button"
                  onclick={() => (browserCountryCode =
                    savedBrowserCountryCode)}
                  class="px-3 py-1 text-xs border border-[var(--dash-border)] rounded-md text-[var(--dash-text)] hover:bg-[var(--dash-bg)] transition-colors"
                >
                  Cancel
                </button>
              {/if}
              {#if isSavingBrowserCountry && !browserCountryDirty}
                <FontAwesomeIcon
                  icon={faSpinner}
                  class="w-3 h-3 text-[var(--dash-text-muted)] animate-spin"
                />
              {/if}
            </div>
            <p class="text-xs text-[var(--dash-text-muted)] mt-2">
              The country the scraper will appear to browse from. Set this to
              match your actual location to avoid your account being flagged for
              logging in from unusual locations. If empty, your profile's
              country is used.
            </p>

            <!-- Advanced: browser fingerprint toggle -->
            <button
              type="button"
              onclick={() => (showAdvancedBrowser = !showAdvancedBrowser)}
              class="mt-3 flex items-center gap-1.5 text-xs text-[var(--dash-text-muted)] hover:text-[var(--dash-text-secondary)] transition-colors"
            >
              {#if showAdvancedBrowser}
                <FontAwesomeIcon icon={faChevronDown} class="w-2.5 h-2.5" />
              {:else}
                <FontAwesomeIcon icon={faChevronRight} class="w-2.5 h-2.5" />
              {/if}
              Advanced
            </button>

            {#if showAdvancedBrowser}
              <div
                class="mt-3 pt-3 border-t border-[var(--dash-border)] space-y-3"
              >
                <div>
                  <label
                    for="browser_language"
                    class="block text-xs font-medium text-[var(--dash-text-secondary)] mb-1"
                  >
                    Language
                  </label>
                  <input
                    type="text"
                    id="browser_language"
                    bind:value={browserLanguage}
                    placeholder={defaultBrowserLanguage}
                    class="w-full px-2.5 py-1.5 text-sm border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
                  />
                  {#if !browserLanguage}
                    <p class="text-xs text-[var(--dash-text-muted)] mt-0.5">
                      Defaults to <span class="font-mono">{
                        defaultBrowserLanguage
                      }</span> based on selected country
                    </p>
                  {/if}
                </div>

                <div>
                  <label
                    for="browser_timezone"
                    class="block text-xs font-medium text-[var(--dash-text-secondary)] mb-1"
                  >
                    Timezone
                  </label>
                  <input
                    type="text"
                    id="browser_timezone"
                    bind:value={browserTimezone}
                    placeholder={defaultBrowserTimezone}
                    class="w-full px-2.5 py-1.5 text-sm border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
                  />
                  {#if !browserTimezone}
                    <p class="text-xs text-[var(--dash-text-muted)] mt-0.5">
                      Defaults to <span class="font-mono">{
                        defaultBrowserTimezone
                      }</span> based on selected country
                    </p>
                  {/if}
                </div>

                <div>
                  <label
                    for="browser_user_agent"
                    class="block text-xs font-medium text-[var(--dash-text-secondary)] mb-1"
                  >
                    User Agent
                  </label>
                  <input
                    type="text"
                    id="browser_user_agent"
                    bind:value={browserUserAgent}
                    placeholder="Auto-detected or random"
                    class="w-full px-2.5 py-1.5 text-xs font-mono border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
                  />
                  {#if !browserUserAgent}
                    <p class="text-xs text-[var(--dash-text-muted)] mt-0.5">
                      Auto-detected from your browser, or GoLogin generates a
                      random one
                    </p>
                  {/if}
                </div>

                {#if browserFingerprintDirty}
                  <div class="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onclick={saveBrowserFingerprint}
                      disabled={isSavingBrowserFingerprint}
                      class="px-3 py-1 text-xs bg-[var(--dash-primary)] text-white rounded-md hover:bg-[var(--dash-primary-hover)] transition-colors disabled:opacity-50 flex items-center gap-1"
                    >
                      {#if isSavingBrowserFingerprint}
                        <FontAwesomeIcon
                          icon={faSpinner}
                          class="w-3 h-3 animate-spin"
                        />
                      {:else}
                        <FontAwesomeIcon icon={faCheck} class="w-3 h-3" />
                      {/if}
                      Save
                    </button>
                    <button
                      type="button"
                      onclick={resetBrowserFingerprint}
                      class="px-3 py-1 text-xs border border-[var(--dash-border)] rounded-md text-[var(--dash-text)] hover:bg-[var(--dash-bg)] transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                {/if}
                {#if               isSavingBrowserFingerprint &&
                !browserFingerprintDirty}
                  <FontAwesomeIcon
                    icon={faSpinner}
                    class="w-3 h-3 text-[var(--dash-text-muted)] animate-spin"
                  />
                {/if}
              </div>
            {/if}
          </div>
        {/if}

        <!-- Keep Minimized (local/tunnel mode only) -->
        {#if           savedBrowserProvider === "local" ||
            (!savedBrowserProvider &&
              data.browserProvider === "tunnel")}
          <div class="mt-4 pt-4 border-t border-[var(--dash-border)]">
            <div class="flex items-center flex-wrap gap-3">
              <label class="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  bind:checked={keepMinimized}
                  class="w-4 h-4 rounded border-[var(--dash-border)] text-[var(--dash-primary)] focus:ring-[var(--dash-primary)]"
                />
                <span class="text-sm text-[var(--dash-text-secondary)]"
                >Keep Chrome minimized during scraping</span>
              </label>
              {#if keepMinimizedDirty}
                <div class="flex items-center gap-2">
                  <button
                    type="button"
                    onclick={saveKeepMinimized}
                    disabled={isSavingKeepMinimized}
                    class="px-3 py-1 text-xs bg-[var(--dash-primary)] text-white rounded-md hover:bg-[var(--dash-primary-hover)] transition-colors disabled:opacity-50 flex items-center gap-1"
                  >
                    {#if isSavingKeepMinimized}
                      <FontAwesomeIcon
                        icon={faSpinner}
                        class="w-3 h-3 animate-spin"
                      />
                    {:else}
                      <FontAwesomeIcon icon={faCheck} class="w-3 h-3" />
                    {/if}
                    Save
                  </button>
                  <button
                    type="button"
                    onclick={() => (keepMinimized = savedKeepMinimized)}
                    class="px-3 py-1 text-xs border border-[var(--dash-border)] rounded-md text-[var(--dash-text)] hover:bg-[var(--dash-bg)] transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              {/if}
            </div>
            <p class="text-xs text-[var(--dash-text-muted)] mt-2">
              When enabled, Chrome is automatically minimized while the scraper
              runs. Disable to watch the browser in real-time.
            </p>
          </div>
        {/if}
        {/if}
      </div>
    </div>
  </div>

  <!-- Browser View toggle button -->
  <button
    onclick={() => (showBrowser = !showBrowser)}
    class="w-full p-4 border-2 border-dashed border-[var(--dash-border)] rounded-lg text-[var(--dash-text-secondary)] hover:text-[var(--dash-text)] hover:border-[var(--dash-text-secondary)] transition-colors flex items-center justify-center gap-2"
  >
    <FontAwesomeIcon icon={faEye} class="w-4 h-4" />
    <span>{showBrowser ? "Hide" : "Show"} Browser View</span>
  </button>

  <!-- Browser View popup -->
  {#if showBrowser}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="fixed inset-0 z-50 flex items-center justify-center p-4"
      onkeydown={(e) => {
        if (e.key === "Escape") {
          showBrowser = false;
          if (screencastEnabled) toggleScreencast();
        }
      }}
    >
      <!-- Backdrop -->
      <div
        class="absolute inset-0 bg-black/60"
        onclick={() => {
          showBrowser = false;
          if (screencastEnabled) toggleScreencast();
        }}
        role="presentation"
      ></div>
      <!-- Popup content -->
      <div
        class="relative bg-[var(--dash-card)] rounded-lg border border-[var(--dash-border)] overflow-hidden shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col"
      >
        <div
          class="flex items-center justify-between p-4 border-b border-[var(--dash-border)]"
        >
          <div class="flex items-center gap-2">
            <FontAwesomeIcon
              icon={isCloudMode ? faCloud : faDesktop}
              class="w-4 h-4 text-[var(--dash-text-secondary)]"
            />
            <h2 class="font-medium text-[var(--dash-text)]">Browser View</h2>
            {#if isCloudMode}
              <span
                class="text-xs text-[var(--dash-text-muted)] bg-[var(--dash-bg)] px-2 py-0.5 rounded"
              >
                Cloud
              </span>
            {/if}
            {#if isTunnelMode}
              <span
                class="text-xs text-[var(--dash-text-muted)] bg-[var(--dash-bg)] px-2 py-0.5 rounded"
              >
                Desktop
              </span>
            {/if}
          </div>
          <div class="flex items-center gap-2">
            {#if isBlocked}
              <span
                class="text-sm text-[var(--dash-warning)] bg-[var(--dash-warning-light)] px-2 py-1 rounded"
              >
                Action needed
              </span>
            {/if}
            {#if isTunnelMode}
              <button
                onclick={toggleScreencast}
                class="
                  px-2 py-1 text-xs rounded transition-colors {screencastEnabled
                  ? 'bg-[var(--dash-primary)] text-white'
                  : 'bg-[var(--dash-bg)] text-[var(--dash-text-secondary)] hover:text-[var(--dash-text)]'}
                "
                title={screencastEnabled
                  ? "Disable live view (reduces latency)"
                  : "Enable live view (streams from desktop browser)"}
              >
                <FontAwesomeIcon icon={faEye} class="w-3 h-3 mr-1" />
                {screencastEnabled ? "Live" : "View"}
              </button>
            {/if}
            {#if isCloudMode && liveUrl}
              <a
                href={liveUrl}
                target="_blank"
                rel="noopener"
                class="p-1 text-[var(--dash-text-secondary)] hover:text-[var(--dash-primary)] transition-colors"
                title="Open in new tab"
              >
                <FontAwesomeIcon icon={faExternalLinkAlt} class="w-4 h-4" />
              </a>
            {/if}
            <button
              onclick={() => {
                showBrowser = false;
                if (screencastEnabled) toggleScreencast();
              }}
              class="p-1 text-[var(--dash-text-secondary)] hover:text-[var(--dash-text)] transition-colors"
            >
              <FontAwesomeIcon icon={faTimes} class="w-4 h-4" />
            </button>
          </div>
        </div>
        <div class="relative w-full" style="padding-bottom: 56.25%">
          {#if screencastEnabled && screencastSrc}
            <img
              src={screencastSrc}
              alt="Live browser view"
              class="absolute inset-0 w-full h-full object-contain bg-black"
            />
          {:else if screencastEnabled}
            <div
              class="absolute inset-0 flex items-center justify-center bg-[var(--dash-bg)]"
            >
              <div class="text-center">
                <FontAwesomeIcon
                  icon={faSpinner}
                  class="w-6 h-6 text-[var(--dash-text-muted)] animate-spin mb-2"
                />
                <p class="text-sm text-[var(--dash-text-muted)]">
                  Starting live view...
                </p>
              </div>
            </div>
          {:else if browserViewUrl}
            <iframe
              src={browserViewUrl}
              class="absolute inset-0 w-full h-full border-0"
              title="Browser view for manual intervention"
            ></iframe>
          {:else if isTunnelMode}
            <div
              class="absolute inset-0 flex items-center justify-center bg-[var(--dash-bg)]"
            >
              <div class="text-center">
                <FontAwesomeIcon
                  icon={faDesktop}
                  class="w-6 h-6 text-[var(--dash-text-muted)] mb-2"
                />
                {#if screencastError}
                  <p class="text-sm text-[var(--dash-error)]">
                    {screencastError}
                  </p>
                  <p class="text-xs text-[var(--dash-text-muted)] mt-1">
                    Check that the desktop app is connected
                  </p>
                {:else}
                  <p class="text-sm text-[var(--dash-text-muted)]">
                    Browser running on your desktop
                  </p>
                  <p class="text-xs text-[var(--dash-text-muted)] mt-1">
                    Click "View" to enable live streaming
                  </p>
                {/if}
              </div>
            </div>
          {:else}
            <div
              class="absolute inset-0 flex items-center justify-center bg-[var(--dash-bg)]"
            >
              <div class="text-center">
                <FontAwesomeIcon
                  icon={faSpinner}
                  class="w-6 h-6 text-[var(--dash-text-muted)] animate-spin mb-2"
                />
                <p class="text-sm text-[var(--dash-text-muted)]">
                  Starting cloud browser...
                </p>
              </div>
            </div>
          {/if}
        </div>
        <div class="p-3 bg-[var(--dash-bg)] border-t border-[var(--dash-border)]">
          {#if isBlocked}
            <div class="flex items-center justify-between">
              <p class="text-sm text-[var(--dash-text-secondary)]">
                {#if isMagicLink}
                  Paste the login link from your email below and click Navigate,
                  then click Continue.
                {:else}
                  Complete the required action (login, CAPTCHA, or verification)
                  in the browser above, then click Continue.
                {/if}
              </p>
              <div class="flex items-center gap-2 ml-4">
                <button
                  onclick={() => sendFeedback("continue")}
                  disabled={isSendingFeedback}
                  class="flex items-center gap-2 px-4 py-2 bg-[var(--dash-success)] text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  {#if isSendingFeedback}
                    <FontAwesomeIcon
                      icon={faSpinner}
                      class="w-3 h-3 animate-spin"
                    />
                  {:else}
                    <FontAwesomeIcon icon={faCheck} class="w-3 h-3" />
                  {/if}
                  <span>Continue</span>
                </button>
                <button
                  onclick={() => sendFeedback("skip")}
                  disabled={isSendingFeedback}
                  class="flex items-center gap-2 px-3 py-2 bg-[var(--dash-card)] text-[var(--dash-text)] border border-[var(--dash-border)] rounded-lg hover:bg-[var(--dash-border)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  title="Skip current action"
                >
                  <FontAwesomeIcon icon={faForward} class="w-3 h-3" />
                  <span>Skip</span>
                </button>
              </div>
            </div>
          {:else if isRunning}
            <p class="text-sm text-[var(--dash-text-secondary)]">
              Watch the scrape progress. You may need to intervene if a CAPTCHA or
              login is required.
            </p>
          {:else}
            <p class="text-sm text-[var(--dash-text-secondary)]">
              Browser session view. Start a scrape to see activity.
            </p>
          {/if}
          {#if isRunning || isBlocked}
            <!-- Navigate URL (for magic link login) -->
            <div
              class="flex items-center gap-2 mt-2 pt-2 border-t border-[var(--dash-border)]"
            >
              <input
                type="url"
                bind:value={navigateUrlValue}
                placeholder="Paste login URL from email"
                disabled={isNavigating}
                onkeydown={(e) => {
                  if (e.key === "Enter") sendNavigateUrl();
                }}
                class="flex-1 px-3 py-1.5 text-sm bg-[var(--dash-card)] text-[var(--dash-text)] border border-[var(--dash-border)] rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--dash-primary)] disabled:opacity-50 {isMagicLink ? 'ring-1 ring-[var(--dash-warning)]' : ''}"
              />
              <button
                onclick={() => sendNavigateUrl()}
                disabled={isNavigating || !navigateUrlValue.trim()}
                class="px-3 py-1.5 text-sm {isMagicLink ? 'bg-[var(--dash-primary)] text-white' : 'bg-[var(--dash-card)] text-[var(--dash-text)] border border-[var(--dash-border)]'} rounded-lg hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Open URL in the scraper browser"
              >
                {#if isNavigating}
                  <FontAwesomeIcon
                    icon={faSpinner}
                    class="w-3 h-3 animate-spin"
                  />
                {:else}
                  Navigate
                {/if}
              </button>
              {#if navigateUrlMessage}
                <span class="text-xs text-[var(--dash-text-muted)]">{
                  navigateUrlMessage
                }</span>
              {/if}
            </div>
            <!-- Type text into browser (for 2FA codes on mobile) -->
            <div
              class="flex items-center gap-2 mt-2 pt-2 border-t border-[var(--dash-border)]"
            >
              <input
                type="text"
                bind:value={typeTextValue}
                placeholder="Type text into browser (2FA code, etc.)"
                disabled={isTypingText}
                onkeydown={(e) => {
                  if (e.key === "Enter") sendTypeText(true);
                }}
                class="flex-1 px-3 py-1.5 text-sm bg-[var(--dash-card)] text-[var(--dash-text)] border border-[var(--dash-border)] rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--dash-primary)] disabled:opacity-50"
              />
              <button
                onclick={() => sendTypeText(false)}
                disabled={isTypingText || !typeTextValue.trim()}
                class="px-3 py-1.5 text-sm bg-[var(--dash-card)] text-[var(--dash-text)] border border-[var(--dash-border)] rounded-lg hover:bg-[var(--dash-border)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Type text without submitting"
              >
                {#if isTypingText}
                  <FontAwesomeIcon
                    icon={faSpinner}
                    class="w-3 h-3 animate-spin"
                  />
                {:else}
                  Type
                {/if}
              </button>
              <button
                onclick={() => sendTypeText(true)}
                disabled={isTypingText || !typeTextValue.trim()}
                class="px-3 py-1.5 text-sm bg-[var(--dash-primary)] text-white rounded-lg hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Type text and press Enter"
              >
                Send
              </button>
              {#if typeTextMessage}
                <span class="text-xs text-[var(--dash-text-muted)]">{
                  typeTextMessage
                }</span>
              {/if}
            </div>
          {/if}
        </div>
      </div>
    </div>
  {/if}

  <!-- Runs History -->
  <div
    class="bg-[var(--dash-card)] rounded-lg border border-[var(--dash-border)]"
  >
    <div
      class="flex items-center gap-2 p-4 border-b border-[var(--dash-border)]"
    >
      <FontAwesomeIcon
        icon={faHistory}
        class="w-4 h-4 text-[var(--dash-text-secondary)]"
      />
      <h2 class="font-medium text-[var(--dash-text)]">Run History</h2>
    </div>

    {#if runs.length === 0}
      <div class="p-8 text-center text-[var(--dash-text-secondary)]">
        <p>No runs yet. Click "Run Scrape" to start.</p>
      </div>
    {:else}
      <div class="divide-y divide-[var(--dash-border)]">
        {#each runs as run (run.id)}
          <div class="bg-[var(--dash-card)]">
            <!-- Run header (clickable) -->
            <button
              onclick={() => toggleRunExpanded(run.id)}
              class="w-full flex items-center gap-3 p-4 hover:bg-[var(--dash-bg)] transition-colors text-left"
            >
              {#if expandedRunId === run.id}
                <FontAwesomeIcon
                  icon={faChevronDown}
                  class="w-3 h-3 text-[var(--dash-text-muted)]"
                />
              {:else}
                <FontAwesomeIcon
                  icon={faChevronRight}
                  class="w-3 h-3 text-[var(--dash-text-muted)]"
                />
              {/if}

              <div
                class={`w-6 h-6 rounded-full flex items-center justify-center ${
                  run.status === "running" || run.status === "queued"
                    ? "bg-[var(--dash-primary-light)]"
                    : run.status === "success"
                    ? "bg-[var(--dash-success-light)]"
                    : run.status === "blocked" ||
                        run.status === "partial"
                    ? "bg-[var(--dash-warning-light)]"
                    : "bg-[var(--dash-error-light)]"
                }`}
              >
                {#key run.status}
                  <FontAwesomeIcon
                    icon={getRunStatusIcon(run.status)}
                    class={`w-3 h-3 ${getRunStatusColor(run.status)} ${
                      run.status === "running" ||
                        run.status === "queued"
                        ? "animate-spin"
                        : ""
                    }`}
                  />
                {/key}
              </div>

              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <span
                    class={`font-medium capitalize ${
                      getRunStatusColor(run.status)
                    }`}
                  >
                    {run.status}
                  </span>
                  {#if run.jobs_found !== null}
                    <span class="text-sm text-[var(--dash-text-secondary)]">
                      • {run.jobs_found} jobs
                    </span>
                  {/if}
                  {#if                 run.error_message && run.status !== "success"}
                    <span
                      class="text-sm text-[var(--dash-text-muted)] truncate"
                    >
                      • {run.error_message}
                    </span>
                  {/if}
                </div>
                <div class="text-sm text-[var(--dash-text-muted)]">
                  {formatRelativeTime(run.started_at)}
                  <span class="text-[var(--dash-text-muted)]">•</span>
                  <span class="capitalize">{run.triggered_by}</span>
                </div>
              </div>
            </button>

            <!-- Expanded details (tabs: Items / Logs) -->
            {#if expandedRunId === run.id}
              <div
                class="border-t border-[var(--dash-border)] bg-[var(--dash-bg)]"
              >
                <!-- Tab buttons -->
                <div class="flex border-b border-[var(--dash-border)]">
                  <button
                    onclick={() => {
                      runTabView[run.id] = "jobs";
                      scrollJobsToProcessing(run.id);
                    }}
                    class={`px-4 py-2 text-sm font-medium transition-colors ${
                      !runTabView[run.id] ||
                        runTabView[run.id] === "jobs"
                        ? "text-[var(--dash-primary)] border-b-2 border-[var(--dash-primary)]"
                        : "text-[var(--dash-text-secondary)] hover:text-[var(--dash-text)]"
                    }`}
                  >
                    Jobs
                    {#if runItems[run.id]?.stats}
                      <span class="ml-1 text-xs text-[var(--dash-text-muted)]">
                        ({runItems[run.id].stats.completed}/{
                          runItems[run.id].stats.total
                        })
                      </span>
                    {/if}
                  </button>
                  <button
                    onclick={() => {
                      runTabView[run.id] = "logs";
                      logAutoScroll[run.id] = true;
                      scrollLogToBottom(run.id);
                    }}
                    class={`px-4 py-2 text-sm font-medium transition-colors ${
                      runTabView[run.id] === "logs"
                        ? "text-[var(--dash-primary)] border-b-2 border-[var(--dash-primary)]"
                        : "text-[var(--dash-text-secondary)] hover:text-[var(--dash-text)]"
                    }`}
                  >
                    Logs
                  </button>
                </div>

                <div class="p-4">
                  <!-- Jobs view -->
                  {#if               !runTabView[run.id] ||
                runTabView[run.id] === "jobs"}
                    <div class="flex items-center justify-between mb-2">
                      <span class="text-sm font-medium text-[var(--dash-text)]"
                      >Discovered Jobs</span>
                      {#if loadingItems[run.id]}
                        <FontAwesomeIcon
                          icon={faSpinner}
                          class="w-3 h-3 text-[var(--dash-text-muted)] animate-spin"
                        />
                      {/if}
                    </div>

                    <!-- Stats bar -->
                    {#if runItems[run.id]?.stats}
                      {@const stats = runItems[run.id].stats}
                      <div class="flex gap-3 mb-3 text-xs">
                        <span class="text-[var(--dash-text-muted)]">{
                            stats.total
                          } total</span>
                        {#if stats.completed > 0}
                          <span class="text-[var(--dash-success)]">{
                              stats.completed
                            } imported</span>
                        {/if}
                        {#if stats.processing > 0}
                          <span class="text-[var(--dash-primary)]">{
                              stats.processing
                            } processing</span>
                        {/if}
                        {#if stats.pending > 0}
                          <span class="text-[var(--dash-text-muted)]">{
                              stats.pending
                            } pending</span>
                        {/if}
                        {#if stats.skipped > 0}
                          <span class="text-[var(--dash-warning)]">{
                              stats.skipped
                            } skipped</span>
                        {/if}
                        {#if stats.error > 0}
                          <span class="text-[var(--dash-error)]">{stats.error}
                            errors</span>
                        {/if}
                      </div>
                    {/if}

                    <div
                      data-jobs-container={run.id}
                      class="bg-[var(--dash-card)] rounded border border-[var(--dash-border)] max-h-80 overflow-y-auto"
                    >
                      {#if                 !runItems[run.id]?.items ||
                  runItems[run.id].items.length === 0}
                        <div
                          class="p-4 text-sm text-[var(--dash-text-muted)] text-center"
                        >
                          {#if loadingItems[run.id]}
                            Loading jobs...
                          {:else}
                            No jobs discovered yet
                          {/if}
                        </div>
                      {:else}
                        <div class="divide-y divide-[var(--dash-border)]">
                          {#each runItems[run.id].items as item (item.id)}
                            <div
                              data-item-status={item.status}
                              class={`${getItemStatusBg(item.status)}`}
                            >
                              <!-- Item header (clickable for completed items with job details) -->
                              <button
                                type="button"
                                onclick={() =>
                                  item.jobs &&
                                  toggleItemExpanded(item.id)}
                                class={`w-full flex items-center gap-3 px-3 py-2 text-left transition-all ${
                                  item.jobs
                                    ? "cursor-pointer hover:bg-black/5 dark:hover:bg-white/5"
                                    : "cursor-default"
                                }`}
                                disabled={!item.jobs}
                              >
                                <!-- Position -->
                                <span
                                  class="text-xs text-[var(--dash-text-muted)] w-5 text-right"
                                >
                                  {item.position}
                                </span>

                                <!-- Status indicator -->
                                <div
                                  class={`w-2 h-2 rounded-full flex-shrink-0 ${
                                    item.status === "completed"
                                      ? "bg-[var(--dash-success)]"
                                      : item.status === "processing"
                                      ? "bg-[var(--dash-primary)] animate-pulse"
                                      : item.status === "skipped"
                                      ? "bg-[var(--dash-warning)]"
                                      : item.status === "error"
                                      ? "bg-[var(--dash-error)]"
                                      : "bg-[var(--dash-text-muted)]"
                                  }`}
                                >
                                </div>

                                <!-- Job info -->
                                <div class="flex-1 min-w-0">
                                  <div class="flex items-center gap-2">
                                    {#if                           item.job_id &&
                            item.status ===
                              "completed"}
                                      <span
                                        class="text-sm font-medium text-[var(--dash-primary)] truncate"
                                      >
                                        {
                                          item.jobs?.title ||
                                            item.title ||
                                            "Untitled"
                                        }
                                      </span>
                                    {:else}
                                      <span
                                        class="text-sm font-medium text-[var(--dash-text)] truncate"
                                      >
                                        {
                                          item.title ||
                                            "Untitled"
                                        }
                                      </span>
                                    {/if}
                                    {#if                           item.was_created === true}
                                      <span
                                        class="text-xs px-1.5 py-0.5 rounded bg-[var(--dash-success)] text-white"
                                      >new</span>
                                    {:else if                           item.was_created ===
                              false &&
                            item.status ===
                              "completed"}
                                      <span
                                        class="text-xs px-1.5 py-0.5 rounded bg-[var(--dash-bg)] text-[var(--dash-text-muted)]"
                                      >updated</span>
                                    {/if}
                                  </div>
                                  <div
                                    class="flex items-center gap-2 text-xs text-[var(--dash-text-secondary)]"
                                  >
                                    {#if                           item.jobs?.company ||
                            item.company}
                                      <span class="flex items-center gap-1">
                                        <FontAwesomeIcon
                                          icon={faBuilding}
                                          class="w-3 h-3"
                                        />
                                        {
                                          item.jobs?.company ||
                                            item.company
                                        }
                                      </span>
                                    {/if}
                                    {#if                           item.jobs
                            ?.office_location ||
                            item.location}
                                      <span class="flex items-center gap-1">
                                        <FontAwesomeIcon
                                          icon={faMapMarkerAlt}
                                          class="w-3 h-3"
                                        />
                                        {
                                          item.jobs
                                            ?.office_location ||
                                            item.location
                                        }
                                      </span>
                                    {/if}
                                  </div>
                                  {#if                         item.status_message &&
                          (item.status === "skipped" ||
                            item.status === "error" ||
                            item.status ===
                              "cancelled")}
                                    <div
                                      class={`text-xs mt-0.5 ${
                                        getItemStatusColor(
                                          item.status,
                                        )
                                      }`}
                                    >
                                      {item.status_message}
                                    </div>
                                  {/if}
                                </div>

                                <!-- Status badge and expand icon -->
                                <span
                                  class={`text-xs capitalize ${
                                    getItemStatusColor(item.status)
                                  }`}
                                >
                                  {item.status}
                                </span>
                                {#if item.jobs}
                                  {#if expandedItemId === item.id}
                                    <FontAwesomeIcon
                                      icon={faChevronDown}
                                      class="w-3 h-3 text-[var(--dash-text-muted)]"
                                    />
                                  {:else}
                                    <FontAwesomeIcon
                                      icon={faChevronRight}
                                      class="w-3 h-3 text-[var(--dash-text-muted)]"
                                    />
                                  {/if}
                                {/if}
                              </button>

                              <!-- Expanded job details -->
                              {#if                     expandedItemId === item.id &&
                      item.jobs}
                                {@const job = item.jobs}
                                <div
                                  class="border-t border-[var(--dash-border)] p-4 space-y-4 {getItemStatusBg(item.status)}"
                                >
                                  <!-- Job Info Grid -->
                                  <div
                                    class="grid grid-cols-1 md:grid-cols-3 gap-4"
                                  >
                                    {#if                         job.salary_min ||
                          job.salary_max}
                                      <div>
                                        <p
                                          class="text-xs text-[var(--dash-text-secondary)] uppercase tracking-wide mb-1"
                                        >
                                          Salary
                                        </p>
                                        <p
                                          class="font-medium text-[var(--dash-text)] flex items-center gap-1"
                                        >
                                          <FontAwesomeIcon
                                            icon={faMoneyBillWave}
                                            class="w-4 h-4 text-[var(--dash-success)]"
                                          />
                                          {
                                            formatSalary(
                                              job.salary_min,
                                              job.salary_max,
                                              job.salary_currency,
                                              job.salary_period,
                                            )
                                          }
                                        </p>
                                      </div>
                                    {/if}
                                    {#if                         job.job_types &&
                          Array.isArray(
                            job.job_types,
                          ) && job.job_types.length > 0}
                                      <div>
                                        <p
                                          class="text-xs text-[var(--dash-text-secondary)] uppercase tracking-wide mb-1"
                                        >
                                          Job Type
                                        </p>
                                        <p
                                          class="font-medium text-[var(--dash-text)]"
                                        >
                                          {
                                            job.job_types.map(
                                              formatJobType,
                                            ).join(", ")
                                          }
                                        </p>
                                      </div>
                                    {/if}
                                    {#if                         job.work_location &&
                          Array.isArray(
                            job.work_location,
                          ) &&
                          job.work_location.length > 0}
                                      <div>
                                        <p
                                          class="text-xs text-[var(--dash-text-secondary)] uppercase tracking-wide mb-1"
                                        >
                                          Work Location
                                        </p>
                                        <p
                                          class="font-medium text-[var(--dash-text)]"
                                        >
                                          {
                                            job.work_location.map(
                                              formatWorkLocation,
                                            ).join(", ")
                                          }
                                        </p>
                                      </div>
                                    {/if}
                                  </div>

                                  <!-- Skills -->
                                  {#if                       job.skills_required &&
                        Array.isArray(
                          job.skills_required,
                        ) &&
                        job.skills_required.length > 0}
                                    <div>
                                      <p
                                        class="text-xs text-[var(--dash-text-secondary)] uppercase tracking-wide mb-2"
                                      >
                                        Required Skills
                                      </p>
                                      <div class="flex flex-wrap gap-1">
                                        {#each                           job.skills_required.slice(
                            0,
                            10,
                          ) as
                                          skill
                                        }
                                          <span
                                            class="px-2 py-1 text-xs bg-[var(--dash-bg)] text-[var(--dash-text)] rounded"
                                          >
                                            {skill}
                                          </span>
                                        {/each}
                                        {#if                           job.skills_required
                            .length > 10}
                                          <span
                                            class="px-2 py-1 text-xs text-[var(--dash-text-muted)]"
                                          >
                                            +{
                                              job.skills_required
                                                .length - 10
                                            } more
                                          </span>
                                        {/if}
                                      </div>
                                    </div>
                                  {/if}

                                  {#if                       job.skills_preferred &&
                        Array.isArray(
                          job.skills_preferred,
                        ) &&
                        job.skills_preferred.length > 0}
                                    <div>
                                      <p
                                        class="text-xs text-[var(--dash-text-secondary)] uppercase tracking-wide mb-2"
                                      >
                                        Preferred Skills
                                      </p>
                                      <div class="flex flex-wrap gap-1">
                                        {#each                           job.skills_preferred.slice(
                            0,
                            10,
                          ) as
                                          skill
                                        }
                                          <span
                                            class="px-2 py-1 text-xs bg-[var(--dash-primary-light)] text-[var(--dash-primary)] rounded"
                                          >
                                            {skill}
                                          </span>
                                        {/each}
                                        {#if                           job.skills_preferred
                            .length > 10}
                                          <span
                                            class="px-2 py-1 text-xs text-[var(--dash-text-muted)]"
                                          >
                                            +{
                                              job.skills_preferred
                                                .length - 10
                                            } more
                                          </span>
                                        {/if}
                                      </div>
                                    </div>
                                  {/if}

                                  <!-- Description Preview -->
                                  {#if job.job_description}
                                    <div>
                                      <p
                                        class="text-xs text-[var(--dash-text-secondary)] uppercase tracking-wide mb-1"
                                      >
                                        Description
                                      </p>
                                      <p
                                        class="text-sm text-[var(--dash-text)] whitespace-pre-wrap"
                                      >
                                        {
                                          truncateText(
                                            job.job_description,
                                            500,
                                          )
                                        }
                                      </p>
                                      {#if                         job.job_description.length >
                          500}
                                        <a
                                          href="/dashboard/jobs/{job.id}"
                                          class="text-sm text-[var(--dash-primary)] hover:underline mt-2 inline-block"
                                        >
                                          View full description →
                                        </a>
                                      {/if}
                                    </div>
                                  {/if}

                                  <!-- Footer with links -->
                                  <div
                                    class="pt-2 border-t border-[var(--dash-border)] flex items-center gap-4 text-xs text-[var(--dash-text-muted)]"
                                  >
                                    <span>ID: {job.id}</span>
                                    <a
                                      href="/dashboard/jobs/{job.id}"
                                      class="text-[var(--dash-primary)] hover:underline flex items-center gap-1"
                                    >
                                      <FontAwesomeIcon
                                        icon={faEye}
                                        class="w-3 h-3"
                                      />
                                      View details
                                    </a>
                                    {#if job.source_url}
                                      <a
                                        href={job.source_url}
                                        target="_blank"
                                        rel="noopener"
                                        class="hover:text-[var(--dash-primary)] flex items-center gap-1"
                                      >
                                        <FontAwesomeIcon
                                          icon={faExternalLinkAlt}
                                          class="w-3 h-3"
                                        />
                                        Source
                                      </a>
                                    {/if}
                                  </div>
                                </div>
                              {/if}
                            </div>
                          {/each}
                        </div>
                      {/if}
                    </div>
                  {:else if runTabView[run.id] === "logs"}
                    <!-- Logs view -->
                    <div class="flex items-center justify-between mb-2">
                      <div class="flex items-center gap-2">
                        <span
                          class="text-sm font-medium text-[var(--dash-text)]"
                        >Logs</span>
                        <select
                          bind:value={logLevelFilter}
                          onchange={() => {
                            // Clear and reload logs with new filter
                            runLogs[run.id] = [];
                            loadRunLogs(run.id);
                          }}
                          class="text-xs px-2 py-1 rounded border border-[var(--dash-border)] bg-[var(--dash-card)] text-[var(--dash-text)]"
                        >
                          <option value="debug">Debug</option>
                          <option value="info">Info</option>
                          <option value="warn">Warn</option>
                          <option value="error">Error</option>
                        </select>
                      </div>
                      {#if loadingLogs[run.id]}
                        <FontAwesomeIcon
                          icon={faSpinner}
                          class="w-3 h-3 text-[var(--dash-text-muted)] animate-spin"
                        />
                      {/if}
                    </div>

                    <div
                      bind:this={logContainerRefs[run.id]}
                      onscroll={(e) => handleLogScroll(run.id, e)}
                      class="bg-[var(--dash-card)] rounded border border-[var(--dash-border)] max-h-64 overflow-y-auto"
                    >
                      {#if                 !runLogs[run.id] ||
                  runLogs[run.id].length === 0}
                        <div
                          class="p-4 text-sm text-[var(--dash-text-muted)] text-center"
                        >
                          {#if loadingLogs[run.id]}
                            Loading logs...
                          {:else}
                            No logs available
                          {/if}
                        </div>
                      {:else}
                        <div class="p-2 space-y-0.5 font-mono text-xs">
                          {#each runLogs[run.id] as log (log.id)}
                            <div
                              class="flex gap-2 py-0.5 px-1 hover:bg-[var(--dash-bg)] rounded"
                            >
                              <span
                                class="text-[var(--dash-text-muted)] whitespace-nowrap"
                              >
                                {
                                  new Date(log.timestamp)
                                    .toLocaleTimeString()
                                }
                              </span>
                              <span
                                class={`uppercase w-12 ${
                                  getLogLevelColor(log.level)
                                }`}
                              >
                                {log.level}
                              </span>
                              <span class="text-[var(--dash-text)] break-all">
                                {log.message}
                              </span>
                            </div>
                          {/each}
                        </div>
                      {/if}
                    </div>
                  {/if}
                </div>
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Settings -->
  <div class="bg-[var(--dash-card)] rounded-lg border border-[var(--dash-border)]">
    <button
      type="button"
      onclick={() => toggleSection("settings")}
      class="flex items-center gap-2 w-full text-left p-4"
    >
      {#if sectionOpen.settings}
        <FontAwesomeIcon icon={faChevronDown} class="w-3 h-3 text-[var(--dash-text-muted)]" />
      {:else}
        <FontAwesomeIcon icon={faChevronRight} class="w-3 h-3 text-[var(--dash-text-muted)]" />
      {/if}
      <FontAwesomeIcon icon={faCog} class="w-4 h-4 text-[var(--dash-text-muted)]" />
      <h3 class="text-sm font-medium text-[var(--dash-text-muted)] uppercase tracking-wide">
        Settings
      </h3>
    </button>

    {#if sectionOpen.settings}
      <div class="px-4 pb-4 space-y-4">
        <div class="pt-2 border-t border-[var(--dash-border)]">
          <h4 class="text-sm font-medium text-red-500 mb-2">Danger Zone</h4>
          {#if showDeleteConfirm}
            <div class="flex items-center gap-3 flex-wrap">
              <span class="text-sm text-[var(--dash-text)]">
                Are you sure? This will permanently delete this task and all its run history.
              </span>
              <div class="flex items-center gap-2">
                <button
                  onclick={deleteTask}
                  disabled={isDeleting}
                  class="px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                >
                  {#if isDeleting}
                    <FontAwesomeIcon icon={faSpinner} class="w-3 h-3 animate-spin mr-1" />
                  {/if}
                  Yes, delete
                </button>
                <button
                  onclick={() => (showDeleteConfirm = false)}
                  class="px-3 py-1.5 text-sm border border-[var(--dash-border)] text-[var(--dash-text-secondary)] rounded hover:bg-[var(--dash-bg)]"
                >
                  Cancel
                </button>
              </div>
            </div>
          {:else}
            <button
              onclick={() => (showDeleteConfirm = true)}
              class="flex items-center gap-2 px-3 py-1.5 text-sm text-red-500 border border-red-300 dark:border-red-800 rounded hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
            >
              <FontAwesomeIcon icon={faTrash} class="w-3.5 h-3.5" />
              Delete this search task
            </button>
          {/if}
        </div>
      </div>
    {/if}
  </div>
</div>
