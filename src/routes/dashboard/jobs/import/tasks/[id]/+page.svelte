<script lang="ts">
  import type { PageData } from "./$types";
  import { onDestroy, onMount } from "svelte";
  import { goto, invalidateAll } from "$app/navigation";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import Card from "../../../../components/Card.svelte";
  import Spinner from "$lib/components/Spinner.svelte";
  import PlatformLogo from "$lib/components/PlatformLogo.svelte";
  import CategoryPill from "$lib/components/CategoryPill.svelte";
  import SearchTaskFields from "../../../components/SearchTaskFields.svelte";
  import { formatJobType, formatWorkLocation, formatSalaryRange, searchTaskDisplayName } from "$lib/format";
  import {
    faArrowLeft,
    faBuilding,
    faCalendar,
    faCheck,
    faChevronDown,
    faChevronRight,
    faCloud,
    faCog,
    faCopy,
    faDesktop,
    faEnvelope,
    faExclamationTriangle,
    faExternalLinkAlt,
    faEye,
    faEyeSlash,
    faForward,
    faHandPointer,
    faHistory,
    faMapMarkerAlt,
    faMoneyBillWave,
    faPencil,
    faCamera,
    faPlay,
    faPlus,
    faStop,
    faSync,
    faTerminal,
    faTimes,
    faTrash,
  } from "@fortawesome/free-solid-svg-icons";

  let { data }: { data: PageData } = $props();

  let searchTask = $state(data.searchTask);

  // Header editing state (note)
  let isEditingNote = $state(false);
  let editNoteInput = $state(searchTask.note ?? "");
  let isSavingHeader = $state(false);

  async function saveHeader() {
    isSavingHeader = true;
    try {
      const newNote = editNoteInput.trim();

      if (newNote !== (searchTask.note ?? "")) {
        await fetch(`/api/import-tasks/${searchTask.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ note: newNote }),
        });
        searchTask.note = newNote || null;
      }
      isEditingNote = false;
    } catch (err) {
      console.error("Failed to save header:", err);
    } finally {
      isSavingHeader = false;
    }
  }

  function cancelEditNote() {
    editNoteInput = searchTask.note ?? "";
    isEditingNote = false;
  }

  // Settings section (danger zone) — collapsed by default
  let settingsOpen = $state(
    (() => {
      const v = (data.uiPreferences as Record<string, unknown>)[
        "task_sections_settings"
      ];
      return v === undefined ? false : Boolean(v);
    })(),
  );

  function toggleSettingsSection() {
    settingsOpen = !settingsOpen;
    fetch(`/api/import-tasks/${data.searchTask.id}/ui-preferences`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task_sections_settings: settingsOpen }),
    }).catch(() => {});
  }

  // Delete task
  let isDeleting = $state(false);
  let showDeleteConfirm = $state(false);

  async function deleteTask() {
    isDeleting = true;
    try {
      const res = await fetch(`/api/import-tasks/${searchTask.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        goto("/dashboard/jobs/import/tasks");
      }
    } finally {
      isDeleting = false;
    }
  }

  // Desktop scraper connection status
  let desktopConnected = $state<boolean | null>(null);
  let connectedDeviceIds = $state<number[]>([]);
  let connectedDeviceNames = $state<string[]>([]);

  async function checkDesktopStatus() {
    try {
      const res = await fetch(`/api/tunnel?profileId=${data.profileId}`);
      const result = await res.json();
      desktopConnected = result.connected === true;
      const devices = result.devices ?? [];
      connectedDeviceIds = devices.map((d: { apiKeyId: number }) => d.apiKeyId);
      connectedDeviceNames = devices.map((d: { apiKeyName: string }) => d.apiKeyName);
    } catch {
      desktopConnected = false;
      connectedDeviceIds = [];
      connectedDeviceNames = [];
    }
  }

  // Merge API key devices with live connection status
  let devices = $derived(
    data.apiKeyDevices.map(d => ({
      ...d,
      connected: connectedDeviceIds.includes(d.apiKeyId),
    })),
  );

  let isStarting = $state(false);
  let isStopping = $state(false);
  let isSendingFeedback = $state(false);
  let feedbackSent = $state(false);
  let errorMessage = $state<string | null>(null);
  let showBrowser = $state(false);
  let showBrowserLogs = $state(false);
  let browserLogRef = $state<HTMLElement | null>(null);
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
  interface RunSettings {
    max_jobs?: number | null;
    skip_existing?: boolean;
    skip_first?: number | null;
    stop_after_duplicates?: number | null;
    browser_provider?: string | null;
  }

  interface Run {
    id: number;
    status: string;
    started_at: string;
    finished_at: string | null;
    jobs_found: number | null;
    error_message: string | null;
    triggered_by: string;
    live_url: string | null;
    settings: RunSettings | null;
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
    job: JobDetails | null;
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
      new: number;
      existing: number;
    };
  }

  let runs = $state<Run[]>([]);
  let copiedRunId = $state<number | null>(null);
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

  // Featured run = shown in the status card instead of history.
  // Stays there for the lifetime of this page session (even after completing).
  // On page load, we pick the currently active run (if any), or fall back to the
  // most recent run. Once set, it sticks.
  const activeRunStatuses = ["running", "queued", "blocked", "stopping"];
  let featuredRunId = $state<number | null>(null);
  $effect(() => {
    if (featuredRunId !== null) return; // already locked in
    const active = runs.find((r) => activeRunStatuses.includes(r.status));
    if (active) {
      featuredRunId = active.id;
    } else if (runs.length > 0) {
      featuredRunId = runs[0].id; // most recent run (runs are sorted by date desc)
    }
  });
  let featuredRun = $derived(featuredRunId !== null ? (runs.find((r) => r.id === featuredRunId) ?? null) : null);
  let historyRuns = $derived(runs.filter((r) => r.id !== featuredRunId));
  let logLevelFilter = $state<"debug" | "info" | "warn" | "error">("info");

  // Log auto-scroll: track container refs and whether user has scrolled up
  let logContainerRefs = $state<Record<number, HTMLElement | null>>({});
  let logAutoScroll = $state<Record<number, boolean>>({});

  // Reset all page state when navigating between different search tasks
  let currentSearchTaskId = $state(data.searchTask.id);
  $effect(() => {
    if (data.searchTask.id === currentSearchTaskId) return;
    currentSearchTaskId = data.searchTask.id;
    // Reset note input
    isEditingNote = false;
    editNoteInput = data.searchTask.note ?? "";
    // Reset settings section
    settingsOpen = (() => {
      const v = (data.uiPreferences as Record<string, unknown>)[
        "task_sections_settings"
      ];
      return v === undefined ? false : Boolean(v);
    })();
    // Reset transient input state
    typeTextValue = "";
    typeTextMessage = null;
    navigateUrlValue = "";
    navigateUrlMessage = null;
    errorMessage = null;

    showBrowser = false;
    liveUrl = null;
    currentRunId = null;
    runs = [];
    expandedRunId = null;
    featuredRunId = null;
    // Reload runs for the new search task
    loadRuns();
    // Restart polling if needed
    stopPolling();
    if (
      ["running", "blocked", "queued", "stopping"].includes(
        data.searchTask.status ?? "",
      )
    ) {
      startPolling();
    }
  });

  // Computed states
  let isRunning = $derived(searchTask.status === "running");
  let isBlocked = $derived(searchTask.status === "blocked");
  let isQueued = $derived(searchTask.status === "queued");
  let isStoppingStatus = $derived(searchTask.status === "stopping");
  let needsIntervention = $derived(isRunning || isBlocked);
  let hasOtherRunning = $state(data.hasOtherRunning);
  let isCloudMode = $derived(!!liveUrl);
  let isMagicLink = $derived(
    isBlocked && searchTask.status_message?.includes("login link"),
  );
  let isVerification = $derived(
    isBlocked && (
      searchTask.status_message?.includes("verification") ||
      searchTask.status_message?.includes("login link")
    ),
  );
  let verificationEmailAddress = $state(data.verificationEmailAddress);
  let copiedVerifyEmail = $state(false);

  function copyVerificationEmail() {
    if (!verificationEmailAddress) return;
    navigator.clipboard.writeText(verificationEmailAddress);
    copiedVerifyEmail = true;
    setTimeout(() => (copiedVerifyEmail = false), 2000);
  }

  // Determine if this search uses a cloud browser (GoLogin) — either per-search override or server default
  let expectsCloudBrowser = $derived(
    (searchTask as any).browser_provider === "hosted" ||
      (!(searchTask as any).browser_provider &&
        data.browserProvider === "goLogin"),
  );
  // Tunnel mode: uses desktop app browser (no VNC, no live URL by default)
  let isTunnelMode = $derived(
    (searchTask as any).browser_provider === "local" ||
      (!(searchTask as any).browser_provider &&
        data.browserProvider === "tunnel"),
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

  // Browser view mode for tunnel: "screenshot" (polling) or "vnc" (interactive)
  type BrowserViewMode = "screenshot" | "vnc";
  let browserViewMode = $state<BrowserViewMode>("screenshot");

  // VNC state (for tunnel mode — interactive browser control via noVNC)
  let vncEnabled = $state(false);
  let vncUrl = $state<string | null>(null);
  let vncError = $state<string | null>(null);
  let vncConnecting = $state(false);

  async function startVnc() {
    vncError = null;
    vncConnecting = true;

    try {
      const res = await fetch(`/api/tunnel/vnc/${data.profileId}`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Failed to start VNC" }));
        vncError = err.message || err.error || "Failed to start VNC";
        return;
      }

      const { token, profileId } = await res.json();
      const host = window.location.host;
      const encrypt = window.location.protocol === "https:" ? 1 : 0;
      const wsPath = `tunnel/vnc/${profileId}?token=${token}`;
      vncUrl = `/vnc/vnc.html?autoconnect=true&resize=scale&password=secret&host=${host}&path=${encodeURIComponent(wsPath)}&encrypt=${encrypt}`;
      vncEnabled = true;
    } catch {
      vncError = "Failed to connect to VNC";
    } finally {
      vncConnecting = false;
    }
  }

  function stopVnc() {
    vncEnabled = false;
    vncUrl = null;
  }

  function setViewMode(mode: BrowserViewMode) {
    if (mode === browserViewMode) return;
    // Stop the other mode
    if (mode === "screenshot" && vncEnabled) stopVnc();
    if (mode === "vnc") stopScreenshotPolling();
    browserViewMode = mode;
    if (mode === "vnc") startVnc();
    if (mode === "screenshot" && showBrowser) startScreenshotPolling();
  }

  // Screenshot polling state
  let screenshotSrc = $state<string | null>(null);
  let screenshotPollingInterval: ReturnType<typeof setInterval> | null = null;
  let screenshotLoading = $state(false);

  async function fetchScreenshot() {
    try {
      const res = await fetch(`/api/tunnel/screencast/${data.profileId}`);
      if (res.ok && res.status !== 204) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        if (screenshotSrc) URL.revokeObjectURL(screenshotSrc);
        screenshotSrc = url;
        screenshotLoading = false;
      }
    } catch {
      // Silently ignore — will retry on next poll
    }
  }

  function startScreenshotPolling() {
    if (screenshotPollingInterval) return;
    screenshotLoading = !screenshotSrc;
    fetchScreenshot();
    screenshotPollingInterval = setInterval(fetchScreenshot, 2000);
  }

  function stopScreenshotPolling() {
    if (screenshotPollingInterval) {
      clearInterval(screenshotPollingInterval);
      screenshotPollingInterval = null;
    }
  }

  // Interactive screenshot mode
  let interactiveMode = $state(false);
  let screenshotImgEl = $state<HTMLImageElement | null>(null);

  // Translate mouse position on the displayed image to browser viewport coordinates
  function imgToViewport(e: MouseEvent): { x: number; y: number } | null {
    const img = screenshotImgEl;
    if (!img || !img.naturalWidth || !img.naturalHeight) return null;
    const rect = img.getBoundingClientRect();
    // object-contain: image is centered with aspect ratio preserved
    const imgAspect = img.naturalWidth / img.naturalHeight;
    const boxAspect = rect.width / rect.height;
    let renderW: number, renderH: number, offsetX: number, offsetY: number;
    if (imgAspect > boxAspect) {
      // Image is wider than box — letterboxed top/bottom
      renderW = rect.width;
      renderH = rect.width / imgAspect;
      offsetX = 0;
      offsetY = (rect.height - renderH) / 2;
    } else {
      // Image is taller — pillarboxed left/right
      renderH = rect.height;
      renderW = rect.height * imgAspect;
      offsetX = (rect.width - renderW) / 2;
      offsetY = 0;
    }
    const relX = (e.clientX - rect.left - offsetX) / renderW;
    const relY = (e.clientY - rect.top - offsetY) / renderH;
    if (relX < 0 || relX > 1 || relY < 0 || relY > 1) return null;
    return { x: Math.round(relX * img.naturalWidth), y: Math.round(relY * img.naturalHeight) };
  }

  function getModifiers(e: MouseEvent | KeyboardEvent): number {
    let mod = 0;
    if (e.altKey) mod |= 1;
    if (e.ctrlKey) mod |= 2;
    if (e.metaKey) mod |= 4;
    if (e.shiftKey) mod |= 8;
    return mod;
  }

  const MOUSE_BUTTON_MAP = ["left", "middle", "right"] as const;

  function sendInput(body: Record<string, unknown>) {
    fetch(`/api/tunnel/input/${data.profileId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => {});
  }

  function handleInteractiveMouseDown(e: MouseEvent) {
    if (!interactiveMode) return;
    const pos = imgToViewport(e);
    if (!pos) return;
    e.preventDefault();
    sendInput({
      type: "rawMouseEvent",
      ...pos,
      eventType: "mousePressed",
      button: MOUSE_BUTTON_MAP[e.button] || "left",
      clickCount: e.detail,
      modifiers: getModifiers(e),
    });
  }

  function handleInteractiveMouseUp(e: MouseEvent) {
    if (!interactiveMode) return;
    const pos = imgToViewport(e);
    if (!pos) return;
    e.preventDefault();
    sendInput({
      type: "rawMouseEvent",
      ...pos,
      eventType: "mouseReleased",
      button: MOUSE_BUTTON_MAP[e.button] || "left",
      clickCount: e.detail,
      modifiers: getModifiers(e),
    });
  }

  let lastMoveTime = 0;
  function handleInteractiveMouseMove(e: MouseEvent) {
    if (!interactiveMode) return;
    // Throttle to ~30fps
    const now = Date.now();
    if (now - lastMoveTime < 33) return;
    lastMoveTime = now;
    const pos = imgToViewport(e);
    if (!pos) return;
    sendInput({
      type: "rawMouseEvent",
      ...pos,
      eventType: "mouseMoved",
      modifiers: getModifiers(e),
    });
  }

  function handleInteractiveWheel(e: WheelEvent) {
    if (!interactiveMode) return;
    const pos = imgToViewport(e);
    if (!pos) return;
    e.preventDefault();
    sendInput({
      type: "rawScrollEvent",
      ...pos,
      deltaX: e.deltaX,
      deltaY: e.deltaY,
    });
  }

  function handleInteractiveKeyDown(e: KeyboardEvent) {
    if (!interactiveMode) return;
    e.preventDefault();
    sendInput({
      type: "rawKeyEvent",
      eventType: "keyDown",
      key: e.key,
      code: e.code,
      text: e.key.length === 1 ? e.key : undefined,
      modifiers: getModifiers(e),
    });
  }

  function handleInteractiveKeyUp(e: KeyboardEvent) {
    if (!interactiveMode) return;
    e.preventDefault();
    sendInput({
      type: "rawKeyEvent",
      eventType: "keyUp",
      key: e.key,
      code: e.code,
      modifiers: getModifiers(e),
    });
  }

  // Start/stop screenshot polling when browser view opens/closes
  // Faster polling (500ms) in interactive mode, normal (2s) otherwise
  $effect(() => {
    if (showBrowser && isTunnelMode && browserViewMode === "screenshot") {
      stopScreenshotPolling();
      const interval = interactiveMode ? 500 : 2000;
      screenshotLoading = !screenshotSrc;
      fetchScreenshot();
      screenshotPollingInterval = setInterval(fetchScreenshot, interval);
    } else {
      stopScreenshotPolling();
    }
  });

  onDestroy(() => {
    if (vncEnabled) stopVnc();
    stopScreenshotPolling();
    if (screenshotSrc) URL.revokeObjectURL(screenshotSrc);
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
        return null;
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
        `/api/import-tasks/${searchTask.id}/runs?limit=10`,
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
        `/api/import-tasks/${searchTask.id}/runs/${runId}/logs?level=${logLevelFilter}`,
      );
      if (response.ok) {
        const data = await response.json();
        // Merge with any logs that polling may have added concurrently
        const existing = runLogs[runId] || [];
        if (existing.length === 0) {
          runLogs[runId] = data.logs;
        } else {
          const existingIds = new Set(existing.map((l: { id: number }) => l.id));
          const newLogs = data.logs.filter((l: { id: number }) => !existingIds.has(l.id));
          if (newLogs.length > 0) {
            runLogs[runId] = [...existing, ...newLogs];
          }
        }
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
        `/api/import-tasks/${searchTask.id}/runs/${runId}/items`,
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
    const result = formatSalaryRange(min, max, currency, period);
    return result === "Not specified" ? "" : result;
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

  async function copyRunId(runId: number) {
    try {
      await navigator.clipboard.writeText(String(runId));
      copiedRunId = runId;
      setTimeout(() => {
        copiedRunId = null;
      }, 2000);
    } catch {
      // Fallback: ignore
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
          `/api/import-tasks/${searchTask.id}/runs/${runId}/logs?level=${logLevelFilter}`;
        if (lastTimestamp) {
          url += `&after=${encodeURIComponent(lastTimestamp)}`;
        }

        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          if (data.logs.length > 0) {
            // Deduplicate by log id to prevent Svelte keyed each errors
            const existingIds = new Set(existingLogs.map((l: { id: number }) => l.id));
            const newLogs = data.logs.filter((l: { id: number }) => !existingIds.has(l.id));
            if (newLogs.length > 0) {
              runLogs[runId] = [...existingLogs, ...newLogs];
              scrollLogToBottom(runId);
            }
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

  async function startScrape() {
    // Prevent starting when device is required but not connected
    if (isTunnelMode && !desktopConnected) {
      errorMessage =
        "No device is connected. Connect the desktop app or a self-hosted tunnel before running an import.";
      return;
    }

    isStarting = true;
    errorMessage = null;

    try {
      const response = await fetch(
        `/api/import-tasks/${searchTask.id}/run`,
        {
          method: "POST",
        },
      );

      const result = await response.json();

      if (!response.ok) {
        errorMessage = result.message || "Failed to start scrape";
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

      // Queued successfully
      searchTask.status = "queued";
      searchTask.status_message = "Waiting in queue";
      currentRunId = result.runId;

      // Reload runs to show the new one
      await loadRuns();

      // Feature this run in the status card (items/logs auto-loaded by $effect)
      if (result.runId) {
        featuredRunId = result.runId;
        runTabView[result.runId] = "jobs";
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
          `/api/import-tasks/${searchTask.id}/run`,
        );
        const result = await response.json();

        if (feedbackSent && result.status !== "blocked") {
          feedbackSent = false;
        }
        searchTask.status = result.status;
        searchTask.status_message = result.statusMessage;
        searchTask.last_run = result.lastRun;
        searchTask.last_run_jobs_found = result.jobsFound;
        if (result.nextScheduledRun !== undefined) {
          searchTask.next_scheduled_run = result.nextScheduledRun;
        }
        liveUrl = result.liveUrl || null;
        currentRunId = result.currentRunId || null;

        // Update runs list
        await loadRuns();

        // Stop polling when scrape is complete (keep polling during "stopping")
        if (!["running", "blocked", "queued", "stopping"].includes(result.status)) {
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
        `/api/import-tasks/${searchTask.id}/run`,
        {
          method: "DELETE",
        },
      );

      const result = await response.json();

      if (!response.ok) {
        errorMessage = result.message || "Failed to stop scrape";
        return;
      }

      if (result.status === "removed_from_queue" || result.status === "cancelled") {
        // Immediate cancellation (was queued, not yet running)
        searchTask.status = "idle";
        searchTask.status_message = "Cancelled by user";
        stopPolling();
        showBrowser = false;
        liveUrl = null;
        await loadRuns();
        await invalidateAll();
      } else if (result.status === "cancellation_requested") {
        // Worker is still running, transition to "stopping" state
        searchTask.status = "stopping";
        searchTask.status_message = "Stopping...";
        // Keep polling — the worker will set the final status
        if (!pollInterval) startPolling();
        await loadRuns();
      }
    } catch (err) {
      errorMessage = "Failed to stop scrape";
      console.error(err);
    } finally {
      isStopping = false;
    }
  }

  let stoppingAt = $state<number | null>(null);
  let showForceStop = $state(false);
  let forceStopTimeout: ReturnType<typeof setTimeout> | null = null;

  // Show force stop button after 10 seconds in "stopping" state
  $effect(() => {
    if (searchTask.status === "stopping") {
      if (!stoppingAt) stoppingAt = Date.now();
      forceStopTimeout = setTimeout(() => { showForceStop = true; }, 10_000);
    } else {
      stoppingAt = null;
      showForceStop = false;
      if (forceStopTimeout) { clearTimeout(forceStopTimeout); forceStopTimeout = null; }
    }
    return () => { if (forceStopTimeout) clearTimeout(forceStopTimeout); };
  });

  async function forceStop() {
    errorMessage = null;
    try {
      const response = await fetch(
        `/api/import-tasks/${searchTask.id}/run?force=true`,
        { method: "DELETE" },
      );
      const result = await response.json();
      if (!response.ok) {
        errorMessage = result.message || "Failed to force stop";
        return;
      }
      searchTask.status = "idle";
      searchTask.status_message = "Force stopped by user";
      stopPolling();
      showBrowser = false;
      liveUrl = null;
      await loadRuns();
      await invalidateAll();
    } catch (err) {
      errorMessage = "Failed to force stop";
      console.error(err);
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
        `/api/import-tasks/${searchTask.id}/runs/${currentRunId}/respond`,
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
        searchTask.status = "cancelled";
        searchTask.status_message = "Cancelled by user";
        stopPolling();
        showBrowser = false;
        liveUrl = null;
        await loadRuns();
      }
      // For continue/skip, keep feedbackSent=true so buttons stay disabled
      // until the status changes from "blocked" via polling
      if (response !== "cancel") {
        feedbackSent = true;
      }
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
        `/api/import-tasks/${searchTask.id}/runs/${currentRunId}/type-text`,
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

  async function submitBrowserForm() {
    if (!currentRunId) return;
    isTypingText = true;
    typeTextMessage = null;
    try {
      const res = await fetch(
        `/api/import-tasks/${searchTask.id}/runs/${currentRunId}/type-text`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: "", submit: true }),
        },
      );
      const result = await res.json();
      if (!res.ok) {
        typeTextMessage = result.message || "Failed to submit";
        return;
      }
      typeTextMessage = "Submitted";
      setTimeout(() => { typeTextMessage = null; }, 2000);
    } catch {
      typeTextMessage = "Failed to submit";
    } finally {
      isTypingText = false;
    }
  }

  async function clearBrowserInput() {
    if (!currentRunId) return;
    isTypingText = true;
    typeTextMessage = null;
    try {
      const res = await fetch(
        `/api/import-tasks/${searchTask.id}/runs/${currentRunId}/type-text`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: "", clear: true }),
        },
      );
      const result = await res.json();
      if (!res.ok) {
        typeTextMessage = result.message || "Failed to clear";
        return;
      }
      typeTextMessage = "Cleared";
      setTimeout(() => { typeTextMessage = null; }, 2000);
    } catch {
      typeTextMessage = "Failed to clear";
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
        `/api/import-tasks/${searchTask.id}/runs/${currentRunId}/navigate-url`,
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

  let desktopPollInterval: ReturnType<typeof setInterval> | null = null;

  // Auto-load items/logs for the featured run shown in the status card
  $effect(() => {
    const run = featuredRun;
    if (!run) return;
    // Load items and logs if not already loaded
    if (!runItems[run.id] && !loadingItems[run.id]) loadRunItems(run.id);
    if (!runLogs[run.id] && !loadingLogs[run.id]) loadRunLogs(run.id);
    // Start polling if not already
    startItemPolling(run.id);
    startLogPolling(run.id);
  });

  // Auto-scroll browser popup logs to bottom
  $effect(() => {
    if (!showBrowserLogs || !featuredRunId || !browserLogRef) return;
    const logs = runLogs[featuredRunId];
    if (!logs || logs.length === 0) return;
    // Access logs.length to create a reactive dependency
    void logs.length;
    requestAnimationFrame(() => {
      if (browserLogRef) {
        browserLogRef.scrollTop = browserLogRef.scrollHeight;
      }
    });
  });

  // Reactively start/stop desktop connection polling when tunnel mode changes
  $effect(() => {
    if (isTunnelMode) {
      checkDesktopStatus();
      desktopPollInterval = setInterval(checkDesktopStatus, 15000);
    } else {
      if (desktopPollInterval) {
        clearInterval(desktopPollInterval);
        desktopPollInterval = null;
      }
      desktopConnected = null;
    }
    return () => {
      if (desktopPollInterval) {
        clearInterval(desktopPollInterval);
        desktopPollInterval = null;
      }
    };
  });

  onMount(() => {
    // Load runs history
    loadRuns();

    // Start polling if already running/blocked/queued/stopping
    if (needsIntervention || isQueued || isStoppingStatus) {
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

{#snippet runDetails(run: Run, standalone: boolean = false)}
  <div class="{standalone ? 'border border-[var(--dash-border)] rounded-lg overflow-hidden' : 'border-t border-[var(--dash-border)]'} bg-[var(--dash-bg)]">
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
            ({runItems[run.id].stats.new} new / {
              runItems[run.id].stats.total
            } total)
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

      <!-- Jobs view -->
      {#if !runTabView[run.id] || runTabView[run.id] === "jobs"}
        <div class="flex items-center justify-between px-4 py-2">
          <div class="flex items-center gap-3">
            {#if runItems[run.id]?.stats}
              {@const stats = runItems[run.id].stats}
              <div class="flex gap-3 text-xs">
                <span class="text-[var(--dash-text-muted)]">{stats.total} total</span>
                {#if stats.new > 0}
                  <span class="text-[var(--dash-success)]">{stats.new} new</span>
                {/if}
                {#if stats.existing > 0}
                  <span class="text-[var(--dash-text-secondary)]">{stats.existing} existing</span>
                {/if}
                {#if stats.processing > 0}
                  <span class="text-[var(--dash-primary)]">{stats.processing} processing</span>
                {/if}
                {#if stats.pending > 0}
                  <span class="text-[var(--dash-text-muted)]">{stats.pending} pending</span>
                {/if}
                {#if stats.skipped > 0}
                  <span class="text-[var(--dash-warning)]">{stats.skipped} skipped</span>
                {/if}
                {#if stats.error > 0}
                  <span class="text-[var(--dash-error)]">{stats.error} errors</span>
                {/if}
              </div>
            {/if}
          </div>
          {#if loadingItems[run.id]}
            <Spinner size="w-3 h-3" color="var(--dash-text-muted)" />
          {/if}
        </div>

        <div
          data-jobs-container={run.id}
          class="border-t border-[var(--dash-border)] max-h-80 overflow-y-auto"
        >
          {#if !runItems[run.id]?.items || runItems[run.id].items.length === 0}
            <div class="p-4 text-sm text-[var(--dash-text-muted)] text-center">
              {#if loadingItems[run.id]}
                Loading jobs...
              {:else if run.finished_at}
                No jobs imported
              {:else}
                No jobs discovered yet
              {/if}
            </div>
          {:else}
            <div class="divide-y divide-[var(--dash-border)]">
              {#each runItems[run.id].items as item (item.id)}
                <div
                  data-item-status={item.status}
                  class={`${getItemStatusBg(item.status)} ${expandedItemId === item.id ? 'border-l-2 border-l-[var(--dash-primary)]' : ''}`}
                >
                  <!-- Item header (clickable for completed items with job details) -->
                  <button
                    type="button"
                    onclick={() =>
                      item.job &&
                      toggleItemExpanded(item.id)}
                    class={`w-full flex items-start sm:items-center gap-2 sm:gap-3 px-3 py-2 text-left transition-all ${
                      item.job
                        ? "cursor-pointer hover:bg-black/5 dark:hover:bg-white/5"
                        : "cursor-default"
                    }`}
                    disabled={!item.job}
                  >
                    <!-- Position + status indicator -->
                    <div class="flex items-center gap-2 pt-0.5 sm:pt-0 shrink-0">
                      <span class="text-xs text-[var(--dash-text-muted)] w-5 text-right">
                        {item.position}
                      </span>
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
                    </div>

                    <!-- Job info -->
                    <div class="flex-1 min-w-0">
                      <div class="flex flex-wrap items-center gap-2">
                        {#if item.job_id && item.status === "completed"}
                          <span class="text-sm font-medium text-[var(--dash-primary)]">
                            {item.job?.title || item.title || "Untitled"}
                          </span>
                        {:else}
                          <span class="text-sm font-medium text-[var(--dash-text)]">
                            {item.title || "Untitled"}
                          </span>
                        {/if}
                        {#if item.was_created === true}
                          <span class="text-xs px-1.5 py-0.5 rounded bg-[var(--dash-success)] text-white shrink-0">new</span>
                        {:else if item.was_created === false && item.status === "completed"}
                          <span class="text-xs px-1.5 py-0.5 rounded bg-[var(--dash-bg)] text-[var(--dash-text-muted)] shrink-0">{run.settings?.skip_existing ? 'skipped' : 'updated'}</span>
                        {/if}
                        <!-- Status badge + chevron: inline on sm+, hidden here on mobile -->
                        <span
                          class={`hidden sm:inline text-xs capitalize shrink-0 ${getItemStatusColor(item.status)}`}
                        >
                          {item.status}
                        </span>
                        {#if item.job}
                          <FontAwesomeIcon
                            icon={expandedItemId === item.id ? faChevronDown : faChevronRight}
                            class="hidden sm:block w-3 h-3 text-[var(--dash-text-muted)] shrink-0"
                          />
                        {/if}
                      </div>
                      <div class="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[var(--dash-text-secondary)]">
                        {#if item.job?.company || item.company}
                          <span class="flex items-center gap-1">
                            <FontAwesomeIcon icon={faBuilding} class="w-3 h-3" />
                            {item.job?.company || item.company}
                          </span>
                        {/if}
                        {#if item.job?.office_location || item.location}
                          <span class="flex items-center gap-1">
                            <FontAwesomeIcon icon={faMapMarkerAlt} class="w-3 h-3" />
                            {item.job?.office_location || item.location}
                          </span>
                        {/if}
                        <!-- Status badge on mobile: shown in meta row -->
                        <span
                          class={`sm:hidden text-xs capitalize ${getItemStatusColor(item.status)}`}
                        >
                          {item.status}
                        </span>
                        {#if item.job}
                          <FontAwesomeIcon
                            icon={expandedItemId === item.id ? faChevronDown : faChevronRight}
                            class="sm:hidden w-3 h-3 text-[var(--dash-text-muted)]"
                          />
                        {/if}
                      </div>
                      {#if item.status_message && (item.status === "skipped" || item.status === "error" || item.status === "cancelled")}
                        <div class={`text-xs mt-0.5 ${getItemStatusColor(item.status)}`}>
                          {item.status_message}
                        </div>
                      {/if}
                    </div>
                  </button>

                  <!-- Expanded job details -->
                  {#if expandedItemId === item.id && item.job}
                    {@const job = item.job}
                    {@const workLocs = Array.isArray(job.work_location) ? job.work_location : []}
                    {@const jobTyps = Array.isArray(job.job_types) ? job.job_types : []}
                    {@const expLvls = Array.isArray(job.experience_levels) ? job.experience_levels : []}
                    {@const salaryText = formatSalary(job.salary_min, job.salary_max, job.salary_currency, job.salary_period)}
                    <div class="border-t border-[var(--dash-border)] p-3 sm:p-4 space-y-3 {getItemStatusBg(item.status)}">
                      <!-- Category pills -->
                      {#if workLocs.length > 0 || jobTyps.length > 0 || expLvls.length > 0}
                        <div class="flex items-center gap-1.5 flex-wrap">
                          {#each workLocs as loc}
                            <CategoryPill category="work_location" value={loc} />
                          {/each}
                          {#each jobTyps as type}
                            <CategoryPill category="job_type" value={type} />
                          {/each}
                          {#each expLvls as level}
                            <CategoryPill category="experience_level" value={level} />
                          {/each}
                        </div>
                      {/if}

                      <!-- Salary and date -->
                      {#if salaryText || job.date_posted || job.date_created}
                        <div class="flex items-center gap-3 text-xs sm:text-sm flex-wrap">
                          {#if salaryText}
                            <span class="flex items-center gap-1 text-[var(--dash-success)]">
                              <FontAwesomeIcon icon={faMoneyBillWave} class="w-3 h-3" />
                              {salaryText}
                            </span>
                          {/if}
                          {#if job.date_posted || job.date_created}
                            <span class="flex items-center gap-1 text-[var(--dash-text-muted)]">
                              <FontAwesomeIcon icon={faCalendar} class="w-3 h-3" />
                              {formatDate(job.date_posted || job.date_created)}
                            </span>
                          {/if}
                        </div>
                      {/if}

                      <!-- Skills -->
                      {#if job.skills_required && Array.isArray(job.skills_required) && job.skills_required.length > 0}
                        <div>
                          <p class="text-xs text-[var(--dash-text-secondary)] uppercase tracking-wide mb-2">Required Skills</p>
                          <div class="flex flex-wrap gap-1">
                            {#each job.skills_required.slice(0, 12) as skill}
                              <span class="px-2 py-1 text-xs bg-[var(--dash-bg)] text-[var(--dash-text)] rounded">{skill}</span>
                            {/each}
                            {#if job.skills_required.length > 12}
                              <span class="px-2 py-1 text-xs text-[var(--dash-text-muted)]">+{job.skills_required.length - 12} more</span>
                            {/if}
                          </div>
                        </div>
                      {/if}

                      {#if job.skills_preferred && Array.isArray(job.skills_preferred) && job.skills_preferred.length > 0}
                        <div>
                          <p class="text-xs text-[var(--dash-text-secondary)] uppercase tracking-wide mb-2">Preferred Skills</p>
                          <div class="flex flex-wrap gap-1">
                            {#each job.skills_preferred.slice(0, 12) as skill}
                              <span class="px-2 py-1 text-xs bg-[var(--dash-primary-light)] text-[var(--dash-primary)] rounded">{skill}</span>
                            {/each}
                            {#if job.skills_preferred.length > 12}
                              <span class="px-2 py-1 text-xs text-[var(--dash-text-muted)]">+{job.skills_preferred.length - 12} more</span>
                            {/if}
                          </div>
                        </div>
                      {/if}

                      <!-- Description Preview -->
                      {#if job.job_description}
                        <div>
                          <p class="text-xs text-[var(--dash-text-secondary)] uppercase tracking-wide mb-1">Description</p>
                          <p class="text-sm text-[var(--dash-text)] whitespace-pre-wrap">{truncateText(job.job_description, 300)}</p>
                        </div>
                      {/if}

                      <!-- Footer with links -->
                      <div class="pt-2 border-t border-[var(--dash-border)] flex items-center gap-4 text-xs text-[var(--dash-text-muted)]">
                        <a
                          href="/dashboard/jobs/{job.id}"
                          class="text-[var(--dash-primary)] hover:underline flex items-center gap-1"
                        >
                          <FontAwesomeIcon icon={faEye} class="w-3 h-3" />
                          View details
                        </a>
                        {#if job.source_url}
                          <a
                            href={job.source_url}
                            target="_blank"
                            rel="noopener"
                            class="hover:text-[var(--dash-primary)] flex items-center gap-1"
                          >
                            <FontAwesomeIcon icon={faExternalLinkAlt} class="w-3 h-3" />
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
        <div class="flex items-center justify-between px-4 py-2">
          <div class="flex items-center gap-2">
            <span class="text-sm font-medium text-[var(--dash-text)]">Logs</span>
            <select
              bind:value={logLevelFilter}
              onchange={() => {
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
            <Spinner size="w-3 h-3" color="var(--dash-text-muted)" />
          {/if}
        </div>

        <div
          bind:this={logContainerRefs[run.id]}
          onscroll={(e) => handleLogScroll(run.id, e)}
          class="border-t border-[var(--dash-border)] max-h-64 overflow-y-auto"
        >
          {#if !runLogs[run.id] || runLogs[run.id].length === 0}
            <div class="p-4 text-sm text-[var(--dash-text-muted)] text-center">
              {#if loadingLogs[run.id]}
                Loading logs...
              {:else}
                No logs available
              {/if}
            </div>
          {:else}
            <div class="p-2 space-y-0.5 font-mono text-xs">
              {#each runLogs[run.id] as log (log.id)}
                <div class="flex gap-2 py-0.5 px-1 hover:bg-[var(--dash-bg)] rounded">
                  <span class="text-[var(--dash-text-muted)] whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <span class={`uppercase w-12 ${getLogLevelColor(log.level)}`}>
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
{/snippet}

<svelte:head>
  <title>{searchTaskDisplayName(searchTask.job_platform?.name, searchTask.note)} - Import Tasks - Smart Job Seeker</title>
</svelte:head>

<div class="space-y-6">
  <!-- Header -->
  <div class="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
    <a
      href="/dashboard/jobs/import/tasks"
      class="flex items-center gap-2 text-[var(--dash-text-secondary)] hover:text-[var(--dash-primary)] transition-colors shrink-0"
    >
      <FontAwesomeIcon icon={faArrowLeft} class="w-4 h-4" />
      <span class="text-sm">All Import Tasks</span>
    </a>
    <span class="text-lg text-[var(--dash-text-muted)] hidden sm:inline">·</span>
    <div class="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 flex-1 min-w-0">
      <div class="flex items-center gap-3 shrink-0">
        {#if searchTask.job_platform}
          <PlatformLogo platformUrl={searchTask.job_platform.url} size="w-5 h-5" />
          <span class="text-lg font-medium text-[var(--dash-text)]">{searchTask.job_platform.name}</span>
        {/if}
        {#if !isEditingNote && !searchTask.note}
          <button
            onclick={() => { isEditingNote = true; }}
            class="p-1 text-[var(--dash-text-muted)] hover:text-[var(--dash-text)] transition-colors shrink-0"
            title="Add note"
          >
            <FontAwesomeIcon icon={faPencil} class="w-3.5 h-3.5" />
          </button>
        {/if}
      </div>
      {#if isEditingNote}
        <span class="text-lg text-[var(--dash-text-secondary)] hidden sm:inline">—</span>
        <div class="flex items-center gap-2 flex-1 min-w-0">
          <input
            type="text"
            bind:value={editNoteInput}
            autocomplete="off"
            placeholder="e.g., Remote only, senior roles"
            class="flex-1 min-w-0 px-2 py-1 bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded text-[var(--dash-text)] text-base focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
            onkeydown={(e) => {
              if (e.key === "Enter") saveHeader();
              if (e.key === "Escape") cancelEditNote();
            }}
          />
          <button
            onclick={saveHeader}
            disabled={isSavingHeader}
            class="flex items-center gap-1 px-2 py-1 bg-[var(--dash-primary)] text-white rounded text-sm hover:bg-[var(--dash-primary-hover)] transition-colors disabled:opacity-50 shrink-0"
          >
            {#if isSavingHeader}
              <Spinner size="w-3 h-3" />
            {/if}
            Save
          </button>
          <button
            onclick={cancelEditNote}
            class="px-2 py-1 text-[var(--dash-text-secondary)] hover:text-[var(--dash-text)] text-sm transition-colors shrink-0"
          >
            Cancel
          </button>
        </div>
      {:else if searchTask.note}
        <div class="flex items-center gap-2 min-w-0">
          <span class="text-lg text-[var(--dash-text-secondary)] hidden sm:inline">—</span>
          <span class="text-lg text-[var(--dash-text-secondary)] truncate">{searchTask.note}</span>
          <button
            onclick={() => { isEditingNote = true; }}
            class="p-1 text-[var(--dash-text-muted)] hover:text-[var(--dash-text)] transition-colors shrink-0"
            title="Edit note"
          >
            <FontAwesomeIcon icon={faPencil} class="w-3.5 h-3.5" />
          </button>
        </div>
      {/if}
    </div>
  </div>

  <!-- Scrape Status -->
  <Card padding="lg">
    <div class="space-y-3">
      {#if errorMessage}
        <div
          class="p-3 bg-[var(--dash-error-light)] border border-[var(--dash-error)] rounded-lg"
        >
          <p class="text-[var(--dash-error)] text-sm">{errorMessage}</p>
        </div>
      {/if}

      <div class="flex items-center gap-3 min-w-0">
          {#if searchTask.status === "queued"}
            <div
              class="w-10 h-10 rounded-full bg-[var(--dash-primary-light)] flex items-center justify-center shrink-0"
            >
              <Spinner size="w-5 h-5" color="var(--dash-primary)" />
            </div>
            <div class="min-w-0">
              <p class="font-medium text-[var(--dash-text)]">Queued</p>
              <p class="text-sm text-[var(--dash-text-secondary)]">
                Waiting in queue to start...
              </p>
            </div>
          {:else if searchTask.status === "running"}
            <div
              class="w-10 h-10 rounded-full bg-[var(--dash-primary-light)] flex items-center justify-center shrink-0"
            >
              <Spinner size="w-5 h-5" color="var(--dash-primary)" />
            </div>
            <div class="min-w-0">
              <p class="font-medium text-[var(--dash-text)]">
                {searchTask.status_message || "Running..."}
              </p>
              <p class="text-sm text-[var(--dash-text-secondary)]">
                Scraping jobs from {
                  searchTask.job_platform?.name || "platform"
                }
              </p>
            </div>
          {:else if searchTask.status === "blocked"}
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
                {searchTask.status_message}
              </p>
              <p class="text-sm text-[var(--dash-text-secondary)]">
                {#if isMagicLink}
                  Paste the login URL from your email below, then click Continue
                {:else}
                  Complete the action in the browser view, then click Continue
                {/if}
              </p>
              {#if isVerification && verificationEmailAddress}
                <div class="mt-2 flex items-center gap-2 p-2 bg-[var(--dash-bg)] rounded-lg border border-[var(--dash-border)]">
                  <FontAwesomeIcon icon={faEnvelope} class="w-3.5 h-3.5 text-[var(--dash-primary)] shrink-0" />
                  <span class="text-xs text-[var(--dash-text-secondary)]">
                    Or forward the verification email to:
                  </span>
                  <code class="text-xs font-mono text-[var(--dash-primary)] select-all break-all">{verificationEmailAddress}</code>
                  <button
                    onclick={copyVerificationEmail}
                    class="shrink-0 p-1 transition-colors {copiedVerifyEmail ? 'text-green-600' : 'text-[var(--dash-text-muted)] hover:text-[var(--dash-text)]'}"
                    title="Copy email address"
                  >
                    <FontAwesomeIcon icon={copiedVerifyEmail ? faCheck : faCopy} class="w-3 h-3" />
                  </button>
                  {#if copiedVerifyEmail}
                    <span class="text-xs text-green-600">Copied!</span>
                  {/if}
                </div>
              {/if}
            </div>
          {:else if searchTask.status === "stopping"}
            <div
              class="w-10 h-10 rounded-full bg-[var(--dash-error-light)] flex items-center justify-center shrink-0"
            >
              <Spinner size="w-5 h-5" color="var(--dash-error)" />
            </div>
            <div class="min-w-0">
              <p class="font-medium text-[var(--dash-text)]">Stopping...</p>
              <p class="text-sm text-[var(--dash-text-secondary)]">
                Waiting for the scraper to finish current action
              </p>
              {#if showForceStop}
                <button
                  onclick={forceStop}
                  class="mt-1 text-sm text-[var(--dash-error)] hover:underline"
                >
                  Force stop
                </button>
              {/if}
            </div>
          {:else if searchTask.status === "success"}
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
                {formatDate(searchTask.last_run)}
                {#if searchTask.last_run_jobs_found}
                  • {searchTask.last_run_jobs_found} jobs found
                {/if}
              </p>
            </div>
          {:else if searchTask.status === "partial"}
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
                {formatDate(searchTask.last_run)} • {searchTask.status_message}
              </p>
            </div>
          {:else if searchTask.status === "error"}
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
                {searchTask.status_message}
              </p>
            </div>
          {:else if searchTask.status === "cancelled"}
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
                {
                  searchTask.status_message ||
                    "Cancelled by user"
                }
              </p>
            </div>
          {:else if searchTask.last_run}
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
                Last run: {formatDate(searchTask.last_run)}
                {#if searchTask.last_run_jobs_found}
                  • {searchTask.last_run_jobs_found} jobs found
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
                Click "Start" to begin importing jobs
              </p>
            </div>
          {/if}
        </div>

        {#if searchTask.schedule_interval_hours}
          <div class="flex items-center gap-2 text-xs text-[var(--dash-text-secondary)] mt-2">
            <FontAwesomeIcon icon={faCalendar} class="w-3 h-3" />
            <span>
              Auto-runs every {searchTask.schedule_interval_hours}h
              {#if searchTask.next_scheduled_run}
                {@const nextRun = new Date(searchTask.next_scheduled_run)}
                {@const diffMs = nextRun.getTime() - Date.now()}
                {#if diffMs <= 0}
                  — next run due now
                {:else}
                  {@const diffMins = Math.floor(diffMs / 60000)}
                  {@const diffHours = Math.floor(diffMs / 3600000)}
                  — next run in {diffHours > 0 ? `${diffHours}h ${diffMins % 60}m` : `${diffMins}m`}
                {/if}
              {/if}
            </span>
          </div>
        {/if}

        {#if isTunnelMode && desktopConnected !== null}
          <div
            class="flex items-center gap-2 text-xs {isTunnelMode && !desktopConnected ? 'text-amber-600' : 'text-[var(--dash-text-secondary)]'}"
          >
            <span
              class="w-2 h-2 rounded-full {desktopConnected ? 'bg-green-500' : isTunnelMode ? 'bg-amber-500' : 'bg-[var(--dash-text-muted)]'}"
            ></span>
            <FontAwesomeIcon icon={faDesktop} class="w-3 h-3" />
            {#if desktopConnected}
              {connectedDeviceNames.join(", ")}
            {:else}
              No device connected — <a href="/dashboard/jobs/import/devices" class="underline hover:text-amber-700">Setup guide</a>
            {/if}
          </div>
        {/if}

        <div class="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2">
          {#if searchTask.status === "blocked"}
            <button
              onclick={() => sendFeedback("continue")}
              disabled={isSendingFeedback || feedbackSent}
              class="flex items-center justify-center sm:justify-start gap-2 px-4 py-2 bg-[var(--dash-success)] text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {#if isSendingFeedback || feedbackSent}
                <Spinner size="w-4 h-4" />
              {:else}
                <FontAwesomeIcon icon={faCheck} class="w-4 h-4" />
              {/if}
              <span>{feedbackSent ? "Resuming..." : "Continue"}</span>
            </button>
            <button
              onclick={() => sendFeedback("skip")}
              disabled={isSendingFeedback || feedbackSent}
              class="flex items-center justify-center sm:justify-start gap-2 px-3 py-2 bg-[var(--dash-bg)] text-[var(--dash-text)] border border-[var(--dash-border)] rounded-lg hover:bg-[var(--dash-border)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Skip current action and move to next"
            >
              <FontAwesomeIcon icon={faForward} class="w-4 h-4" />
              <span>Skip</span>
            </button>
          {/if}

          {#if isRunning || isBlocked || isQueued || isStoppingStatus}
            <button
              onclick={stopScrape}
              disabled={isStopping || isStoppingStatus}
              class="flex items-center justify-center sm:justify-start gap-2 px-4 py-2 bg-[var(--dash-error)] text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {#if isStopping || isStoppingStatus}
                <Spinner size="w-4 h-4" />
                <span>Stopping...</span>
              {:else}
                <FontAwesomeIcon icon={faStop} class="w-4 h-4" />
                <span>Stop</span>
              {/if}
            </button>
          {:else}
            <button
              onclick={startScrape}
              disabled={isStarting || !searchTask.search_url ||
                !searchTask.platform_id}
              class="flex items-center justify-center sm:justify-start gap-2 px-4 py-2 bg-[var(--dash-primary)] text-white rounded-lg hover:bg-[var(--dash-primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {#if isStarting}
                <Spinner size="w-4 h-4" />
                <span>{hasOtherRunning ? "Enqueuing..." : "Starting..."}</span>
              {:else}
                <FontAwesomeIcon icon={faPlay} class="w-4 h-4" />
                <span>{hasOtherRunning ? "Enqueue" : "Start"}</span>
              {/if}
            </button>
          {/if}

          <button
            onclick={() => (showBrowser = !showBrowser)}
            class="flex items-center justify-center sm:justify-start gap-2 px-3 py-2 bg-[var(--dash-card)] text-[var(--dash-text)] border border-[var(--dash-border)] rounded-lg hover:bg-[var(--dash-bg-hover)] transition-colors"
            title="{showBrowser ? 'Hide' : 'Show'} browser view"
          >
            <FontAwesomeIcon
              icon={showBrowser ? faEyeSlash : faEye}
              class="w-4 h-4"
            />
            <span class="text-sm">Browser View</span>
          </button>
        </div>

      <!-- Active run details (jobs/logs) shown inline in status card -->
      {#if featuredRun}
        <div class="flex items-center gap-1.5 text-xs text-[var(--dash-text-muted)]">
          <span>Run</span>
          <span class="font-mono">#{featuredRun.id}</span>
          <button
            type="button"
            onclick={() => copyRunId(featuredRun!.id)}
            class="p-0.5 cursor-pointer text-[var(--dash-text-muted)] hover:text-[var(--dash-primary)] transition-colors"
            aria-label="Copy run ID"
          >
            <FontAwesomeIcon
              icon={copiedRunId === featuredRun.id ? faCheck : faCopy}
              class="w-3 h-3 {copiedRunId === featuredRun.id ? 'text-green-600' : ''}"
            />
          </button>
          {#if copiedRunId === featuredRun.id}
            <span class="text-green-600">Copied!</span>
          {/if}
        </div>
        {@render runDetails(featuredRun, true)}
      {/if}

      <!-- Missing config warnings -->
      {#if !searchTask.search_url}
        <p class="text-sm text-[var(--dash-warning)]">
          No search URL configured. Please add a search URL to start scraping.
        </p>
      {/if}
      {#if !searchTask.platform_id}
        <p class="text-sm text-[var(--dash-warning)]">
          No platform selected. Please select a platform to start scraping.
        </p>
      {/if}
    </div>
  </Card>

  <!-- Scrape Configuration -->
  <Card padding="lg">
    {#key data.searchTask.id}
      <SearchTaskFields
        mode="edit"
        localBrowserAllowed={data.localBrowserAllowed}
        serverBrowserProvider={data.browserProvider}
        {searchTask}
        searchTaskId={searchTask.id}
        profileId={data.profileId}
        platformCredentials={data.platformCredentials}
        canEditPlatformUrls={data.canEditPlatformUrls}
        browserCountryCode={data.browserCountryCode}
        defaultCountryCode={data.defaultCountryCode}
        browserFingerprint={data.browserFingerprint}
        browserFingerprintDefaults={data.browserFingerprintDefaults}
        uiPreferences={data.uiPreferences as Record<string, unknown>}
        {desktopConnected}
        {devices}
        verificationEmailAddress={data.verificationEmailAddress}
      />
    {/key}
  </Card>

  <!-- Browser View popup -->
  {#if showBrowser}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="fixed inset-0 z-50 flex sm:items-center sm:justify-center sm:p-4"
      onkeydown={(e) => {
        if (e.key === "Escape") {
          showBrowser = false;
          if (vncEnabled) toggleVnc();
        }
      }}
    >
      <!-- Backdrop (hidden on mobile since popup is full-screen) -->
      <div
        class="absolute inset-0 bg-black/60 hidden sm:block"
        onclick={() => {
          showBrowser = false;
          if (vncEnabled) toggleVnc();
        }}
        role="presentation"
      >
      </div>
      <!-- Popup content: full-screen on mobile, constrained popup on desktop -->
      <Card
        class="relative overflow-hidden shadow-2xl w-full h-[100dvh] sm:h-auto sm:max-w-5xl sm:max-h-[90vh] flex flex-col !rounded-none !border-0 sm:!rounded-lg sm:!border"
      >
        <div
          class="flex items-center justify-between px-3 py-2 sm:p-4 border-b border-[var(--dash-border)] shrink-0"
        >
          <div class="flex items-center gap-2">
            <FontAwesomeIcon
              icon={isCloudMode ? faCloud : faDesktop}
              class="w-4 h-4 text-[var(--dash-text-secondary)]"
            />
            <h2 class="font-medium text-[var(--dash-text)] text-sm sm:text-base hidden sm:block">Browser View</h2>
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
                {connectedDeviceNames.join(", ") || "Desktop"}
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
              <div class="flex rounded overflow-hidden border border-[var(--dash-border)]">
                <button
                  onclick={() => setViewMode("screenshot")}
                  class="px-2 py-1 text-xs flex items-center gap-1 transition-colors {browserViewMode === 'screenshot' ? 'bg-[var(--dash-primary)] text-white' : 'bg-[var(--dash-bg)] text-[var(--dash-text-secondary)] hover:text-[var(--dash-text)]'}"
                  title="Screenshot mode (auto-refreshing)"
                >
                  <FontAwesomeIcon icon={faCamera} class="w-3 h-3" />
                  <span class="hidden sm:inline">Screenshot</span>
                </button>
                <button
                  onclick={() => setViewMode("vnc")}
                  disabled={vncConnecting}
                  class="px-2 py-1 text-xs flex items-center gap-1 border-l border-[var(--dash-border)] transition-colors {browserViewMode === 'vnc' ? 'bg-[var(--dash-primary)] text-white' : 'bg-[var(--dash-bg)] text-[var(--dash-text-secondary)] hover:text-[var(--dash-text)]'}"
                  title="Interactive VNC mode"
                >
                  <FontAwesomeIcon icon={faDesktop} class="w-3 h-3" />
                  <span class="hidden sm:inline">{vncConnecting ? "Connecting..." : "Interactive"}</span>
                </button>
              </div>
              {#if browserViewMode === "screenshot"}
                <button
                  onclick={() => { interactiveMode = !interactiveMode; }}
                  class="p-1 transition-colors {interactiveMode ? 'text-[var(--dash-primary)]' : 'text-[var(--dash-text-secondary)] hover:text-[var(--dash-text)]'}"
                  title="{interactiveMode ? 'Disable' : 'Enable'} interactive mode"
                >
                  <FontAwesomeIcon icon={faHandPointer} class="w-3.5 h-3.5" />
                </button>
                <button
                  onclick={fetchScreenshot}
                  class="p-1 text-[var(--dash-text-secondary)] hover:text-[var(--dash-text)] transition-colors"
                  title="Refresh screenshot"
                >
                  <FontAwesomeIcon icon={faSync} class="w-3.5 h-3.5" />
                </button>
              {/if}
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
                showBrowserLogs = !showBrowserLogs;
                if (showBrowserLogs && featuredRunId && !runLogs[featuredRunId]) {
                  loadRunLogs(featuredRunId);
                }
              }}
              class="
                px-2 py-1 text-xs rounded transition-colors {showBrowserLogs
                ? 'bg-[var(--dash-primary)] text-white'
                : 'bg-[var(--dash-bg)] text-[var(--dash-text-secondary)] hover:text-[var(--dash-text)]'}
              "
              title={showBrowserLogs ? "Hide logs" : "Show logs"}
            >
              <FontAwesomeIcon icon={faTerminal} class="w-3 h-3 mr-1" />
              Logs
            </button>
            <button
              onclick={() => {
                showBrowser = false;
                if (vncEnabled) stopVnc();
                stopScreenshotPolling();
              }}
              class="p-1 text-[var(--dash-text-secondary)] hover:text-[var(--dash-text)] transition-colors"
            >
              <FontAwesomeIcon icon={faTimes} class="w-4 h-4" />
            </button>
          </div>
        </div>
        <!-- Browser view: flex-fills on mobile, 16:9 aspect on desktop -->
        <div class="relative w-full flex-1 sm:flex-initial sm:aspect-video">
          {#if expectsCloudBrowser && browserViewUrl}
            <iframe
              src={browserViewUrl}
              class="absolute inset-0 w-full h-full border-0"
              title="Cloud browser view"
            ></iframe>
          {:else if expectsCloudBrowser}
            <div
              class="absolute inset-0 flex items-center justify-center bg-[var(--dash-bg)]"
            >
              <div class="text-center">
                <Spinner size="w-6 h-6" color="var(--dash-text-muted)" class="mb-2" />
                <p class="text-sm text-[var(--dash-text-muted)]">
                  Starting cloud browser...
                </p>
              </div>
            </div>
          {:else if browserViewMode === "screenshot"}
            {#if screenshotSrc}
              <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
              <div
                class="absolute inset-0 bg-black {interactiveMode ? 'cursor-crosshair' : ''}"
                role={interactiveMode ? "application" : undefined}
                tabindex={interactiveMode ? 0 : undefined}
                onmousedown={handleInteractiveMouseDown}
                onmouseup={handleInteractiveMouseUp}
                onmousemove={handleInteractiveMouseMove}
                onwheel={handleInteractiveWheel}
                onkeydown={handleInteractiveKeyDown}
                onkeyup={handleInteractiveKeyUp}
                oncontextmenu={(e) => { if (interactiveMode) e.preventDefault(); }}
              >
                <img
                  bind:this={screenshotImgEl}
                  src={screenshotSrc}
                  alt="Browser screenshot"
                  class="w-full h-full object-contain pointer-events-none select-none"
                  draggable="false"
                />
              </div>
            {:else if screenshotLoading}
              <div class="absolute inset-0 flex items-center justify-center bg-[var(--dash-bg)]">
                <div class="text-center">
                  <Spinner size="w-6 h-6" color="var(--dash-text-muted)" class="mb-2" />
                  <p class="text-sm text-[var(--dash-text-muted)]">Loading screenshot...</p>
                </div>
              </div>
            {:else}
              <div class="absolute inset-0 flex items-center justify-center bg-[var(--dash-bg)]">
                <div class="text-center">
                  <FontAwesomeIcon icon={faCamera} class="w-6 h-6 text-[var(--dash-text-muted)] mb-2" />
                  <p class="text-sm text-[var(--dash-text-muted)]">No screenshot available</p>
                  <p class="text-xs text-[var(--dash-text-muted)] mt-1">Make sure a device is connected</p>
                </div>
              </div>
            {/if}
          {:else if vncEnabled && vncUrl}
            <iframe
              src={vncUrl}
              class="absolute inset-0 w-full h-full border-0"
              title="Interactive browser view (VNC)"
            ></iframe>
          {:else if vncConnecting}
            <div
              class="absolute inset-0 flex items-center justify-center bg-[var(--dash-bg)]"
            >
              <div class="text-center">
                <Spinner size="w-6 h-6" color="var(--dash-text-muted)" class="mb-2" />
                <p class="text-sm text-[var(--dash-text-muted)]">
                  Connecting to browser...
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
                {#if vncError}
                  <p class="text-sm text-[var(--dash-error)]">
                    {vncError}
                  </p>
                  <p class="text-xs text-[var(--dash-text-muted)] mt-1">
                    Check that the device is connected
                  </p>
                {:else}
                  <p class="text-sm text-[var(--dash-text-muted)]">
                    Browser running on your device
                  </p>
                  <p class="text-xs text-[var(--dash-text-muted)] mt-1">
                    Switch to "Interactive" for VNC browser control
                  </p>
                {/if}
              </div>
            </div>
          {:else}
            <div
              class="absolute inset-0 flex items-center justify-center bg-[var(--dash-bg)]"
            >
              <div class="text-center">
                <Spinner size="w-6 h-6" color="var(--dash-text-muted)" class="mb-2" />
                <p class="text-sm text-[var(--dash-text-muted)]">
                  Starting cloud browser...
                </p>
              </div>
            </div>
          {/if}
        <!-- Logs overlay (on top of browser view, semi-transparent) -->
        {#if showBrowserLogs}
          <div class="absolute inset-0 z-10 flex flex-col bg-black/80 backdrop-blur-sm">
              <div class="flex items-center justify-between px-3 py-1.5 bg-[var(--dash-bg)] border-b border-[var(--dash-border)] shrink-0">
                <div class="flex items-center gap-2">
                  <select
                    bind:value={logLevelFilter}
                    onchange={() => {
                      if (featuredRunId) {
                        runLogs[featuredRunId] = [];
                        loadRunLogs(featuredRunId);
                      }
                    }}
                    class="text-xs px-2 py-0.5 rounded border border-[var(--dash-border)] bg-[var(--dash-card)] text-[var(--dash-text)]"
                  >
                    <option value="debug">Debug</option>
                    <option value="info">Info</option>
                    <option value="warn">Warn</option>
                    <option value="error">Error</option>
                  </select>
                </div>
                {#if featuredRunId && loadingLogs[featuredRunId]}
                  <Spinner size="w-3 h-3" color="var(--dash-text-muted)" />
                {/if}
              </div>
              <div
                bind:this={browserLogRef}
                class="overflow-y-auto flex-1"
              >
                {#if !featuredRunId || !runLogs[featuredRunId] || runLogs[featuredRunId].length === 0}
                  <div class="p-4 text-sm text-[var(--dash-text-muted)] text-center">
                    {#if featuredRunId && loadingLogs[featuredRunId]}
                      Loading logs...
                    {:else}
                      No logs available
                    {/if}
                  </div>
                {:else}
                  <div class="p-2 space-y-0.5 font-mono text-xs">
                    {#each runLogs[featuredRunId] as log (log.id)}
                      <div class="flex gap-2 py-0.5 px-1 hover:bg-[var(--dash-bg)] rounded">
                        <span class="text-[var(--dash-text-muted)] whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                        <span class={`uppercase w-12 ${getLogLevelColor(log.level)}`}>
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
          </div>
        {/if}
        <!-- Intervention controls overlay (anchored to bottom of browser view) -->
        {#if isBlocked}
          <div
            class="absolute bottom-0 left-0 right-0 z-10 p-3 bg-[var(--dash-card)]/95 backdrop-blur-sm border-t border-[var(--dash-warning)]/30 space-y-2 overflow-y-auto max-h-[60%] shadow-[0_-2px_8px_rgba(0,0,0,0.1)]"
          >
            <!-- Intervention message + action buttons -->
            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div class="text-sm text-[var(--dash-text-secondary)]">
                {#if isMagicLink}
                  <p>Paste the login link from your email below and click Navigate,
                  then click Continue.</p>
                {:else}
                  <p>Complete the required action (login, CAPTCHA, or verification)
                  in the browser above, then click Continue.</p>
                {/if}
                {#if isVerification && verificationEmailAddress}
                  <p class="mt-1 flex items-center gap-1.5 text-xs flex-wrap">
                    <FontAwesomeIcon icon={faEnvelope} class="w-3 h-3 text-[var(--dash-primary)]" />
                    <span>Auto-verify: forward the email to</span>
                    <code class="font-mono text-[var(--dash-primary)] select-all">{verificationEmailAddress}</code>
                    <button onclick={copyVerificationEmail} class="transition-colors {copiedVerifyEmail ? 'text-green-600' : 'text-[var(--dash-text-muted)] hover:text-[var(--dash-text)]'}" title="Copy">
                      <FontAwesomeIcon icon={copiedVerifyEmail ? faCheck : faCopy} class="w-2.5 h-2.5" />
                    </button>
                    {#if copiedVerifyEmail}
                      <span class="text-green-600">Copied!</span>
                    {/if}
                  </p>
                {/if}
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <button
                  onclick={() => sendFeedback("continue")}
                  disabled={isSendingFeedback || feedbackSent}
                  class="flex items-center gap-2 px-4 py-2 bg-[var(--dash-success)] text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  {#if isSendingFeedback || feedbackSent}
                    <Spinner size="w-3 h-3" />
                  {:else}
                    <FontAwesomeIcon icon={faCheck} class="w-3 h-3" />
                  {/if}
                  <span>{feedbackSent ? "Resuming..." : "Continue"}</span>
                </button>
                <button
                  onclick={() => sendFeedback("skip")}
                  disabled={isSendingFeedback || feedbackSent}
                  class="flex items-center gap-2 px-3 py-2 bg-[var(--dash-card)] text-[var(--dash-text)] border border-[var(--dash-border)] rounded-lg hover:bg-[var(--dash-border)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  title="Skip current action"
                >
                  <FontAwesomeIcon icon={faForward} class="w-3 h-3" />
                  <span>Skip</span>
                </button>
              </div>
            </div>
            <!-- Navigate URL (for magic link login) -->
            <div
              class="flex items-center gap-2 pt-2 border-t border-[var(--dash-border)]"
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
                  <Spinner size="w-3 h-3" />
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
            <!-- Type text into browser (for 2FA codes) -->
            <div
              class="flex flex-col gap-2 pt-2 border-t border-[var(--dash-border)]"
            >
              <div class="flex items-center gap-2">
                <input
                  type="text"
                  bind:value={typeTextValue}
                  placeholder="2FA / verification code"
                  disabled={isTypingText}
                  onkeydown={(e) => {
                    if (e.key === "Enter") sendTypeText(true);
                  }}
                  class="flex-1 px-3 py-1.5 text-sm bg-[var(--dash-card)] text-[var(--dash-text)] border border-[var(--dash-border)] rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--dash-primary)] disabled:opacity-50"
                />
                <button
                  onclick={() => sendTypeText(true)}
                  disabled={isTypingText || !typeTextValue.trim()}
                  class="px-3 py-1.5 text-sm bg-[var(--dash-primary)] text-white rounded-lg hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                  title="Type text and submit the form"
                >
                  {#if isTypingText}
                    <Spinner size="w-3 h-3" />
                  {:else}
                    Send
                  {/if}
                </button>
              </div>
              <div class="flex flex-wrap items-center gap-2">
                <button
                  onclick={() => sendTypeText(false)}
                  disabled={isTypingText || !typeTextValue.trim()}
                  class="px-3 py-1.5 text-sm bg-[var(--dash-card)] text-[var(--dash-text)] border border-[var(--dash-border)] rounded-lg hover:bg-[var(--dash-border)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Type text without submitting"
                >
                  Type only
                </button>
                <button
                  onclick={() => submitBrowserForm()}
                  disabled={isTypingText}
                  class="px-3 py-1.5 text-sm bg-[var(--dash-success)] text-white rounded-lg hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Click the submit button in the browser"
                >
                  Submit
                </button>
                <button
                  onclick={() => clearBrowserInput()}
                  disabled={isTypingText}
                  class="px-3 py-1.5 text-sm bg-[var(--dash-card)] text-[var(--dash-text-secondary)] border border-[var(--dash-border)] rounded-lg hover:bg-[var(--dash-border)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Clear the input field in the browser"
                >
                  Clear
                </button>
                {#if typeTextMessage}
                  <span class="text-xs text-[var(--dash-text-muted)]">{
                    typeTextMessage
                  }</span>
                {/if}
              </div>
            </div>
          </div>
        {/if}
        </div>
      </Card>
    </div>
  {/if}

  <!-- Runs History -->
  <Card>
    <div
      class="flex items-center gap-2 p-4 border-b border-[var(--dash-border)]"
    >
      <FontAwesomeIcon
        icon={faHistory}
        class="w-4 h-4 text-[var(--dash-text-secondary)]"
      />
      <h2 class="font-medium text-[var(--dash-text)]">Run History</h2>
    </div>

    {#if historyRuns.length === 0}
      <div class="p-8 text-center text-[var(--dash-text-secondary)]">
        <p>No completed runs yet.</p>
      </div>
    {:else}
      <div class="divide-y divide-[var(--dash-border)]">
        {#each historyRuns as run (run.id)}
          <div class="bg-[var(--dash-card)] {expandedRunId === run.id ? 'border-l-2 border-l-[var(--dash-primary)]' : ''}">
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
                  {#if run.status === "running" || run.status === "queued"}
                    <Spinner size="w-3 h-3" color="var(--dash-primary)" />
                  {:else}
                    <FontAwesomeIcon
                      icon={getRunStatusIcon(run.status)}
                      class="w-3 h-3 {getRunStatusColor(run.status)}"
                    />
                  {/if}
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
                      • {run.jobs_found} new {run.jobs_found === 1 ? 'job' : 'jobs'}
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
                <div class="flex items-center gap-1 text-sm text-[var(--dash-text-muted)]">
                  {formatRelativeTime(run.started_at)}
                  <span class="text-[var(--dash-text-muted)]">•</span>
                  <span class="capitalize">{run.triggered_by}</span>
                  <span class="text-[var(--dash-text-muted)]">•</span>
                  <span class="font-mono text-xs">#{run.id}</span>
                  <span
                    role="button"
                    tabindex="0"
                    onclick={(e) => {
                      e.stopPropagation();
                      copyRunId(run.id);
                    }}
                    onkeydown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.stopPropagation();
                        e.preventDefault();
                        copyRunId(run.id);
                      }
                    }}
                    class="p-0.5 cursor-pointer text-[var(--dash-text-muted)] hover:text-[var(--dash-primary)] transition-colors"
                    aria-label="Copy run ID"
                  >
                    <FontAwesomeIcon
                      icon={copiedRunId === run.id ? faCheck : faCopy}
                      class="w-3 h-3 {copiedRunId === run.id ? 'text-green-600' : ''}"
                    />
                  </span>
                  {#if copiedRunId === run.id}
                    <span class="text-xs text-green-600">Copied!</span>
                  {/if}
                </div>
                {#if run.settings}
                  <div class="flex items-center gap-1.5 flex-wrap mt-0.5">
                    {#if run.settings.max_jobs}
                      <span class="inline-flex items-center px-1.5 py-0 text-xs rounded bg-[var(--dash-bg)] text-[var(--dash-text-muted)]">
                        max: {run.settings.max_jobs}
                      </span>
                    {/if}
                    {#if run.settings.skip_first}
                      <span class="inline-flex items-center px-1.5 py-0 text-xs rounded bg-[var(--dash-bg)] text-[var(--dash-text-muted)]">
                        skip first: {run.settings.skip_first}
                      </span>
                    {/if}
                    {#if run.settings.skip_existing}
                      <span class="inline-flex items-center px-1.5 py-0 text-xs rounded bg-[var(--dash-bg)] text-[var(--dash-text-muted)]">
                        skip existing
                      </span>
                    {/if}
                    {#if run.settings.stop_after_duplicates}
                      <span class="inline-flex items-center px-1.5 py-0 text-xs rounded bg-[var(--dash-bg)] text-[var(--dash-text-muted)]">
                        stop after: {run.settings.stop_after_duplicates} dupes
                      </span>
                    {/if}
                    {#if run.settings.browser_provider}
                      <span class="inline-flex items-center px-1.5 py-0 text-xs rounded bg-[var(--dash-bg)] text-[var(--dash-text-muted)]">
                        {run.settings.browser_provider === 'hosted' ? 'cloud' : run.settings.browser_provider}
                      </span>
                    {/if}
                  </div>
                {/if}
              </div>
            </button>

            <!-- Expanded details (tabs: Items / Logs) -->
            {#if expandedRunId === run.id}
              {@render runDetails(run)}
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  </Card>

  <!-- Settings -->
  <Card>
    <button
      type="button"
      onclick={toggleSettingsSection}
      class="flex items-center gap-2 w-full text-left p-4"
    >
      {#if settingsOpen}
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
      <FontAwesomeIcon
        icon={faCog}
        class="w-4 h-4 text-[var(--dash-text-muted)]"
      />
      <h3
        class="text-sm font-medium text-[var(--dash-text-muted)] uppercase tracking-wide"
      >
        Settings
      </h3>
    </button>

    {#if settingsOpen}
      <div class="px-4 pb-4 space-y-4">
        <div class="pt-2 border-t border-[var(--dash-border)]">
          <h4 class="text-sm font-medium text-red-500 mb-2">Danger Zone</h4>
          {#if showDeleteConfirm}
            <div class="flex items-center gap-3 flex-wrap">
              <span class="text-sm text-[var(--dash-text)]">
                Are you sure? This will permanently delete this task and all its
                run history.
              </span>
              <div class="flex items-center gap-2">
                <button
                  onclick={deleteTask}
                  disabled={isDeleting}
                  class="px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                >
                  {#if isDeleting}
                    <Spinner size="w-3 h-3" class="mr-1" />
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
  </Card>
</div>
