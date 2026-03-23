<script lang="ts">
  import type { ActionData, PageData } from "./$types";
  import { enhance } from "$app/forms";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import { onMount } from "svelte";
  import {
    faDesktop,
    faExclamationTriangle,
    faSearch,
    faTimes,
  } from "@fortawesome/free-solid-svg-icons";
  import { getSearchTaskStatusIcon } from "$lib/search-task-status";
  import Spinner from "$lib/components/Spinner.svelte";
  import SectionHeader from "../../profile/components/SectionHeader.svelte";
  import EmptyState from "../../profile/components/EmptyState.svelte";
  import SearchTaskFields from "../components/SearchTaskFields.svelte";

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let searchTasks = $derived(data.searchTasks);
  let showAddForm = $state(false);

  // Desktop scraper connection status
  let desktopConnected = $state<boolean | null>(null); // null = checking

  let anyTaskUsesDesktop = $derived(
    searchTasks.some((s) => s.browser_provider === "local"),
  );

  async function checkDesktopStatus() {
    try {
      const res = await fetch(`/api/tunnel?profileId=${data.profileId}`);
      const result = await res.json();
      desktopConnected = result.connected === true;
    } catch {
      desktopConnected = false;
    }
  }

  onMount(() => {
    checkDesktopStatus();
    const interval = setInterval(checkDesktopStatus, 15000);
    return () => clearInterval(interval);
  });

  // Form states for new entry
  let newName = $state("");
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
    newName = "";
    newSearchUrl = "";
    newSearchTerm = "";
    newLoginPageUrl = "";
    detectedPlatform = null;
    existingCredentials = [];
  }

  function handleAddSubmit() {
    return async ({
      result,
      update,
    }: {
      result: { type: string };
      update: () => Promise<void>;
    }) => {
      await update();
      if (result.type === "success") {
        resetAddForm();
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

<div class="space-y-6">
  <SectionHeader
    title="Search Tasks"
    icon={faSearch}
    showAddButton={!showAddForm && searchTasks.length > 0}
    addLabel="Add Search"
    onAdd={() => (showAddForm = true)}
  />

  {#if     desktopConnected !== null && (anyTaskUsesDesktop || desktopConnected)}
    <div
      class="flex items-center gap-2 text-xs text-[var(--dash-text-secondary)]"
    >
      <span
        class="w-2 h-2 rounded-full {desktopConnected ? 'bg-green-500' : 'bg-[var(--dash-text-muted)]'}"
      ></span>
      <FontAwesomeIcon icon={faDesktop} class="w-3 h-3" />
      {#if desktopConnected}
        Desktop app connected
      {:else}
        Desktop app not connected — <a href="/dashboard/export/local-setup" class="underline hover:text-[var(--dash-primary)]">Setup guide</a>
      {/if}
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
        Add New Job Search
      </h3>
      <div class="space-y-4">
        <!-- Search Name -->
        <div>
          <label
            for="new-name"
            class="block text-sm font-medium text-[var(--dash-text)] mb-1"
          >
            Search Name <span class="text-[var(--dash-error)]">*</span>
          </label>
          <input
            type="text"
            id="new-name"
            name="name"
            bind:value={newName}
            placeholder="e.g., Senior Frontend Developer"
            required
            class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
          />
        </div>

        <SearchTaskFields
          mode="add"
          localBrowserAllowed={data.localBrowserAllowed}
          serverBrowserProvider={data.serverBrowserProvider}
          defaultBrowserProvider={data.defaultBrowserProvider}
          defaultMaxJobs={data.defaultMaxJobs}
          bind:searchUrl={newSearchUrl}
          bind:searchTerm={newSearchTerm}
          bind:loginPageUrl={newLoginPageUrl}
          {detectedPlatform}
          {detectingPlatform}
          {existingCredentials}
          onsearchurlinput={handleSearchUrlInput}
        />
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
          Add Search
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
  {:else}
    <div class="space-y-3">
      {#each searchTasks as search (search.id)}
        {@const statusIcon = getSearchTaskStatusIcon(search)}
        <a
          href="/dashboard/jobs/settings/{search.id}"
          class="block bg-[var(--dash-card)] rounded-lg border border-[var(--dash-border)] p-3 sm:p-4 hover:bg-[var(--dash-bg)] transition-colors"
        >
          <div class="flex items-start gap-3">
            <!-- Desktop: Icon on the left -->
            <div class="hidden md:flex flex-shrink-0">
              <div
                class="
                  w-12 h-12 rounded-lg {getStatusBgColor(
                  search,
                  )} flex items-center justify-center
                "
              >
                <FontAwesomeIcon
                  icon={faSearch}
                  class="w-6 h-6 {getStatusColor(search)}"
                />
              </div>
            </div>

            <div class="flex-1 min-w-0">
              <!-- Title: name @ platform -->
              <div class="flex items-center gap-2 flex-wrap">
                <h3
                  class="font-medium text-[var(--dash-text)] text-sm sm:text-base"
                >
                  {search.name}
                  {#if search.job_platforms}
                    <span class="text-[var(--dash-text-secondary)] font-normal"
                    >@</span>
                    <span
                      class="bg-[var(--dash-bg-inset)] px-2 py-0.5 rounded text-sm font-normal inline-block"
                    >{search.job_platforms.name}</span>
                  {/if}
                </h3>
                {#if search.browser_provider === "local"}
                  <span
                    class="
                      text-xs px-2 py-0.5 rounded-full whitespace-nowrap flex items-center gap-1 {desktopConnected
                      ? 'bg-green-500/10 text-green-600'
                      : desktopConnected === false
                      ? 'bg-amber-500/10 text-amber-600'
                      : 'bg-[var(--dash-bg)] text-[var(--dash-text-muted)]'}
                    "
                    title={desktopConnected
                      ? "Desktop app connected"
                      : "Desktop app not connected"}
                  >
                    <FontAwesomeIcon icon={faDesktop} class="w-3 h-3" />
                    {
                      desktopConnected
                        ? "Connected"
                        : desktopConnected === false
                        ? "Disconnected"
                        : "..."
                    }
                  </span>
                {/if}
                {#if               search.status === "running" ||
                search.status === "queued"}
                  <span
                    class="text-xs px-2 py-0.5 rounded-full whitespace-nowrap flex items-center gap-1 bg-blue-500/20 text-blue-600"
                  >
                    <Spinner size="w-3 h-3" />
                    {
                      search.status === "queued"
                        ? "Queued"
                        : "Running"
                    }
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
                  <span>Running...</span>
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
            </div>

            <!-- Mobile: Icon on the right -->
            <div class="flex-shrink-0 md:hidden">
              <div
                class="
                  w-10 h-10 rounded-lg {getStatusBgColor(
                  search,
                  )} flex items-center justify-center
                "
              >
                <FontAwesomeIcon
                  icon={faSearch}
                  class="w-5 h-5 {getStatusColor(search)}"
                />
              </div>
            </div>
          </div>
        </a>
      {/each}
    </div>
  {/if}
</div>
