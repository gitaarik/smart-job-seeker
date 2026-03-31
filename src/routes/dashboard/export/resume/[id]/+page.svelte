<script lang="ts">
  import type { ActionData, PageData } from "./$types";
  import { enhance } from "$app/forms";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faArrowLeft,
    faBriefcase,
    faCheck,
    faCode,
    faCogs,
    faFileAlt,
    faGraduationCap,
    faStar,
    faTrash,
  } from "@fortawesome/free-solid-svg-icons";
  import Card from "../../../components/Card.svelte";
  import ConfirmModal from "../../../profile/components/ConfirmModal.svelte";

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let version = $derived(data.version);
  let showDeleteModal = $state(false);

  // Form states
  let editName = $state(data.version.name || "");
  let editSlug = $state(data.version.slug || "");
  let editExtendsIds = $state<number[]>([...data.version.extendsIds]);
  let editPublicResume = $state(data.publicResumeVersionId === data.version.id);
  let editPublicCv = $state(data.publicCvVersionId === data.version.id);

  let tagUsage = $derived(data.tagUsage);
  let hasTaggedItems = $derived(
    tagUsage.workExperiences.length > 0 ||
    tagUsage.education.length > 0 ||
    tagUsage.sideProjects.length > 0 ||
    tagUsage.skills.length > 0 ||
    tagUsage.achievements.length > 0,
  );

  function getReplacedPublicResumeName(): string | null {
    if (
      !data.publicResumeVersionId ||
      data.publicResumeVersionId === version.id
    )
      return null;
    const v = data.allVersions.find(
      (v) => v.id === data.publicResumeVersionId,
    );
    return v?.name || v?.slug || null;
  }

  function getReplacedPublicCvName(): string | null {
    if (!data.publicCvVersionId || data.publicCvVersionId === version.id)
      return null;
    const v = data.allVersions.find((v) => v.id === data.publicCvVersionId);
    return v?.name || v?.slug || null;
  }
</script>

