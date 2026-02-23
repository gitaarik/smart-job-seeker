<script lang="ts">
  import type { ActionData, PageData } from "./$types";
  import { enhance } from "$app/forms";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faCheck,
    faExclamationTriangle,
    faExternalLinkAlt,
    faPencil,
    faPlay,
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
  let platforms = $derived(data.platforms);
  let editingId = $state<number | null>(null);
  let showAddForm = $state(false);
  let deleteId = $state<number | null>(null);

  // Form states for new entry
  let newName = $state("");
  let newSearchUrl = $state("");
  let newPlatform = $state("");
  let newStatus = $state("active");

  // Form states for editing
  let editName = $state("");
  let editSearchUrl = $state("");
  let editPlatform = $state("");
  let editStatus = $state("");

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

  function startEdit(search: (typeof jobSearches)[0]) {
    editingId = search.id;
    editName = search.name || "";
    editSearchUrl = search.search_url || "";
    editPlatform = search.platform?.toString() || "";
    editStatus = search.status || "active";
  }

  function cancelEdit() {
    editingId = null;
  }

  function resetAddForm() {
    showAddForm = false;
    newName = "";
    newSearchUrl = "";
    newPlatform = "";
    newStatus = "active";
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
      }
    };
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
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
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

          <div>
            <label
              for="new-platform"
              class="block text-sm font-medium text-[var(--dash-text)] mb-1"
            >
              Platform
            </label>
            <select
              id="new-platform"
              name="platform"
              bind:value={newPlatform}
              class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
            >
              <option value="">Select a platform</option>
              {#each platforms as platform}
                <option value={String(platform.id)}>{platform.name}</option>
              {/each}
            </select>
          </div>
        </div>

        <div>
          <label
            for="new-search-url"
            class="block text-sm font-medium text-[var(--dash-text)] mb-1"
          >
            Search URL
          </label>
          <input
            type="url"
            id="new-search-url"
            name="search_url"
            bind:value={newSearchUrl}
            placeholder="https://linkedin.com/jobs/search?keywords=..."
            class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
          />
          <p class="text-xs text-[var(--dash-text-secondary)] mt-1">
            Paste a job search URL from LinkedIn, Indeed, or other platforms
          </p>
        </div>

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
          class="bg-[var(--dash-card)] rounded-lg border border-[var(--dash-border)] p-4"
        >
          {#if editingId === search.id}
            <!-- Edit Mode -->
            <form
              method="POST"
              action="?/update"
              use:enhance={handleEditSubmit}
            >
              <input type="hidden" name="id" value={search.id} />
              <div class="space-y-4">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label
                      for="edit-name-{search.id}"
                      class="block text-sm font-medium text-[var(--dash-text)] mb-1"
                    >
                      Search Name <span class="text-[var(--dash-error)]"
                      >*</span>
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

                  <div>
                    <label
                      for="edit-platform-{search.id}"
                      class="block text-sm font-medium text-[var(--dash-text)] mb-1"
                    >
                      Platform
                    </label>
                    <select
                      id="edit-platform-{search.id}"
                      name="platform"
                      bind:value={editPlatform}
                      class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
                    >
                      <option value="">Select a platform</option>
                      {#each platforms as platform}
                        <option value={String(platform.id)}>{platform.name}</option>
                      {/each}
                    </select>
                  </div>
                </div>

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
                    bind:value={editSearchUrl}
                    class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
                  />
                </div>

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
                  class="p-2 text-[var(--dash-text-secondary)] hover:text-[var(--dash-text)] transition-colors"
                  aria-label="Cancel"
                >
                  <FontAwesomeIcon icon={faTimes} class="w-4 h-4" />
                </button>
                <button
                  type="submit"
                  class="p-2 text-[var(--dash-primary)] hover:text-[var(--dash-primary-hover)] transition-colors"
                  aria-label="Save"
                >
                  <FontAwesomeIcon icon={faCheck} class="w-4 h-4" />
                </button>
              </div>
            </form>
          {:else}
            <!-- View Mode -->
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-4">
                <div
                  class="
                    w-10 h-10 rounded-full flex items-center justify-center {search.status ===
                    'active'
                    ? 'bg-[var(--dash-success-light)]'
                    : 'bg-[var(--dash-bg)]'}
                  "
                >
                  <FontAwesomeIcon
                    icon={faSearch}
                    class="
                      w-5 h-5 {search.status === 'active'
                      ? 'text-[var(--dash-success)]'
                      : 'text-[var(--dash-text-muted)]'}
                    "
                  />
                </div>
                <div>
                  <div class="flex items-center gap-2">
                    <h3 class="font-medium text-[var(--dash-text)]">
                      {search.name}
                    </h3>
                    <span
                      class="
                        text-xs px-2 py-0.5 rounded-full {search.is_active
                        ? 'bg-[var(--dash-success-light)] text-[var(--dash-success)]'
                        : 'bg-[var(--dash-bg)] text-[var(--dash-text-muted)]'}
                      "
                    >
                      {search.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p class="text-sm text-[var(--dash-text-secondary)] flex items-center gap-1 flex-wrap">
                    {#if search.job_platforms}
                      <span>{search.job_platforms.name}</span>
                      <span>•</span>
                    {/if}
                    {#if search.status === "running"}
                      <FontAwesomeIcon icon={faSpinner} class="w-3 h-3 text-[var(--dash-primary)] animate-spin" />
                      <span>Running...</span>
                    {:else if search.status === "success"}
                      <FontAwesomeIcon icon={faCheck} class="w-3 h-3 text-[var(--dash-success)]" />
                      <span>{formatDate(search.last_run)}</span>
                      {#if search.last_run_jobs_found}
                        <span class="text-[var(--dash-text-muted)]">({search.last_run_jobs_found} jobs)</span>
                      {/if}
                    {:else if search.status === "blocked"}
                      <FontAwesomeIcon icon={faExclamationTriangle} class="w-3 h-3 text-[var(--dash-warning)]" />
                      <span class="text-[var(--dash-warning)]">{search.status_message}</span>
                    {:else if search.status === "partial"}
                      <FontAwesomeIcon icon={faExclamationTriangle} class="w-3 h-3 text-[var(--dash-warning)]" />
                      <span>{formatDate(search.last_run)}</span>
                      <span class="text-[var(--dash-text-muted)]">— {search.status_message}</span>
                    {:else if search.status === "error"}
                      <FontAwesomeIcon icon={faTimes} class="w-3 h-3 text-[var(--dash-error)]" />
                      <span class="text-[var(--dash-error)]">{search.status_message}</span>
                    {:else if search.last_run}
                      <FontAwesomeIcon icon={faCheck} class="w-3 h-3 text-[var(--dash-success)]" />
                      <span>{formatDate(search.last_run)}</span>
                    {:else}
                      <span class="text-[var(--dash-text-muted)]">Never run</span>
                    {/if}
                  </p>
                </div>
              </div>

              <div class="flex items-center gap-2">
                <a
                  href="/dashboard/jobs/settings/{search.id}"
                  class="p-2 text-[var(--dash-primary)] hover:text-[var(--dash-primary-hover)] transition-colors"
                  aria-label="View and run scrape"
                  title="View details and run scrape"
                >
                  <FontAwesomeIcon icon={faPlay} class="w-4 h-4" />
                </a>
                {#if search.search_url}
                  <a
                    href={search.search_url}
                    target="_blank"
                    rel="noopener"
                    class="p-2 text-[var(--dash-text-secondary)] hover:text-[var(--dash-primary)] transition-colors"
                    aria-label="Open search URL"
                  >
                    <FontAwesomeIcon icon={faExternalLinkAlt} class="w-4 h-4" />
                  </a>
                {/if}
                <button
                  type="button"
                  onclick={() => startEdit(search)}
                  class="p-2 text-[var(--dash-text-secondary)] hover:text-[var(--dash-primary)] transition-colors"
                  aria-label="Edit"
                >
                  <FontAwesomeIcon icon={faPencil} class="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onclick={() => (deleteId = search.id)}
                  class="p-2 text-[var(--dash-text-secondary)] hover:text-[var(--dash-error)] transition-colors"
                  aria-label="Delete"
                >
                  <FontAwesomeIcon icon={faTrash} class="w-4 h-4" />
                </button>
              </div>
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
