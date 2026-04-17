<script lang="ts">
  import { onMount } from "svelte";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faCheck,
    faChevronDown,
    faChevronRight,
    faCopy,
    faDesktop,
    faEnvelope,
    faExternalLinkAlt,
    faEye,
    faEyeSlash,
    faGlobe,
    faKey,
  } from "@fortawesome/free-solid-svg-icons";
  import CountrySelect from "./CountrySelect.svelte";
  import Spinner from "$lib/components/Spinner.svelte";
  import PlatformLogo from "$lib/components/PlatformLogo.svelte";
  import CredentialSelector from "./CredentialSelector.svelte";
  import BrowserProviderToggle from "./BrowserProviderToggle.svelte";

  interface Props {
    mode: "add" | "edit";
    localBrowserAllowed: boolean;
    serverBrowserProvider: string;
    defaultBrowserProvider?: string;
    defaultMaxJobs?: number | null;
    // Add mode props
    searchUrl?: string;
    searchTerm?: string;
    loginPageUrl?: string;
    detectedPlatform?: {
      id: number;
      name: string;
      url: string;
      loginPageUrl: string | null;
      isNew: boolean;
    } | null;
    detectingPlatform?: boolean;
    existingCredentials?: Array<{
      id: number;
      username: string | null;
      status: string;
    }>;
    onsearchurlinput?: (e: Event) => void;
    // Edit mode props
    searchTask?: any;
    searchTaskId?: number;
    profileId?: number;
    platformCredentials?: Array<{ id: number; username: string | null }>;
    canEditPlatformUrls?: boolean;
    browserCountryCode?: string;
    defaultCountryCode?: string;
    browserFingerprint?: {
      language: string;
      timezone: string;
    };
    browserFingerprintDefaults?: { language: string; timezone: string };
    uiPreferences?: Record<string, unknown>;
    desktopConnected?: boolean | null;
    devices?: Array<{ apiKeyId: number; apiKeyName: string; connected: boolean }>;
    verificationEmailAddress?: string | null;
  }

  let {
    mode,
    localBrowserAllowed,
    serverBrowserProvider,
    defaultBrowserProvider = "local",
    defaultMaxJobs = 25,
    // Add mode
    searchUrl = $bindable(""),
    searchTerm = $bindable(""),
    loginPageUrl = $bindable(""),
    detectedPlatform = null,
    detectingPlatform = false,
    existingCredentials = [],
    onsearchurlinput,
    // Edit mode
    searchTask = null,
    searchTaskId = 0,
    profileId = 0,
    platformCredentials: initialPlatformCredentials = [],
    canEditPlatformUrls: initialCanEditPlatformUrls = true,
    browserCountryCode: initialBrowserCountryCode = "",
    defaultCountryCode = "",
    browserFingerprint = { language: "", timezone: "" },
    browserFingerprintDefaults = { language: "", timezone: "" },
    uiPreferences = {},
    desktopConnected = null,
    devices = [],
    verificationEmailAddress = null,
  }: Props = $props();

  const isAdd = mode === "add";
  const isEdit = mode === "edit";

  // ── Verification email relay ──
  let copiedVerifyEmail = $state(false);
  function copyVerificationEmail() {
    if (!verificationEmailAddress) return;
    navigator.clipboard.writeText(verificationEmailAddress);
    copiedVerifyEmail = true;
    setTimeout(() => (copiedVerifyEmail = false), 2000);
  }

  // ── Add-mode credential state ──
  let addLoginMode = $state<string>("auto");
  let selectedCredentialId = $state<string>("none");
  let showNewCredentials = $state(false);
  let newCredUsername = $state("");
  let newCredPassword = $state("");
  let newCredSecurityAnswer = $state("");
  let showPassword = $state(false);
  let showAdvancedAuth = $state(false);

  function handleCredentialSelection(value: string) {
    selectedCredentialId = value;
    showNewCredentials = value === "new";
  }

  // ── Add-mode browser provider ──
  let addBrowserProvider = $state<string | null>(
    defaultBrowserProvider || null,
  );

  // ── Add-mode browser country ──
  let addBrowserCountryCode = $state(initialBrowserCountryCode);

  // ── Add-mode scraping options ──
  let addMaxJobsEnabled = $state(defaultMaxJobs != null);
  let addMaxJobsInput = $state(defaultMaxJobs?.toString() ?? "");
  let addSkipFirstEnabled = $state(false);
  let addSkipFirstInput = $state("");
  let addStopAfterDuplicatesEnabled = $state(true);
  let addStopAfterDuplicatesInput = $state("5");
  let addSkipExisting = $state(true);
  let addKeepMinimized = $state(true);
  let addScheduleInterval = $state("");

  // Schedule options (shared)
  const SCHEDULE_OPTIONS = [
    { value: "", label: "Off" },
    { value: "6", label: "Every 6 hours" },
    { value: "12", label: "Every 12 hours" },
    { value: "24", label: "Every 24 hours" },
    { value: "48", label: "Every 2 days" },
    { value: "72", label: "Every 3 days" },
  ];

  // ── Edit-mode state ──
  // Collapsible sections
  function loadSectionOpen(section: string, defaultOpen = true): boolean {
    const key = `task_sections_${section}`;
    const val = uiPreferences[key];
    return val === undefined ? defaultOpen : Boolean(val);
  }

  function toggleSection(section: string) {
    const isOpen = sectionOpen[section];
    sectionOpen[section] = !isOpen;
    if (isEdit && searchTaskId) {
      const key = `task_sections_${section}`;
      fetch(`/api/import-tasks/${searchTaskId}/ui-preferences`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: !isOpen }),
      }).catch(() => {});
    }
  }

  let sectionOpen = $state<Record<string, boolean>>(
    isEdit
      ? {
        search: loadSectionOpen("search"),
        auth: loadSectionOpen("auth"),
        options: loadSectionOpen("options"),
        browser: loadSectionOpen("browser"),
      }
      : { search: true, auth: true, options: true, browser: true },
  );

  // Parse helpers
  function parseIntOrNull(val: unknown): number | null {
    if (val === undefined || val === null || val === "") return null;
    const n = typeof val === "number" ? val : parseInt(String(val));
    return isNaN(n) || n < 1 ? null : n;
  }

  // ── Edit-mode field state ──
  let searchUrlInput = $state<string>(searchTask?.search_url ?? "");
  let searchTermInput = $state<string>(searchTask?.search_term ?? "");
  let loginUrlInput = $state<string>(
    searchTask?.job_platforms?.login_page_url ?? "",
  );
  let isSavingSearchUrl = $state(false);
  let isSavingSearchTerm = $state(false);
  let isSavingLoginUrl = $state(false);
  let searchUrlDirty = $derived(
    isEdit && searchUrlInput.trim() !== (searchTask?.search_url ?? ""),
  );
  let searchTermDirty = $derived(
    isEdit && searchTermInput.trim() !== (searchTask?.search_term ?? ""),
  );
  let loginUrlDirty = $derived(
    isEdit &&
      loginUrlInput.trim() !==
        (searchTask?.job_platforms?.login_page_url ?? ""),
  );

  let showAdvancedSearch = $state(false);

  // Scraping options (edit)
  let maxJobsEnabled = $state<boolean>(searchTask?.max_jobs != null);
  let maxJobsInput = $state<string>(searchTask?.max_jobs?.toString() ?? "");
  let isSavingMaxJobs = $state(false);
  let maxJobsDirty = $derived(
    isEdit &&
      (maxJobsEnabled ? parseIntOrNull(maxJobsInput) : null) !==
        (searchTask?.max_jobs ?? null),
  );

  let skipExisting = $state<boolean>(searchTask?.skip_existing ?? false);
  let isSavingSkipExisting = $state(false);
  let skipExistingDirty = $derived(
    isEdit && skipExisting !== (searchTask?.skip_existing ?? false),
  );

  let stopAfterDuplicatesEnabled = $state<boolean>(
    searchTask?.stop_after_duplicates != null,
  );
  let stopAfterDuplicatesInput = $state<string>(
    searchTask?.stop_after_duplicates?.toString() ?? "",
  );
  let isSavingStopAfterDuplicates = $state(false);
  let stopAfterDuplicatesDirty = $derived(
    isEdit &&
      (stopAfterDuplicatesEnabled
          ? parseIntOrNull(stopAfterDuplicatesInput)
          : null) !== (searchTask?.stop_after_duplicates ?? null),
  );

  let skipFirstEnabled = $state<boolean>(searchTask?.skip_first != null);
  let skipFirstInput = $state<string>(
    searchTask?.skip_first?.toString() ?? "",
  );
  let isSavingSkipFirst = $state(false);
  let skipFirstDirty = $derived(
    isEdit &&
      (skipFirstEnabled ? parseIntOrNull(skipFirstInput) : null) !==
        (searchTask?.skip_first ?? null),
  );

  // Browser provider (edit)
  let browserProvider = $state<string | null>(
    searchTask?.browser_provider ?? null,
  );
  let savedBrowserProvider = $state<string | null>(
    searchTask?.browser_provider ?? null,
  );
  let browserProviderDirty = $derived(
    isEdit && browserProvider !== savedBrowserProvider,
  );
  let isSavingBrowserProvider = $state(false);

  // Tunnel device selection (edit)
  let tunnelApiKey = $state<number | null>(searchTask?.tunnel_api_key ?? null);
  let savedTunnelApiKey = $state<number | null>(searchTask?.tunnel_api_key ?? null);
  let tunnelApiKeyDirty = $derived(
    isEdit && tunnelApiKey !== savedTunnelApiKey,
  );
  let isSavingTunnelApiKey = $state(false);

  // Keep minimized (edit)
  let keepMinimized = $state<boolean>(searchTask?.keep_minimized ?? true);
  let savedKeepMinimized = $state<boolean>(
    searchTask?.keep_minimized ?? true,
  );
  let keepMinimizedDirty = $derived(
    isEdit && keepMinimized !== savedKeepMinimized,
  );
  let isSavingKeepMinimized = $state(false);

  // Schedule (edit)
  let scheduleIntervalInput = $state<string>(
    searchTask?.schedule_interval_hours?.toString() ?? "",
  );
  let isSavingSchedule = $state(false);
  let scheduleDirty = $derived(
    isEdit &&
      (scheduleIntervalInput || "") !==
        (searchTask?.schedule_interval_hours?.toString() ?? ""),
  );

  // Browser location (edit)
  let editBrowserCountryCode = $state(initialBrowserCountryCode);
  let savedBrowserCountryCode = $state(initialBrowserCountryCode);
  let browserCountryDirty = $derived(
    isEdit && editBrowserCountryCode !== savedBrowserCountryCode,
  );
  let isSavingBrowserCountry = $state(false);

  // Browser fingerprint (edit)
  let showAdvancedBrowser = $state(false);
  let browserLanguage = $state(browserFingerprint.language);
  let savedBrowserLanguage = $state(browserFingerprint.language);
  let browserTimezone = $state(browserFingerprint.timezone);
  let savedBrowserTimezone = $state(browserFingerprint.timezone);
  let browserFingerprintDirty = $derived(
    isEdit &&
      (browserLanguage !== savedBrowserLanguage ||
        browserTimezone !== savedBrowserTimezone),
  );
  let isSavingBrowserFingerprint = $state(false);
  let defaultBrowserLanguage = browserFingerprintDefaults.language;
  let defaultBrowserTimezone = browserFingerprintDefaults.timezone;

  // Credentials (edit)
  let editPlatformCredentials = $state(initialPlatformCredentials);
  let canEditPlatformUrls = $state(initialCanEditPlatformUrls);
  const editInitialCredId = searchTask?.platform_id_profile_id?.toString() ??
    "none";
  let editSavedCredentialId = $state<string>(editInitialCredId);
  let editSelectedCredentialId = $state<string>(editInitialCredId);
  let credentialDirty = $derived(
    isEdit && editSelectedCredentialId !== editSavedCredentialId,
  );
  let isSavingCredential = $state(false);

  // Login mode (edit)
  let editLoginMode = $state<string>(searchTask?.login_mode ?? "auto");
  let editSavedLoginMode = $state<string>(searchTask?.login_mode ?? "auto");
  let loginModeDirty = $derived(
    isEdit && editLoginMode !== editSavedLoginMode,
  );
  let isSavingLoginMode = $state(false);

  // Computed: tunnel mode / hosted mode for conditional sections
  let effectiveBrowserProvider = $derived(
    isEdit ? savedBrowserProvider : addBrowserProvider,
  );
  let isHostedMode = $derived(
    effectiveBrowserProvider === "hosted" ||
      (!effectiveBrowserProvider && serverBrowserProvider === "goLogin"),
  );
  let isTunnelMode = $derived(
    effectiveBrowserProvider === "local" ||
      (!effectiveBrowserProvider && serverBrowserProvider === "tunnel"),
  );

  // ── Edit-mode save functions ──
  async function patchSearchTask(body: Record<string, unknown>) {
    await fetch(`/api/import-tasks/${searchTaskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  async function saveSearchUrl() {
    isSavingSearchUrl = true;
    try {
      const url = searchUrlInput.trim() || null;
      await patchSearchTask({ search_url: url });
      searchTask.search_url = url;
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
      await patchSearchTask({ search_term: term });
      searchTask.search_term = term;
    } catch (err) {
      console.error("Failed to save search term:", err);
    } finally {
      isSavingSearchTerm = false;
    }
  }

  async function saveLoginUrl() {
    if (!searchTask?.platform_id) return;
    isSavingLoginUrl = true;
    try {
      const url = loginUrlInput.trim() || null;
      await fetch(`/api/platforms/${searchTask.platform}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login_page_url: url }),
      });
      if (searchTask.job_platforms) {
        searchTask.job_platforms.login_page_url = url;
      }
    } catch (err) {
      console.error("Failed to save login URL:", err);
    } finally {
      isSavingLoginUrl = false;
    }
  }

  async function saveMaxJobs() {
    const val = maxJobsEnabled ? parseIntOrNull(maxJobsInput) : null;
    isSavingMaxJobs = true;
    try {
      await patchSearchTask({ max_jobs: val });
      searchTask.max_jobs = val;
    } catch (err) {
      console.error("Failed to save max jobs:", err);
    } finally {
      isSavingMaxJobs = false;
    }
  }

  async function saveSkipExisting() {
    isSavingSkipExisting = true;
    try {
      await patchSearchTask({ skip_existing: skipExisting });
      searchTask.skip_existing = skipExisting;
    } catch (err) {
      console.error("Failed to save skip existing:", err);
    } finally {
      isSavingSkipExisting = false;
    }
  }

  async function saveStopAfterDuplicates() {
    const val = stopAfterDuplicatesEnabled
      ? parseIntOrNull(stopAfterDuplicatesInput)
      : null;
    isSavingStopAfterDuplicates = true;
    try {
      await patchSearchTask({ stop_after_duplicates: val });
      searchTask.stop_after_duplicates = val;
    } catch (err) {
      console.error("Failed to save stop after duplicates:", err);
    } finally {
      isSavingStopAfterDuplicates = false;
    }
  }

  async function saveSkipFirst() {
    const val = skipFirstEnabled ? parseIntOrNull(skipFirstInput) : null;
    isSavingSkipFirst = true;
    try {
      await patchSearchTask({ skip_first: val });
      searchTask.skip_first = val;
    } catch (err) {
      console.error("Failed to save skip first:", err);
    } finally {
      isSavingSkipFirst = false;
    }
  }

  async function saveBrowserProvider() {
    isSavingBrowserProvider = true;
    try {
      await patchSearchTask({ browser_provider: browserProvider });
      savedBrowserProvider = browserProvider;
      searchTask.browser_provider = browserProvider;
    } catch (err) {
      console.error("Failed to save browser provider:", err);
    } finally {
      isSavingBrowserProvider = false;
    }
  }

  async function saveTunnelApiKey() {
    isSavingTunnelApiKey = true;
    try {
      await patchSearchTask({ tunnel_api_key: tunnelApiKey });
      savedTunnelApiKey = tunnelApiKey;
      searchTask.tunnel_api_key = tunnelApiKey;
    } catch (err) {
      console.error("Failed to save tunnel device:", err);
    } finally {
      isSavingTunnelApiKey = false;
    }
  }

  async function saveKeepMinimized() {
    isSavingKeepMinimized = true;
    try {
      await patchSearchTask({ keep_minimized: keepMinimized });
      savedKeepMinimized = keepMinimized;
      searchTask.keep_minimized = keepMinimized;
    } catch (err) {
      console.error("Failed to save keep minimized:", err);
    } finally {
      isSavingKeepMinimized = false;
    }
  }

  async function saveSchedule() {
    isSavingSchedule = true;
    try {
      const val = scheduleIntervalInput ? parseInt(scheduleIntervalInput) : null;
      await patchSearchTask({ schedule_interval_hours: val });
      searchTask.schedule_interval_hours = val;
    } catch (err) {
      console.error("Failed to save schedule:", err);
    } finally {
      isSavingSchedule = false;
    }
  }

  async function saveBrowserCountryCode() {
    isSavingBrowserCountry = true;
    try {
      const code = editBrowserCountryCode.trim().toUpperCase() || null;
      await fetch(`/api/profile/${profileId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ browser_country_code: code }),
      });
      const normalized = code || "";
      editBrowserCountryCode = normalized;
      savedBrowserCountryCode = normalized;
    } catch (err) {
      console.error("Failed to save browser country code:", err);
    } finally {
      isSavingBrowserCountry = false;
    }
  }

  async function saveBrowserFingerprint() {
    isSavingBrowserFingerprint = true;
    try {
      await fetch(`/api/profile/${profileId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          browser_language: browserLanguage.trim() || null,
          browser_timezone: browserTimezone.trim() || null,
        }),
      });
      savedBrowserLanguage = browserLanguage;
      savedBrowserTimezone = browserTimezone;
    } catch (err) {
      console.error("Failed to save browser fingerprint:", err);
    } finally {
      isSavingBrowserFingerprint = false;
    }
  }

  function resetBrowserFingerprint() {
    browserLanguage = savedBrowserLanguage;
    browserTimezone = savedBrowserTimezone;
  }

  async function saveCredential() {
    isSavingCredential = true;
    try {
      const credProfileId = editSelectedCredentialId === "none"
        ? null
        : parseInt(editSelectedCredentialId);
      await patchSearchTask({ platform_profile_id: credProfileId });
      searchTask.platform_profile_id = credProfileId;
      editSavedCredentialId = editSelectedCredentialId;
    } catch (err) {
      console.error("Failed to save credential:", err);
    } finally {
      isSavingCredential = false;
    }
  }

  async function saveLoginMode() {
    isSavingLoginMode = true;
    try {
      await patchSearchTask({ login_mode: editLoginMode });
      searchTask.login_mode = editLoginMode;
      editSavedLoginMode = editLoginMode;
    } catch (err) {
      console.error("Failed to save login mode:", err);
    } finally {
      isSavingLoginMode = false;
    }
  }

  // Re-sync state when searchTask changes from outside (navigation)
  export function resetToData(newData: {
    searchTask: any;
    platformCredentials: any[];
    canEditPlatformUrls: boolean;
    browserCountryCode: string;
    defaultCountryCode: string;
    browserFingerprint: {
      language: string;
      timezone: string;
    };
    browserFingerprintDefaults: { language: string; timezone: string };
    uiPreferences: Record<string, unknown>;
  }) {
    searchUrlInput = newData.searchTask.search_url ?? "";
    searchTermInput = newData.searchTask.search_term ?? "";
    loginUrlInput = newData.searchTask.job_platforms?.login_page_url ?? "";
    maxJobsEnabled = newData.searchTask.max_jobs != null;
    maxJobsInput = newData.searchTask.max_jobs?.toString() ?? "";
    skipFirstEnabled = newData.searchTask.skip_first != null;
    skipFirstInput = newData.searchTask.skip_first?.toString() ?? "";
    stopAfterDuplicatesEnabled =
      newData.searchTask.stop_after_duplicates != null;
    stopAfterDuplicatesInput =
      newData.searchTask.stop_after_duplicates?.toString() ?? "";
    skipExisting = newData.searchTask.skip_existing ?? false;
    browserProvider = newData.searchTask.browser_provider ?? null;
    savedBrowserProvider = newData.searchTask.browser_provider ?? null;
    keepMinimized = newData.searchTask.keep_minimized ?? true;
    savedKeepMinimized = newData.searchTask.keep_minimized ?? true;
    scheduleIntervalInput = newData.searchTask.schedule_interval_hours?.toString() ?? "";
    editBrowserCountryCode = newData.browserCountryCode;
    savedBrowserCountryCode = newData.browserCountryCode;
    browserLanguage = newData.browserFingerprint.language;
    savedBrowserLanguage = newData.browserFingerprint.language;
    browserTimezone = newData.browserFingerprint.timezone;
    savedBrowserTimezone = newData.browserFingerprint.timezone;
    defaultBrowserLanguage = newData.browserFingerprintDefaults.language;
    defaultBrowserTimezone = newData.browserFingerprintDefaults.timezone;
    editPlatformCredentials = newData.platformCredentials;
    canEditPlatformUrls = newData.canEditPlatformUrls;
    const credId = newData.searchTask.platform_profile_id?.toString() ??
      "none";
    editSavedCredentialId = credId;
    editSelectedCredentialId = credId;
    editLoginMode = newData.searchTask.login_mode ?? "auto";
    editSavedLoginMode = newData.searchTask.login_mode ?? "auto";
    sectionOpen = {
      search: (() => {
        const v = newData.uiPreferences["task_sections_search"];
        return v === undefined ? true : Boolean(v);
      })(),
      auth: (() => {
        const v = newData.uiPreferences["task_sections_auth"];
        return v === undefined ? true : Boolean(v);
      })(),
      options: (() => {
        const v = newData.uiPreferences["task_sections_options"];
        return v === undefined ? true : Boolean(v);
      })(),
      browser: (() => {
        const v = newData.uiPreferences["task_sections_browser"];
        return v === undefined ? true : Boolean(v);
      })(),
    };
  }

  // Prevent browser form restoration from causing dirty state on page load/refresh.
  // Browsers can restore previous input values after Svelte hydration, which bind:value
  // picks up and makes fields appear dirty. Re-sync all state from props after mount.
  onMount(() => {
    if (isEdit && searchTask) {
      searchUrlInput = searchTask.search_url ?? "";
      searchTermInput = searchTask.search_term ?? "";
      loginUrlInput = searchTask.job_platforms?.login_page_url ?? "";
      maxJobsEnabled = searchTask.max_jobs != null;
      maxJobsInput = searchTask.max_jobs?.toString() ?? "";
      skipFirstEnabled = searchTask.skip_first != null;
      skipFirstInput = searchTask.skip_first?.toString() ?? "";
      stopAfterDuplicatesEnabled = searchTask.stop_after_duplicates != null;
      stopAfterDuplicatesInput = searchTask.stop_after_duplicates?.toString() ?? "";
      skipExisting = searchTask.skip_existing ?? false;
      browserProvider = searchTask.browser_provider ?? null;
      savedBrowserProvider = searchTask.browser_provider ?? null;
      keepMinimized = searchTask.keep_minimized ?? true;
      savedKeepMinimized = searchTask.keep_minimized ?? true;
      scheduleIntervalInput = searchTask.schedule_interval_hours?.toString() ?? "";
      editBrowserCountryCode = initialBrowserCountryCode;
      savedBrowserCountryCode = initialBrowserCountryCode;
      browserLanguage = browserFingerprint.language;
      savedBrowserLanguage = browserFingerprint.language;
      browserTimezone = browserFingerprint.timezone;
      savedBrowserTimezone = browserFingerprint.timezone;
      const credId = searchTask.platform_profile_id?.toString() ?? "none";
      editSavedCredentialId = credId;
      editSelectedCredentialId = credId;
      editLoginMode = searchTask.login_mode ?? "auto";
      editSavedLoginMode = searchTask.login_mode ?? "auto";
    }
  });