<div class="space-y-6">
  <!-- Header with back link -->
  <div>
    <a
      href="/dashboard/export/resume"
      class="flex items-center gap-2 text-[var(--dash-text-secondary)] hover:text-[var(--dash-primary)] transition-colors"
    >
      <FontAwesomeIcon icon={faArrowLeft} class="w-4 h-4" />
      <span class="text-sm">Back to all Resume Versions</span>
    </a>
  </div>
  <div class="flex items-center gap-2">
    <FontAwesomeIcon
      icon={faFileAlt}
      class="w-5 h-5 text-indigo-600"
    />
    <h2 class="text-lg font-semibold text-[var(--dash-text)]">
      {version.name || version.slug || "Untitled Version"}
    </h2>
  </div>

  {#if form?.error}
    <div
      class="bg-[var(--dash-error-light)] border border-[var(--dash-error)] rounded-lg p-4"
    >
      <p class="text-[var(--dash-error)] text-sm">{form.error}</p>
    </div>
  {/if}

  {#if form?.success}
    <div
      class="bg-[var(--dash-success-light,#dcfce7)] border border-[var(--dash-success)] rounded-lg p-4"
    >
      <p class="text-[var(--dash-success)] text-sm">Version updated.</p>
    </div>
  {/if}

  <form method="POST" action="?/update" use:enhance>
    <Card padding="responsive">
      <div class="space-y-6">
        <!-- Basic Info -->
        <div>
          <h3
            class="text-sm font-semibold text-[var(--dash-text)] uppercase tracking-wide mb-4"
          >
            Basic Info
          </h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label
                for="edit-name"
                class="block text-sm font-medium text-[var(--dash-text)] mb-1"
              >
                Name
              </label>
              <input
                type="text"
                id="edit-name"
                name="name"
                bind:value={editName}
                placeholder="e.g., Full Stack Developer Resume"
                class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
              />
            </div>

            <div>
              <label
                for="edit-slug"
                class="block text-sm font-medium text-[var(--dash-text)] mb-1"
              >
                Slug <span class="text-[var(--dash-error)]">*</span>
              </label>
              <input
                type="text"
                id="edit-slug"
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
        </div>

        <!-- Extends -->
        {#if data.allVersions.length > 0}
          <div>
            <h3
              class="text-sm font-semibold text-[var(--dash-text)] uppercase tracking-wide mb-3"
            >
              Extends
            </h3>
            <div class="flex flex-wrap gap-x-4 gap-y-2">
              {#each data.allVersions as v}
                <label
                  class="flex items-center gap-1.5 text-sm text-[var(--dash-text)] cursor-pointer"
                >
                  <input
                    type="checkbox"
                    name="extendsIds"
                    value={v.id}
                    checked={editExtendsIds.includes(v.id)}
                    onchange={(e) => {
                      if (e.currentTarget.checked) {
                        editExtendsIds = [...editExtendsIds, v.id];
                      } else {
                        editExtendsIds = editExtendsIds.filter(
                          (id) => id !== v.id,
                        );
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

        <!-- Public Access -->
        <div>
          <h3
            class="text-sm font-semibold text-[var(--dash-text)] uppercase tracking-wide mb-1"
          >
            Public Access
          </h3>
          <p class="text-xs text-[var(--dash-text-secondary)] mb-3">
            For trackable links with view limits and expiration, use <a
              href="/dashboard/export/share"
              class="text-[var(--dash-primary)] hover:underline"
              >Private Links</a
            >.
          </p>
          <div class="space-y-2">
            <label
              class="flex items-start gap-1.5 text-sm text-[var(--dash-text)] cursor-pointer"
            >
              <input
                type="checkbox"
                name="publicResume"
                bind:checked={editPublicResume}
                class="rounded border-[var(--dash-border)] text-[var(--dash-primary)] focus:ring-[var(--dash-primary)] mt-0.5"
              />
              <span>
                Use as public resume
                {#if getReplacedPublicResumeName() && editPublicResume}
                  <span class="text-xs text-[var(--dash-warning)]"
                    >(replaces {getReplacedPublicResumeName()})</span
                  >
                {/if}
              </span>
            </label>
            <label
              class="flex items-start gap-1.5 text-sm text-[var(--dash-text)] cursor-pointer"
            >
              <input
                type="checkbox"
                name="publicCv"
                bind:checked={editPublicCv}
                class="rounded border-[var(--dash-border)] text-[var(--dash-primary)] focus:ring-[var(--dash-primary)] mt-0.5"
              />
              <span>
                Use as public CV
                {#if getReplacedPublicCvName() && editPublicCv}
                  <span class="text-xs text-[var(--dash-warning)]"
                    >(replaces {getReplacedPublicCvName()})</span
                  >
                {/if}
              </span>
            </label>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex items-center pt-2 border-t border-[var(--dash-border)]">
          <button
            type="button"
            onclick={() => (showDeleteModal = true)}
            class="py-2 pr-2 text-red-500 hover:text-red-600 transition-colors"
            aria-label="Delete"
          >
            <FontAwesomeIcon icon={faTrash} class="w-4 h-4" />
          </button>
          <div class="ml-auto">
            <button
              type="submit"
              class="px-4 py-2 bg-[var(--dash-primary)] text-white rounded-lg hover:bg-[var(--dash-primary-hover)] transition-colors flex items-center gap-2 text-sm font-medium"
            >
              <FontAwesomeIcon icon={faCheck} class="w-4 h-4" />
              Save
            </button>
          </div>
        </div>
      </div>
    </Card>
  </form>

  <!-- Tagged Items -->
  <Card padding="responsive">
    <h3
      class="text-sm font-semibold text-[var(--dash-text)] uppercase tracking-wide mb-3"
    >
      Tagged Items
    </h3>
    {#if !hasTaggedItems}
      <p class="text-sm text-[var(--dash-text-secondary)]">
        No items are tagged with this version yet. Add the <code class="text-xs bg-[var(--dash-bg)] px-1.5 py-0.5 rounded font-mono">{version.slug}</code> tag to work experiences, education, or side projects to include them in this version.
      </p>
    {:else}
      <div class="tagged-items space-y-4">
        {#if tagUsage.workExperiences.length > 0}
          <div>
            <div class="flex items-center gap-1.5 mb-2">
              <FontAwesomeIcon icon={faBriefcase} class="w-3.5 h-3.5 text-[var(--dash-text-secondary)]" />
              <span class="text-xs font-medium text-[var(--dash-text-secondary)] uppercase tracking-wide">Work Experience</span>
            </div>
            <div class="flex flex-wrap gap-2">
              {#each tagUsage.workExperiences as item}
                <a
                  href="/dashboard/profile/work-experience/{item.id}"
                  class="dash-link-ext"
                >{item.name || "Untitled"}</a>
              {/each}
            </div>
          </div>
        {/if}

        {#if tagUsage.education.length > 0}
          <div>
            <div class="flex items-center gap-1.5 mb-2">
              <FontAwesomeIcon icon={faGraduationCap} class="w-3.5 h-3.5 text-[var(--dash-text-secondary)]" />
              <span class="text-xs font-medium text-[var(--dash-text-secondary)] uppercase tracking-wide">Education</span>
            </div>
            <div class="flex flex-wrap gap-2">
              {#each tagUsage.education as item}
                <a
                  href="/dashboard/profile/education/{item.id}"
                  class="dash-link-ext"
                >{item.name || "Untitled"}</a>
              {/each}
            </div>
          </div>
        {/if}

        {#if tagUsage.sideProjects.length > 0}
          <div>
            <div class="flex items-center gap-1.5 mb-2">
              <FontAwesomeIcon icon={faCode} class="w-3.5 h-3.5 text-[var(--dash-text-secondary)]" />
              <span class="text-xs font-medium text-[var(--dash-text-secondary)] uppercase tracking-wide">Side Projects</span>
            </div>
            <div class="flex flex-wrap gap-2">
              {#each tagUsage.sideProjects as item}
                <a
                  href="/dashboard/profile/side-projects/{item.id}"
                  class="dash-link-ext"
                >{item.name || "Untitled"}</a>
              {/each}
            </div>
          </div>
        {/if}

        {#if tagUsage.skills.length > 0}
          <div>
            <div class="flex items-center gap-1.5 mb-2">
              <FontAwesomeIcon icon={faCogs} class="w-3.5 h-3.5 text-[var(--dash-text-secondary)]" />
              <span class="text-xs font-medium text-[var(--dash-text-secondary)] uppercase tracking-wide">Skills</span>
            </div>
            <div class="flex flex-wrap gap-2">
              {#each tagUsage.skills as item}
                <a
                  href="/dashboard/profile/skills"
                  class="dash-link-ext"
                >{item.name || "Untitled"}</a>
              {/each}
            </div>
          </div>
        {/if}

        {#if tagUsage.achievements.length > 0}
          <div>
            <div class="flex items-center gap-1.5 mb-2">
              <FontAwesomeIcon icon={faStar} class="w-3.5 h-3.5 text-[var(--dash-text-secondary)]" />
              <span class="text-xs font-medium text-[var(--dash-text-secondary)] uppercase tracking-wide">Achievements</span>
            </div>
            <div class="flex flex-wrap gap-2">
              {#each tagUsage.achievements as item}
                <a
                  href="/dashboard/profile/work-experience/{item.work_experience}"
                  class="dash-link-ext"
                >{item.name || "Untitled"}</a>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    {/if}
  </Card>
</div>

<!-- Delete Confirmation Modal -->
<ConfirmModal
  isOpen={showDeleteModal}
  title="Delete Version"
  message="Are you sure you want to delete this resume version? Associated share links may stop working. This action cannot be undone."
  onCancel={() => (showDeleteModal = false)}
  onConfirm={() => {
    const form = document.createElement("form");
    form.method = "POST";
    form.action = `?/delete`;
    document.body.appendChild(form);
    form.submit();
  }}
/>

<style>
  :global(.tagged-items .dash-link-ext) {
    border-radius: 0.375rem;
  }
</style>
