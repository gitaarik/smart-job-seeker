<script lang="ts">
  import type { ActionData, PageData } from "./$types";
  import { enhance } from "$app/forms";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faCheck,
    faFileAlt,
    faGlobe,
    faPencil,
    faTimes,
    faTrash,
  } from "@fortawesome/free-solid-svg-icons";
  import SectionHeader from "../../profile/components/SectionHeader.svelte";
  import EmptyState from "../../profile/components/EmptyState.svelte";
  import ConfirmModal from "../../profile/components/ConfirmModal.svelte";
  import ItemCard from "../../profile/components/ItemCard.svelte";

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let versions = $derived(data.versions);
  let publicResumeVersionId = $derived(data.publicResumeVersionId);
  let publicCvVersionId = $derived(data.publicCvVersionId);

  let editingId = $state<number | null>(null);
  let showAddForm = $state(false);
  let deleteId = $state<number | null>(null);

  // Form states for new entry
  let newName = $state("");
  let newSlug = $state("");
  let newSlugManual = $state(false);
  let newExtendsIds = $state<number[]>([]);

  // Form states for editing
  let editName = $state("");
  let editSlug = $state("");
  let editExtendsIds = $state<number[]>([]);
  let editPublicResume = $state(false);
  let editPublicCv = $state(false);

  function slugify(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function handleNewNameInput() {
    if (!newSlugManual) {
      newSlug = slugify(newName);
    }
  }

  function handleNewSlugInput() {
    newSlugManual = true;
  }

  function formatDate(date: Date | string | null): string {
    if (!date) return "";
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function startEdit(version: (typeof versions)[0]) {
    editingId = version.id;
    editName = version.name || "";
    editSlug = version.slug || "";
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
    newSlug = "";
    newSlugManual = false;
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
    const v = versions.find((v) => v.id === publicResumeVersionId);
    return v?.name || v?.slug || null;
  }

  function getReplacedPublicCvName(versionId: number): string | null {
    if (!publicCvVersionId || publicCvVersionId === versionId) return null;
    const v = versions.find((v) => v.id === publicCvVersionId);
    return v?.name || v?.slug || null;
  }

  function getParentVersionNames(extendsIds: number[]): string {
    return extendsIds
      .map((id) => versions.find((v) => v.id === id))
      .filter(Boolean)
      .map((v) => v?.name || v?.slug || "Untitled")
      .join(", ");
  }

  function getDisplayName(version: (typeof versions)[0]): string {
    return version.name || version.slug || "Untitled Version";
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
              Name
            </label>
            <input
              type="text"
              id="new-name"
              name="name"
              bind:value={newName}
              oninput={handleNewNameInput}
              placeholder="e.g., Full Stack Developer Resume"
              class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
            />
          </div>

          <div>
            <label
              for="new-slug"
              class="block text-sm font-medium text-[var(--dash-text)] mb-1"
            >
              Slug <span class="text-[var(--dash-error)]">*</span>
            </label>
            <input
              type="text"
              id="new-slug"
              name="slug"
              bind:value={newSlug}
              oninput={handleNewSlugInput}
              placeholder="e.g., fullstack-developer"
              required
              pattern="[a-z0-9][a-z0-9-]*[a-z0-9]"
              class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent font-mono text-sm"
            />
            <p class="text-xs text-[var(--dash-text-muted)] mt-1">
              Used in URLs and version tags
            </p>
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
                  {v.name || v.slug || "Untitled"}
                </label>
              {/each}
            </div>
            <p class="text-xs text-[var(--dash-text-muted)] mt-1">
              Inherit tags and toggles from other versions
            </p>
          </div>
        {/if}
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
        {#if editingId === version.id}
          <!-- Edit Mode -->
          <ItemCard
            id={version.id}
            icon={faFileAlt}
            iconColor="text-indigo-600"
          >
            {#snippet editContent()}
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
                        Name
                      </label>
                      <input
                        type="text"
                        id="edit-name-{version.id}"
                        name="name"
                        bind:value={editName}
                        class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label
                        for="edit-slug-{version.id}"
                        class="block text-sm font-medium text-[var(--dash-text)] mb-1"
                      >
                        Slug <span class="text-[var(--dash-error)]">*</span>
                      </label>
                      <input
                        type="text"
                        id="edit-slug-{version.id}"
                        name="slug"
                        bind:value={editSlug}
                        required
                        pattern="[a-z0-9][a-z0-9-]*[a-z0-9]"
                        class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent font-mono text-sm"
                      />
                      <p class="text-xs text-[var(--dash-text-muted)] mt-1">
                        Used in URLs and version tags
                      </p>
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
                            {v.name || v.slug || "Untitled"}
                          </label>
                        {/each}
                      </div>
                      <p class="text-xs text-[var(--dash-text-muted)] mt-1">
                        Inherit tags and toggles from other versions
                      </p>
                    </div>
                  {/if}

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

                <div class="flex items-center mt-4">
                  <button
                    type="button"
                    onclick={() => (deleteId = version.id)}
                    class="py-2 pr-2 text-[var(--dash-error)] hover:text-[var(--dash-error)] opacity-70 hover:opacity-100 transition-opacity"
                    aria-label="Delete"
                  >
                    <FontAwesomeIcon icon={faTrash} class="w-4 h-4" />
                  </button>
                  <div class="flex gap-2 ml-auto">
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
                </div>
              </form>
            {/snippet}
          </ItemCard>
        {:else}
          <!-- View Mode -->
          <ItemCard
            id={version.id}
            icon={faFileAlt}
            iconColor="text-indigo-600"
          >
          {#snippet title()}
            {getDisplayName(version)}
          {/snippet}

          {#snippet badges()}
            {#if isPublicResume(version.id)}
              <span
                class="text-xs px-2 py-0.5 rounded-full bg-[var(--dash-info-light)] text-[var(--dash-info)] inline-flex items-center gap-1 mt-1.5 align-middle"
              >
                <FontAwesomeIcon icon={faGlobe} class="w-3 h-3" />
                Public Resume
              </span>
            {/if}
            {#if isPublicCv(version.id)}
              <span
                class="text-xs px-2 py-0.5 rounded-full bg-[var(--dash-info-light)] text-[var(--dash-info)] inline-flex items-center gap-1 mt-1.5 align-middle"
              >
                <FontAwesomeIcon icon={faGlobe} class="w-3 h-3" />
                Public CV
              </span>
            {/if}
          {/snippet}

          {#snippet subtitle()}
            <span class="font-mono text-xs">{version.slug}</span>
            {#if version.date_created}
              <span class="mx-1">•</span>
              Created {formatDate(version.date_created)}
            {/if}
          {/snippet}

          {#snippet footer()}
            {#if data.selectedProfile?.slug}
              <div class="flex items-center gap-2 flex-wrap flex-1">
                <a
                  href="/p/{data.selectedProfile.slug}/resume?version={encodeURIComponent(version.slug)}"
                  target="_blank"
                  class="dash-link-ext"
                >Resume</a>
                <a
                  href="/p/{data.selectedProfile.slug}/resume.pdf?version={encodeURIComponent(version.slug)}"
                  target="_blank"
                  class="dash-link-ext"
                >Resume PDF</a>
                <a
                  href="/p/{data.selectedProfile.slug}/cv?version={encodeURIComponent(version.slug)}"
                  target="_blank"
                  class="dash-link-ext"
                >CV</a>
                <a
                  href="/p/{data.selectedProfile.slug}/cv.pdf?version={encodeURIComponent(version.slug)}"
                  target="_blank"
                  class="dash-link-ext"
                >CV PDF</a>
                <button
                  type="button"
                  onclick={() => startEdit(version)}
                  class="p-1 text-[var(--dash-text-secondary)] hover:text-[var(--dash-primary)] transition-colors ml-auto"
                  aria-label="Edit"
                >
                  <FontAwesomeIcon icon={faPencil} class="w-3.5 h-3.5" />
                </button>
              </div>
            {/if}
          {/snippet}
          </ItemCard>
        {/if}
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
