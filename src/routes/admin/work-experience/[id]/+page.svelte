<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/state";
  import { goto } from "$app/navigation";

  interface WorkExperience {
    id: string;
    name: string;
    location: string;
    description: string;
    position: string;
    url?: string;
    startDate: string;
    endDate?: string;
    summary: string;
    logo?: string;
    sortOrder: number;
    isActive: boolean;
    highlights: Highlight[];
    technologies: Technology[];
    projects: Project[];
  }

  interface Highlight {
    id: string;
    title?: string;
    description: string;
    iconName?: string;
    sortOrder: number;
    tags: Tag[];
  }

  interface Tag {
    id: string;
    tagName: string;
  }

  interface Technology {
    id: string;
    technologyName: string;
    sortOrder: number;
  }

  interface Project {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    summary: string;
    description: string;
    outcome: string;
    sortOrder: number;
  }

  let workExperience: WorkExperience | null = null;
  let loading = true;
  let error = "";
  let activeTab: "highlights" | "technologies" | "projects" = "highlights";

  // Form states
  let showHighlightForm = false;
  let showTechnologyForm = false;
  let showProjectForm = false;
  let editingHighlight: Highlight | null = null;
  let editingProject: Project | null = null;

  // Form data
  let highlightForm = {
    title: "",
    description: "",
    iconName: "",
    sortOrder: 0,
    tags: "",
  };

  let technologyFormData = "";
  let editedTechnologies: string[] = [];

  let projectForm = {
    name: "",
    startDate: "",
    endDate: "",
    summary: "",
    description: "",
    outcome: "",
    sortOrder: 0,
  };

  const workExperienceId = page.params.id;

  onMount(async () => {
    await loadWorkExperience();
  });

  async function loadWorkExperience() {
    try {
      loading = true;
      const response = await fetch(`/api/admin/work/${workExperienceId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to load work experience");
      }

      workExperience = data.workExperience;
      editedTechnologies = workExperience?.technologies.map((t) =>
        t.technologyName
      ) || [];
    } catch (err) {
      error = err instanceof Error ? err.message : "An error occurred";
    } finally {
      loading = false;
    }
  }

  // Highlight functions
  function openAddHighlight() {
    editingHighlight = null;
    highlightForm = {
      title: "",
      description: "",
      iconName: "",
      sortOrder: workExperience?.highlights.length || 0,
      tags: "",
    };
    showHighlightForm = true;
  }

  function openEditHighlight(highlight: Highlight) {
    editingHighlight = highlight;
    highlightForm = {
      title: highlight.title || "",
      description: highlight.description,
      iconName: highlight.iconName || "",
      sortOrder: highlight.sortOrder,
      tags: highlight.tags.map((t) => t.tagName).join(", "),
    };
    showHighlightForm = true;
  }

  async function saveHighlight() {
    try {
      const method = editingHighlight ? "PUT" : "POST";
      const url = editingHighlight
        ? `/api/admin/work/${workExperienceId}/highlights/${editingHighlight.id}`
        : `/api/admin/work/${workExperienceId}/highlights`;

      const tags = highlightForm.tags.split(",").map((t) => t.trim())
        .filter((t) => t);

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...highlightForm,
          tags,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save highlight");
      }

      await loadWorkExperience();
      closeHighlightForm();
    } catch (err) {
      error = err instanceof Error ? err.message : "An error occurred";
    }
  }

  async function deleteHighlight(highlight: Highlight) {
    if (!confirm("Are you sure you want to delete this highlight?")) return;

    try {
      const response = await fetch(
        `/api/admin/work/${workExperienceId}/highlights/${highlight.id}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete highlight");
      }

      await loadWorkExperience();
    } catch (err) {
      error = err instanceof Error ? err.message : "An error occurred";
    }
  }

  function closeHighlightForm() {
    showHighlightForm = false;
    editingHighlight = null;
  }

  // Technology functions
  function addTechnology() {
    if (technologyFormData.trim()) {
      editedTechnologies = [
        ...editedTechnologies,
        technologyFormData.trim(),
      ];
      technologyFormData = "";
    }
  }

  function removeTechnology(index: number) {
    editedTechnologies = editedTechnologies.filter((_, i) => i !== index);
  }

  async function saveTechnologies() {
    try {
      const response = await fetch(
        `/api/admin/work/${workExperienceId}/technologies`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ technologies: editedTechnologies }),
        },
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save technologies");
      }

      await loadWorkExperience();
      showTechnologyForm = false;
    } catch (err) {
      error = err instanceof Error ? err.message : "An error occurred";
    }
  }

  // Project functions
  function openAddProject() {
    editingProject = null;
    projectForm = {
      name: "",
      startDate: "",
      endDate: "",
      summary: "",
      description: "",
      outcome: "",
      sortOrder: workExperience?.projects.length || 0,
    };
    showProjectForm = true;
  }

  function openEditProject(project: Project) {
    editingProject = project;
    projectForm = { ...project };
    showProjectForm = true;
  }

  async function saveProject() {
    try {
      const method = editingProject ? "PUT" : "POST";
      const url = editingProject
        ? `/api/admin/work/${workExperienceId}/projects/${editingProject.id}`
        : `/api/admin/work/${workExperienceId}/projects`;

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(projectForm),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save project");
      }

      await loadWorkExperience();
      closeProjectForm();
    } catch (err) {
      error = err instanceof Error ? err.message : "An error occurred";
    }
  }

  async function deleteProject(project: Project) {
    if (!confirm("Are you sure you want to delete this project?")) return;

    try {
      const response = await fetch(
        `/api/admin/work/${workExperienceId}/projects/${project.id}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete project");
      }

      await loadWorkExperience();
    } catch (err) {
      error = err instanceof Error ? err.message : "An error occurred";
    }
  }

  function closeProjectForm() {
    showProjectForm = false;
    editingProject = null;
  }

  function formatDate(dateStr: string) {
    if (!dateStr) return "";
    const [year, month] = dateStr.split("-");
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
    });
  }
</script>

<svelte:head>
  <title>
    {workExperience?.name || "Loading..."} - Work Experience Details
  </title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
  <div class="mb-6">
    <button
      on:click={() => goto("/admin/work-experience")}
      class="text-blue-600 hover:text-blue-800 text-sm font-medium mb-4"
    >
      ← Back to Work Experiences
    </button>
  </div>

  {#if error}
    <div
      class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6"
    >
      {error}
    </div>
  {/if}

  {#if loading}
    <div class="flex justify-center items-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600">
      </div>
    </div>
  {:else if workExperience}
    <!-- Header -->
    <div class="bg-white rounded-lg shadow-md border border-gray-200 p-6 mb-6">
      <div class="flex items-start gap-4 mb-4">
        {#if workExperience.logo}
          <img
            src={workExperience.logo}
            alt="{workExperience.name} logo"
            class="w-16 h-16 object-contain"
          />
        {/if}
        <div>
          <h1 class="text-2xl font-bold text-gray-900">
            {workExperience.name}
          </h1>
          <p class="text-lg text-gray-700">{workExperience.position}</p>
          <p class="text-gray-600">
            {workExperience.location} • {formatDate(workExperience.startDate)} -
            {
              workExperience.endDate
                ? formatDate(workExperience.endDate)
                : "Present"
            }
          </p>
        </div>
      </div>
      <p class="text-gray-700 mb-4">{workExperience.summary}</p>
      {#if workExperience.url}
        <a
          href={workExperience.url}
          target="_blank"
          class="text-blue-600 hover:text-blue-800 text-sm"
        >Visit Website →</a>
      {/if}
    </div>

    <!-- Tabs -->
    <div class="border-b border-gray-200 mb-6">
      <nav class="flex space-x-8">
        <button
          class="py-2 px-1 border-b-2 font-medium text-sm {activeTab === 'highlights' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}"
          on:click={() => activeTab = "highlights"}
        >
          Highlights ({workExperience.highlights.length})
        </button>
        <button
          class="py-2 px-1 border-b-2 font-medium text-sm {activeTab === 'technologies' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}"
          on:click={() => activeTab = "technologies"}
        >
          Technologies ({workExperience.technologies.length})
        </button>
        <button
          class="py-2 px-1 border-b-2 font-medium text-sm {activeTab === 'projects' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}"
          on:click={() => activeTab = "projects"}
        >
          Projects ({workExperience.projects.length})
        </button>
      </nav>
    </div>

    <!-- Highlights Tab -->
    {#if activeTab === "highlights"}
      <div class="space-y-4">
        <div class="flex justify-between items-center">
          <h2 class="text-xl font-semibold">Highlights</h2>
          <button
            on:click={openAddHighlight}
            class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm"
          >
            Add Highlight
          </button>
        </div>

        {#each workExperience.highlights as highlight}
          <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div class="flex justify-between items-start">
              <div class="flex-1">
                {#if highlight.title}
                  <h3 class="font-medium text-gray-900 mb-1">
                    {highlight.title}
                  </h3>
                {/if}
                <p class="text-gray-700 text-sm mb-2">
                  {highlight.description}
                </p>
                {#if highlight.iconName}
                  <p class="text-xs text-gray-500 mb-2">
                    Icon: {highlight.iconName}
                  </p>
                {/if}
                {#if highlight.tags.length > 0}
                  <div class="flex gap-1 flex-wrap">
                    {#each highlight.tags as tag}
                      <span
                        class="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded"
                      >
                        {tag.tagName}
                      </span>
                    {/each}
                  </div>
                {/if}
              </div>
              <div class="flex gap-2 ml-4">
                <button
                  on:click={() => openEditHighlight(highlight)}
                  class="text-blue-600 hover:text-blue-800 text-sm"
                >
                  Edit
                </button>
                <button
                  on:click={() => deleteHighlight(highlight)}
                  class="text-red-600 hover:text-red-800 text-sm"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}

    <!-- Technologies Tab -->
    {#if activeTab === "technologies"}
      <div class="space-y-4">
        <div class="flex justify-between items-center">
          <h2 class="text-xl font-semibold">Technologies</h2>
          <button
            on:click={() => showTechnologyForm = true}
            class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm"
          >
            Edit Technologies
          </button>
        </div>

        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div class="flex flex-wrap gap-2">
            {#each workExperience.technologies as tech}
              <span
                class="bg-gray-100 text-gray-800 px-3 py-1 rounded-md text-sm"
              >
                {tech.technologyName}
              </span>
            {/each}
          </div>
        </div>
      </div>
    {/if}

    <!-- Projects Tab -->
    {#if activeTab === "projects"}
      <div class="space-y-4">
        <div class="flex justify-between items-center">
          <h2 class="text-xl font-semibold">Projects</h2>
          <button
            on:click={openAddProject}
            class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm"
          >
            Add Project
          </button>
        </div>

        {#each workExperience.projects as project}
          <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div class="flex justify-between items-start mb-2">
              <h3 class="font-medium text-gray-900">{project.name}</h3>
              <div class="flex gap-2 ml-4">
                <button
                  on:click={() => openEditProject(project)}
                  class="text-blue-600 hover:text-blue-800 text-sm"
                >
                  Edit
                </button>
                <button
                  on:click={() => deleteProject(project)}
                  class="text-red-600 hover:text-red-800 text-sm"
                >
                  Delete
                </button>
              </div>
            </div>
            <p class="text-sm text-gray-500 mb-2">
              {formatDate(project.startDate)} - {formatDate(project.endDate)}
            </p>
            <p class="text-gray-700 text-sm mb-2">{project.summary}</p>
            <details class="text-sm">
              <summary class="cursor-pointer text-blue-600 hover:text-blue-800">
                Show more details
              </summary>
              <div class="mt-2 space-y-2 pl-4">
                <div>
                  <span class="font-medium">Description:</span>
                  <p class="text-gray-700">{project.description}</p>
                </div>
                <div>
                  <span class="font-medium">Outcome:</span>
                  <p class="text-gray-700">{project.outcome}</p>
                </div>
              </div>
            </details>
          </div>
        {/each}
      </div>
    {/if}
  {:else}
    <div class="text-center py-12">
      <p class="text-gray-500 text-lg">Work experience not found.</p>
    </div>
  {/if}
</div>

<!-- Highlight Form Modal -->
{#if showHighlightForm}
  <div
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
  >
    <div
      class="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
    >
      <div class="p-6 border-b border-gray-200">
        <h2 class="text-xl font-semibold text-gray-900">
          {editingHighlight ? "Edit Highlight" : "Add Highlight"}
        </h2>
      </div>

      <form on:submit|preventDefault={saveHighlight} class="p-6 space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1"
          >Title</label>
          <input
            type="text"
            bind:value={highlightForm.title}
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1"
          >Description *</label>
          <textarea
            bind:value={highlightForm.description}
            required
            rows="3"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          ></textarea>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1"
          >Icon Name</label>
          <input
            type="text"
            bind:value={highlightForm.iconName}
            placeholder="faCode, faUsers, etc."
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1"
          >Tags</label>
          <input
            type="text"
            bind:value={highlightForm.tags}
            placeholder="fullstack-python, fullstack-react (comma separated)"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1"
          >Sort Order</label>
          <input
            type="number"
            bind:value={highlightForm.sortOrder}
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div class="flex justify-end gap-3 pt-6 border-t border-gray-200">
          <button
            type="button"
            on:click={closeHighlightForm}
            class="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            {editingHighlight ? "Update" : "Create"}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- Technology Form Modal -->
{#if showTechnologyForm}
  <div
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
  >
    <div
      class="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
    >
      <div class="p-6 border-b border-gray-200">
        <h2 class="text-xl font-semibold text-gray-900">Edit Technologies</h2>
      </div>

      <div class="p-6 space-y-4">
        <div class="flex gap-2">
          <input
            type="text"
            bind:value={technologyFormData}
            placeholder="Add technology..."
            class="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            on:keydown={(e) =>
              e.key === "Enter" &&
              (e.preventDefault(), addTechnology())}
          />
          <button
            type="button"
            on:click={addTechnology}
            class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Add
          </button>
        </div>

        <div class="space-y-2 max-h-60 overflow-y-auto">
          {#each editedTechnologies as tech, index}
            <div
              class="flex items-center justify-between bg-gray-50 px-3 py-2 rounded"
            >
              <span>{tech}</span>
              <button
                type="button"
                on:click={() => removeTechnology(index)}
                class="text-red-600 hover:text-red-800 text-sm"
              >
                Remove
              </button>
            </div>
          {/each}
        </div>

        <div class="flex justify-end gap-3 pt-6 border-t border-gray-200">
          <button
            type="button"
            on:click={() => showTechnologyForm = false}
            class="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            on:click={saveTechnologies}
            class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<!-- Project Form Modal -->
{#if showProjectForm}
  <div
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
  >
    <div
      class="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
    >
      <div class="p-6 border-b border-gray-200">
        <h2 class="text-xl font-semibold text-gray-900">
          {editingProject ? "Edit Project" : "Add Project"}
        </h2>
      </div>

      <form on:submit|preventDefault={saveProject} class="p-6 space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1"
            >Project Name *</label>
            <input
              type="text"
              bind:value={projectForm.name}
              required
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1"
            >Sort Order</label>
            <input
              type="number"
              bind:value={projectForm.sortOrder}
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1"
            >Start Date *</label>
            <input
              type="text"
              bind:value={projectForm.startDate}
              placeholder="YYYY-MM"
              required
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1"
            >End Date *</label>
            <input
              type="text"
              bind:value={projectForm.endDate}
              placeholder="YYYY-MM"
              required
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1"
          >Summary *</label>
          <textarea
            bind:value={projectForm.summary}
            required
            rows="2"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          ></textarea>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1"
          >Description *</label>
          <textarea
            bind:value={projectForm.description}
            required
            rows="3"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          ></textarea>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1"
          >Outcome *</label>
          <textarea
            bind:value={projectForm.outcome}
            required
            rows="3"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          ></textarea>
        </div>

        <div class="flex justify-end gap-3 pt-6 border-t border-gray-200">
          <button
            type="button"
            on:click={closeProjectForm}
            class="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            {editingProject ? "Update" : "Create"}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

