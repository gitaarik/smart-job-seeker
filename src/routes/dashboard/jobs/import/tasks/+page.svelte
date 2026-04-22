<script lang="ts">
  import type { ActionData, PageData } from "./$types";
  import { enhance } from "$app/forms";
  import { goto } from "$app/navigation";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import { onMount } from "svelte";
  import {
    faCalendar,
    faClock,
    faDesktop,
    faExclamationTriangle,
    faPlus,
    faSearch,
    faTimes,
    faSortAmountDown,
  } from "@fortawesome/free-solid-svg-icons";
  import { getSearchTaskStatusIcon } from "$lib/search-task-status";
  import { searchTaskDisplayName } from "$lib/format";
  import Spinner from "$lib/components/Spinner.svelte";
  import PlatformLogo from "$lib/components/PlatformLogo.svelte";
  import EmptyState from "../../../profile/components/EmptyState.svelte";
  import SearchTaskFields from "../../components/SearchTaskFields.svelte";

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let searchTasks = $derived(data.searchTasks);
  let showAddForm = $state(false);

  // Sort options (initialized from server-persisted preference)
  type SortOption = "added" | "alpha" | "last_run";
  const validSorts: SortOption[] = ["added", "alpha", "last_run"];
  let sortBy = $state<SortOption>(
    validSorts.includes(data.searchTaskSort as SortOption)
      ? (data.searchTaskSort as SortOption)
      : "added",
  );

  function setSortBy(value: SortOption) {
    sortBy = value;
    fetch(`/api/profile/${data.profileId}/ui-preferences`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ searchTaskSort: value }),
    });
  }

  let sortedSearchTasks = $derived.by(() => {
    const tasks = [...searchTasks];
    switch (sortBy) {
      case "alpha":
        return tasks.sort((a, b) => {
          const nameA = a.job_platform?.name?.toLowerCase() ?? "";
          const nameB = b.job_platform?.name?.toLowerCase() ?? "";
          return nameA.localeCompare(nameB);
        });
      case "last_run": {
        const activeStatuses = ["running", "queued", "blocked", "stopping"];
        return tasks.sort((a, b) => {
          const aActive = activeStatuses.includes(a.status ?? "") ? 1 : 0;
          const bActive = activeStatuses.includes(b.status ?? "") ? 1 : 0;
          if (aActive !== bActive) return bActive - aActive;
          const dateA = a.last_run ? new Date(a.last_run).getTime() : 0;
          const dateB = b.last_run ? new Date(b.last_run).getTime() : 0;
          return dateB - dateA;
        });
      }
      case "added":
      default:
        return tasks.sort((a, b) => {
          const dateA = a.date_created ? new Date(a.date_created).getTime() : 0;
          const dateB = b.date_created ? new Date(b.date_created).getTime() : 0;
          return dateB - dateA;
        });
    }
  });

  // Desktop scraper connection status
  let desktopConnected = $state<boolean | null>(null); // null = checking
  let connectedDeviceNames = $state<string[]>([]);

  let anyTaskUsesDesktop = $derived(
    searchTasks.some((s) => s.browser_provider === "local"),
  );

  async function checkDesktopStatus() {
    try {
      const res = await fetch(`/api/tunnel?profileId=${data.profileId}`);
      const result = await res.json();
      desktopConnected = result.connected === true;
      connectedDeviceNames = (result.devices ?? []).map((d: { apiKeyName: string }) => d.apiKeyName);
    } catch {
      desktopConnected = false;
      connectedDeviceNames = [];
    }
  }

  onMount(() => {
    checkDesktopStatus();
    const interval = setInterval(checkDesktopStatus, 15000);
    return () => clearInterval(interval);
  });

  // Form states for new entry
  let newNote = $state("");
  let newSearchUrl = $state("");
  let newSearchTerm = $state("");
  let newLoginPageUrl = $state("");

  // Auto-detected platform state
  let detectedPlatform = $state<
    {
      id: number;
      name: string;
      url: string;
      loginPageUrl: string | null;
      isNew: boolean;
    } | null
  >(null);
  let detectingPlatform = $state(false);

  // Credentials state for new entry
  let existingCredentials = $state<
    Array<{
      id: number;
      username: string | null;
      status: string;
    }>
  >([]);

  // Debounce timer
  let urlDebounce: ReturnType<typeof setTimeout> | null = null;

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

  async function detectPlatformFromUrl(searchUrl: string) {
    if (!searchUrl) {
      detectedPlatform = null;
      existingCredentials = [];
      return;
    }

    // Extract base URL
    let baseUrl: string;
    try {
      const parsed = new URL(
        searchUrl.startsWith("http") ? searchUrl : `https://${searchUrl}`,
      );
      baseUrl = parsed.origin;
    } catch {
      return;
    }

    detectingPlatform = true;

    try {
      const response = await fetch(
        `/api/platforms/detect?url=${
          encodeURIComponent(baseUrl)
        }&profileId=${data.profileId}`,
      );
      if (response.ok) {
        const result = await response.json();
        detectedPlatform = result.platform;
        existingCredentials = result.credentials || [];
        if (result.platform.loginPageUrl) {
          newLoginPageUrl = result.platform.loginPageUrl;
        }
      }
    } catch {
      // Ignore errors
    } finally {
      detectingPlatform = false;
    }
  }

  function handleSearchUrlInput(e: Event) {
    const value = (e.target as HTMLInputElement).value;
    newSearchUrl = value;

    // Debounce platform detection
    if (urlDebounce) clearTimeout(urlDebounce);
    urlDebounce = setTimeout(() => detectPlatformFromUrl(value), 500);
  }

  function resetAddForm() {
    showAddForm = false;
    newNote = "";
    newSearchUrl = "";
    newSearchTerm = "";
    newLoginPageUrl = "";
    detectedPlatform = null;
    existingCredentials = [];
  }

  function handleAddSubmit() {
    return async ({
      result,
    }: {
      result: { type: string; data?: { taskId?: number } };
      update: () => Promise<void>;
    }) => {
      if (result.type === "success" && result.data?.taskId) {
        resetAddForm();
        goto(`/dashboard/jobs/import/tasks/${result.data.taskId}`);
      }
    };
  }

  function getStatusColor(search: (typeof searchTasks)[0]): string {
    if (search.status === "running" || search.status === "queued") {
      return "text-blue-500";
    }
    if (search.status === "stopping") return "text-orange-500";
    if (search.status === "blocked" || search.status === "partial") {
      return "text-yellow-600";
    }
    if (search.status === "error") return "text-red-500";
    if (search.status === "success") return "text-[var(--dash-success)]";
    if (search.last_run) return "text-[var(--dash-success)]";
    return "text-[var(--dash-text-muted)]";
  }

  function getStatusBgColor(search: (typeof searchTasks)[0]): string {
    if (search.status === "running" || search.status === "queued") {
      return "bg-blue-500/10";
    }
    if (search.status === "stopping") return "bg-orange-500/10";
    if (search.status === "blocked" || search.status === "partial") {
      return "bg-yellow-500/10";
    }
    if (search.status === "error") return "bg-red-500/10";
    if (search.status === "success") return "bg-green-500/10";
    if (search.last_run) return "bg-green-500/10";
    return "bg-[var(--dash-bg)]";
  }
