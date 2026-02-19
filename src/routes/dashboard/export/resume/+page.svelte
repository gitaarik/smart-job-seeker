<script lang="ts">
  import type { ActionData, PageData } from "./$types";
  import { enhance } from "$app/forms";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faCheck,
    faChevronDown,
    faChevronUp,
    faDownload,
    faFileAlt,
    faPencil,
    faTimes,
    faTrash,
  } from "@fortawesome/free-solid-svg-icons";
  import SectionHeader from "../../profile/components/SectionHeader.svelte";
  import EmptyState from "../../profile/components/EmptyState.svelte";
  import DeleteConfirmModal from "../../profile/components/DeleteConfirmModal.svelte";

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let versions = $derived(data.versions);
  let exports = $derived(data.exports);
  let expandedId = $state<number | null>(null);
  let editingId = $state<number | null>(null);
  let showAddForm = $state(false);
  let deleteId = $state<number | null>(null);

  const statusOptions = [
    { value: "draft", label: "Draft" },
    { value: "published", label: "Published" },
    { value: "archived", label: "Archived" },
  ];

  // Form states for new entry
  let newName = $state("");
  let newDescription = $state("");
  let newStatus = $state("draft");

  // Form states for editing
  let editName = $state("");
  let editDescription = $state("");
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

  function getStatusColor(status: string): string {
    switch (status) {
      case "published":
        return "bg-green-100 text-green-700";
      case "draft":
        return "bg-yellow-100 text-yellow-700";
      case "archived":
        return "bg-gray-100 text-gray-600";
      default:
        return "bg-gray-100 text-gray-600";
    }
  }

  function getFileTypeLabel(type: string): string {
    switch (type) {
      case "pdf":
        return "PDF";
      case "html":
        return "HTML";
      case "docx":
        return "Word";
      case "json":
        return "JSON";
      case "txt":
        return "Text";
      default:
        return type.toUpperCase();
    }
  }

  function toggleExpand(id: number) {
    if (editingId === id) return;
    expandedId = expandedId === id ? null : id;
  }

  function startEdit(version: (typeof versions)[0]) {
    editingId = version.id;
    expandedId = version.id;
    editName = version.name || "";
    editDescription = version.description || "";
    editStatus = version.status || "draft";
  }

  function cancelEdit() {
    editingId = null;
  }

  function resetAddForm() {
    showAddForm = false;
    newName = "";
    newDescription = "";
    newStatus = "draft";
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
    title="Resume/CV Versions"
    icon={faFileAlt}
    showAddButton={!showAddForm && versions.length > 0}
    addLabel="Add Version"
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
        Add New Version
      </h3>
      <div class="space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label
              for="new-name"
              class="block text-sm font-medium text-[var(--dash-text)] mb-1"
            >
              Name <span class="text-[var(--dash-error)]">*</span>
            </label>
            <input
              type="text"
              id="new-name"
              name="name"
              bind:value={newName}
              placeholder="e.g., Full Stack Developer Resume"
              required
              class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
            />
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
              {#each statusOptions as option}
                <option value={option.value}>{option.label}</option>
              {/each}
            </select>
          </div>
        </div>

        <div>
          <label
            for="new-description"
            class="block text-sm font-medium text-[var(--dash-text)] mb-1"
          >
            Description
          </label>
          <textarea
            id="new-description"
            name="description"
            bind:value={newDescription}
            rows={3}
            placeholder="What is this version for? (e.g., Tailored for frontend roles)"
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
          Add Version
        </button>
      </div>
    </form>
  {/if}

  <!-- Versions List -->
  {#if versions.length === 0 && !showAddForm}
    <EmptyState
      icon={faFileAlt}
      title="No resume versions yet"
      description="Create different versions of your resume for different job types or industries. Each version can be customized and exported."
      actionLabel="Add First Version"
      onAction={() => (showAddForm = true)}
    />
  {:else}
    <div class="space-y-3">
      {#each versions as version (version.id)}
        <div
          class="bg-[var(--dash-card)] rounded-lg border border-[var(--dash-border)] overflow-hidden"
        >
          <!-- Header -->
          <button
            type="button"
            onclick={() => toggleExpand(version.id)}
            class="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors text-left"
          >
            <div class="flex items-center gap-4 flex-1 min-w-0">
              <div
                class="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0"
              >
                <FontAwesomeIcon
                  icon={faFileAlt}
                  class="w-5 h-5 text-indigo-600"
                />
              </div>

              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <h3 class="font-medium text-[var(--dash-text)] truncate">
                    {version.name || "Untitled Version"}
                  </h3>
                  <span
                    class="text-xs px-2 py-0.5 rounded-full capitalize {getStatusColor(version.status)}"
                  >
                    {version.status}
                  </span>
                </div>
                <p class="text-sm text-[var(--dash-text-secondary)] truncate">
                  {version.description || "No description"}
                  {#if version.date_created}
                    <span class="mx-1">•</span>
                    Created {formatDate(version.date_created)}
                  {/if}
                </p>
              </div>
            </div>

            <FontAwesomeIcon
              icon={expandedId === version.id ? faChevronUp : faChevronDown}
              class="w-4 h-4 text-[var(--dash-text-secondary)]"
            />
          </button>

          <!-- Expanded Content -->
          {#if expandedId === version.id}
            <div class="border-t border-[var(--dash-border)] p-4">
              {#if editingId === version.id}
                <!-- Edit Mode -->
                <form
                  method="POST"
                  action="?/update"
                  use:enhance={handleEditSubmit}
                >
                  <input type="hidden" name="id" value={version.id} />
                  <div class="space-y-4">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label
                          for="edit-name-{version.id}"
                          class="block text-sm font-medium text-[var(--dash-text)] mb-1"
                        >
                          Name <span class="text-[var(--dash-error)]">*</span>
                        </label>
                        <input
                          type="text"
                          id="edit-name-{version.id}"
                          name="name"
                          bind:value={editName}
                          required
                          class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
                        />
                      </div>

                      <div>
                        <label
                          for="edit-status-{version.id}"
                          class="block text-sm font-medium text-[var(--dash-text)] mb-1"
                        >
                          Status
                        </label>
                        <select
                          id="edit-status-{version.id}"
                          name="status"
                          bind:value={editStatus}
                          class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
                        >
                          {#each statusOptions as option}
                            <option value={option.value}>{option.label}</option>
                          {/each}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label
                        for="edit-description-{version.id}"
                        class="block text-sm font-medium text-[var(--dash-text)] mb-1"
                      >
                        Description
                      </label>
                      <textarea
                        id="edit-description-{version.id}"
                        name="description"
                        bind:value={editDescription}
                        rows={3}
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
                  {#if version.description}
                    <div>
                      <p
                        class="text-sm font-medium text-[var(--dash-text-secondary)] mb-1"
                      >
                        Description
                      </p>
                      <p class="text-[var(--dash-text)]">
                        {version.description}
                      </p>
                    </div>
                  {/if}

                  {#if data.selectedProfile?.slug}
                    {@const slug = data.selectedProfile.slug}
                    {@const encodedName = encodeURIComponent(version.name)}
                    <div>
                      <p
                        class="text-sm font-medium text-[var(--dash-text-secondary)] mb-1"
                      >
                        Preview Links
                      </p>
                      <div class="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                        <a
                          href="/p/{slug}/resume?version={encodedName}"
                          target="_blank"
                          class="text-[var(--dash-primary)] hover:underline"
                        >Resume</a>
                        <a
                          href="/p/{slug}/resume.pdf?version={encodedName}"
                          target="_blank"
                          class="text-[var(--dash-primary)] hover:underline"
                        >Resume PDF</a>
                        <a
                          href="/p/{slug}/cv?version={encodedName}"
                          target="_blank"
                          class="text-[var(--dash-primary)] hover:underline"
                        >CV</a>
                        <a
                          href="/p/{slug}/cv.pdf?version={encodedName}"
                          target="_blank"
                          class="text-[var(--dash-primary)] hover:underline"
                        >CV PDF</a>
                      </div>
                    </div>
                  {/if}

                  <div
                    class="flex items-center justify-end gap-2 pt-2 border-t border-[var(--dash-border)]"
                  >
                    <button
                      type="button"
                      onclick={() => startEdit(version)}
                      class="p-2 text-[var(--dash-text-secondary)] hover:text-[var(--dash-primary)] transition-colors"
                      aria-label="Edit"
                    >
                      <FontAwesomeIcon icon={faPencil} class="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onclick={() => (deleteId = version.id)}
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

  <!-- Exports Section -->
  {#if exports.length > 0}
    <div class="mt-8">
      <h2 class="text-lg font-semibold text-[var(--dash-text)] mb-4">
        Available Exports
      </h2>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {#each exports as exp (exp.id)}
          <div
            class="bg-[var(--dash-card)] rounded-lg border border-[var(--dash-border)] p-4"
          >
            <div class="flex items-center gap-3">
              <div
                class="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center"
              >
                <FontAwesomeIcon
                  icon={faDownload}
                  class="w-5 h-5 text-gray-600"
                />
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <span
                    class="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700 font-medium"
                  >
                    {getFileTypeLabel(exp.file_type)}
                  </span>
                  <span class="text-xs text-[var(--dash-text-secondary)]">
                    {exp.export_type}
                  </span>
                </div>
                <p class="text-sm text-[var(--dash-text)] truncate mt-1">
                  {
                    exp.description || exp.export_format ||
                      "Export file"
                  }
                </p>
                <p class="text-xs text-[var(--dash-text-secondary)]">
                  {formatDate(exp.date_created)}
                </p>
              </div>
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>

<!-- Delete Confirmation Modal -->
<DeleteConfirmModal
  isOpen={deleteId !== null}
  title="Delete Version"
  message="Are you sure you want to delete this resume version? Associated share links may stop working. This action cannot be undone."
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
