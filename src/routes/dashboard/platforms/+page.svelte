<script lang="ts">
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faCheck,
    faExclamationTriangle,
    faEye,
    faEyeSlash,
    faGlobe,
    faKey,
    faPlus,
    faSave,
    faSearch,
    faSpinner,
    faTimes,
    faTrash,
  } from "@fortawesome/free-solid-svg-icons";

  interface Platform {
    id: number;
    name: string;
    key: string;
    url: string | null;
    loginPageUrl: string | null;
    hasCredentials: boolean;
    credentials: {
      id: number;
      username: string | null;
      status: string;
      last_login_at: string | null;
      login_error: string | null;
    } | null;
  }

  interface SearchResult {
    id: number;
    name: string;
    key: string;
    url: string | null;
    login_page_url: string | null;
    status: string;
  }

  let { data } = $props();
  let platforms = $state<Platform[]>(data.platforms);

  // Add new platform state
  let showAddForm = $state(false);
  let urlInput = $state("");
  let searching = $state(false);
  let searchResults = $state<SearchResult[]>([]);
  let showSearchResults = $state(false);
  let fetchingMetadata = $state(false);
  let newPlatformName = $state("");
  let newPlatformLoginUrl = $state("");
  let selectedPlatform = $state<SearchResult | null>(null);
  let creatingPlatform = $state(false);

  // Credentials state
  let newUsername = $state("");
  let newPassword = $state("");
  let showPassword = $state(false);

  // Edit state
  let editingPlatformId = $state<number | null>(null);
  let editUsername = $state("");
  let editPassword = $state("");
  let showEditPassword = $state(false);
  let saving = $state(false);
  let deleting = $state<number | null>(null);
  let error = $state<string | null>(null);
  let success = $state<string | null>(null);

  // Debounce timer for URL search
  let searchTimeout: ReturnType<typeof setTimeout> | null = null;

  async function searchPlatforms(url: string) {
    if (!url || url.length < 3) {
      searchResults = [];
      showSearchResults = false;
      return;
    }

    searching = true;
    try {
      const response = await fetch(`/api/platforms/search?url=${encodeURIComponent(url)}`);
      if (response.ok) {
        searchResults = await response.json();
        showSearchResults = searchResults.length > 0;
      }
    } catch {
      // Ignore errors
    } finally {
      searching = false;
    }
  }

  function handleUrlInput(e: Event) {
    const value = (e.target as HTMLInputElement).value;
    urlInput = value;
    selectedPlatform = null;
    newPlatformName = "";
    newPlatformLoginUrl = "";

    // Debounce search
    if (searchTimeout) clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => searchPlatforms(value), 300);
  }

  function selectPlatform(platform: SearchResult) {
    selectedPlatform = platform;
    urlInput = platform.url || "";
    newPlatformName = platform.name;
    newPlatformLoginUrl = platform.login_page_url || "";
    showSearchResults = false;
  }

  async function fetchMetadata() {
    if (!urlInput) return;

    fetchingMetadata = true;
    error = null;

    try {
      const response = await fetch(`/api/platforms/fetch-metadata?url=${encodeURIComponent(urlInput)}`);
      if (response.ok) {
        const data = await response.json();
        newPlatformName = data.suggestedName || "";
        urlInput = data.url; // Use normalized URL
      } else {
        const errData = await response.json();
        error = errData.message || "Failed to fetch site metadata";
      }
    } catch {
      error = "Failed to fetch site metadata";
    } finally {
      fetchingMetadata = false;
    }
  }

  async function addPlatformWithCredentials() {
    if (!urlInput) return;

    creatingPlatform = true;
    error = null;

    try {
      let platformId: number;

      if (selectedPlatform) {
        // Use existing platform
        platformId = selectedPlatform.id;
      } else {
        // Create new platform
        const createResponse = await fetch("/api/platforms/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: urlInput,
            name: newPlatformName || undefined,
            loginPageUrl: newPlatformLoginUrl || undefined,
          }),
        });

        if (!createResponse.ok) {
          const errData = await createResponse.json();
          throw new Error(errData.message || "Failed to create platform");
        }

        const createData = await createResponse.json();
        platformId = createData.platform.id;
      }

      // Save credentials if provided
      if (newUsername) {
        const credResponse = await fetch(`/api/platforms/${platformId}/credentials`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            profileId: data.selectedProfile.id,
            username: newUsername,
            password: newPassword || undefined,
          }),
        });

        if (!credResponse.ok) {
          const errData = await credResponse.json();
          throw new Error(errData.message || "Failed to save credentials");
        }
      }

      // Refresh the platform list
      const refreshResponse = await fetch(`/api/platforms?profileId=${data.selectedProfile.id}`);
      if (refreshResponse.ok) {
        platforms = await refreshResponse.json();
      }

      success = "Platform added successfully";
      resetAddForm();
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to add platform";
    } finally {
      creatingPlatform = false;
    }
  }

  function resetAddForm() {
    showAddForm = false;
    urlInput = "";
    searchResults = [];
    showSearchResults = false;
    newPlatformName = "";
    newPlatformLoginUrl = "";
    selectedPlatform = null;
    newUsername = "";
    newPassword = "";
    showPassword = false;
  }

  function startEditing(platform: Platform) {
    editingPlatformId = platform.id;
    editUsername = platform.credentials?.username || "";
    editPassword = "";
    showEditPassword = false;
    error = null;
    success = null;
  }

  function cancelEditing() {
    editingPlatformId = null;
    editUsername = "";
    editPassword = "";
    showEditPassword = false;
    error = null;
  }

  async function saveCredentials(platformId: number) {
    saving = true;
    error = null;
    success = null;

    try {
      const response = await fetch(`/api/platforms/${platformId}/credentials`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId: data.selectedProfile.id,
          username: editUsername,
          password: editPassword || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to save credentials");
      }

      // Update local state
      platforms = platforms.map((p) =>
        p.id === platformId
          ? {
              ...p,
              hasCredentials: !!editUsername,
              credentials: {
                id: p.credentials?.id || 0,
                username: editUsername,
                status: "active",
                last_login_at: p.credentials?.last_login_at || null,
                login_error: null,
              },
            }
          : p,
      );

      success = "Credentials saved successfully";
      editingPlatformId = null;
      editUsername = "";
      editPassword = "";
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to save credentials";
    } finally {
      saving = false;
    }
  }

  async function deleteCredentials(platformId: number) {
    if (!confirm("Are you sure you want to delete these credentials?")) {
      return;
    }

    deleting = platformId;
    error = null;
    success = null;

    try {
      const response = await fetch(
        `/api/platforms/${platformId}/credentials?profileId=${data.selectedProfile.id}`,
        { method: "DELETE" },
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to delete credentials");
      }

      // Update local state
      platforms = platforms.map((p) =>
        p.id === platformId
          ? {
              ...p,
              hasCredentials: false,
              credentials: null,
            }
          : p,
      );

      success = "Credentials deleted";
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to delete credentials";
    } finally {
      deleting = null;
    }
  }

  // Clear success message after 3 seconds
  $effect(() => {
    if (success) {
      const timeout = setTimeout(() => {
        success = null;
      }, 3000);
      return () => clearTimeout(timeout);
    }
  });

  // Filter platforms to only show those with credentials
  let platformsWithCredentials = $derived(platforms.filter((p) => p.hasCredentials));
