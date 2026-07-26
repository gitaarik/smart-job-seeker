<script lang="ts">
import type { PageData } from "./$types";
import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
import {
  faArrowLeft,
  faLightbulb,
  faPlus,
  faStar,
  faTrash,
} from "@fortawesome/free-solid-svg-icons";
import MediaUpload from "$lib/components/MediaUpload.svelte";
import SectionSaveButton from "$lib/components/SectionSaveButton.svelte";
import { autoSaveField, recordsEqual } from "$lib/components/auto-save.svelte";
import AutoSaveIndicator from "$lib/components/AutoSaveIndicator.svelte";
import TranslatableField from "$lib/components/TranslatableField.svelte";
import AchievementsList, {
  type AchievementItem,
} from "$lib/components/AchievementsList.svelte";
import TechnologyTagsEditor from "$lib/components/TechnologyTagsEditor.svelte";
import VersionTags from "$lib/components/VersionTags.svelte";
import ConfirmModal from "../../../components/ConfirmModal.svelte";
import ProjectDocuments from "../../../components/ProjectDocuments.svelte";
import Card from "../../../../components/Card.svelte";

type SaveState = "idle" | "saving" | "saved" | "error";

let { data }: { data: PageData } = $props();

let imageUrl = $state(data.imageUrl);
let bannerUrl = $state(data.bannerUrl);

let project = $derived(data.project);

let pageTitle = $derived(project.name || "Project");

// Section save states. Technologies and achievements stay on explicit save:
// both stage removals in a `deleted*` index set that only takes effect on
// commit, so auto-saving would change what the delete button means, not just
// when the PATCH fires.
let techSaveState = $state<SaveState>("idle");
let achievementsSaveState = $state<SaveState>("idle");

// Form states
let editName = $state(project.name || "");
let editUrl = $state(project.url || "");
let editUrlLabel = $state(project.url_label || "");
let editSummary = $state(project.summary || "");
let editStars = $state(project.stars?.toString() || "");
let editStartDate = $state(formatDate(project.start_date));
let editEndDate = $state(formatDate(project.end_date));
let editTags = $state<string[]>(
  Array.isArray(project.tags) ? project.tags as string[] : [],
);
let editAchievements = $state<AchievementItem[]>(
  project.side_project_achievements.map((a) => ({
    id: a.id,
    description: a.description || "",
    tags: null,
  })),
);
let editTechnologies = $state<string[]>(
  project.side_project_technologies.map((t) => t.name || ""),
);
let deletedTechnologies = $state<Set<number>>(new Set());
let deletedAchievements = $state<Set<number>>(new Set());
let lastAddedTechIndex = $state<number | null>(null);
let showDeleteConfirm = $state(false);

function formatDate(date: Date | string | null): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toISOString().split("T")[0];
}

type ProjectBasics = {
  name: string;
  url: string;
  urlLabel: string;
  summary: string;
  stars: string;
  startDate: string;
  endDate: string;
};
const basicsField = autoSaveField<ProjectBasics>({
  initial: {
    name: editName,
    url: editUrl,
    urlLabel: editUrlLabel,
    summary: editSummary,
    stars: editStars,
    startDate: editStartDate,
    endDate: editEndDate,
  },
  save: async (v) => {
    const response = await fetch(`/api/side-project/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        section: "basic",
        name: v.name,
        url: v.url,
        url_label: v.urlLabel,
        summary: v.summary,
        stars: v.stars || null,
        start_date: v.startDate || null,
        end_date: v.endDate || null,
      }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(
        body.message || body.error || `Save failed (${response.status})`,
      );
    }
  },
  onSaved: (v) => {
    editName = v.name;
    editUrl = v.url;
    editUrlLabel = v.urlLabel;
    editSummary = v.summary;
    editStars = v.stars;
    editStartDate = v.startDate;
    editEndDate = v.endDate;
  },
  equal: recordsEqual,
  debounceMs: 700,
});
$effect(() =>
  basicsField.set({
    name: editName,
    url: editUrl,
    urlLabel: editUrlLabel,
    summary: editSummary,
    stars: editStars,
    startDate: editStartDate,
    endDate: editEndDate,
  })
);

async function saveTechnologies() {
  techSaveState = "saving";
  try {
    const response = await fetch(`/api/side-project/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        section: "technologies",
        technologies: editTechnologies.filter((t, i) =>
          t.trim() && !deletedTechnologies.has(i)
        ),
      }),
    });

    if (response.ok) {
      techSaveState = "saved";
      setTimeout(() => (techSaveState = "idle"), 2000);
    } else {
      techSaveState = "error";
      setTimeout(() => (techSaveState = "idle"), 3000);
    }
  } catch {
    techSaveState = "error";
    setTimeout(() => (techSaveState = "idle"), 3000);
  }
}