</script>

{#snippet saveCancel(
  dirty: boolean,
  saving: boolean,
  onSave: () => void,
  onCancel: () => void,
)}
  {#if dirty}
    <div class="flex items-center gap-2">
      <button
        type="button"
        onclick={onSave}
        disabled={saving}
        class="px-3 py-1 text-xs bg-[var(--dash-primary)] text-white rounded-md hover:bg-[var(--dash-primary-hover)] transition-colors disabled:opacity-50 flex items-center gap-1"
      >
        {#if saving}
          <Spinner size="w-3 h-3" />
        {:else}
          <FontAwesomeIcon icon={faCheck} class="w-3 h-3" />
        {/if}
        Save
      </button>
      <button
        type="button"
        onclick={onCancel}
        class="px-3 py-1 text-xs border border-[var(--dash-border)] rounded-md text-[var(--dash-text)] hover:bg-[var(--dash-bg)] transition-colors"
      >
        Cancel
      </button>
    </div>
  {/if}
{/snippet}

{#snippet sectionToggle(section: string, label: string)}
  <button
    type="button"
    onclick={() => toggleSection(section)}
    class="flex items-center gap-2 w-full text-left"
  >
    {#if sectionOpen[section]}
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
    <h3
      class="text-sm font-medium text-[var(--dash-text-muted)] uppercase tracking-wide"
    >
      {label}
    </h3>
  </button>
{/snippet}

<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
  <!-- Left column: Search & Credentials -->
  <div class="space-y-4">
    {#if isAdd || searchTask?.platform_id}
      {#if isEdit}
        {@render sectionToggle("search", "Search")}
      {/if}

      {#if isAdd || sectionOpen.search}
        <div class="space-y-3">
          <!-- Search URL -->
          {#if isAdd}
            <div>
              <h3
                class="text-xs font-medium text-[var(--dash-text-secondary)] mb-1"
              >
                Search URL <span class="text-[var(--dash-error)]">*</span>
              </h3>
              <div class="relative">
                <input
                  type="url"
                  name="search_url"
                  value={searchUrl}
                  oninput={onsearchurlinput}
                  placeholder="https://linkedin.com/jobs/search?keywords=frontend..."
                  required
                  class="w-full px-2 py-1 text-sm rounded border border-[var(--dash-border)] bg-[var(--dash-bg)] text-[var(--dash-text)] placeholder-[var(--dash-text-muted)]"
                />
                {#if detectingPlatform}
                  <div class="absolute right-3 top-1/2 -translate-y-1/2">
                    <Spinner size="w-4 h-4" color="var(--dash-text-secondary)" />
                  </div>
                {/if}
              </div>
              <p class="text-xs text-[var(--dash-text-muted)] mt-1">
                Paste a job search URL from LinkedIn, Indeed, or other job
                platforms
              </p>
            </div>

            <!-- Detected Platform Info -->
            {#if detectedPlatform}
              <div
                class="p-3 bg-[var(--dash-bg)] rounded-lg border border-[var(--dash-border)]"
              >
                <div class="flex items-center gap-2 text-sm">
                  <PlatformLogo
                    platformUrl={detectedPlatform.url}
                    size="w-5 h-5"
                  />
                  {#if detectedPlatform.isNew}
                    <span class="text-[var(--dash-text)]">New platform: <strong
                      >{detectedPlatform.name}</strong></span>
                  {:else}
                    <span class="text-[var(--dash-text)]"><strong>{
                        detectedPlatform.name
                      }</strong></span>
                  {/if}
                </div>
                <input
                  type="hidden"
                  name="platform_id"
                  value={detectedPlatform.id || ""}
                />
                <input
                  type="hidden"
                  name="platform_url"
                  value={detectedPlatform.url}
                />
                <input
                  type="hidden"
                  name="platform_name"
                  value={detectedPlatform.name}
                />
                <input
                  type="hidden"
                  name="platform_is_new"
                  value={detectedPlatform.isNew}
                />
              </div>
            {/if}
          {:else}
            <!-- Edit mode: Search URL -->
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
                  autocomplete="off"
                  placeholder="https://..."
                  class="flex-1 px-2 py-1 text-sm rounded border border-[var(--dash-border)] bg-[var(--dash-bg)] text-[var(--dash-text)] placeholder-[var(--dash-text-muted)]"
                />
                {#if searchTask?.search_url}
                  <a
                    href={searchTask.search_url}
                    target="_blank"
                    rel="noopener"
                    class="p-1 text-[var(--dash-text-secondary)] hover:text-[var(--dash-primary)] transition-colors"
                    title="Open search URL"
                  >
                    <FontAwesomeIcon
                      icon={faExternalLinkAlt}
                      class="w-3 h-3"
                    />
                  </a>
                {/if}
              </div>
              {#if searchUrlDirty}
                <div class="mt-2">
                  {@render             saveCancel(
              true,
              isSavingSearchUrl,
              saveSearchUrl,
              () => (searchUrlInput = searchTask?.search_url ?? ""),
            )}
                </div>
              {/if}
            </div>
          {/if}

          <!-- Search Term -->
          {#if isAdd}
            <div>
              <h3
                class="text-xs font-medium text-[var(--dash-text-secondary)] mb-1"
              >
                Search Term
                <span class="font-normal text-[var(--dash-text-muted)]"
                >(optional)</span>
              </h3>
              <input
                type="text"
                name="search_term"
                bind:value={searchTerm}
                placeholder="e.g., frontend developer amsterdam"
                class="w-full px-2 py-1 text-sm rounded border border-[var(--dash-border)] bg-[var(--dash-bg)] text-[var(--dash-text)] placeholder-[var(--dash-text-muted)]"
              />
              <p class="text-xs text-[var(--dash-text-muted)] mt-1">
                For sites that don't support search in the URL. The scraper will
                type this into the search field.
              </p>
            </div>
          {:else}
            <!-- Edit: collapsible advanced search term -->
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
                  autocomplete="off"
                  placeholder="e.g., frontend developer amsterdam"
                  class="w-full px-2 py-1 text-sm rounded border border-[var(--dash-border)] bg-[var(--dash-bg)] text-[var(--dash-text)] placeholder-[var(--dash-text-muted)]"
                />
                <p class="text-xs text-[var(--dash-text-muted)] mt-1">
                  For sites that don't support search in the URL. The scraper
                  will type this into the search field.
                </p>
                {#if searchTermDirty}
                  <div class="mt-2">
                    {@render             saveCancel(
              true,
              isSavingSearchTerm,
              saveSearchTerm,
              () => (searchTermInput = searchTask?.search_term ??
                ""),
            )}
                  </div>
                {/if}
              </div>
            {/if}
          {/if}
        </div>
      {/if}

      <!-- Authentication -->
      <div class="pt-4 border-t border-[var(--dash-border)] space-y-3">
        {#if isEdit}
          {@render sectionToggle("auth", "Authentication")}
        {:else}
          <h3
            class="text-sm font-medium text-[var(--dash-text-muted)] uppercase tracking-wide"
          >
            Authentication
          </h3>
        {/if}

        {#if isAdd || (isEdit && sectionOpen.auth)}
          <!-- Login URL -->
          {#if isAdd}
            <div>
              <h3
                class="text-xs font-medium text-[var(--dash-text-secondary)] mb-1"
              >
                Login Page URL
                <span class="font-normal text-[var(--dash-text-muted)]"
                >(optional)</span>
              </h3>
              <input
                type="url"
                name="login_page_url"
                bind:value={loginPageUrl}
                placeholder="https://linkedin.com/login"
                class="w-full px-2 py-1 text-sm rounded border border-[var(--dash-border)] bg-[var(--dash-bg)] text-[var(--dash-text)] placeholder-[var(--dash-text-muted)]"
              />
              <p class="text-xs text-[var(--dash-text-muted)] mt-1">
                URL of the login page. Used to auto-fill credentials before
                scraping.
              </p>
            </div>
          {:else}
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
                    autocomplete="off"
                    placeholder="https://..."
                    class="flex-1 px-2 py-1 text-sm rounded border border-[var(--dash-border)] bg-[var(--dash-bg)] text-[var(--dash-text)] placeholder-[var(--dash-text-muted)]"
                  />
                  {#if searchTask?.job_platforms?.login_page_url}
                    <a
                      href={searchTask.job_platforms.login_page_url}
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
                  <div class="mt-2">
                    {@render             saveCancel(
              true,
              isSavingLoginUrl,
              saveLoginUrl,
              () => (loginUrlInput =
                searchTask?.job_platforms?.login_page_url ?? ""),
            )}
                  </div>
                {/if}
              {:else if searchTask?.job_platforms?.login_page_url}
                <a
                  href={searchTask.job_platforms.login_page_url}
                  target="_blank"
                  rel="noopener"
                  class="text-sm text-[var(--dash-primary)] hover:underline break-all flex items-center gap-1"
                >
                  {searchTask.job_platforms.login_page_url}
                  <FontAwesomeIcon
                    icon={faExternalLinkAlt}
                    class="w-3 h-3 flex-shrink-0"
                  />
                </a>
              {:else}
                <p class="text-sm text-[var(--dash-text-muted)]">Not set</p>
              {/if}
            </div>
          {/if}

          <!-- Credentials -->
          {#if isAdd}
          <!-- Login Mode (add mode) -->
          <div class="border-t border-[var(--dash-border)] pt-3">
            <h3
              class="text-xs font-medium text-[var(--dash-text-secondary)] mb-2"
            >
              Login Mode
            </h3>

            <div class="flex rounded-md border border-[var(--dash-border)] overflow-hidden">
              <button
                type="button"
                onclick={() => { addLoginMode = "auto"; if (selectedCredentialId === "none") selectedCredentialId = existingCredentials.length > 0 ? String(existingCredentials[0].id) : "new"; showNewCredentials = selectedCredentialId === "new"; }}
                class={`flex-1 px-3 py-1.5 text-xs font-medium transition-colors ${
                  addLoginMode === "auto"
                    ? "bg-[var(--dash-primary)] text-white"
                    : "bg-[var(--dash-bg)] text-[var(--dash-text-secondary)] hover:bg-[var(--dash-surface)]"
                }`}
              >
                Auto-login
              </button>
              <button
                type="button"
                onclick={() => { addLoginMode = "manual"; selectedCredentialId = "none"; showNewCredentials = false; }}
                class={`flex-1 px-3 py-1.5 text-xs font-medium transition-colors ${
                  addLoginMode === "manual"
                    ? "bg-[var(--dash-primary)] text-white"
                    : "bg-[var(--dash-bg)] text-[var(--dash-text-secondary)] hover:bg-[var(--dash-surface)]"
                }`}
              >
                Manual login
              </button>
              <button
                type="button"
                onclick={() => { addLoginMode = "none"; selectedCredentialId = "none"; showNewCredentials = false; }}
                class={`flex-1 px-3 py-1.5 text-xs font-medium transition-colors ${
                  addLoginMode === "none"
                    ? "bg-[var(--dash-primary)] text-white"
                    : "bg-[var(--dash-bg)] text-[var(--dash-text-secondary)] hover:bg-[var(--dash-surface)]"
                }`}
              >
                No login
              </button>
            </div>
            <input type="hidden" name="login_mode" value={addLoginMode} />
            <p class="text-xs text-[var(--dash-text-muted)] mt-1.5">
              {#if addLoginMode === "auto"}
                The scraper will fill in credentials and log in automatically.
              {:else if addLoginMode === "manual"}
                The scraper will navigate to the login page and wait for you to log in.
              {:else}
                The scraper will go directly to the search page without logging in.
              {/if}
            </p>
          </div>

          <!-- Credentials (only for auto-login) -->
          {#if addLoginMode === "auto"}
            <div>
              <h3
                class="text-xs font-medium text-[var(--dash-text-secondary)] mb-2"
              >
                Login Credentials
              </h3>

              <select
                name="credential_id"
                value={selectedCredentialId}
                onchange={(e) =>
                  handleCredentialSelection(
                    (e.target as HTMLSelectElement).value,
                  )}
                class="w-full px-2 py-1 text-sm border border-[var(--dash-border)] rounded bg-[var(--dash-bg)] text-[var(--dash-text)]"
              >
                {#each existingCredentials as cred}
                  <option value={String(cred.id)}>{cred.username}</option>
                {/each}
                <option value="new">+ Add new credentials</option>
              </select>

              {#if showNewCredentials}
                <div
                  class="mt-3 p-3 bg-[var(--dash-bg)] rounded-lg space-y-3"
                >
                  <div>
                    <label
                      for="add-cred-username"
                      class="block text-sm text-[var(--dash-text)] mb-1"
                    >
                      Username / Email
                    </label>
                    <input
                      type="text"
                      id="add-cred-username"
                      name="new_credential_username"
                      bind:value={newCredUsername}
                      placeholder="your@email.com"
                      class="w-full px-2 py-1 text-sm border border-[var(--dash-border)] rounded bg-[var(--dash-bg)] text-[var(--dash-text)] placeholder-[var(--dash-text-muted)]"
                    />
                  </div>
                  <div>
                    <label
                      for="add-cred-password"
                      class="block text-sm text-[var(--dash-text)] mb-1"
                    >
                      Password
                    </label>
                    <div class="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        id="add-cred-password"
                        name="new_credential_password"
                        bind:value={newCredPassword}
                        placeholder="Enter password"
                        class="w-full px-2 py-1 pr-8 text-sm border border-[var(--dash-border)] rounded bg-[var(--dash-bg)] text-[var(--dash-text)] placeholder-[var(--dash-text-muted)]"
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
                  <!-- Advanced: security answer -->
                  <button
                    type="button"
                    onclick={() => (showAdvancedAuth = !showAdvancedAuth)}
                    class="flex items-center gap-1.5 text-xs text-[var(--dash-text-muted)] hover:text-[var(--dash-text-secondary)] transition-colors"
                  >
                    {#if showAdvancedAuth}
                      <FontAwesomeIcon icon={faChevronDown} class="w-2.5 h-2.5" />
                    {:else}
                      <FontAwesomeIcon icon={faChevronRight} class="w-2.5 h-2.5" />
                    {/if}
                    Advanced
                  </button>
                  {#if showAdvancedAuth}
                    <div>
                      <label
                        for="add-cred-security-answer"
                        class="block text-xs text-[var(--dash-text-secondary)] mb-1"
                      >
                        Security Question Answer <span class="font-normal text-[var(--dash-text-muted)]">(optional)</span>
                      </label>
                      <input
                        type="text"
                        id="add-cred-security-answer"
                        name="new_credential_security_answer"
                        bind:value={newCredSecurityAnswer}
                        placeholder="e.g., your mother's maiden name"
                        class="w-full px-2 py-1 text-sm border border-[var(--dash-border)] rounded bg-[var(--dash-bg)] text-[var(--dash-text)] placeholder-[var(--dash-text-muted)]"
                      />
                      <p class="text-xs text-[var(--dash-text-muted)] mt-1">
                        Auto-filled when a site asks a security question after login.
                      </p>
                    </div>
                  {/if}
                </div>
              {/if}
            </div>
          {/if}
          {:else}
            <CredentialSelector
              bind:credentials={editPlatformCredentials}
              bind:selectedId={editSelectedCredentialId}
              bind:loginMode={editLoginMode}
              platformId={searchTask?.platform_id}
              {profileId}
              platformName={searchTask?.job_platforms?.name}
              oncredentialadded={() => {
                // Auto-save credential selection when a new one is added via "Add & Select"
                saveCredential();
              }}
              oncredentialdeleted={(credId) => {
                if (searchTask?.platform_id_profile_id === credId) {
                  searchTask.platform_profile_id = null;
                  editSavedCredentialId = "none";
                }
              }}
            />

            {#if loginModeDirty}
              <div class="mt-3">
                {@render saveCancel(
                  true,
                  isSavingLoginMode,
                  saveLoginMode,
                  () => (editLoginMode = editSavedLoginMode),
                )}
              </div>
            {/if}

            {#if credentialDirty}
              <div class="mt-3">
                {@render           saveCancel(
            true,
            isSavingCredential,
            saveCredential,
            () => (editSelectedCredentialId = editSavedCredentialId),
          )}
              </div>
            {/if}
          {/if}

          <!-- Email Verification Relay -->
          {#if verificationEmailAddress}
            <div class="pt-3 border-t border-[var(--dash-border)]">
              <div class="flex items-center gap-2 mb-1.5">
                <FontAwesomeIcon icon={faEnvelope} class="w-3.5 h-3.5 text-[var(--dash-text-muted)]" />
                <span class="text-sm text-[var(--dash-text-secondary)]">Email verification relay</span>
              </div>
              <div class="flex items-center gap-2">
                <code class="flex-1 px-2 py-1.5 text-xs font-mono bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded select-all text-[var(--dash-text)] truncate">{verificationEmailAddress}</code>
                <button
                  type="button"
                  onclick={copyVerificationEmail}
                  class="px-2 py-1.5 bg-[var(--dash-card)] border border-[var(--dash-border)] rounded hover:bg-[var(--dash-border)] transition-colors text-xs shrink-0"
                  title="Copy to clipboard"
                >
                  {#if copiedVerifyEmail}
                    <FontAwesomeIcon icon={faCheck} class="w-3.5 h-3.5 text-[var(--dash-success)]" />
                  {:else}
                    <FontAwesomeIcon icon={faCopy} class="w-3.5 h-3.5" />
                  {/if}
                </button>
              </div>
              <p class="text-xs text-[var(--dash-text-muted)] mt-1.5">
                Forward verification emails from job sites to this address for auto-login.
              </p>
            </div>
          {/if}
        {/if}
      </div>
    {/if}

  </div>

  <!-- Right column: Scraping Options & Browser Control -->
  <div
    class="lg:border-l lg:border-[var(--dash-border)] lg:pl-6 space-y-4"
  >
    <hr class="border-[var(--dash-border)] lg:hidden" />

    <!-- Scraping Options -->
    {#if isEdit}
      {@render sectionToggle("options", "Scraping Options")}
    {:else}
      <h3
        class="text-sm font-medium text-[var(--dash-text-muted)] uppercase tracking-wide"
      >
        Scraping Options
      </h3>
    {/if}

    {#if isAdd || sectionOpen.options}
      <div class="space-y-3">
        <!-- Max jobs -->
        <div class="flex items-center flex-wrap gap-3">
          <label class="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isAdd ? addMaxJobsEnabled : maxJobsEnabled}
              onchange={(e) => {
                if (isAdd) {
                  addMaxJobsEnabled =
                    (e.target as HTMLInputElement).checked;
                } else {maxJobsEnabled =
                    (e.target as HTMLInputElement).checked;}
              }}
              class="w-4 h-4 rounded border-[var(--dash-border)] text-[var(--dash-primary)] focus:ring-[var(--dash-primary)]"
            />
            <span
              class="text-sm text-[var(--dash-text-secondary)] whitespace-nowrap"
            >Max jobs to process</span>
          </label>
          {#if isAdd}
            <input
              type="number"
              name="max_jobs"
              min="1"
              placeholder="No limit"
              bind:value={addMaxJobsInput}
              disabled={!addMaxJobsEnabled}
              class="w-24 px-2 py-1 text-sm rounded border border-[var(--dash-border)] bg-[var(--dash-bg)] text-[var(--dash-text)] placeholder-[var(--dash-text-muted)] disabled:opacity-40"
            />
          {:else}
            <input
              type="number"
              min="1"
              placeholder="No limit"
              bind:value={maxJobsInput}
              autocomplete="off"
              disabled={!maxJobsEnabled}
              class="w-24 px-2 py-1 text-sm rounded border border-[var(--dash-border)] bg-[var(--dash-bg)] text-[var(--dash-text)] placeholder-[var(--dash-text-muted)] disabled:opacity-40"
            />
            {@render           saveCancel(
            maxJobsDirty,
            isSavingMaxJobs,
            saveMaxJobs,
            () => {
              maxJobsInput = searchTask?.max_jobs?.toString() ?? "";
              maxJobsEnabled = searchTask?.max_jobs != null;
            },
          )}
          {/if}
        </div>

        <!-- Already imported behavior -->
        <div class="flex items-center flex-wrap gap-3">
          <span
            class="text-sm text-[var(--dash-text-secondary)] whitespace-nowrap"
          >Already imported jobs</span>
          <div
            class="flex rounded-md border border-[var(--dash-border)] overflow-hidden"
          >
            <button
              type="button"
              onclick={() => {
                if (isAdd) addSkipExisting = false;
                else skipExisting = false;
              }}
              class={`px-3 py-1 text-xs font-medium transition-colors ${
                !(isAdd ? addSkipExisting : skipExisting)
                  ? "bg-[var(--dash-primary)] text-white"
                  : "bg-[var(--dash-bg)] text-[var(--dash-text-secondary)] hover:bg-[var(--dash-surface)]"
              }`}
            >
              Update
            </button>
            <button
              type="button"
              onclick={() => {
                if (isAdd) addSkipExisting = true;
                else skipExisting = true;
              }}
              class={`px-3 py-1 text-xs font-medium transition-colors ${
                (isAdd ? addSkipExisting : skipExisting)
                  ? "bg-[var(--dash-primary)] text-white"
                  : "bg-[var(--dash-bg)] text-[var(--dash-text-secondary)] hover:bg-[var(--dash-surface)]"
              }`}
            >
              Skip
            </button>
          </div>
          {#if isAdd}
            <input
              type="hidden"
              name="skip_existing"
              value={addSkipExisting ? "true" : "false"}
            />
          {:else}
            {@render           saveCancel(
            skipExistingDirty,
            isSavingSkipExisting,
            saveSkipExisting,
            () => (skipExisting = searchTask?.skip_existing ?? false),
          )}
          {/if}
        </div>

        <!-- Stop after duplicates -->
        <div class="flex items-center flex-wrap gap-3">
          <label class="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isAdd
                ? addStopAfterDuplicatesEnabled
                : stopAfterDuplicatesEnabled}
              onchange={(e) => {
                if (isAdd) {
                  addStopAfterDuplicatesEnabled =
                    (e.target as HTMLInputElement).checked;
                } else {stopAfterDuplicatesEnabled =
                    (e.target as HTMLInputElement).checked;}
              }}
              class="w-4 h-4 rounded border-[var(--dash-border)] text-[var(--dash-primary)] focus:ring-[var(--dash-primary)]"
            />
            <span
              class="text-sm text-[var(--dash-text-secondary)] whitespace-nowrap"
            >Stop after</span>
          </label>
          {#if isAdd}
            <input
              type="number"
              name="stop_after_duplicates"
              min="1"
              placeholder="Off"
              bind:value={addStopAfterDuplicatesInput}
              disabled={!addStopAfterDuplicatesEnabled}
              class="w-20 px-2 py-1 text-sm rounded border border-[var(--dash-border)] bg-[var(--dash-bg)] text-[var(--dash-text)] placeholder-[var(--dash-text-muted)] disabled:opacity-40"
            />
          {:else}
            <input
              type="number"
              min="1"
              placeholder="Off"
              bind:value={stopAfterDuplicatesInput}
              autocomplete="off"
              disabled={!stopAfterDuplicatesEnabled}
              class="w-20 px-2 py-1 text-sm rounded border border-[var(--dash-border)] bg-[var(--dash-bg)] text-[var(--dash-text)] placeholder-[var(--dash-text-muted)] disabled:opacity-40"
            />
          {/if}
          <span
            class="text-sm text-[var(--dash-text-secondary)]"
            class:opacity-40={isAdd
              ? !addStopAfterDuplicatesEnabled
              : !stopAfterDuplicatesEnabled}
          >already imported jobs in a row</span>
          {#if isEdit}
            {@render           saveCancel(
            stopAfterDuplicatesDirty,
            isSavingStopAfterDuplicates,
            saveStopAfterDuplicates,
            () => {
              stopAfterDuplicatesInput =
                searchTask?.stop_after_duplicates?.toString() ?? "";
              stopAfterDuplicatesEnabled =
                searchTask?.stop_after_duplicates != null;
            },
          )}
          {/if}
        </div>

        <!-- Skip first -->
        <div class="flex items-center flex-wrap gap-3">
          <label class="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isAdd ? addSkipFirstEnabled : skipFirstEnabled}
              onchange={(e) => {
                if (isAdd) {
                  addSkipFirstEnabled =
                    (e.target as HTMLInputElement).checked;
                } else {skipFirstEnabled =
                    (e.target as HTMLInputElement).checked;}
              }}
              class="w-4 h-4 rounded border-[var(--dash-border)] text-[var(--dash-primary)] focus:ring-[var(--dash-primary)]"
            />
            <span
              class="text-sm text-[var(--dash-text-secondary)] whitespace-nowrap"
            >Skip first</span>
          </label>
          {#if isAdd}
            <input
              type="number"
              name="skip_first"
              min="1"
              placeholder="Off"
              bind:value={addSkipFirstInput}
              disabled={!addSkipFirstEnabled}
              class="w-20 px-2 py-1 text-sm rounded border border-[var(--dash-border)] bg-[var(--dash-bg)] text-[var(--dash-text)] placeholder-[var(--dash-text-muted)] disabled:opacity-40"
            />
          {:else}
            <input
              type="number"
              min="1"
              placeholder="Off"
              bind:value={skipFirstInput}
              autocomplete="off"
              disabled={!skipFirstEnabled}
              class="w-20 px-2 py-1 text-sm rounded border border-[var(--dash-border)] bg-[var(--dash-bg)] text-[var(--dash-text)] placeholder-[var(--dash-text-muted)] disabled:opacity-40"
            />
          {/if}
          <span
            class="text-sm text-[var(--dash-text-secondary)]"
            class:opacity-40={isAdd ? !addSkipFirstEnabled : !skipFirstEnabled}
          >jobs</span>
          {#if isEdit}
            {@render           saveCancel(
            skipFirstDirty,
            isSavingSkipFirst,
            saveSkipFirst,
            () => {
              skipFirstInput = searchTask?.skip_first?.toString() ??
                "";
              skipFirstEnabled = searchTask?.skip_first != null;
            },
          )}
          {/if}
        </div>

      </div>
    {/if}

    <!-- Schedule -->
    <div class="flex items-center flex-wrap gap-3">
      <span class="text-sm text-[var(--dash-text-secondary)] whitespace-nowrap">
        Auto-run
      </span>
      {#if isAdd}
        <select
          name="schedule_interval_hours"
          bind:value={addScheduleInterval}
          class="px-2 py-1 text-sm border border-[var(--dash-border)] rounded bg-[var(--dash-bg)] text-[var(--dash-text)]"
        >
          {#each SCHEDULE_OPTIONS as opt}
            <option value={opt.value}>{opt.label}</option>
          {/each}
        </select>
      {:else}
        <select
          bind:value={scheduleIntervalInput}
          class="px-2 py-1 text-sm border border-[var(--dash-border)] rounded bg-[var(--dash-bg)] text-[var(--dash-text)]"
        >
          {#each SCHEDULE_OPTIONS as opt}
            <option value={opt.value}>{opt.label}</option>
          {/each}
        </select>
        {@render saveCancel(
          scheduleDirty,
          isSavingSchedule,
          saveSchedule,
          () => (scheduleIntervalInput = searchTask?.schedule_interval_hours?.toString() ?? ""),
        )}
      {/if}
    </div>

    <!-- Browser Control -->
    <hr class="border-[var(--dash-border)] mt-4" />
    {#if isEdit}
      {@render sectionToggle("browser", "Browser Control")}
    {:else}
      <h3
        class="text-sm font-medium text-[var(--dash-text-muted)] uppercase tracking-wide"
      >
        Browser Control
      </h3>
    {/if}

    {#if isAdd || sectionOpen.browser}
      <div class="space-y-3">
        {#if isAdd}
          <BrowserProviderToggle
            bind:value={addBrowserProvider}
            {localBrowserAllowed}
            {devices}
          />
          <input
            type="hidden"
            name="browser_provider"
            value={addBrowserProvider ?? ""}
          />
        {:else}
          <BrowserProviderToggle
            bind:value={browserProvider}
            bind:tunnelApiKey
            {localBrowserAllowed}
            {devices}
          />
          {#if browserProviderDirty || tunnelApiKeyDirty}
            {@render saveCancel(
              true,
              isSavingBrowserProvider || isSavingTunnelApiKey,
              async () => {
                if (browserProviderDirty) await saveBrowserProvider();
                if (tunnelApiKeyDirty) await saveTunnelApiKey();
              },
              () => {
                browserProvider = savedBrowserProvider;
                tunnelApiKey = savedTunnelApiKey;
              },
            )}
          {/if}
        {/if}

        <!-- Desktop connection status (edit only) -->
        {#if isEdit && isTunnelMode && desktopConnected !== null}
          <div
            class="
              flex items-center gap-2 text-xs {isTunnelMode &&
              !desktopConnected
              ? 'text-amber-600'
              : 'text-[var(--dash-text-secondary)]'}
            "
          >
            <span
              class="
                w-2 h-2 rounded-full {desktopConnected
                ? 'bg-green-500'
                : isTunnelMode
                ? 'bg-amber-500'
                : 'bg-[var(--dash-text-muted)]'}
              "
            ></span>
            <FontAwesomeIcon icon={faDesktop} class="w-3 h-3" />
            {#if desktopConnected}
              {devices.filter(d => d.connected).map(d => d.apiKeyName).join(", ") || "Device connected"}
            {:else}
              No device connected — <a href="/dashboard/jobs/import/devices" class="underline hover:text-amber-700">Setup guide</a>
            {/if}
          </div>
        {/if}

        <!-- Browser Location (hosted mode) -->
        {#if isHostedMode}
          <div class="mt-2 pt-3 border-t border-[var(--dash-border)]">
            <div class="flex items-center gap-2 mb-2">
              <FontAwesomeIcon
                icon={faGlobe}
                class="w-3.5 h-3.5 text-[var(--dash-text-secondary)]"
              />
              <h3
                class="text-xs font-medium text-[var(--dash-text-secondary)]"
              >
                Browser Location
              </h3>
            </div>
            {#if isAdd}
              <div class="flex-1">
                <CountrySelect
                  bind:value={addBrowserCountryCode}
                  fallback={defaultCountryCode}
                />
              </div>
              <input
                type="hidden"
                name="browser_country_code"
                value={addBrowserCountryCode}
              />
            {:else}
              <div class="flex items-center gap-2">
                <div class="flex-1">
                  <CountrySelect
                    bind:value={editBrowserCountryCode}
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
                      <Spinner size="w-3 h-3" />
                    {:else}
                      <FontAwesomeIcon icon={faCheck} class="w-3 h-3" />
                    {/if}
                    Save
                  </button>
                  <button
                    type="button"
                    onclick={() => (editBrowserCountryCode =
                      savedBrowserCountryCode)}
                    class="px-3 py-1 text-xs border border-[var(--dash-border)] rounded-md text-[var(--dash-text)] hover:bg-[var(--dash-bg)] transition-colors"
                  >
                    Cancel
                  </button>
                {/if}
                {#if isSavingBrowserCountry && !browserCountryDirty}
                  <Spinner size="w-3 h-3" color="var(--dash-text-muted)" />
                {/if}
              </div>
            {/if}
            <p class="text-xs text-[var(--dash-text-muted)] mt-2">
              The country the scraper will appear to browse from. Set this to
              match your actual location to avoid your account being flagged for
              logging in from unusual locations.{
                isEdit
                  ? " If empty, your profile's country is used."
                  : ""
              }
            </p>

            <!-- Advanced: browser fingerprint -->
            {#if isEdit}
              <button
                type="button"
                onclick={() => (showAdvancedBrowser = !showAdvancedBrowser)}
                class="mt-3 flex items-center gap-1.5 text-xs text-[var(--dash-text-muted)] hover:text-[var(--dash-text-secondary)] transition-colors"
              >
                {#if showAdvancedBrowser}
                  <FontAwesomeIcon
                    icon={faChevronDown}
                    class="w-2.5 h-2.5"
                  />
                {:else}
                  <FontAwesomeIcon
                    icon={faChevronRight}
                    class="w-2.5 h-2.5"
                  />
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
                      autocomplete="off"
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
                      autocomplete="off"
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

                  {#if browserFingerprintDirty}
                    <div class="flex items-center gap-2 pt-1">
                      {@render               saveCancel(
                true,
                isSavingBrowserFingerprint,
                saveBrowserFingerprint,
                resetBrowserFingerprint,
              )}
                    </div>
                  {/if}
                  {#if             isSavingBrowserFingerprint && !browserFingerprintDirty}
                    <Spinner size="w-3 h-3" color="var(--dash-text-muted)" />
                  {/if}
                </div>
              {/if}
            {/if}
          </div>
        {/if}

        <!-- Keep Minimized (desktop/tunnel mode) -->
        {#if isTunnelMode}
          <div class="mt-2 pt-3 border-t border-[var(--dash-border)]">
            <div class="flex items-center flex-wrap gap-3">
              <label class="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isAdd ? addKeepMinimized : keepMinimized}
                  onchange={(e) => {
                    if (isAdd) {
                      addKeepMinimized =
                        (e.target as HTMLInputElement).checked;
                    } else {keepMinimized =
                        (e.target as HTMLInputElement).checked;}
                  }}
                  class="w-4 h-4 rounded border-[var(--dash-border)] text-[var(--dash-primary)] focus:ring-[var(--dash-primary)]"
                />
                <span class="text-sm text-[var(--dash-text-secondary)]"
                >Keep Chrome minimized</span>
              </label>
              {#if isAdd}
                <input
                  type="hidden"
                  name="keep_minimized"
                  value={addKeepMinimized ? "true" : "false"}
                />
              {:else}
                {@render             saveCancel(
              keepMinimizedDirty,
              isSavingKeepMinimized,
              saveKeepMinimized,
              () => (keepMinimized = savedKeepMinimized),
            )}
              {/if}
            </div>
            <p class="text-xs text-[var(--dash-text-muted)] mt-2">
              When enabled, Chrome is automatically minimized while the scraper
              runs. Disable to watch the browser in real-time.
            </p>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>
