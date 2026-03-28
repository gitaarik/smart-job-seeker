<script lang="ts">
  import type { ActionData, PageData } from "./$types";
  import { enhance } from "$app/forms";
  import { page } from "$app/stores";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faCheck,
    faChevronDown,
    faChevronUp,
    faCopy,
    faFileAlt,
    faGlobe,
    faPencil,
    faTimes,
    faTrash,
  } from "@fortawesome/free-solid-svg-icons";
  import Card from "../../components/Card.svelte";
  import SectionHeader from "../../profile/components/SectionHeader.svelte";
  import EmptyState from "../../profile/components/EmptyState.svelte";
  import ConfirmModal from "../../profile/components/ConfirmModal.svelte";

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let versions = $derived(data.versions);
  let publicResumeVersionId = $derived(data.publicResumeVersionId);
  let publicCvVersionId = $derived(data.publicCvVersionId);

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
  let newExtendsIds = $state<number[]>([]);

  // Form states for editing
  let editName = $state("");
  let editDescription = $state("");
  let editStatus = $state("");
  let editExtendsIds = $state<number[]>([]);
  let editPublicResume = $state(false);
  let editPublicCv = $state(false);

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
        return "bg-[var(--dash-success-light)] text-[var(--dash-success)]";
      case "draft":
        return "bg-[var(--dash-warning-light)] text-[var(--dash-warning)]";
      case "archived":
        return "bg-[var(--dash-bg)] text-[var(--dash-text-muted)]";
      default:
        return "bg-[var(--dash-bg)] text-[var(--dash-text-muted)]";
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
    editExtendsIds = [...version.extendsIds];
    editPublicResume = isPublicResume(version.id);
    editPublicCv = isPublicCv(version.id);
  }

  function cancelEdit() {
    editingId = null;
  }

  function resetAddForm() {
    showAddForm = false;
    newName = "";
    newDescription = "";
    newStatus = "draft";
    newExtendsIds = [];
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

  function isPublicResume(versionId: number): boolean {
    return publicResumeVersionId === versionId;
  }

  function isPublicCv(versionId: number): boolean {
    return publicCvVersionId === versionId;
  }

  function getReplacedPublicResumeName(versionId: number): string | null {
    if (!publicResumeVersionId || publicResumeVersionId === versionId) return null;
    return versions.find((v) => v.id === publicResumeVersionId)?.name ?? null;
  }

  function getReplacedPublicCvName(versionId: number): string | null {
    if (!publicCvVersionId || publicCvVersionId === versionId) return null;
    return versions.find((v) => v.id === publicCvVersionId)?.name ?? null;
  }

  function getParentVersionNames(extendsIds: number[]): string {
    return extendsIds
      .map((id) => versions.find((v) => v.id === id))
      .filter(Boolean)
      .map((v) => v?.name || "Untitled")
      .join(", ");
  }

  let copiedLink = $state<string | null>(null);

  function getPublicUrl(path: string): string {
    const slug = data.selectedProfile?.slug;
    return `${$page.url.origin}/p/${slug}/${path}`;
  }

  async function copyPublicLink(key: string) {
    try {
      await navigator.clipboard.writeText(getPublicUrl(key));
      copiedLink = key;
      setTimeout(() => {
        copiedLink = null;
      }, 2000);
    } catch {
      console.error("Failed to copy");
    }
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

        {#if versions.length > 0}
          <div>
            <p class="block text-sm font-medium text-[var(--dash-text)] mb-2">
              Extends
            </p>
            <div class="flex flex-wrap gap-x-4 gap-y-2">
              {#each versions as v}
                <label class="flex items-center gap-1.5 text-sm text-[var(--dash-text)] cursor-pointer">
                  <input
                    type="checkbox"
                    name="extendsIds"
                    value={v.id}
                    checked={newExtendsIds.includes(v.id)}
                    onchange={(e) => {
                      if (e.currentTarget.checked) {
                        newExtendsIds = [...newExtendsIds, v.id];
                      } else {
                        newExtendsIds = newExtendsIds.filter((id) => id !== v.id);
                      }
                    }}
                    class="rounded border-[var(--dash-border)] text-[var(--dash-primary)] focus:ring-[var(--dash-primary)]"
                  />
                  {v.name || "Untitled"}
                </label>
              {/each}
            </div>
            <p class="text-xs text-[var(--dash-text-muted)] mt-1">
              Inherit tags and toggles from other versions
            </p>
          </div>
        {/if}

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
          class="px-4 py-2 border border-[var(--dash-border)] rounded-lg text-[var(--dash-text)] hover:bg-[var(--dash-bg)] transition-colors"
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
        <Card class="overflow-hidden">
          <!-- Header -->
          <button
            type="button"
            onclick={() => toggleExpand(version.id)}
            class="w-full flex items-center justify-between p-4 hover:bg-[var(--dash-bg)] transition-colors text-left"
          >
            <div class="flex items-center gap-4 flex-1 min-w-0">
              <div
                class="w-10 h-10 rounded-full bg-[var(--dash-bg)] flex items-center justify-center flex-shrink-0"
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
                  {#if isPublicResume(version.id)}
                    <span
                      class="text-xs px-2 py-0.5 rounded-full bg-[var(--dash-info-light)] text-[var(--dash-info)] flex items-center gap-1"
                    >
                      <FontAwesomeIcon icon={faGlobe} class="w-3 h-3" />
                      Public Resume
                    </span>
                  {/if}
                  {#if isPublicCv(version.id)}
                    <span
                      class="text-xs px-2 py-0.5 rounded-full bg-[var(--dash-info-light)] text-[var(--dash-info)] flex items-center gap-1"
                    >
                      <FontAwesomeIcon icon={faGlobe} class="w-3 h-3" />
                      Public CV
                    </span>
                  {/if}
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

                    {#if versions.length > 1}
                      <div>
                        <p class="block text-sm font-medium text-[var(--dash-text)] mb-2">
                          Extends
                        </p>
                        <div class="flex flex-wrap gap-x-4 gap-y-2">
                          {#each versions.filter((v) => v.id !== version.id) as v}
                            <label class="flex items-center gap-1.5 text-sm text-[var(--dash-text)] cursor-pointer">
                              <input
                                type="checkbox"
                                name="extendsIds"
                                value={v.id}
                                checked={editExtendsIds.includes(v.id)}
                                onchange={(e) => {
                                  if (e.currentTarget.checked) {
                                    editExtendsIds = [...editExtendsIds, v.id];
                                  } else {
                                    editExtendsIds = editExtendsIds.filter((id) => id !== v.id);
                                  }
                                }}
                                class="rounded border-[var(--dash-border)] text-[var(--dash-primary)] focus:ring-[var(--dash-primary)]"
                              />
                              {v.name || "Untitled"}
                            </label>
                          {/each}
                        </div>
                        <p class="text-xs text-[var(--dash-text-muted)] mt-1">
                          Inherit tags and toggles from other versions
                        </p>
                      </div>
                    {/if}

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

                    <div>
                      <p class="text-sm font-medium text-[var(--dash-text)] mb-1">
                        Public Access
                      </p>
                      <p class="text-xs text-[var(--dash-text-secondary)] mb-3">
                        For trackable links with view limits and expiration, use <a href="/dashboard/export/share" class="text-[var(--dash-primary)] hover:underline">Private Links</a>.
                      </p>
                      <div class="space-y-2">
                        <label class="flex items-start gap-1.5 text-sm text-[var(--dash-text)] cursor-pointer">
                          <input
                            type="checkbox"
                            name="publicResume"
                            bind:checked={editPublicResume}
                            class="rounded border-[var(--dash-border)] text-[var(--dash-primary)] focus:ring-[var(--dash-primary)] mt-0.5"
                          />
                          <span>
                            Use as public resume
                            {#if getReplacedPublicResumeName(version.id) && editPublicResume}
                              <span class="text-xs text-[var(--dash-warning)]">(replaces {getReplacedPublicResumeName(version.id)})</span>
                            {/if}
                          </span>
                        </label>
                        <label class="flex items-start gap-1.5 text-sm text-[var(--dash-text)] cursor-pointer">
                          <input
                            type="checkbox"
                            name="publicCv"
                            bind:checked={editPublicCv}
                            class="rounded border-[var(--dash-border)] text-[var(--dash-primary)] focus:ring-[var(--dash-primary)] mt-0.5"
                          />
                          <span>
                            Use as public CV
                            {#if getReplacedPublicCvName(version.id) && editPublicCv}
                              <span class="text-xs text-[var(--dash-warning)]">(replaces {getReplacedPublicCvName(version.id)})</span>
                            {/if}
                          </span>
                        </label>
                      </div>
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

                  {#if version.extendsIds.length > 0}
                    <div>
                      <p
                        class="text-sm font-medium text-[var(--dash-text-secondary)] mb-1"
                      >
                        Extends
                      </p>
                      <p class="text-[var(--dash-text)] text-sm">
                        {getParentVersionNames(version.extendsIds)}
                      </p>
                    </div>
                  {/if}

                  {#if data.selectedProfile?.slug}
                    <div>
                      <p
                        class="text-sm font-medium text-[var(--dash-text-secondary)] mb-1"
                      >
                        Preview Links
                      </p>
                      <div class="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                        <a
                          href="/p/{data.selectedProfile.slug}/resume?version={encodeURIComponent(version.name)}"
                          target="_blank"
                          class="text-[var(--dash-primary)] hover:underline"
                        >Resume</a>
                        <a
                          href="/p/{data.selectedProfile.slug}/resume.pdf?version={encodeURIComponent(version.name)}"
                          target="_blank"
                          class="text-[var(--dash-primary)] hover:underline"
                        >Resume PDF</a>
                        <a
                          href="/p/{data.selectedProfile.slug}/cv?version={encodeURIComponent(version.name)}"
                          target="_blank"
                          class="text-[var(--dash-primary)] hover:underline"
                        >CV</a>
                        <a
                          href="/p/{data.selectedProfile.slug}/cv.pdf?version={encodeURIComponent(version.name)}"
                          target="_blank"
                          class="text-[var(--dash-primary)] hover:underline"
                        >CV PDF</a>
                      </div>
                    </div>

                    {#if isPublicResume(version.id) || isPublicCv(version.id)}
                      <div>
                        <p
                          class="text-sm font-medium text-[var(--dash-text-secondary)] mb-2"
                        >
                          Public Links
                        </p>
                        <div class="space-y-2">
                          {#if isPublicResume(version.id)}
                            {#each [{ path: "resume", label: "Resume (HTML)" }, { path: "resume.pdf", label: "Resume (PDF)" }] as link (link.path)}
                              <div class="flex items-center gap-2 bg-[var(--dash-bg)] p-2 rounded-lg">
                                <FontAwesomeIcon icon={faGlobe} class="w-3.5 h-3.5 text-[var(--dash-info)] shrink-0" />
                                <div class="flex-1 min-w-0">
                                  <p class="text-xs font-medium text-[var(--dash-text-secondary)]">{link.label}</p>
                                  <a
                                    href="/p/{data.selectedProfile.slug}/{link.path}"
                                    target="_blank"
                                    class="text-sm text-[var(--dash-primary)] hover:underline block truncate"
                                  >
                                    {$page.url.origin}/p/{data.selectedProfile.slug}/{link.path}
                                  </a>
                                </div>
                                <button
                                  type="button"
                                  onclick={() => copyPublicLink(link.path)}
                                  class="p-1.5 text-[var(--dash-text-secondary)] hover:text-[var(--dash-primary)] transition-colors shrink-0"
                                  aria-label="Copy {link.label} link"
                                >
                                  <FontAwesomeIcon
                                    icon={copiedLink === link.path ? faCheck : faCopy}
                                    class="w-3.5 h-3.5 {copiedLink === link.path ? 'text-green-600' : ''}"
                                  />
                                </button>
                              </div>
                            {/each}
                          {/if}
                          {#if isPublicCv(version.id)}
                            {#each [{ path: "cv", label: "CV (HTML)" }, { path: "cv.pdf", label: "CV (PDF)" }] as link (link.path)}
                              <div class="flex items-center gap-2 bg-[var(--dash-bg)] p-2 rounded-lg">
                                <FontAwesomeIcon icon={faGlobe} class="w-3.5 h-3.5 text-[var(--dash-info)] shrink-0" />
                                <div class="flex-1 min-w-0">
                                  <p class="text-xs font-medium text-[var(--dash-text-secondary)]">{link.label}</p>
                                  <a
                                    href="/p/{data.selectedProfile.slug}/{link.path}"
                                    target="_blank"
                                    class="text-sm text-[var(--dash-primary)] hover:underline block truncate"
                                  >
                                    {$page.url.origin}/p/{data.selectedProfile.slug}/{link.path}
                                  </a>
                                </div>
                                <button
                                  type="button"
                                  onclick={() => copyPublicLink(link.path)}
                                  class="p-1.5 text-[var(--dash-text-secondary)] hover:text-[var(--dash-primary)] transition-colors shrink-0"
                                  aria-label="Copy {link.label} link"
                                >
                                  <FontAwesomeIcon
                                    icon={copiedLink === link.path ? faCheck : faCopy}
                                    class="w-3.5 h-3.5 {copiedLink === link.path ? 'text-green-600' : ''}"
                                  />
                                </button>
                              </div>
                            {/each}
                          {/if}
                        </div>
                      </div>
                    {/if}
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
        </Card>
      {/each}
    </div>
  {/if}
</div>

<!-- Delete Confirmation Modal -->
<ConfirmModal
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