async function saveAchievements() {
  achievementsSaveState = "saving";
  try {
    const sent = editAchievements
      .map((a, i) => ({ a, i }))
      .filter(({ a, i }) =>
        a.description.trim() && !deletedAchievements.has(i)
      );

    const response = await fetch(`/api/side-project/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        section: "achievements",
        achievements: sent.map(({ a }) => ({
          id: a.id,
          description: a.description,
        })),
      }),
    });

    if (response.ok) {
      const result = await response.json().catch(() => null);
      if (result && Array.isArray(result.achievements)) {
        const updated = [...editAchievements];
        sent.forEach(({ i }, k) => {
          const newId = result.achievements[k]?.id;
          if (newId) updated[i] = { ...updated[i], id: newId };
        });
        editAchievements = updated;
      }
      achievementsSaveState = "saved";
      setTimeout(() => (achievementsSaveState = "idle"), 2000);
    } else {
      achievementsSaveState = "error";
      setTimeout(() => (achievementsSaveState = "idle"), 3000);
    }
  } catch {
    achievementsSaveState = "error";
    setTimeout(() => (achievementsSaveState = "idle"), 3000);
  }
}

let lastAddedAchievementIndex = $state<number | null>(null);

function addAchievement() {
  editAchievements = [...editAchievements, { description: "", tags: null }];
  lastAddedAchievementIndex = editAchievements.length - 1;
}

function removeAchievement(index: number) {
  if (!editAchievements[index]?.description.trim()) {
    // Empty item - remove immediately
    editAchievements = editAchievements.filter((_, i) => i !== index);
    // Adjust deleted indices for removed item
    const newDeleted = new Set<number>();
    deletedAchievements.forEach((i) => {
      if (i > index) newDeleted.add(i - 1);
      else if (i < index) newDeleted.add(i);
    });
    deletedAchievements = newDeleted;
  } else {
    // Has content - soft delete
    deletedAchievements = new Set([...deletedAchievements, index]);
  }
}

function undoRemoveAchievement(index: number) {
  const newSet = new Set(deletedAchievements);
  newSet.delete(index);
  deletedAchievements = newSet;
}

// AchievementsList commits a reorder with the soft-delete set already
// remapped to the new order; realign our index-based side state to match.
function commitAchievementsReorder(newDeleted: Set<number>) {
  deletedAchievements = newDeleted;
  lastAddedAchievementIndex = null;
}

function addTechnology() {
  editTechnologies = [...editTechnologies, ""];
  lastAddedTechIndex = editTechnologies.length - 1;
}

function removeTechnology(index: number) {
  if (!editTechnologies[index]?.trim()) {
    // Empty tag - remove immediately
    editTechnologies = editTechnologies.filter((_, i) => i !== index);
    // Adjust deleted indices for removed item
    const newDeleted = new Set<number>();
    deletedTechnologies.forEach((i) => {
      if (i > index) newDeleted.add(i - 1);
      else if (i < index) newDeleted.add(i);
    });
    deletedTechnologies = newDeleted;
  } else {
    // Has content - soft delete
    deletedTechnologies = new Set([...deletedTechnologies, index]);
  }
}

function undoRemoveTechnology(index: number) {
  const newSet = new Set(deletedTechnologies);
  newSet.delete(index);
  deletedTechnologies = newSet;
}
</script>

<svelte:head>
  <title>{pageTitle} - Side Projects - Smart Job Seeker</title>
</svelte:head>

<div class="space-y-6">
  <!-- Header -->
  <div class="flex items-center gap-4">
    <a
      href="/profile/side-projects"
      class="flex items-center gap-2 text-[var(--dash-text-secondary)] hover:text-[var(--dash-primary)] transition-colors"
    >
      <FontAwesomeIcon icon={faArrowLeft} class="w-4 h-4" />
      <span class="text-sm">All Side Projects</span>
    </a>
  </div>

  <div class="flex items-center gap-4">
    {#if imageUrl}
      <img
        src={imageUrl}
        alt="{project.name} image"
        class="w-12 h-12 rounded-lg object-cover"
      />
    {:else}
      <div
        class="w-12 h-12 rounded-lg bg-[var(--dash-bg)] flex items-center justify-center"
      >
        <FontAwesomeIcon icon={faLightbulb} class="w-6 h-6 text-[var(--dash-primary)]" />
      </div>
    {/if}
    <div>
      <h1 class="text-2xl font-bold text-[var(--dash-text)]">
        Edit Side Project
        {#if project.stars}
          <span class="text-amber-500 text-lg ml-2">
            <FontAwesomeIcon icon={faStar} class="w-4 h-4" />
            {project.stars}
          </span>
        {/if}
      </h1>
      <p class="text-[var(--dash-text-secondary)]">{project.name}</p>
    </div>
  </div>

  <!-- Basic Info -->
  <Card padding="lg">
    <h2
      class="text-lg font-semibold text-[var(--dash-text)] mb-4">Basic Information</h2>
    <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <TranslatableField
            entity="side_project"
            id={project.id}
            field="name"
            label="Project Name"
            required
            bind:value={editName}
          />
        </div>

        <div>
          <label
            for="edit-url"
            class="block text-sm font-medium text-[var(--dash-text)] mb-1"
          >
            URL
          </label>
          <input
            type="url"
            id="edit-url"
            bind:value={editUrl}
            placeholder="https://github.com/user/project"
            class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
          />
        </div>

        <TranslatableField
          entity="side_project"
          id={project.id}
          field="url_label"
          label="URL Label"
          bind:value={editUrlLabel}
          placeholder="e.g., View on GitHub"
        />

        <div>
          <label
            for="edit-stars"
            class="block text-sm font-medium text-[var(--dash-text)] mb-1"
          >
            GitHub Stars
          </label>
          <input
            type="number"
            id="edit-stars"
            bind:value={editStars}
            min="0"
            class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
          />
        </div>

        <div>
          <label
            for="edit-start-date"
            class="block text-sm font-medium text-[var(--dash-text)] mb-1"
          >
            Start Date
          </label>
          <input
            type="date"
            id="edit-start-date"
            bind:value={editStartDate}
            class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
          />
        </div>

        <div>
          <label
            for="edit-end-date"
            class="block text-sm font-medium text-[var(--dash-text)] mb-1"
          >
            End Date
          </label>
          <input
            type="date"
            id="edit-end-date"
            bind:value={editEndDate}
            class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
          />
        </div>
      </div>

      <TranslatableField
        entity="side_project"
        id={project.id}
        field="summary"
        label="Summary"
        multiline
        rows={5}
        bind:value={editSummary}
        placeholder="Brief description of the project..."
      />
    </div>
    <div class="flex justify-end mt-4">
      <AutoSaveIndicator field={basicsField} />
    </div>
  </Card>

  <!-- Technologies -->
  <Card padding="lg">
    <h2
      class="text-lg font-semibold text-[var(--dash-text)] mb-4">Technologies</h2>

    <TechnologyTagsEditor
      bind:technologies={editTechnologies}
      deletedIndices={deletedTechnologies}
      lastAddedIndex={lastAddedTechIndex}
      onAdd={addTechnology}
      onRemove={removeTechnology}
      onUndoRemove={undoRemoveTechnology}
      onFocused={() => (lastAddedTechIndex = null)}
    />
    <div class="flex justify-end mt-4">
      <SectionSaveButton state={techSaveState} onClick={saveTechnologies} />
    </div>
  </Card>

  <!-- Achievements -->
  <Card padding="lg">
    <h2
      class="text-lg font-semibold text-[var(--dash-text)] mb-4">Achievements</h2>

    <AchievementsList
      bind:achievements={editAchievements}
      deletedIndices={deletedAchievements}
      lastAddedIndex={lastAddedAchievementIndex}
      entity="side_project_achievement"
      onAdd={addAchievement}
      onRemove={removeAchievement}
      onUndoRemove={undoRemoveAchievement}
      onReorderCommit={commitAchievementsReorder}
      onReorderSave={saveAchievements}
      onFocused={() => (lastAddedAchievementIndex = null)}
    />
    <div class="flex justify-end mt-4">
      <SectionSaveButton state={achievementsSaveState}
        onClick={saveAchievements} />
    </div>
  </Card>

  <!-- Files & source code -->
  <Card padding="lg">
    <h2 class="text-lg font-semibold text-[var(--dash-text)] mb-1">
      Files & source code
    </h2>
    <p class="text-sm text-[var(--dash-text-secondary)] mb-4">
      Attach this project's source code or docs. We summarize them into reference
      notes we can cite when a job matches this project.
    </p>
    <ProjectDocuments
      profileId={data.profileId}
      sideProjectId={project.id}
      documents={data.documents}
    />
  </Card>

  <!-- Portfolio Images -->
  <Card padding="lg">
    <h2
      class="text-lg font-semibold text-[var(--dash-text)] mb-2">Portfolio Images</h2>
    <p class="text-sm text-[var(--dash-text-secondary)] mb-4">
      These images are used for your portfolio display. They are not required for job search or scoring.
    </p>
    <div class="flex gap-6">
      <div class="max-w-xs">
        <MediaUpload
          entityType="side_project"
          entityId={project.id}
          field="image_path"
          currentUrl={imageUrl}
          label="Project Image"
          showHint={false}
          onUpload={(url) => (imageUrl = url)}
          onDelete={() => (imageUrl = null)}
        />
      </div>
      <div class="flex-1">
        <MediaUpload
          entityType="side_project"
          entityId={project.id}
          field="banner_path"
          currentUrl={bannerUrl}
          label="Project Banner"
          showHint={false}
          onUpload={(url) => (bannerUrl = url)}
          onDelete={() => (bannerUrl = null)}
        />
      </div>
    </div>
    <p class="text-xs text-[var(--dash-text-secondary)] mt-3">
      JPEG, PNG, WebP, or GIF. Max 5MB.
    </p>
  </Card>

  <!-- Version Tags -->
  <VersionTags bind:tags={editTags} apiUrl={`/api/side-project/${project.id}`}
    section="basic" />

  <!-- Danger Zone -->
  <Card padding="lg">
    <div class="space-y-3">
      <div class="flex items-center gap-2 mb-2">
        <FontAwesomeIcon
          icon={faTrash}
          class="w-4 h-4 text-[var(--dash-text-secondary)]"
        />
        <h2
          class="text-sm font-semibold text-[var(--dash-text)] uppercase tracking-wide"
        >
          Danger Zone
        </h2>
      </div>

      <p class="text-sm text-[var(--dash-text-secondary)]">
        Permanently remove this side project and all associated data.
      </p>

      <button
        type="button"
        onclick={() => showDeleteConfirm = true}
        class="flex items-center gap-2 px-4 py-2 text-sm bg-red-500/10 border border-red-500/30 rounded-lg text-red-500 hover:bg-red-500/20 hover:border-red-500/50 transition-colors"
      >
        <FontAwesomeIcon icon={faTrash} class="w-3 h-3" />
        Delete Side Project
      </button>
    </div>
  </Card>
</div>

<ConfirmModal
  isOpen={showDeleteConfirm}
  title="Delete Side Project"
  message="Are you sure you want to permanently delete this side project? All achievements and technologies will also be deleted. This action cannot be undone."
  confirmLabel="Delete"
  onCancel={() => showDeleteConfirm = false}
  onConfirm={() => {
    showDeleteConfirm = false;
    const form = document.createElement("form");
    form.method = "POST";
    form.action = "/profile/side-projects?/delete";
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = "id";
    input.value = String(project.id);
    form.appendChild(input);
    document.body.appendChild(form);
    form.submit();
  }}
/>
