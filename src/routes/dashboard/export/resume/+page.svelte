<script lang="ts">
  import type { ActionData, PageData } from "./$types";
  import { enhance } from "$app/forms";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faArrowRight,
    faFileAlt,
    faGlobe,
  } from "@fortawesome/free-solid-svg-icons";
  import SectionHeader from "../../profile/components/SectionHeader.svelte";
  import EmptyState from "../../profile/components/EmptyState.svelte";
  import ItemCard from "../../profile/components/ItemCard.svelte";

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let versions = $derived(data.versions);
  let publicResumeVersionId = $derived(data.publicResumeVersionId);
  let publicCvVersionId = $derived(data.publicCvVersionId);

  let showAddForm = $state(false);

  // Form states for new entry
  let newName = $state("");
  let newSlug = $state("");
  let newSlugManual = $state(false);
  let newExtendsIds = $state<number[]>([]);

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

  function isPublicResume(versionId: number): boolean {
    return publicResumeVersionId === versionId;
  }

  function isPublicCv(versionId: number): boolean {
    return publicCvVersionId === versionId;
  }

  function getDisplayName(version: (typeof versions)[0]): string {
    return version.name || version.slug || "Untitled Version";
  }
</script>

<div class="space-y-6">
  <SectionHeader
    title="Resumes & CVs"
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
              {@const versionParam = isPublicResume(version.id) ? "" : `?version=${encodeURIComponent(version.slug ?? "")}`}
              {@const cvVersionParam = isPublicCv(version.id) ? "" : `?version=${encodeURIComponent(version.slug ?? "")}`}
              <div class="flex items-center gap-2 flex-wrap flex-1">
                <a
                  href="/p/{data.selectedProfile.slug}/resume{versionParam}"
                  target="_blank"
                  class="dash-link-ext"
                >Resume</a>
                <a
                  href="/p/{data.selectedProfile.slug}/resume.pdf{versionParam}"
                  target="_blank"
                  class="dash-link-ext"
                >Resume PDF</a>
                <a
                  href="/p/{data.selectedProfile.slug}/cv{cvVersionParam}"
                  target="_blank"
                  class="dash-link-ext"
                >CV</a>
                <a
                  href="/p/{data.selectedProfile.slug}/cv.pdf{cvVersionParam}"
                  target="_blank"
                  class="dash-link-ext"
                >CV PDF</a>
                <a
                  href="/dashboard/export/resume/{version.id}"
                  class="p-1 text-[var(--dash-text-secondary)] hover:text-[var(--dash-primary)] transition-colors ml-auto flex items-center gap-1.5"
                  aria-label="Edit"
                >
                  Edit
                  <FontAwesomeIcon icon={faArrowRight} class="w-3.5 h-3.5" />
                </a>
              </div>
            {/if}
          {/snippet}
        </ItemCard>
      {/each}
    </div>
  {/if}
</div>
