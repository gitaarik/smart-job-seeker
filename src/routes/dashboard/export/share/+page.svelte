<script lang="ts">
  import type { ActionData, PageData } from "./$types";
  import { enhance } from "$app/forms";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faCheck,
    faChevronDown,
    faChevronUp,
    faCopy,
    faEye,
    faLink,
    faPencil,
    faTimes,
    faTrash,
  } from "@fortawesome/free-solid-svg-icons";
  import SectionHeader from "../../profile/components/SectionHeader.svelte";
  import EmptyState from "../../profile/components/EmptyState.svelte";
  import DeleteConfirmModal from "../../profile/components/DeleteConfirmModal.svelte";

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let tokens = $derived(data.tokens);
  let versions = $derived(data.versions);
  let expandedId = $state<number | null>(null);
  let editingId = $state<number | null>(null);
  let showAddForm = $state(false);
  let deleteId = $state<number | null>(null);
  let copiedId = $state<number | null>(null);

  // Form states for new entry
  let newName = $state("");
  let newNotes = $state("");
  let newVersion = $state("");
  let newVisitLimit = $state("");
  let newExpiresAt = $state("");

  // Form states for editing
  let editName = $state("");
  let editNotes = $state("");
  let editVisitLimit = $state("");
  let editExpiresAt = $state("");
  let editStatus = $state("");

  function formatDate(date: Date | string | null): string {
    if (!date) return "";
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function formatDateTime(date: Date | string | null): string {
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

  function getShareUrl(token: string): string {
    // This would be the actual share URL format
    return `${window.location.origin}/share/${token}`;
  }

  async function copyToClipboard(token: string, id: number) {
    try {
      await navigator.clipboard.writeText(getShareUrl(token));
      copiedId = id;
      setTimeout(() => {
        copiedId = null;
      }, 2000);
    } catch {
      console.error("Failed to copy");
    }
  }

  function isExpired(expiresAt: Date | string | null): boolean {
    if (!expiresAt) return false;
    const d = typeof expiresAt === "string"
      ? new Date(expiresAt)
      : expiresAt;
    return d < new Date();
  }

  function toggleExpand(id: number) {
    if (editingId === id) return;
    expandedId = expandedId === id ? null : id;
  }

  function startEdit(token: (typeof tokens)[0]) {
    editingId = token.id;
    expandedId = token.id;
    editName = token.name || "";
    editNotes = token.notes || "";
    editVisitLimit = token.visit_limit?.toString() || "";
    editExpiresAt = token.expires_at
      ? new Date(token.expires_at).toISOString().split("T")[0]
      : "";
    editStatus = token.status || "published";
  }

  function cancelEdit() {
    editingId = null;
  }

  function resetAddForm() {
    showAddForm = false;
    newName = "";
    newNotes = "";
    newVersion = "";
    newVisitLimit = "";
    newExpiresAt = "";
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
    title="Share Links"
    icon={faLink}
    showAddButton={!showAddForm && tokens.length > 0 && versions.length > 0}
    addLabel="Create Link"
    onAdd={() => (showAddForm = true)}
  />

  {#if form?.error}
    <div
      class="bg-[var(--dash-error-light)] border border-[var(--dash-error)] rounded-lg p-4"
    >
      <p class="text-[var(--dash-error)] text-sm">{form.error}</p>
    </div>
  {/if}

  <!-- No Versions Warning -->
  {#if versions.length === 0}
    <EmptyState
      icon={faLink}
      title="No resume versions available"
      description="Create a resume version first before creating share links. Share links allow you to share your resume with specific people and track views."
      actionLabel="Create Resume Version"
      onAction={() => {
        window.location.href = "/dashboard/export/resume";
      }}
    />
  {:else}
    <!-- Add Form -->
    {#if showAddForm}
      <form
        method="POST"
        action="?/create"
        use:enhance={handleAddSubmit}
        class="bg-[var(--dash-card)] rounded-lg border border-[var(--dash-primary)] p-4"
      >
        <h3 class="font-medium text-[var(--dash-text)] mb-4">
          Create Share Link
        </h3>
        <div class="space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label
                for="new-name"
                class="block text-sm font-medium text-[var(--dash-text)] mb-1"
              >
                Name
              </label>
              <input
                type="text"
                id="new-name"
                name="name"
                bind:value={newName}
                placeholder="e.g., For Company X"
                class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
              />
            </div>

            <div>
              <label
                for="new-version"
                class="block text-sm font-medium text-[var(--dash-text)] mb-1"
              >
                Resume Version <span class="text-[var(--dash-error)]">*</span>
              </label>
              <select
                id="new-version"
                name="profile_version"
                bind:value={newVersion}
                required
                class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
              >
                <option value="">Select a version</option>
                {#each versions as version}
                  <option value={version.id}>{version.name}</option>
                {/each}
              </select>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label
                for="new-visit-limit"
                class="block text-sm font-medium text-[var(--dash-text)] mb-1"
              >
                Visit Limit
              </label>
              <input
                type="number"
                id="new-visit-limit"
                name="visit_limit"
                bind:value={newVisitLimit}
                min="1"
                placeholder="Unlimited"
                class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
              />
              <p class="text-xs text-[var(--dash-text-secondary)] mt-1">
                Leave empty for unlimited views
              </p>
            </div>

            <div>
              <label
                for="new-expires-at"
                class="block text-sm font-medium text-[var(--dash-text)] mb-1"
              >
                Expires On
              </label>
              <input
                type="date"
                id="new-expires-at"
                name="expires_at"
                bind:value={newExpiresAt}
                class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
              />
              <p class="text-xs text-[var(--dash-text-secondary)] mt-1">
                Leave empty for no expiration
              </p>
            </div>
          </div>

          <div>
            <label
              for="new-notes"
              class="block text-sm font-medium text-[var(--dash-text)] mb-1"
            >
              Notes
            </label>
            <textarea
              id="new-notes"
              name="notes"
              bind:value={newNotes}
              rows={2}
              placeholder="Private notes about this share link..."
              class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent resize-y"
            ></textarea>
          </div>
        </div>

        <div class="flex justify-end gap-2 mt-4">
          <button
            type="button"
            onclick={resetAddForm}
            class="px-4 py-2 border border-[var(--dash-border)] rounded-lg text-[var(--dash-text)] hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            class="px-4 py-2 bg-[var(--dash-primary)] text-white rounded-lg hover:bg-[var(--dash-primary-hover)] transition-colors"
          >
            Create Link
          </button>
        </div>
      </form>
    {/if}

    <!-- Tokens List -->
    {#if tokens.length === 0 && !showAddForm}
      <EmptyState
        icon={faLink}
        title="No share links yet"
        description="Create shareable links for your resume versions. Track who views your resume and set expiration dates or view limits."
        actionLabel="Create First Link"
        onAction={() => (showAddForm = true)}
      />
    {:else if tokens.length > 0}
      <div class="space-y-3">
        {#each tokens as token (token.id)}
          {@const expired = isExpired(token.expires_at)}
          {@const       limitReached = token.visit_limit &&
        token.visit_count >= token.visit_limit}
          <div
            class="bg-[var(--dash-card)] rounded-lg border border-[var(--dash-border)] overflow-hidden"
          >
            <!-- Header -->
            <div
              role="button"
              tabindex="0"
              onclick={() => toggleExpand(token.id)}
              onkeydown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  toggleExpand(token.id);
                }
              }}
              class="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors text-left cursor-pointer"
            >
              <div class="flex items-center gap-4 flex-1 min-w-0">
                <div
                  class="
                    w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 {expired ||
                    limitReached
                    ? 'bg-gray-100'
                    : 'bg-green-100'}
                  "
                >
                  <FontAwesomeIcon
                    icon={faLink}
                    class="
                      w-5 h-5 {expired || limitReached
                      ? 'text-gray-500'
                      : 'text-green-600'}
                    "
                  />
                </div>

                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 flex-wrap">
                    <h3 class="font-medium text-[var(--dash-text)] truncate">
                      {token.name || "Unnamed Link"}
                    </h3>
                    {#if expired}
                      <span
                        class="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700"
                      >
                        Expired
                      </span>
                    {:else if limitReached}
                      <span
                        class="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700"
                      >
                        Limit Reached
                      </span>
                    {:else}
                      <span
                        class="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700"
                      >
                        Active
                      </span>
                    {/if}
                  </div>
                  <p class="text-sm text-[var(--dash-text-secondary)] truncate">
                    {token.version?.name || "Unknown version"}
                    <span class="mx-1">•</span>
                    <FontAwesomeIcon icon={faEye} class="w-3 h-3" />
                    {token.visit_count} view{token.visit_count !== 1 ? "s" : ""}
                    {#if token.visit_limit}
                      / {token.visit_limit}
                    {/if}
                  </p>
                </div>
              </div>

              <div class="flex items-center gap-2">
                <button
                  type="button"
                  onclick={(e) => {
                    e.stopPropagation();
                    copyToClipboard(token.token, token.id);
                  }}
                  class="p-2 text-[var(--dash-text-secondary)] hover:text-[var(--dash-primary)] transition-colors"
                  aria-label="Copy link"
                >
                  <FontAwesomeIcon
                    icon={copiedId === token.id ? faCheck : faCopy}
                    class="
                      w-4 h-4 {copiedId === token.id
                      ? 'text-green-600'
                      : ''}
                    "
                  />
                </button>
                <FontAwesomeIcon
                  icon={expandedId === token.id ? faChevronUp : faChevronDown}
                  class="w-4 h-4 text-[var(--dash-text-secondary)]"
                />
              </div>
            </div>

            <!-- Expanded Content -->
            {#if expandedId === token.id}
              <div class="border-t border-[var(--dash-border)] p-4">
                {#if editingId === token.id}
                  <!-- Edit Mode -->
                  <form
                    method="POST"
                    action="?/update"
                    use:enhance={handleEditSubmit}
                  >
                    <input type="hidden" name="id" value={token.id} />
                    <div class="space-y-4">
                      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label
                            for="edit-name-{token.id}"
                            class="block text-sm font-medium text-[var(--dash-text)] mb-1"
                          >
                            Name
                          </label>
                          <input
                            type="text"
                            id="edit-name-{token.id}"
                            name="name"
                            bind:value={editName}
                            class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
                          />
                        </div>

                        <div>
                          <label
                            for="edit-status-{token.id}"
                            class="block text-sm font-medium text-[var(--dash-text)] mb-1"
                          >
                            Status
                          </label>
                          <select
                            id="edit-status-{token.id}"
                            name="status"
                            bind:value={editStatus}
                            class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
                          >
                            <option value="published">Active</option>
                            <option value="archived">Disabled</option>
                          </select>
                        </div>
                      </div>

                      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label
                            for="edit-visit-limit-{token.id}"
                            class="block text-sm font-medium text-[var(--dash-text)] mb-1"
                          >
                            Visit Limit
                          </label>
                          <input
                            type="number"
                            id="edit-visit-limit-{token.id}"
                            name="visit_limit"
                            bind:value={editVisitLimit}
                            min="1"
                            placeholder="Unlimited"
                            class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
                          />
                        </div>

                        <div>
                          <label
                            for="edit-expires-at-{token.id}"
                            class="block text-sm font-medium text-[var(--dash-text)] mb-1"
                          >
                            Expires On
                          </label>
                          <input
                            type="date"
                            id="edit-expires-at-{token.id}"
                            name="expires_at"
                            bind:value={editExpiresAt}
                            class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
                          />
                        </div>
                      </div>

                      <div>
                        <label
                          for="edit-notes-{token.id}"
                          class="block text-sm font-medium text-[var(--dash-text)] mb-1"
                        >
                          Notes
                        </label>
                        <textarea
                          id="edit-notes-{token.id}"
                          name="notes"
                          bind:value={editNotes}
                          rows={2}
                          class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent resize-y"
                        ></textarea>
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
                  <div class="space-y-4">
                    <!-- Share URL -->
                    <div>
                      <p
                        class="text-sm font-medium text-[var(--dash-text-secondary)] mb-1"
                      >
                        Share URL
                      </p>
                      <div
                        class="flex items-center gap-2 bg-gray-50 p-2 rounded-lg"
                      >
                        <code
                          class="text-sm text-[var(--dash-text)] flex-1 truncate"
                        >
                          {getShareUrl(token.token)}
                        </code>
                        <button
                          type="button"
                          onclick={() => copyToClipboard(token.token, token.id)}
                          class="px-3 py-1 text-sm bg-[var(--dash-primary)] text-white rounded hover:bg-[var(--dash-primary-hover)] transition-colors"
                        >
                          {copiedId === token.id ? "Copied!" : "Copy"}
                        </button>
                      </div>
                    </div>

                    <!-- Stats -->
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p class="text-[var(--dash-text-secondary)]">Views</p>
                        <p class="font-medium text-[var(--dash-text)]">
                          {token.visit_count}
                          {#if token.visit_limit}
                            / {token.visit_limit}
                          {/if}
                        </p>
                      </div>
                      <div>
                        <p class="text-[var(--dash-text-secondary)]">Created</p>
                        <p class="font-medium text-[var(--dash-text)]">
                          {formatDate(token.date_created)}
                        </p>
                      </div>
                      <div>
                        <p class="text-[var(--dash-text-secondary)]">Expires</p>
                        <p class="font-medium text-[var(--dash-text)]">
                          {
                            token.expires_at
                              ? formatDate(token.expires_at)
                              : "Never"
                          }
                        </p>
                      </div>
                      <div>
                        <p class="text-[var(--dash-text-secondary)]">
                          Last Accessed
                        </p>
                        <p class="font-medium text-[var(--dash-text)]">
                          {formatDateTime(token.last_accessed_at)}
                        </p>
                      </div>
                    </div>

                    {#if token.notes}
                      <div>
                        <p
                          class="text-sm font-medium text-[var(--dash-text-secondary)] mb-1"
                        >
                          Notes
                        </p>
                        <p class="text-sm text-[var(--dash-text)]">
                          {token.notes}
                        </p>
                      </div>
                    {/if}

                    <div
                      class="flex items-center justify-end gap-2 pt-2 border-t border-[var(--dash-border)]"
                    >
                      <button
                        type="button"
                        onclick={() => startEdit(token)}
                        class="p-2 text-[var(--dash-text-secondary)] hover:text-[var(--dash-primary)] transition-colors"
                        aria-label="Edit"
                      >
                        <FontAwesomeIcon icon={faPencil} class="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onclick={() => (deleteId = token.id)}
                        class="p-2 text-[var(--dash-text-secondary)] hover:text-[var(--dash-error)] transition-colors"
                        aria-label="Delete"
                      >
                        <FontAwesomeIcon icon={faTrash} class="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                {/if}
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  {/if}
</div>

<!-- Delete Confirmation Modal -->
<DeleteConfirmModal
  isOpen={deleteId !== null}
  title="Delete Share Link"
  message="Are you sure you want to delete this share link? Anyone with the link will no longer be able to access your resume. This action cannot be undone."
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
