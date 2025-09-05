<script lang="ts">
  import { onMount } from "svelte";
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
    createdAt: string;
    updatedAt: string;
    highlights?: any[];
    technologies?: any[];
    projects?: any[];
  }

  let workExperiences: WorkExperience[] = [];
  let loading = true;
  let error = "";
  let showForm = false;
  let editingExperience: WorkExperience | null = null;

  // Form fields
  let formData = {
    name: "",
    location: "",
    description: "",
    position: "",
    url: "",
    startDate: "",
    endDate: "",
    summary: "",
    logo: "",
    sortOrder: 0,
    isActive: true,
  };

  onMount(async () => {
    await loadWorkExperiences();
  });

  async function loadWorkExperiences() {
    try {
      loading = true;
      const response = await fetch("/api/admin/work?include=all");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to load work experiences");
      }

      workExperiences = data.workExperiences;
    } catch (err) {
      error = err instanceof Error ? err.message : "An error occurred";
    } finally {
      loading = false;
    }
  }

  function openAddForm() {
    editingExperience = null;
    formData = {
      name: "",
      location: "",
      description: "",
      position: "",
      url: "",
      startDate: "",
      endDate: "",
      summary: "",
      logo: "",
      sortOrder: workExperiences.length,
      isActive: true,
    };
    showForm = true;
  }

  function openEditForm(experience: WorkExperience) {
    editingExperience = experience;
    formData = {
      name: experience.name,
      location: experience.location,
      description: experience.description,
      position: experience.position,
      url: experience.url || "",
      startDate: experience.startDate,
      endDate: experience.endDate || "",
      summary: experience.summary,
      logo: experience.logo || "",
      sortOrder: experience.sortOrder,
      isActive: experience.isActive,
    };
    showForm = true;
  }

  function closeForm() {
    showForm = false;
    editingExperience = null;
    formData = {
      name: "",
      location: "",
      description: "",
      position: "",
      url: "",
      startDate: "",
      endDate: "",
      summary: "",
      logo: "",
      sortOrder: 0,
      isActive: true,
    };
  }

  async function saveExperience() {
    try {
      const method = editingExperience ? "PUT" : "POST";
      const url = editingExperience
        ? `/api/admin/work/${editingExperience.id}`
        : "/api/admin/work";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to save work experience");
      }

      await loadWorkExperiences();
      closeForm();
    } catch (err) {
      error = err instanceof Error
        ? err.message
        : "An error occurred while saving";
    }
  }

  async function deleteExperience(experience: WorkExperience) {
    if (
      !confirm(
        `Are you sure you want to delete ${experience.name}? This will also delete all associated highlights, technologies, and projects.`,
      )
    ) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/work/${experience.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete work experience");
      }

      await loadWorkExperiences();
    } catch (err) {
      error = err instanceof Error
        ? err.message
        : "An error occurred while deleting";
    }
  }

  function viewDetails(experience: WorkExperience) {
    goto(`/admin/work-experience/${experience.id}`);
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
  <title>Work Experience Management - Admin</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
  <div class="flex items-center justify-between mb-8">
    <h1 class="text-3xl font-bold text-gray-900">Work Experience Management</h1>
    <button
      on:click={openAddForm}
      class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors"
    >
      Add New Experience
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
  {:else}
    <div class="grid gap-6">
      {#each workExperiences as experience (experience.id)}
        <div
          class="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden"
        >
          <div class="p-6">
            <div class="flex items-start justify-between">
              <div class="flex-1">
                <div class="flex items-center gap-4 mb-2">
                  {#if experience.logo}
                    <img
                      src={experience.logo}
                      alt="{experience.name} logo"
                      class="w-12 h-12 object-contain"
                    />
                  {/if}
                  <div>
                    <h2 class="text-xl font-semibold text-gray-900">
                      {experience.name}
                    </h2>
                    <p class="text-gray-600">{experience.position}</p>
                  </div>
                </div>
                <div class="text-sm text-gray-500 mb-2">
                  {experience.location} •
                  {formatDate(experience.startDate)} - {
                    experience.endDate
                      ? formatDate(experience.endDate)
                      : "Present"
                  }
                </div>
                <p class="text-gray-600 text-sm mb-4">
                  {experience.description}
                </p>
                <div class="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span class="font-medium">Highlights:</span> {
                      experience.highlights?.length || 0
                    }
                  </div>
                  <div>
                    <span class="font-medium">Technologies:</span> {
                      experience.technologies?.length || 0
                    }
                  </div>
                  <div>
                    <span class="font-medium">Projects:</span> {
                      experience.projects?.length || 0
                    }
                  </div>
                </div>
              </div>
              <div class="flex items-center gap-2 ml-4">
                <span
                  class="text-xs px-2 py-1 rounded-full {experience.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}"
                >
                  {experience.isActive ? "Active" : "Inactive"}
                </span>
              </div>
            </div>
            <div
              class="flex items-center justify-end gap-2 mt-4 pt-4 border-t border-gray-100"
            >
              <button
                on:click={() => viewDetails(experience)}
                class="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                View Details
              </button>
              <button
                on:click={() => openEditForm(experience)}
                class="text-gray-600 hover:text-gray-800 text-sm font-medium"
              >
                Edit
              </button>
              <button
                on:click={() => deleteExperience(experience)}
                class="text-red-600 hover:text-red-800 text-sm font-medium"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      {/each}

      {#if workExperiences.length === 0}
        <div class="text-center py-12">
          <p class="text-gray-500 text-lg">No work experiences found.</p>
          <button
            on:click={openAddForm}
            class="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md transition-colors"
          >
            Add Your First Experience
          </button>
        </div>
      {/if}
    </div>
  {/if}
</div>

{#if showForm}
  <div
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
  >
    <div
      class="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
    >
      <div class="p-6 border-b border-gray-200">
        <h2 class="text-xl font-semibold text-gray-900">
          {
            editingExperience
              ? "Edit Work Experience"
              : "Add New Work Experience"
          }
        </h2>
      </div>

      <form on:submit|preventDefault={saveExperience} class="p-6 space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1"
            >Company Name *</label>
            <input
              type="text"
              bind:value={formData.name}
              required
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1"
            >Location *</label>
            <input
              type="text"
              bind:value={formData.location}
              required
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1"
            >Position *</label>
            <input
              type="text"
              bind:value={formData.position}
              required
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1"
            >Description *</label>
            <input
              type="text"
              bind:value={formData.description}
              required
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div class="grid grid-cols-3 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1"
            >Start Date *</label>
            <input
              type="text"
              bind:value={formData.startDate}
              placeholder="YYYY-MM"
              required
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1"
            >End Date</label>
            <input
              type="text"
              bind:value={formData.endDate}
              placeholder="YYYY-MM (leave empty if current)"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1"
            >Sort Order</label>
            <input
              type="number"
              bind:value={formData.sortOrder}
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1"
            >URL</label>
            <input
              type="url"
              bind:value={formData.url}
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1"
            >Logo Path</label>
            <input
              type="text"
              bind:value={formData.logo}
              placeholder="/src/lib/images/company-logos/..."
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1"
          >Summary *</label>
          <textarea
            bind:value={formData.summary}
            required
            rows="4"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          ></textarea>
        </div>

        <div class="flex items-center">
          <input
            type="checkbox"
            bind:checked={formData.isActive}
            id="isActive"
            class="mr-2"
          />
          <label for="isActive" class="text-sm font-medium text-gray-700"
          >Active</label>
        </div>

        <div class="flex justify-end gap-3 pt-6 border-t border-gray-200">
          <button
            type="button"
            on:click={closeForm}
            class="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            {editingExperience ? "Update" : "Create"}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

