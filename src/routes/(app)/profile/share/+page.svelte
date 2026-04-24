<script lang="ts">
  import type { ActionData, PageData } from "./$types";
  import { enhance } from "$app/forms";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faCheck,
    faCopy,
    faEye,
    faLink,
    faPencil,
    faTrash,
  } from "@fortawesome/free-solid-svg-icons";
  import SectionHeader from "../components/SectionHeader.svelte";
  import EmptyState from "../components/EmptyState.svelte";
  import ConfirmModal from "../components/ConfirmModal.svelte";
  import ItemCard from "../components/ItemCard.svelte";

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
  let newFormat = $state("resume");
  let newViewMode = $state("html");
  let newVisitLimit = $state("");
  let newExpiresAt = $state("");

  // Form states for editing
  let editName = $state("");
  let editNotes = $state("");
  let editVersion = $state("");
  let editFormat = $state("");
  let editViewMode = $state("");
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

  function getPrivateLinkUrl(token: string): string {
    return `${window.location.origin}/p/${data.profileSlug}/s/${token}`;
  }

  async function copyToClipboard(token: string, id: number) {
    try {
      await navigator.clipboard.writeText(getPrivateLinkUrl(token));
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

  // Dirty checking
  let originalValues = $state<Record<string, string>>({});
  let showDiscardConfirm = $state(false);

  function isEditDirty(): boolean {
    if (!editingId) return false;
    return editName !== originalValues.name || editNotes !== originalValues.notes
      || editVersion !== originalValues.version || editFormat !== originalValues.format
      || editViewMode !== originalValues.viewMode || editVisitLimit !== originalValues.visitLimit
      || editExpiresAt !== originalValues.expiresAt || editStatus !== originalValues.status;
  }

  function toggleExpand(id: number) {
    if (editingId === id) {
      if (isEditDirty()) {
        showDiscardConfirm = true;
      } else {
        editingId = null;
        expandedId = null;
      }
      return;
    }
    expandedId = expandedId === id ? null : id;
  }

  function confirmDiscard() {
    editingId = null;
    expandedId = null;
    showDiscardConfirm = false;
  }

  function startEdit(token: (typeof tokens)[0]) {
    editingId = token.id;
    expandedId = token.id;
    editName = token.name || "";
    editNotes = token.notes || "";
    editVersion = token.profile_version?.toString() || "";
    editFormat = token.format || "resume";
    editViewMode = token.view_mode || "html";
    editVisitLimit = token.visit_limit?.toString() || "";
    editExpiresAt = token.expires_at
      ? new Date(token.expires_at).toISOString().split("T")[0]
      : "";
    editStatus = token.status || "published";
    originalValues = {
      name: editName, notes: editNotes, version: editVersion,
      format: editFormat, viewMode: editViewMode, visitLimit: editVisitLimit,
      expiresAt: editExpiresAt, status: editStatus,
    };
  }

  function cancelEdit() {
    editingId = null;
  }

  function resetAddForm() {
    showAddForm = false;
    newName = "";
    newNotes = "";
    newVersion = "";
    newFormat = "resume";
    newViewMode = "html";
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

<svelte:head>
  <title>Share Links - Smart Job Seeker</title>
</svelte:head>

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
      description="Create a resume version first before creating private links. Share links allow you to share your resume with specific people and track views."
      actionLabel="Create Resume Version"
      onAction={() => {
        window.location.href = "/profile/resume";
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
          Create Private Link
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
                class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent bg-[var(--dash-card)] text-[var(--dash-text)]"
              />
            </div>

            <div>
              <label
                for="new-version"
                class="block text-sm font-medium text-[var(--dash-text)] mb-1"
              >
                Version <span class="text-[var(--dash-error)]">*</span>
              </label>
              <select
                id="new-version"
                name="profile_version"
                bind:value={newVersion}
                required
                class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent bg-[var(--dash-card)] text-[var(--dash-text)]"
              >
                <option value="">Select a version</option>
                {#each versions as version}
                  <option value={version.id}>{version.name || version.slug || "Untitled"}</option>
                {/each}
              </select>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label
                for="new-format"
                class="block text-sm font-medium text-[var(--dash-text)] mb-1"
              >
                Format <span class="text-[var(--dash-error)]">*</span>
              </label>
              <select
                id="new-format"
                name="format"
                bind:value={newFormat}
                required
                class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent bg-[var(--dash-card)] text-[var(--dash-text)]"
              >
                <option value="resume">Resume (compact)</option>
                <option value="cv">CV (full)</option>
              </select>
            </div>

            <div>
              <label
                for="new-view-mode"
                class="block text-sm font-medium text-[var(--dash-text)] mb-1"
              >
                View Mode <span class="text-[var(--dash-error)]">*</span>
              </label>
              <select
                id="new-view-mode"
                name="view_mode"
                bind:value={newViewMode}
                required
                class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent bg-[var(--dash-card)] text-[var(--dash-text)]"
              >
                <option value="html">HTML (web page)</option>
                <option value="pdf">PDF (download)</option>
              </select>
            </div>

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
                class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent bg-[var(--dash-card)] text-[var(--dash-text)]"
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
                class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent bg-[var(--dash-card)] text-[var(--dash-text)]"
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
              placeholder="Private notes about this private link..."
              class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent resize-y"
            ></textarea>
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
            Create Link
          </button>
        </div>
      </form>
    {/if}

    <!-- Tokens List -->
    {#if tokens.length === 0 && !showAddForm}
      <EmptyState
        icon={faLink}
        title="No private links yet"
        description="Create shareable links for your resume versions. Track who views your resume and set expiration dates or view limits."
        actionLabel="Create First Link"
        onAction={() => (showAddForm = true)}
      />
    {:else if tokens.length > 0}
      <div class="space-y-3">
        {#each tokens as token (token.id)}
          {@const expired = isExpired(token.expires_at)}
          {@const limitReached = token.visit_limit &&
            token.visit_count >= token.visit_limit}
          <ItemCard
            id={token.id}
            {expandedId}
            onToggle={toggleExpand}
            icon={faLink}
            iconColor={expired || limitReached ? "text-[var(--dash-text-muted)]" : "text-[var(--dash-success)]"}
          >
            {#snippet title()}
              {token.name || "Unnamed Link"}
            {/snippet}

            {#snippet badges()}
              {#if expired}
                <span
                  class="text-xs px-2 py-0.5 rounded-full bg-[var(--dash-error-light)] text-[var(--dash-error)]"
                >
                  Expired
                </span>
              {:else if limitReached}
                <span
                  class="text-xs px-2 py-0.5 rounded-full bg-[var(--dash-warning-light)] text-[var(--dash-warning)]"
                >
                  Limit Reached
                </span>
              {:else}
                <span
                  class="text-xs px-2 py-0.5 rounded-full bg-[var(--dash-success-light)] text-[var(--dash-success)]"
                >
                  Active
                </span>
              {/if}
            {/snippet}

            {#snippet subtitle()}
              {token.version?.name || token.version?.slug || "Unknown version"}
              <span class="mx-1">•</span>
              {token.format === "cv" ? "CV" : "Resume"}
              <span class="mx-1">•</span>
              {token.view_mode === "pdf" ? "PDF" : "HTML"}
              <span class="mx-1">•</span>
              <FontAwesomeIcon icon={faEye} class="w-3 h-3" />
              {token.visit_count} view{token.visit_count !== 1 ? "s" : ""}
              {#if token.visit_limit}
                / {token.visit_limit}
              {/if}
            {/snippet}

            {#snippet headerActions()}
              <button
                type="button"
                onclick={(e) => {
                  e.stopPropagation();
                  copyToClipboard(token.token, token.id);
                }}
                class="p-1.5 text-[var(--dash-text-secondary)] hover:text-[var(--dash-primary)] transition-colors cursor-pointer"
                aria-label="Copy link"
              >
                <FontAwesomeIcon
                  icon={copiedId === token.id ? faCheck : faCopy}
                  class="w-4 h-4 {copiedId === token.id ? 'text-green-600' : ''}"
                />
              </button>
              <button
                type="button"
                onclick={(e) => { e.stopPropagation(); startEdit(token); }}
                class="p-1.5 text-[var(--dash-text-secondary)] hover:text-[var(--dash-primary)] transition-colors cursor-pointer"
                aria-label="Edit"
              >
                <FontAwesomeIcon icon={faPencil} class="w-4 h-4" />
              </button>
            {/snippet}

            {#snippet expandedContent()}
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
                          class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent bg-[var(--dash-card)] text-[var(--dash-text)]"
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
                          class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent bg-[var(--dash-card)] text-[var(--dash-text)]"
                        >
                          <option value="published">Active</option>
                          <option value="archived">Disabled</option>
                        </select>
                      </div>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label
                          for="edit-version-{token.id}"
                          class="block text-sm font-medium text-[var(--dash-text)] mb-1"
                        >
                          Version
                        </label>
                        <select
                          id="edit-version-{token.id}"
                          name="profile_version"
                          bind:value={editVersion}
                          class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent bg-[var(--dash-card)] text-[var(--dash-text)]"
                        >
                          {#each versions as version}
                            <option value={version.id.toString()}>{version.name || version.slug || "Untitled"}</option>
                          {/each}
                        </select>
                      </div>

                      <div>
                        <label
                          for="edit-format-{token.id}"
                          class="block text-sm font-medium text-[var(--dash-text)] mb-1"
                        >
                          Format
                        </label>
                        <select
                          id="edit-format-{token.id}"
                          name="format"
                          bind:value={editFormat}
                          class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent bg-[var(--dash-card)] text-[var(--dash-text)]"
                        >
                          <option value="resume">Resume (compact)</option>
                          <option value="cv">CV (full)</option>
                        </select>
                      </div>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label
                          for="edit-view-mode-{token.id}"
                          class="block text-sm font-medium text-[var(--dash-text)] mb-1"
                        >
                          View Mode
                        </label>
                        <select
                          id="edit-view-mode-{token.id}"
                          name="view_mode"
                          bind:value={editViewMode}
                          class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent bg-[var(--dash-card)] text-[var(--dash-text)]"
                        >
                          <option value="html">HTML (web page)</option>
                          <option value="pdf">PDF (download)</option>
                        </select>
                      </div>

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
                          class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent bg-[var(--dash-card)] text-[var(--dash-text)]"
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
                          class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent bg-[var(--dash-card)] text-[var(--dash-text)]"
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

                  <div class="flex items-center mt-4">
                    <button
                      type="button"
                      onclick={() => { editingId = null; deleteId = token.id; }}
                      class="px-3 py-2 text-xs bg-red-500/10 border border-red-500/30 rounded-lg text-red-500 hover:bg-red-500/20 hover:border-red-500/50 transition-colors flex items-center gap-1.5"
                    >
                      <FontAwesomeIcon icon={faTrash} class="w-3 h-3" /> Delete
                    </button>
                    <div class="flex gap-2 ml-auto">
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
                      class="flex items-center gap-2 bg-[var(--dash-bg)] p-2 rounded-lg"
                    >
                      <code
                        class="text-sm text-[var(--dash-text)] flex-1 truncate"
                      >
                        {getPrivateLinkUrl(token.token)}
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
                </div>
              {/if}
            {/snippet}
          </ItemCard>
        {/each}
      </div>
    {/if}
  {/if}
</div>

<!-- Delete Confirmation Modal -->
<ConfirmModal
  isOpen={deleteId !== null}
  title="Delete Private Link"
  message="Are you sure you want to delete this private link? Anyone with the link will no longer be able to access your resume. This action cannot be undone."
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

<ConfirmModal
  isOpen={showDiscardConfirm}
  title="Discard Changes"
  message="You have unsaved changes. Are you sure you want to discard them?"
  onCancel={() => (showDiscardConfirm = false)}
  onConfirm={confirmDiscard}
/>