</script>

<svelte:head>
  <title>Platform Credentials | Smart Job Seeker</title>
</svelte:head>

<div class="space-y-6">
  <!-- Header -->
  <div class="flex items-start justify-between gap-4">
    <div>
      <h1 class="text-2xl font-bold text-[var(--dash-text)]">Platform Credentials</h1>
      <p class="text-[var(--dash-text-secondary)] mt-1">
        Add job platforms and manage your login credentials for automatic job scraping.
      </p>
    </div>
    {#if !showAddForm}
      <button
        onclick={() => (showAddForm = true)}
        class="flex items-center gap-2 px-4 py-2 bg-[var(--dash-primary)] text-white rounded-lg hover:bg-[var(--dash-primary-hover)] transition-colors whitespace-nowrap"
      >
        <FontAwesomeIcon icon={faPlus} class="w-4 h-4" />
        Add Platform
      </button>
    {/if}
  </div>

  <!-- Success/Error messages -->
  {#if success}
    <div class="p-4 bg-[var(--dash-success-light)] text-[var(--dash-success)] rounded-lg flex items-center gap-2">
      <FontAwesomeIcon icon={faCheck} class="w-4 h-4" />
      {success}
    </div>
  {/if}

  {#if error}
    <div class="p-4 bg-[var(--dash-error-light)] text-[var(--dash-error)] rounded-lg flex items-center gap-2">
      <FontAwesomeIcon icon={faExclamationTriangle} class="w-4 h-4" />
      {error}
    </div>
  {/if}

  <!-- Add Platform Form -->
  {#if showAddForm}
    <div class="bg-[var(--dash-card)] rounded-lg border border-[var(--dash-border)] p-6">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-medium text-[var(--dash-text)]">Add a Job Platform</h2>
        <button
          onclick={resetAddForm}
          class="p-2 text-[var(--dash-text-secondary)] hover:text-[var(--dash-text)] transition-colors"
        >
          <FontAwesomeIcon icon={faTimes} class="w-4 h-4" />
        </button>
      </div>

      <div class="space-y-4">
        <!-- URL Input -->
        <div class="relative">
          <label for="platform-url" class="block text-sm font-medium text-[var(--dash-text)] mb-1">
            Platform URL
          </label>
          <div class="relative">
            <input
              id="platform-url"
              type="text"
              value={urlInput}
              oninput={handleUrlInput}
              placeholder="e.g., linkedin.com or https://jobs.example.com"
              class="w-full px-3 py-2 pr-20 rounded-lg border border-[var(--dash-border)] bg-[var(--dash-bg)] text-[var(--dash-text)] focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)]"
            />
            <div class="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {#if searching}
                <FontAwesomeIcon icon={faSpinner} class="w-4 h-4 text-[var(--dash-text-secondary)] animate-spin" />
              {/if}
              {#if urlInput && !selectedPlatform}
                <button
                  onclick={fetchMetadata}
                  disabled={fetchingMetadata}
                  class="px-2 py-1 text-xs text-[var(--dash-primary)] hover:bg-[var(--dash-primary-light)] rounded transition-colors disabled:opacity-50"
                  title="Fetch site info"
                >
                  {#if fetchingMetadata}
                    <FontAwesomeIcon icon={faSpinner} class="w-3 h-3 animate-spin" />
                  {:else}
                    <FontAwesomeIcon icon={faSearch} class="w-3 h-3" />
                  {/if}
                </button>
              {/if}
            </div>
          </div>

          <!-- Search Results Dropdown -->
          {#if showSearchResults && searchResults.length > 0}
            <div class="absolute z-10 w-full mt-1 bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-lg shadow-lg max-h-60 overflow-y-auto">
              <div class="p-2 text-xs text-[var(--dash-text-secondary)] border-b border-[var(--dash-border)]">
                Existing platforms found:
              </div>
              {#each searchResults as result}
                <button
                  onclick={() => selectPlatform(result)}
                  class="w-full text-left px-3 py-2 hover:bg-[var(--dash-bg)] flex items-center gap-3"
                >
                  <FontAwesomeIcon icon={faGlobe} class="w-4 h-4 text-[var(--dash-text-secondary)]" />
                  <div>
                    <div class="text-sm font-medium text-[var(--dash-text)]">{result.name}</div>
                    <div class="text-xs text-[var(--dash-text-secondary)]">{result.url}</div>
                  </div>
                </button>
              {/each}
            </div>
          {/if}
        </div>

        {#if selectedPlatform}
          <div class="p-3 bg-[var(--dash-bg)] rounded-lg border border-[var(--dash-border)]">
            <div class="flex items-center gap-2 text-sm">
              <FontAwesomeIcon icon={faCheck} class="w-4 h-4 text-[var(--dash-success)]" />
              <span class="text-[var(--dash-text)]">Selected existing platform: <strong>{selectedPlatform.name}</strong></span>
            </div>
          </div>
        {:else if urlInput}
          <!-- Platform Name -->
          <div>
            <label for="platform-name" class="block text-sm font-medium text-[var(--dash-text)] mb-1">
              Platform Name
            </label>
            <input
              id="platform-name"
              type="text"
              bind:value={newPlatformName}
              placeholder="e.g., LinkedIn Jobs"
              class="w-full px-3 py-2 rounded-lg border border-[var(--dash-border)] bg-[var(--dash-bg)] text-[var(--dash-text)] focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)]"
            />
          </div>

          <!-- Login Page URL (optional) -->
          <div>
            <label for="login-url" class="block text-sm font-medium text-[var(--dash-text)] mb-1">
              Login Page URL <span class="text-[var(--dash-text-muted)]">(optional)</span>
            </label>
            <input
              id="login-url"
              type="text"
              bind:value={newPlatformLoginUrl}
              placeholder="e.g., https://linkedin.com/login"
              class="w-full px-3 py-2 rounded-lg border border-[var(--dash-border)] bg-[var(--dash-bg)] text-[var(--dash-text)] focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)]"
            />
          </div>
        {/if}

        {#if urlInput}
          <hr class="border-[var(--dash-border)]" />

          <div>
            <h3 class="text-sm font-medium text-[var(--dash-text)] mb-3">Login Credentials <span class="text-[var(--dash-text-muted)]">(optional)</span></h3>
            <div class="grid gap-4 sm:grid-cols-2">
              <div>
                <label for="new-username" class="block text-sm font-medium text-[var(--dash-text)] mb-1">
                  Username / Email
                </label>
                <input
                  id="new-username"
                  type="text"
                  bind:value={newUsername}
                  placeholder="Enter your username or email"
                  class="w-full px-3 py-2 rounded-lg border border-[var(--dash-border)] bg-[var(--dash-bg)] text-[var(--dash-text)] focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)]"
                />
              </div>

              <div>
                <label for="new-password" class="block text-sm font-medium text-[var(--dash-text)] mb-1">
                  Password
                </label>
                <div class="relative">
                  <input
                    id="new-password"
                    type={showPassword ? "text" : "password"}
                    bind:value={newPassword}
                    placeholder="Enter your password"
                    class="w-full px-3 py-2 pr-10 rounded-lg border border-[var(--dash-border)] bg-[var(--dash-bg)] text-[var(--dash-text)] focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)]"
                  />
                  <button
                    type="button"
                    onclick={() => (showPassword = !showPassword)}
                    class="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--dash-text-secondary)] hover:text-[var(--dash-text)]"
                  >
                    <FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye} class="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        {/if}

        <div class="flex items-center justify-end gap-2 pt-2">
          <button
            onclick={resetAddForm}
            class="px-4 py-2 text-[var(--dash-text-secondary)] hover:text-[var(--dash-text)] transition-colors"
          >
            Cancel
          </button>
          <button
            onclick={addPlatformWithCredentials}
            disabled={creatingPlatform || !urlInput}
            class="flex items-center gap-2 px-4 py-2 bg-[var(--dash-primary)] text-white rounded-lg hover:bg-[var(--dash-primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {#if creatingPlatform}
              <FontAwesomeIcon icon={faSpinner} class="w-4 h-4 animate-spin" />
            {:else}
              <FontAwesomeIcon icon={faPlus} class="w-4 h-4" />
            {/if}
            Add Platform
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Platforms list -->
  {#if platformsWithCredentials.length > 0}
    <div class="bg-[var(--dash-card)] rounded-lg border border-[var(--dash-border)]">
      <div class="p-4 border-b border-[var(--dash-border)]">
        <h2 class="font-medium text-[var(--dash-text)]">Your Platforms</h2>
      </div>
      <div class="divide-y divide-[var(--dash-border)]">
        {#each platformsWithCredentials as platform (platform.id)}
          <div class="p-4">
            {#if editingPlatformId === platform.id}
              <!-- Edit form -->
              <div class="space-y-4">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-lg bg-[var(--dash-bg)] flex items-center justify-center">
                      <FontAwesomeIcon icon={faGlobe} class="w-5 h-5 text-[var(--dash-text-secondary)]" />
                    </div>
                    <div>
                      <h3 class="font-medium text-[var(--dash-text)]">{platform.name}</h3>
                      {#if platform.url}
                        <a
                          href={platform.url}
                          target="_blank"
                          rel="noopener"
                          class="text-sm text-[var(--dash-primary)] hover:underline"
                        >
                          {platform.url}
                        </a>
                      {/if}
                    </div>
                  </div>
                  <button
                    onclick={cancelEditing}
                    class="p-2 text-[var(--dash-text-secondary)] hover:text-[var(--dash-text)] transition-colors"
                  >
                    <FontAwesomeIcon icon={faTimes} class="w-4 h-4" />
                  </button>
                </div>

                <div class="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label for="edit-username-{platform.id}" class="block text-sm font-medium text-[var(--dash-text)] mb-1">
                      Username / Email
                    </label>
                    <input
                      id="edit-username-{platform.id}"
                      type="text"
                      bind:value={editUsername}
                      placeholder="Enter your username or email"
                      class="w-full px-3 py-2 rounded-lg border border-[var(--dash-border)] bg-[var(--dash-bg)] text-[var(--dash-text)] focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)]"
                    />
                  </div>

                  <div>
                    <label for="edit-password-{platform.id}" class="block text-sm font-medium text-[var(--dash-text)] mb-1">
                      Password
                    </label>
                    <div class="relative">
                      <input
                        id="edit-password-{platform.id}"
                        type={showEditPassword ? "text" : "password"}
                        bind:value={editPassword}
                        placeholder="Leave blank to keep current"
                        class="w-full px-3 py-2 pr-10 rounded-lg border border-[var(--dash-border)] bg-[var(--dash-bg)] text-[var(--dash-text)] focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)]"
                      />
                      <button
                        type="button"
                        onclick={() => (showEditPassword = !showEditPassword)}
                        class="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--dash-text-secondary)] hover:text-[var(--dash-text)]"
                      >
                        <FontAwesomeIcon icon={showEditPassword ? faEyeSlash : faEye} class="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                <div class="flex items-center justify-end gap-2">
                  <button
                    onclick={cancelEditing}
                    class="px-4 py-2 text-[var(--dash-text-secondary)] hover:text-[var(--dash-text)] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onclick={() => saveCredentials(platform.id)}
                    disabled={saving || !editUsername}
                    class="flex items-center gap-2 px-4 py-2 bg-[var(--dash-primary)] text-white rounded-lg hover:bg-[var(--dash-primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {#if saving}
                      <FontAwesomeIcon icon={faSpinner} class="w-4 h-4 animate-spin" />
                    {:else}
                      <FontAwesomeIcon icon={faSave} class="w-4 h-4" />
                    {/if}
                    Save Credentials
                  </button>
                </div>
              </div>
            {:else}
              <!-- Display row -->
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-lg bg-[var(--dash-bg)] flex items-center justify-center">
                    <FontAwesomeIcon icon={faGlobe} class="w-5 h-5 text-[var(--dash-text-secondary)]" />
                  </div>
                  <div>
                    <div class="flex items-center gap-2">
                      <h3 class="font-medium text-[var(--dash-text)]">{platform.name}</h3>
                      <span class="flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-[var(--dash-success-light)] text-[var(--dash-success)]">
                        <FontAwesomeIcon icon={faKey} class="w-3 h-3" />
                        Configured
                      </span>
                    </div>
                    {#if platform.credentials?.username}
                      <p class="text-sm text-[var(--dash-text-secondary)]">
                        {platform.credentials.username}
                      </p>
                    {/if}
                    {#if platform.credentials?.login_error}
                      <p class="text-sm text-[var(--dash-error)] flex items-center gap-1 mt-1">
                        <FontAwesomeIcon icon={faExclamationTriangle} class="w-3 h-3" />
                        {platform.credentials.login_error}
                      </p>
                    {/if}
                  </div>
                </div>

                <div class="flex items-center gap-2">
                  <button
                    onclick={() => startEditing(platform)}
                    class="px-3 py-1.5 text-sm text-[var(--dash-primary)] hover:bg-[var(--dash-primary-light)] rounded-lg transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onclick={() => deleteCredentials(platform.id)}
                    disabled={deleting === platform.id}
                    class="p-1.5 text-[var(--dash-text-muted)] hover:text-[var(--dash-error)] transition-colors disabled:opacity-50"
                    title="Delete credentials"
                  >
                    {#if deleting === platform.id}
                      <FontAwesomeIcon icon={faSpinner} class="w-4 h-4 animate-spin" />
                    {:else}
                      <FontAwesomeIcon icon={faTrash} class="w-4 h-4" />
                    {/if}
                  </button>
                </div>
              </div>
            {/if}
          </div>
        {/each}
      </div>
    </div>
  {:else if !showAddForm}
    <!-- Empty state -->
    <div class="bg-[var(--dash-card)] rounded-lg border border-[var(--dash-border)] p-8 text-center">
      <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--dash-bg)] flex items-center justify-center">
        <FontAwesomeIcon icon={faKey} class="w-8 h-8 text-[var(--dash-text-muted)]" />
      </div>
      <h2 class="text-lg font-medium text-[var(--dash-text)] mb-2">No platforms configured</h2>
      <p class="text-[var(--dash-text-secondary)] mb-4">
        Add job platforms and your login credentials to enable automatic job scraping.
      </p>
      <button
        onclick={() => (showAddForm = true)}
        class="inline-flex items-center gap-2 px-4 py-2 bg-[var(--dash-primary)] text-white rounded-lg hover:bg-[var(--dash-primary-hover)] transition-colors"
      >
        <FontAwesomeIcon icon={faPlus} class="w-4 h-4" />
        Add Your First Platform
      </button>
    </div>
  {/if}

  <!-- Security note -->
  <div class="p-4 bg-[var(--dash-bg)] rounded-lg border border-[var(--dash-border)]">
    <p class="text-sm text-[var(--dash-text-secondary)]">
      <strong>Security Note:</strong> Your credentials are stored securely and are only used for automatic login during job scraping.
      For platforms that support it, we recommend using app-specific passwords or API tokens.
    </p>
  </div>
</div>