</script>

<svelte:head>
  <title>Import Tasks - Import Jobs - Smart Job Seeker</title>
</svelte:head>

<div class="space-y-4">
  {#if !showAddForm && searchTasks.length > 0}
    <div class="flex items-center gap-4 flex-wrap">
      {#if desktopConnected !== null && (anyTaskUsesDesktop || desktopConnected)}
        <div
          class="flex items-center gap-2 text-xs text-[var(--dash-text-secondary)]"
        >
          <span
            class="w-2 h-2 rounded-full {desktopConnected ? 'bg-green-500' : 'bg-[var(--dash-text-muted)]'}"
          ></span>
          <FontAwesomeIcon icon={faDesktop} class="w-3 h-3" />
          {#if desktopConnected}
            {connectedDeviceNames.join(", ")}
          {:else}
            No device connected — <a href="/dashboard/jobs/import/devices" class="underline hover:text-[var(--dash-primary)]">Setup guide</a>
          {/if}
        </div>
      {/if}

      {#if searchTasks.length > 1}
        <div class="flex items-center gap-2 text-xs text-[var(--dash-text-secondary)]">
          <FontAwesomeIcon icon={faSortAmountDown} class="w-3 h-3" />
          {#each [
            { value: "added", label: "Date added" },
            { value: "last_run", label: "Last run" },
            { value: "alpha", label: "A–Z" },
          ] as opt}
            <button
              type="button"
              onclick={() => setSortBy(opt.value as SortOption)}
              class="px-2 py-0.5 rounded-full transition-colors {sortBy === opt.value
                ? 'bg-[var(--dash-primary)] text-white'
                : 'bg-[var(--dash-bg)] hover:bg-[var(--dash-border)]'}"
            >
              {opt.label}
            </button>
          {/each}
        </div>
      {/if}

      <div class="ml-auto">
        <button
          type="button"
          onclick={() => (showAddForm = true)}
          class="flex items-center gap-2 px-3 py-1.5 text-xs bg-[var(--dash-primary)] text-white rounded-lg hover:bg-[var(--dash-primary-hover)] transition-colors"
        >
          <FontAwesomeIcon icon={faPlus} class="w-3 h-3" />
          Add Import
        </button>
      </div>
    </div>
  {/if}

  {#if form?.error}
    <div
      class="bg-[var(--dash-error-light)] border border-[var(--dash-error)] rounded-lg p-4"
    >
      <p class="text-[var(--dash-error)] text-sm">{form.error}</p>
    </div>
  {/if}

  <!-- Add Form -->
  {#if showAddForm}
    <form
      method="POST"
      action="?/create"
      use:enhance={handleAddSubmit}
      class="bg-[var(--dash-card)] rounded-lg border border-[var(--dash-primary)] p-4"
    >
      <h3 class="font-medium text-[var(--dash-text)] mb-4">
        Add Import Task
      </h3>
      <div class="space-y-4">
        <SearchTaskFields
          mode="add"
          localBrowserAllowed={data.localBrowserAllowed}
          serverBrowserProvider={data.serverBrowserProvider}
          defaultBrowserProvider={data.defaultBrowserProvider}
          defaultMaxJobs={data.defaultMaxJobs}
          browserCountryCode={data.browserCountryCode}
          defaultCountryCode={data.defaultCountryCode}
          bind:searchUrl={newSearchUrl}
          bind:searchTerm={newSearchTerm}
          bind:loginPageUrl={newLoginPageUrl}
          {detectedPlatform}
          {detectingPlatform}
          {existingCredentials}
          onsearchurlinput={handleSearchUrlInput}
        />

        <!-- Optional note -->
        <div>
          <h3
            class="text-xs font-medium text-[var(--dash-text-secondary)] mb-1"
          >
            Note <span class="font-normal text-[var(--dash-text-muted)]">(optional)</span>
          </h3>
          <input
            type="text"
            id="new-note"
            name="note"
            bind:value={newNote}
            placeholder="e.g., Remote only, senior roles"
            class="w-full px-2 py-1 text-sm border border-[var(--dash-border)] rounded bg-[var(--dash-bg)] text-[var(--dash-text)] placeholder-[var(--dash-text-muted)]"
          />
        </div>
      </div>

      <div class="flex justify-end gap-2 mt-4">
        <button
          type="button"
          onclick={resetAddForm}
          class="px-4 py-2 border border-[var(--dash-border)] rounded-lg text-[var(--dash-text)] hover:bg-[var(--dash-bg)] transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          class="px-4 py-2 bg-[var(--dash-primary)] text-white rounded-lg hover:bg-[var(--dash-primary-hover)] transition-colors"
        >
          Add Task
        </button>
      </div>
    </form>
  {/if}

  <!-- Job Searches List -->
  {#if searchTasks.length === 0 && !showAddForm}
    <EmptyState
      icon={faSearch}
      title="No search tasks yet"
      description="Create search tasks to automatically find matching jobs from LinkedIn, Indeed, and other platforms."
      actionLabel="Add First Search"
      onAction={() => (showAddForm = true)}
    />
  {:else if !showAddForm}
    <div class="space-y-3">
      {#each sortedSearchTasks as search (search.id)}
        {@const statusIcon = getSearchTaskStatusIcon(search)}
        <a
          href="/dashboard/jobs/import/tasks/{search.id}"
          class="block bg-[var(--dash-card)] rounded-lg border border-[var(--dash-border)] p-3 sm:p-4 hover:bg-[var(--dash-bg)] transition-colors"
        >
          <div class="flex items-start gap-3">
            <!-- Desktop: Platform logo on the left -->
            <div class="hidden md:flex flex-shrink-0">
              <div
                class="
                  w-12 h-12 rounded-lg {getStatusBgColor(
                  search,
                  )} flex items-center justify-center
                "
              >
                <PlatformLogo
                  platformUrl={search.job_platform?.url}
                  size="w-7 h-7"
                />
              </div>
            </div>

            <div class="flex-1 min-w-0">
              <!-- Title: platform name + optional note -->
              <div class="flex items-center gap-2 flex-wrap">
                <h3
                  class="font-medium text-[var(--dash-text)] text-sm sm:text-base"
                >
                  {search.job_platform?.name || "Search task"}
                  {#if search.note}
                    <span class="text-[var(--dash-text-secondary)] font-normal">—</span>
                    <span
                      class="text-[var(--dash-text-secondary)] text-sm font-normal"
                    >{search.note}</span>
                  {/if}
                </h3>
                {#if search.browser_provider === "local"}
                  <span
                    class={desktopConnected ? 'text-green-500' : desktopConnected === false ? 'text-red-400' : 'text-[var(--dash-text-muted)]'}
                    title={desktopConnected ? connectedDeviceNames.join(", ") : "No device connected"}
                  >
                    <FontAwesomeIcon icon={faDesktop} class="w-3.5 h-3.5" />
                  </span>
                {/if}
                {#if search.status === "running"}
                  <span
                    class="text-xs px-2 py-0.5 rounded-full whitespace-nowrap flex items-center gap-1 bg-blue-500/20 text-blue-600"
                  >
                    <Spinner size="w-3 h-3" />
                    Running
                  </span>
                {:else if search.status === "queued"}
                  <span
                    class="text-xs px-2 py-0.5 rounded-full whitespace-nowrap flex items-center gap-1 bg-blue-500/20 text-blue-600"
                  >
                    <FontAwesomeIcon icon={faClock} class="w-3 h-3" />
                    Queued
                  </span>
                {:else if search.status === "stopping"}
                  <span
                    class="text-xs px-2 py-0.5 rounded-full whitespace-nowrap flex items-center gap-1 bg-orange-500/20 text-orange-600"
                  >
                    <Spinner size="w-3 h-3" />
                    Stopping
                  </span>
                {:else if search.status === "blocked"}
                  <span
                    class="text-xs px-2 py-0.5 rounded-full whitespace-nowrap flex items-center gap-1 bg-yellow-500/20 text-yellow-600 animate-pulse"
                  >
                    <FontAwesomeIcon
                      icon={faExclamationTriangle}
                      class="w-3 h-3"
                    />
                    Action needed
                  </span>
                {:else if search.status === "error"}
                  <span
                    class="text-xs px-2 py-0.5 rounded-full whitespace-nowrap flex items-center gap-1 bg-red-500/20 text-red-600"
                  >
                    <FontAwesomeIcon icon={faTimes} class="w-3 h-3" />
                    Error
                  </span>
                {:else if !search.is_active}
                  <span
                    class="text-xs px-2 py-0.5 rounded-full bg-[var(--dash-bg)] text-[var(--dash-text-muted)] whitespace-nowrap"
                  >
                    Inactive
                  </span>
                {/if}
                {#if search.schedule_interval_hours}
                  {@const days = search.schedule_interval_hours / 24}
                  {@const prefHour = search.schedule_preferred_hour ?? 9}
                  {@const h12 = prefHour === 0 ? 12 : prefHour > 12 ? prefHour - 12 : prefHour}
                  {@const ampm = prefHour < 12 ? "AM" : "PM"}
                  <span
                    class="text-xs px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 whitespace-nowrap"
                    title="Scheduled auto-run at {h12}:00 {ampm}"
                  >
                    {days >= 14 ? `Every ${days / 7} weeks`
                      : days >= 7 ? "Weekly"
                      : days > 1 ? `Every ${days} days`
                      : "Daily"} at {h12} {ampm}
                  </span>
                {/if}
              </div>

              <!-- Status info -->
              <div
                class="flex items-center gap-1 mt-1 text-xs sm:text-sm text-[var(--dash-text-secondary)] flex-wrap"
              >
                {#if search.status === "queued"}
                  <span class="text-[var(--dash-text-muted)]">{
                    search.status_message || "Waiting in queue..."
                  }</span>
                {:else if search.status === "running"}
                  <Spinner size={statusIcon.iconSize} color="var(--dash-primary)" />
                  <span>{search.status_message || "Running..."}</span>
                {:else if search.status === "stopping"}
                  <Spinner size={statusIcon.iconSize} color="var(--dash-error)" />
                  <span class="text-orange-600">Stopping...</span>
                {:else if search.status === "success"}
                  <FontAwesomeIcon
                    icon={statusIcon.icon}
                    class="{statusIcon.iconSize} {statusIcon.colorClass}"
                  />
                  <span>{formatDate(search.last_run)}</span>
                  {#if search.last_run_jobs_found}
                    <span class="text-[var(--dash-text-muted)]"
                    >({search.last_run_jobs_found} jobs)</span>
                  {/if}
                {:else if search.status === "blocked"}
                  <FontAwesomeIcon
                    icon={statusIcon.icon}
                    class="{statusIcon.iconSize} {statusIcon.colorClass}"
                  />
                  <span class="text-[var(--dash-warning)]">{
                    search.status_message
                  }</span>
                {:else if search.status === "partial"}
                  <FontAwesomeIcon
                    icon={statusIcon.icon}
                    class="{statusIcon.iconSize} {statusIcon.colorClass}"
                  />
                  <span>{formatDate(search.last_run)}</span>
                  <span class="text-[var(--dash-text-muted)]">— {
                      search.status_message
                    }</span>
                {:else if search.status === "error"}
                  <FontAwesomeIcon
                    icon={statusIcon.icon}
                    class="{statusIcon.iconSize} {statusIcon.colorClass}"
                  />
                  <span class="text-[var(--dash-error)]">{
                    search.status_message
                  }</span>
                {:else if search.status === "cancelled"}
                  <FontAwesomeIcon
                    icon={statusIcon.icon}
                    class="{statusIcon.iconSize} {statusIcon.colorClass}"
                  />
                  <span class="text-[var(--dash-text-muted)]">{
                    search.status_message || "Cancelled"
                  }</span>
                {:else if search.last_run}
                  <FontAwesomeIcon
                    icon={statusIcon.icon}
                    class="{statusIcon.iconSize} {statusIcon.colorClass}"
                  />
                  <span>{formatDate(search.last_run)}</span>
                {:else}
                  <span class="text-[var(--dash-text-muted)]">Never run</span>
                {/if}
              </div>

              {#if search.schedule_interval_hours && search.next_scheduled_run}
                {@const nextRun = new Date(search.next_scheduled_run)}
                {@const diffMs = nextRun.getTime() - Date.now()}
                {@const prefHour = search.schedule_preferred_hour ?? 9}
                {@const ampm = prefHour < 12 ? "AM" : "PM"}
                {@const h12 = prefHour === 0 ? 12 : prefHour > 12 ? prefHour - 12 : prefHour}
                <div class="flex items-center gap-1 text-xs text-[var(--dash-text-muted)] mt-1">
                  <FontAwesomeIcon icon={faCalendar} class="w-3 h-3" />
                  <span>
                    Next run {diffMs <= 0 ? "due now" :
                      diffMs < 3600000 ? `in ${Math.floor(diffMs / 60000)}m` :
                      diffMs < 86400000 ? `in ${Math.floor(diffMs / 3600000)}h ${Math.floor((diffMs % 3600000) / 60000)}m` :
                      `${nextRun.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}`}
                    at {h12}:00 {ampm}
                  </span>
                </div>
              {/if}
            </div>

            <!-- Mobile: Platform logo on the right -->
            <div class="flex-shrink-0 md:hidden">
              <div
                class="
                  w-10 h-10 rounded-lg {getStatusBgColor(
                  search,
                  )} flex items-center justify-center
                "
              >
                <PlatformLogo
                  platformUrl={search.job_platform?.url}
                  size="w-6 h-6"
                />
              </div>
            </div>
          </div>
        </a>
      {/each}
    </div>
  {/if}
</div>
