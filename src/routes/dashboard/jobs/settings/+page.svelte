<script lang="ts">
  import type { ActionData, PageData } from "./$types";
  import { enhance } from "$app/forms";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faCheck,
    faChevronDown,
    faChevronUp,
    faExclamationTriangle,
    faExternalLinkAlt,
    faEye,
    faEyeSlash,
    faKey,
    faPencil,
    faPlay,
    faPlus,
    faSearch,
    faSpinner,
    faTimes,
    faTrash,
  } from "@fortawesome/free-solid-svg-icons";
  import SectionHeader from "../../profile/components/SectionHeader.svelte";
  import EmptyState from "../../profile/components/EmptyState.svelte";
  import DeleteConfirmModal from "../../profile/components/DeleteConfirmModal.svelte";

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let jobSearches = $derived(data.jobSearches);
  let expandedId = $state<number | null>(null);
  let editingId = $state<number | null>(null);
  let showAddForm = $state(false);
  let deleteId = $state<number | null>(null);

  // Form states for new entry
  let newName = $state("");
  let newSearchUrl = $state("");
  let newStatus = $state("active");

  // Auto-detected platform state
  let detectedPlatform = $state<{
    id: number;
    name: string;
    url: string;
    isNew: boolean;
  } | null>(null);
  let detectingPlatform = $state(false);

  // Credentials state for new entry
  let existingCredentials = $state<
    Array<{
      id: number;
      username: string | null;
      status: string;
    }>
  >([]);
  let selectedCredentialId = $state<string>("none");
  let showNewCredentials = $state(false);
  let newCredUsername = $state("");
  let newCredPassword = $state("");
  let showPassword = $state(false);

  // Form states for editing
  let editName = $state("");
  let editSearchUrl = $state("");
  let editStatus = $state("");
  let editCredentialId = $state<string>("none");
  let editShowNewCredentials = $state(false);
  let editNewCredUsername = $state("");
  let editNewCredPassword = $state("");
  let editShowPassword = $state(false);
  let editDetectedPlatform = $state<{
    id: number;
    name: string;
    url: string;
    isNew: boolean;
  } | null>(null);
  let editExistingCredentials = $state<
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

  function toggleExpand(id: number) {
    if (editingId === id) return;
    expandedId = expandedId === id ? null : id;
  }

  async function detectPlatformFromUrl(searchUrl: string, isEdit = false) {
    if (!searchUrl) {
      if (isEdit) {
        editDetectedPlatform = null;
        editExistingCredentials = [];
      } else {
        detectedPlatform = null;
        existingCredentials = [];
      }
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
      // Check if platform exists or get metadata for new one
      const response = await fetch(
        `/api/platforms/detect?url=${encodeURIComponent(baseUrl)}&profileId=${data.profileId}`,
      );
      if (response.ok) {
        const result = await response.json();
        if (isEdit) {
          editDetectedPlatform = result.platform;
          editExistingCredentials = result.credentials || [];
          if (result.credentials?.length > 0 && editCredentialId === "none") {
            // Don't auto-select, let user choose
          }
        } else {
          detectedPlatform = result.platform;
          existingCredentials = result.credentials || [];
        }
      }
    } catch {
      // Ignore errors
    } finally {
      detectingPlatform = false;
    }
  }

  function handleSearchUrlInput(e: Event, isEdit = false) {
    const value = (e.target as HTMLInputElement).value;
    if (isEdit) {
      editSearchUrl = value;
    } else {
      newSearchUrl = value;
    }

    // Debounce platform detection
    if (urlDebounce) clearTimeout(urlDebounce);
    urlDebounce = setTimeout(() => detectPlatformFromUrl(value, isEdit), 500);
  }

  function handleCredentialSelection(value: string, isEdit = false) {
    if (isEdit) {
      editCredentialId = value;
      editShowNewCredentials = value === "new";
    } else {
      selectedCredentialId = value;
      showNewCredentials = value === "new";
    }
  }

  function startEdit(search: (typeof jobSearches)[0]) {
    editingId = search.id;
    expandedId = search.id;
    editName = search.name || "";
    editSearchUrl = search.search_url || "";
    editStatus = search.status || "active";
    editCredentialId = search.platform_profile_id?.toString() || "none";
    editShowNewCredentials = false;
    editNewCredUsername = "";
    editNewCredPassword = "";
    editShowPassword = false;

    // Detect platform from existing URL
    if (search.search_url) {
      detectPlatformFromUrl(search.search_url, true);
    }
  }

  function cancelEdit() {
    editingId = null;
    editDetectedPlatform = null;
    editExistingCredentials = [];
  }

  function resetAddForm() {
    showAddForm = false;
    newName = "";
    newSearchUrl = "";
    newStatus = "active";
    detectedPlatform = null;
    existingCredentials = [];
    selectedCredentialId = "none";
    showNewCredentials = false;
    newCredUsername = "";
    newCredPassword = "";
    showPassword = false;
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

  function handleEditSubmit() {
    return async ({
      result,
      update,
    }: {
      result: { type: string };
      update: () => Promise<void>;
    }) => {
      await update();
      if (result.type === "success") {
        editingId = null;
        editDetectedPlatform = null;
        editExistingCredentials = [];
      }
    };
  }

  function getStatusColor(search: (typeof jobSearches)[0]): string {
    if (search.status === "active") return "text-[var(--dash-success)]";
    return "text-[var(--dash-text-muted)]";
  }

  function getStatusBgColor(search: (typeof jobSearches)[0]): string {
    if (search.status === "active") return "bg-green-500/10";
    return "bg-[var(--dash-bg)]";
  }
</script>

<div class="space-y-6">
  <SectionHeader
    title="Search Tasks"
    icon={faSearch}
    showAddButton={!showAddForm && jobSearches.length > 0}
    addLabel="Add Search"
    onAdd={() => (showAddForm = true)}
  />

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
        <!-- Search URL (first!) -->
        <div>
          <label
            for="new-search-url"
            class="block text-sm font-medium text-[var(--dash-text)] mb-1"
          >
            Search URL <span class="text-[var(--dash-error)]">*</span>
          </label>
          <div class="relative">
            <input
              type="url"
              id="new-search-url"
              name="search_url"
              value={newSearchUrl}
              oninput={(e) => handleSearchUrlInput(e)}
              placeholder="https://linkedin.com/jobs/search?keywords=frontend..."
              required
              class="w-full px-3 py-2 pr-10 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
            />
            {#if detectingPlatform}
              <div class="absolute right-3 top-1/2 -translate-y-1/2">
                <FontAwesomeIcon
                  icon={faSpinner}
                  class="w-4 h-4 text-[var(--dash-text-secondary)] animate-spin"
                />
              </div>
            {/if}
          </div>
          <p class="text-xs text-[var(--dash-text-secondary)] mt-1">
            Paste a job search URL from LinkedIn, Indeed, or other job platforms
          </p>
        </div>

        <!-- Detected Platform Info -->
        {#if detectedPlatform}
          <div
            class="p-3 bg-[var(--dash-bg)] rounded-lg border border-[var(--dash-border)]"
          >
            <div class="flex items-center gap-2 text-sm">
              {#if detectedPlatform.isNew}
                <FontAwesomeIcon
                  icon={faPlus}
                  class="w-4 h-4 text-[var(--dash-primary)]"
                />
                <span class="text-[var(--dash-text)]"
                  >New platform: <strong>{detectedPlatform.name}</strong></span
                >
              {:else}
                <FontAwesomeIcon
                  icon={faCheck}
                  class="w-4 h-4 text-[var(--dash-success)]"
                />
                <span class="text-[var(--dash-text)]"
                  >Platform: <strong>{detectedPlatform.name}</strong></span
                >
              {/if}
            </div>
            <!-- Hidden inputs for platform data -->
            <input type="hidden" name="platform_id" value={detectedPlatform.id || ""} />
            <input type="hidden" name="platform_url" value={detectedPlatform.url} />
            <input type="hidden" name="platform_name" value={detectedPlatform.name} />
            <input type="hidden" name="platform_is_new" value={detectedPlatform.isNew} />
          </div>
        {/if}

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

        <!-- Credentials Section -->
        {#if detectedPlatform}
          <div class="border-t border-[var(--dash-border)] pt-4">
            <label class="block text-sm font-medium text-[var(--dash-text)] mb-2">
              <FontAwesomeIcon icon={faKey} class="w-4 h-4 mr-1" />
              Login Credentials
              <span class="text-[var(--dash-text-muted)] font-normal"
                >(optional)</span
              >
            </label>

            <select
              name="credential_id"
              value={selectedCredentialId}
              onchange={(e) =>
                handleCredentialSelection((e.target as HTMLSelectElement).value)}
              class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
            >
              <option value="none">No credentials (public search)</option>
              {#each existingCredentials as cred}
                <option value={String(cred.id)}>{cred.username}</option>
              {/each}
              <option value="new">+ Add new credentials</option>
            </select>

            {#if showNewCredentials}
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
                    name="new_credential_username"
                    bind:value={newCredUsername}
                    placeholder="your@email.com"
                    class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
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
                      name="new_credential_password"
                      bind:value={newCredPassword}
                      placeholder="Enter password"
                      class="w-full px-3 py-2 pr-10 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
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
              </div>
            {/if}
          </div>
        {/if}

        <!-- Status -->
        <div>
          <label
            for="new-status"
            class="block text-sm font-medium text-[var(--dash-text)] mb-1"
          >
            Status
          </label>
          <select
            id="new-status"
            name="status"
            bind:value={newStatus}
            class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
          >
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="archived">Archived</option>
          </select>
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
          Add Search
        </button>
      </div>
    </form>
  {/if}

  <!-- Job Searches List -->
  {#if jobSearches.length === 0 && !showAddForm}
    <EmptyState
      icon={faSearch}
      title="No search tasks yet"
      description="Create search tasks to automatically find matching jobs from LinkedIn, Indeed, and other platforms."
      actionLabel="Add First Search"
      onAction={() => (showAddForm = true)}
    />
  {:else}
    <div class="space-y-3">
      {#each jobSearches as search (search.id)}
        <div
          class="bg-[var(--dash-card)] rounded-lg border border-[var(--dash-border)] overflow-hidden relative transition-all"
        >
          <!-- Chevron in top right corner -->
          <button
            type="button"
            onclick={(e) => {
              e.stopPropagation();
              toggleExpand(search.id);
            }}
            class="absolute top-3 right-3 p-1.5 text-[var(--dash-text-secondary)] hover:text-[var(--dash-primary)] transition-colors z-10"
            aria-label={expandedId === search.id ? "Collapse" : "Expand"}
          >
            <FontAwesomeIcon
              icon={expandedId === search.id ? faChevronUp : faChevronDown}
              class="w-4 h-4"
            />
          </button>

          <!-- Header (clickable to expand/collapse) -->
          <button
            type="button"
            onclick={() => toggleExpand(search.id)}
            class="w-full p-3 sm:p-4 hover:bg-[var(--dash-bg)] transition-colors text-left cursor-pointer"
          >
            <div class="flex items-start gap-3">
              <!-- Desktop: Icon on the left -->
              <div class="hidden md:flex flex-shrink-0">
                <div
                  class="w-12 h-12 rounded-lg {getStatusBgColor(
                    search,
                  )} flex items-center justify-center"
                >
                  <FontAwesomeIcon
                    icon={faSearch}
                    class="w-6 h-6 {getStatusColor(search)}"
                  />
                </div>
              </div>

              <div class="flex-1 min-w-0">
                <!-- Title -->
                <div class="flex items-center gap-2 pr-8">
                  <h3
                    class="font-medium text-[var(--dash-text)] text-sm sm:text-base truncate"
                  >
                    {search.name}
                  </h3>
                  {#if !search.is_active}
                    <span
                      class="text-xs px-2 py-0.5 rounded-full bg-[var(--dash-bg)] text-[var(--dash-text-muted)] whitespace-nowrap"
                    >
                      Inactive
                    </span>
                  {/if}
                  {#if search.platform_profiles}
                    <span
                      class="text-xs px-2 py-0.5 rounded-full bg-[var(--dash-success-light)] text-[var(--dash-success)] whitespace-nowrap flex items-center gap-1"
                    >
                      <FontAwesomeIcon icon={faKey} class="w-3 h-3" />
                      Auto-login
                    </span>
                  {/if}
                </div>

                <!-- Status info -->
                <div
                  class="flex items-center gap-1 mt-1 text-xs sm:text-sm text-[var(--dash-text-secondary)] flex-wrap"
                >
                  {#if search.job_platforms}
                    <span>{search.job_platforms.name}</span>
                    <span>•</span>
                  {/if}
                  {#if search.status === "running"}
                    <FontAwesomeIcon
                      icon={faSpinner}
                      class="w-3 h-3 text-[var(--dash-primary)] animate-spin"
                    />
                    <span>Running...</span>
                  {:else if search.status === "success"}
                    <FontAwesomeIcon
                      icon={faCheck}
                      class="w-3 h-3 text-[var(--dash-success)]"
                    />
                    <span>{formatDate(search.last_run)}</span>
                    {#if search.last_run_jobs_found}
                      <span class="text-[var(--dash-text-muted)]"
                        >({search.last_run_jobs_found} jobs)</span
                      >
                    {/if}
                  {:else if search.status === "blocked"}
                    <FontAwesomeIcon
                      icon={faExclamationTriangle}
                      class="w-3 h-3 text-[var(--dash-warning)]"
                    />
                    <span class="text-[var(--dash-warning)]"
                      >{search.status_message}</span
                    >
                  {:else if search.status === "partial"}
                    <FontAwesomeIcon
                      icon={faExclamationTriangle}
                      class="w-3 h-3 text-[var(--dash-warning)]"
                    />
                    <span>{formatDate(search.last_run)}</span>
                    <span class="text-[var(--dash-text-muted)]"
                      >— {search.status_message}</span
                    >
                  {:else if search.status === "error"}
                    <FontAwesomeIcon
                      icon={faTimes}
                      class="w-3 h-3 text-[var(--dash-error)]"
                    />
                    <span class="text-[var(--dash-error)]"
                      >{search.status_message}</span
                    >
                  {:else if search.last_run}
                    <FontAwesomeIcon
                      icon={faCheck}
                      class="w-3 h-3 text-[var(--dash-success)]"
                    />
                    <span>{formatDate(search.last_run)}</span>
                  {:else}
                    <span class="text-[var(--dash-text-muted)]">Never run</span>
                  {/if}
                </div>
              </div>

              <!-- Mobile: Icon on the right, below chevron -->
              <div class="flex-shrink-0 md:hidden flex flex-col items-end">
                <div class="h-6 mb-1"></div>
                <!-- Spacer for chevron -->
                <div
                  class="w-12 h-12 rounded-lg {getStatusBgColor(
                    search,
                  )} flex items-center justify-center"
                >
                  <FontAwesomeIcon
                    icon={faSearch}
                    class="w-6 h-6 {getStatusColor(search)}"
                  />
                </div>
              </div>
            </div>
          </button>

          <!-- Expanded Content -->
          {#if expandedId === search.id}
            <div class="border-t border-[var(--dash-border)] p-3 sm:p-4">
              {#if editingId === search.id}
                <!-- Edit Mode -->
                <form method="POST" action="?/update" use:enhance={handleEditSubmit}>
                  <input type="hidden" name="id" value={search.id} />
                  <div class="space-y-4">
                    <!-- Search URL -->
                    <div>
                      <label
                        for="edit-search-url-{search.id}"
                        class="block text-sm font-medium text-[var(--dash-text)] mb-1"
                      >
                        Search URL
                      </label>
                      <input
                        type="url"
                        id="edit-search-url-{search.id}"
                        name="search_url"
                        value={editSearchUrl}
                        oninput={(e) => handleSearchUrlInput(e, true)}
                        class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
                      />
                    </div>

                    <!-- Detected Platform -->
                    {#if editDetectedPlatform}
                      <div
                        class="p-3 bg-[var(--dash-bg)] rounded-lg border border-[var(--dash-border)]"
                      >
                        <div class="flex items-center gap-2 text-sm">
                          <FontAwesomeIcon
                            icon={faCheck}
                            class="w-4 h-4 text-[var(--dash-success)]"
                          />
                          <span class="text-[var(--dash-text)]"
                            >Platform: <strong>{editDetectedPlatform.name}</strong
                            ></span
                          >
                        </div>
                        <input
                          type="hidden"
                          name="platform_id"
                          value={editDetectedPlatform.id || ""}
                        />
                        <input
                          type="hidden"
                          name="platform_url"
                          value={editDetectedPlatform.url}
                        />
                        <input
                          type="hidden"
                          name="platform_name"
                          value={editDetectedPlatform.name}
                        />
                        <input
                          type="hidden"
                          name="platform_is_new"
                          value={editDetectedPlatform.isNew}
                        />
                      </div>
                    {/if}

                    <!-- Name -->
                    <div>
                      <label
                        for="edit-name-{search.id}"
                        class="block text-sm font-medium text-[var(--dash-text)] mb-1"
                      >
                        Search Name
                        <span class="text-[var(--dash-error)]">*</span>
                      </label>
                      <input
                        type="text"
                        id="edit-name-{search.id}"
                        name="name"
                        bind:value={editName}
                        required
                        class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
                      />
                    </div>

                    <!-- Credentials -->
                    {#if editDetectedPlatform}
                      <div class="border-t border-[var(--dash-border)] pt-4">
                        <label
                          class="block text-sm font-medium text-[var(--dash-text)] mb-2"
                        >
                          <FontAwesomeIcon icon={faKey} class="w-4 h-4 mr-1" />
                          Login Credentials
                        </label>

                        <select
                          name="credential_id"
                          value={editCredentialId}
                          onchange={(e) =>
                            handleCredentialSelection(
                              (e.target as HTMLSelectElement).value,
                              true,
                            )}
                          class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
                        >
                          <option value="none">No credentials (public search)</option
                          >
                          {#each editExistingCredentials as cred}
                            <option value={String(cred.id)}>{cred.username}</option>
                          {/each}
                          <option value="new">+ Add new credentials</option>
                        </select>

                        {#if editShowNewCredentials}
                          <div
                            class="mt-3 p-3 bg-[var(--dash-bg)] rounded-lg space-y-3"
                          >
                            <div>
                              <label
                                for="edit-cred-username-{search.id}"
                                class="block text-sm text-[var(--dash-text)] mb-1"
                              >
                                Username / Email
                              </label>
                              <input
                                type="text"
                                id="edit-cred-username-{search.id}"
                                name="new_credential_username"
                                bind:value={editNewCredUsername}
                                class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
                              />
                            </div>
                            <div>
                              <label
                                for="edit-cred-password-{search.id}"
                                class="block text-sm text-[var(--dash-text)] mb-1"
                              >
                                Password
                              </label>
                              <div class="relative">
                                <input
                                  type={editShowPassword ? "text" : "password"}
                                  id="edit-cred-password-{search.id}"
                                  name="new_credential_password"
                                  bind:value={editNewCredPassword}
                                  class="w-full px-3 py-2 pr-10 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
                                />
                                <button
                                  type="button"
                                  onclick={() =>
                                    (editShowPassword = !editShowPassword)}
                                  class="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--dash-text-secondary)] hover:text-[var(--dash-text)]"
                                >
                                  <FontAwesomeIcon
                                    icon={editShowPassword ? faEyeSlash : faEye}
                                    class="w-4 h-4"
                                  />
                                </button>
                              </div>
                            </div>
                          </div>
                        {/if}
                      </div>
                    {/if}

                    <!-- Status -->
                    <div>
                      <label
                        for="edit-status-{search.id}"
                        class="block text-sm font-medium text-[var(--dash-text)] mb-1"
                      >
                        Status
                      </label>
                      <select
                        id="edit-status-{search.id}"
                        name="status"
                        bind:value={editStatus}
                        class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
                      >
                        <option value="active">Active</option>
                        <option value="paused">Paused</option>
                        <option value="archived">Archived</option>
                      </select>
                    </div>
                  </div>

                  <div class="flex justify-end gap-2 mt-4">
                    <button
                      type="button"
                      onclick={cancelEdit}
                      class="px-4 py-2 border border-[var(--dash-border)] rounded-lg text-[var(--dash-text)] hover:bg-[var(--dash-bg)] transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      class="px-4 py-2 bg-[var(--dash-primary)] text-white rounded-lg hover:bg-[var(--dash-primary-hover)] transition-colors"
                    >
                      Save
                    </button>
                  </div>
                </form>
              {:else}
                <!-- View Mode - Details -->
                <div class="space-y-3">
                  {#if search.search_url}
                    <div>
                      <p
                        class="text-xs text-[var(--dash-text-secondary)] uppercase tracking-wide mb-1"
                      >
                        Search URL
                      </p>
                      <a
                        href={search.search_url}
                        target="_blank"
                        rel="noopener"
                        class="text-sm text-[var(--dash-primary)] hover:underline break-all flex items-center gap-1"
                      >
                        {search.search_url}
                        <FontAwesomeIcon icon={faExternalLinkAlt} class="w-3 h-3" />
                      </a>
                    </div>
                  {/if}

                  {#if search.platform_profiles}
                    <div>
                      <p
                        class="text-xs text-[var(--dash-text-secondary)] uppercase tracking-wide mb-1"
                      >
                        Login Account
                      </p>
                      <p class="text-sm text-[var(--dash-text)] flex items-center gap-2">
                        <FontAwesomeIcon
                          icon={faKey}
                          class="w-3 h-3 text-[var(--dash-success)]"
                        />
                        {search.platform_profiles.username}
                      </p>
                    </div>
                  {/if}

                  {#if search.last_run}
                    <div>
                      <p
                        class="text-xs text-[var(--dash-text-secondary)] uppercase tracking-wide mb-1"
                      >
                        Last Run
                      </p>
                      <p class="text-sm text-[var(--dash-text)]">
                        {formatDate(search.last_run)}
                        {#if search.last_run_jobs_found}
                          <span class="text-[var(--dash-text-muted)]"
                            >({search.last_run_jobs_found} jobs found)</span
                          >
                        {/if}
                      </p>
                    </div>
                  {/if}

                  {#if search.status_message}
                    <div>
                      <p
                        class="text-xs text-[var(--dash-text-secondary)] uppercase tracking-wide mb-1"
                      >
                        Status Message
                      </p>
                      <p class="text-sm text-[var(--dash-text)]">
                        {search.status_message}
                      </p>
                    </div>
                  {/if}
                </div>
              {/if}
            </div>
          {/if}

          <!-- Footer with action buttons (hidden in edit mode) -->
          {#if editingId !== search.id}
            <div
              class="border-t border-[var(--dash-border)] px-3 py-2 sm:px-4 flex justify-end md:justify-start items-center gap-2"
            >
              <button
                type="button"
                onclick={() => (deleteId = search.id)}
                class="px-3 py-1.5 text-xs bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-lg text-[var(--dash-text)] hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-500 transition-colors flex items-center gap-1.5 whitespace-nowrap"
              >
                <FontAwesomeIcon icon={faTrash} class="w-3 h-3" />
                Delete
              </button>
              <button
                type="button"
                onclick={() => startEdit(search)}
                class="px-3 py-1.5 text-xs bg-blue-500/10 border border-blue-500/30 rounded-lg text-blue-500 hover:bg-blue-500/20 hover:border-blue-500/50 transition-colors flex items-center gap-1.5 whitespace-nowrap"
              >
                <FontAwesomeIcon icon={faPencil} class="w-3 h-3" />
                Edit
              </button>
              <a
                href="/dashboard/jobs/settings/{search.id}"
                class="px-3 py-1.5 text-xs bg-green-500/10 border border-green-500/30 rounded-lg text-green-600 hover:bg-green-500/20 hover:border-green-500/50 transition-colors flex items-center gap-1.5 whitespace-nowrap"
              >
                <FontAwesomeIcon icon={faPlay} class="w-3 h-3" />
                Run
              </a>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>

<!-- Delete Confirmation Modal -->
<DeleteConfirmModal
  isOpen={deleteId !== null}
  title="Delete Job Search"
  message="Are you sure you want to delete this job search configuration? This action cannot be undone."
  onCancel={() => (deleteId = null)}
  onConfirm={() => {
    if (deleteId !== null) {
      const form = document.createElement("form");
      form.method = "POST";
      form.action = "?/delete";
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = "id";
      input.value = String(deleteId);
      form.appendChild(input);
      document.body.appendChild(form);
      form.submit();
    }
  }}
/>
