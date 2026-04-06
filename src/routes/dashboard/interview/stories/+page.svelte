<script lang="ts">
  import type { PageData } from "./$types";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faBook,
    faChevronRight,
    faPencil,
    faTrash,
  } from "@fortawesome/free-solid-svg-icons";
  import Card from "../../components/Card.svelte";
  import SectionHeader from "../../profile/components/SectionHeader.svelte";
  import EmptyState from "../../profile/components/EmptyState.svelte";
  import ConfirmModal from "../../profile/components/ConfirmModal.svelte";
  import SectionSaveButton from "$lib/components/SectionSaveButton.svelte";
  import { invalidateAll } from "$app/navigation";

  let { data }: { data: PageData } = $props();

  let stories = $derived(data.stories);
  let expandedId = $state<number | null>(null);
  let editingId = $state<number | null>(null);
  let showAddForm = $state(false);
  let deleteId = $state<number | null>(null);

  const categories = [
    { value: "leadership", label: "Leadership" },
    { value: "problem_solving", label: "Problem Solving" },
    { value: "teamwork", label: "Teamwork" },
    { value: "technical", label: "Technical Challenge" },
    { value: "conflict", label: "Conflict Resolution" },
    { value: "innovation", label: "Innovation" },
    { value: "failure", label: "Learning from Failure" },
    { value: "achievement", label: "Achievement" },
  ];

  // Form states for new entry
  let newTitle = $state("");
  let newCategory = $state("");
  let newSituation = $state("");
  let newTask = $state("");
  let newAction = $state("");
  let newResult = $state("");
  let newReflection = $state("");

  // Form states for editing
  let editTitle = $state("");
  let editCategory = $state("");
  let editSituation = $state("");
  let editTask = $state("");
  let editAction = $state("");
  let editResult = $state("");
  let editReflection = $state("");

  // Save states
  type SaveState = "idle" | "saving" | "saved" | "error";
  let addSaveState = $state<SaveState>("idle");
  let editSaveState = $state<SaveState>("idle");
  let errorMessage = $state("");

  function toggleExpand(id: number) {
    if (editingId === id) return;
    expandedId = expandedId === id ? null : id;
  }

  function startEdit(story: (typeof stories)[0]) {
    editingId = story.id;
    expandedId = story.id;
    editTitle = story.title || "";
    editCategory = story.category || "";
    editSituation = story.situation || "";
    editTask = story.task || "";
    editAction = story.action || "";
    editResult = story.result || "";
    editReflection = story.reflection || "";
    editSaveState = "idle";
  }

  function cancelEdit() {
    editingId = null;
    editSaveState = "idle";
  }

  function resetAddForm() {
    showAddForm = false;
    newTitle = "";
    newCategory = "";
    newSituation = "";
    newTask = "";
    newAction = "";
    newResult = "";
    newReflection = "";
    addSaveState = "idle";
    errorMessage = "";
  }

  async function saveNewStory() {
    if (!newTitle.trim()) {
      errorMessage = "Title is required";
      addSaveState = "error";
      setTimeout(() => (addSaveState = "idle"), 2000);
      return;
    }

    addSaveState = "saving";
    errorMessage = "";

    try {
      const response = await fetch("/api/interview-stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile_id: data.profileId,
          title: newTitle,
          category: newCategory,
          situation: newSituation,
          task: newTask,
          action: newAction,
          result: newResult,
          reflection: newReflection,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        errorMessage = error.message || error.error || "Failed to create story";
        addSaveState = "error";
        setTimeout(() => (addSaveState = "idle"), 2000);
        return;
      }

      addSaveState = "saved";
      await invalidateAll();
      setTimeout(() => {
        resetAddForm();
      }, 500);
    } catch (error) {
      console.error("Save failed:", error);
      errorMessage = "Failed to create story";
      addSaveState = "error";
      setTimeout(() => (addSaveState = "idle"), 2000);
    }
  }

  async function saveEditedStory() {
    if (!editTitle.trim()) {
      errorMessage = "Title is required";
      editSaveState = "error";
      setTimeout(() => (editSaveState = "idle"), 2000);
      return;
    }

    editSaveState = "saving";
    errorMessage = "";

    try {
      const response = await fetch("/api/interview-stories", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile_id: data.profileId,
          id: editingId,
          title: editTitle,
          category: editCategory,
          situation: editSituation,
          task: editTask,
          action: editAction,
          result: editResult,
          reflection: editReflection,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        errorMessage = error.message || error.error || "Failed to update story";
        editSaveState = "error";
        setTimeout(() => (editSaveState = "idle"), 2000);
        return;
      }

      editSaveState = "saved";
      await invalidateAll();
      setTimeout(() => {
        editingId = null;
        editSaveState = "idle";
      }, 500);
    } catch (error) {
      console.error("Save failed:", error);
      errorMessage = "Failed to update story";
      editSaveState = "error";
      setTimeout(() => (editSaveState = "idle"), 2000);
    }
  }

  async function deleteStory() {
    if (deleteId === null) return;

    try {
      const response = await fetch("/api/interview-stories", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile_id: data.profileId,
          id: deleteId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        errorMessage = error.message || error.error || "Failed to delete story";
        return;
      }

      await invalidateAll();
      deleteId = null;
    } catch (error) {
      console.error("Delete failed:", error);
      errorMessage = "Failed to delete story";
    }
  }

  function getCategoryLabel(value: string | null): string {
    if (!value) return "";
    const category = categories.find((c) => c.value === value);
    return category?.label || value;
  }
</script>

<div class="space-y-6">
  <SectionHeader
    title="Project Stories"
    icon={faBook}
    showAddButton={!showAddForm && stories.length > 0}
    addLabel="Add Story"
    onAdd={() => (showAddForm = true)}
  />

  {#if errorMessage && (addSaveState === "error" || editSaveState === "error")}
    <div
      class="bg-[var(--dash-error-light)] border border-[var(--dash-error)] rounded-lg p-4"
    >
      <p class="text-[var(--dash-error)] text-sm">{errorMessage}</p>
    </div>
  {/if}

  <!-- Add Form -->
  {#if showAddForm}
    <div
      class="bg-[var(--dash-card)] rounded-lg border border-[var(--dash-primary)] p-4"
    >
      <h3 class="font-medium text-[var(--dash-text)] mb-4">
        Add New Project Story
      </h3>
      <div class="space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label
              for="new-title"
              class="block text-sm font-semibold text-[var(--dash-text)] mb-1"
            >
              Title <span class="text-[var(--dash-error)]">*</span>
            </label>
            <input
              type="text"
              id="new-title"
              bind:value={newTitle}
              placeholder="e.g., Led migration to microservices"
              class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
            />
          </div>

          <div>
            <label
              for="new-category"
              class="block text-sm font-semibold text-[var(--dash-text)] mb-1"
            >
              Category
            </label>
            <select
              id="new-category"
              bind:value={newCategory}
              class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
            >
              <option value="">Select a category</option>
              {#each categories as category}
                <option value={category.value}>{category.label}</option>
              {/each}
            </select>
          </div>
        </div>

        <p class="text-sm text-[var(--dash-text-secondary)]">
          Use the STAR method to structure your story: Situation, Task, Action, Result.
        </p>

        <div>
          <label
            for="new-situation"
            class="block text-sm font-semibold text-[var(--dash-text)] mb-1"
          >
            Situation
          </label>
          <textarea
            id="new-situation"
            bind:value={newSituation}
            rows={3}
            placeholder="Describe the context and background..."
            class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent resize-y min-h-[120px] sm:min-h-0"
          ></textarea>
        </div>

        <div>
          <label
            for="new-task"
            class="block text-sm font-semibold text-[var(--dash-text)] mb-1"
          >
            Task
          </label>
          <textarea
            id="new-task"
            bind:value={newTask}
            rows={2}
            placeholder="What was your responsibility or goal?"
            class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent resize-y min-h-[100px] sm:min-h-0"
          ></textarea>
        </div>

        <div>
          <label
            for="new-action"
            class="block text-sm font-semibold text-[var(--dash-text)] mb-1"
          >
            Action
          </label>
          <textarea
            id="new-action"
            bind:value={newAction}
            rows={4}
            placeholder="What specific steps did you take?"
            class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent resize-y min-h-[150px] sm:min-h-0"
          ></textarea>
        </div>

        <div>
          <label
            for="new-result"
            class="block text-sm font-semibold text-[var(--dash-text)] mb-1"
          >
            Result
          </label>
          <textarea
            id="new-result"
            bind:value={newResult}
            rows={3}
            placeholder="What was the outcome? Include metrics if possible."
            class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent resize-y min-h-[120px] sm:min-h-0"
          ></textarea>
        </div>

        <p class="text-sm text-[var(--dash-text-secondary)]">
          Optional: Add a reflection on what you learned from this experience.
        </p>

        <div>
          <label
            for="new-reflection"
            class="block text-sm font-semibold text-[var(--dash-text)] mb-1"
          >
            Reflection (optional)
          </label>
          <textarea
            id="new-reflection"
            bind:value={newReflection}
            rows={2}
            placeholder="What did you learn? What would you do differently?"
            class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent resize-y min-h-[100px] sm:min-h-0"
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
        <SectionSaveButton state={addSaveState} onClick={saveNewStory} />
      </div>
    </div>
  {/if}

  <!-- Stories List -->
  {#if stories.length === 0 && !showAddForm}
    <EmptyState
      icon={faBook}
      title="No project stories yet"
      description="Create STAR-format stories to prepare for behavioral interview questions. Each story captures a Situation, Task, Action, and Result."
      actionLabel="Add First Story"
      onAction={() => (showAddForm = true)}
    />
  {:else}
    <div class="space-y-3">
      {#each stories as story (story.id)}
        <Card class="overflow-hidden relative transition-all">
          <!-- Chevron in top right corner -->
          <button
            type="button"
            onclick={(e) => {
              e.stopPropagation();
              toggleExpand(story.id);
            }}
            class="absolute top-3 right-3 p-1.5 text-[var(--dash-text-secondary)] hover:text-[var(--dash-primary)] transition-colors z-10"
            aria-label={expandedId === story.id ? "Collapse" : "Expand"}
          >
            <span class="inline-block transition-transform duration-200 {expandedId === story.id ? 'rotate-90' : ''}">
              <FontAwesomeIcon
                icon={faChevronRight}
                class="w-4 h-4"
              />
            </span>
          </button>

          <!-- Header (clickable to expand/collapse) -->
          <button
            type="button"
            onclick={() => toggleExpand(story.id)}
            class="w-full p-3 sm:p-4 hover:bg-[var(--dash-bg)] transition-colors text-left cursor-pointer"
          >
            <div class="flex items-start gap-3">
              <!-- Desktop: Icon on the left -->
              <div class="hidden md:flex flex-shrink-0">
                <div class="w-12 h-12 rounded-lg bg-[var(--dash-bg)] flex items-center justify-center">
                  <FontAwesomeIcon icon={faBook} class="w-6 h-6 text-blue-600" />
                </div>
              </div>

              <div class="flex-1 min-w-0">
                <!-- Title -->
                <h3 class="font-medium text-[var(--dash-text)] text-sm sm:text-base line-clamp-2 sm:truncate pr-8">
                  {story.title || "Untitled Story"}
                </h3>

                <!-- Category -->
                <div class="flex items-center gap-2 sm:gap-3 mt-1 text-xs sm:text-sm text-[var(--dash-text-secondary)] flex-wrap">
                  {#if story.category}
                    <span class="px-2 py-0.5 rounded-full bg-[var(--dash-bg)] text-gray-600">
                      {getCategoryLabel(story.category)}
                    </span>
                  {/if}
                </div>
              </div>

              <!-- Mobile: Icon on the right, below chevron -->
              <div class="flex-shrink-0 md:hidden flex flex-col items-end">
                <div class="h-6 mb-1"></div> <!-- Spacer for chevron -->
                <div class="w-12 h-12 rounded-lg bg-[var(--dash-bg)] flex items-center justify-center">
                  <FontAwesomeIcon icon={faBook} class="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>
          </button>

          <!-- Expanded Content -->
          {#if expandedId === story.id}
            <div class="border-t border-[var(--dash-border)] p-3 sm:p-4">
              {#if editingId === story.id}
                <!-- Edit Mode -->
                <div class="space-y-4">
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label
                        for="edit-title-{story.id}"
                        class="block text-sm font-semibold text-[var(--dash-text)] mb-1"
                      >
                        Title <span class="text-[var(--dash-error)]">*</span>
                      </label>
                      <input
                        type="text"
                        id="edit-title-{story.id}"
                        bind:value={editTitle}
                        class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label
                        for="edit-category-{story.id}"
                        class="block text-sm font-semibold text-[var(--dash-text)] mb-1"
                      >
                        Category
                      </label>
                      <select
                        id="edit-category-{story.id}"
                        bind:value={editCategory}
                        class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
                      >
                        <option value="">Select a category</option>
                        {#each categories as category}
                          <option value={category.value}>
                            {category.label}
                          </option>
                        {/each}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label
                      for="edit-situation-{story.id}"
                      class="block text-sm font-semibold text-[var(--dash-text)] mb-1"
                    >
                      Situation
                    </label>
                    <textarea
                      id="edit-situation-{story.id}"
                      bind:value={editSituation}
                      rows={3}
                      class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent resize-y min-h-[120px] sm:min-h-0"
                    ></textarea>
                  </div>

                  <div>
                    <label
                      for="edit-task-{story.id}"
                      class="block text-sm font-semibold text-[var(--dash-text)] mb-1"
                    >
                      Task
                    </label>
                    <textarea
                      id="edit-task-{story.id}"
                      bind:value={editTask}
                      rows={2}
                      class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent resize-y min-h-[100px] sm:min-h-0"
                    ></textarea>
                  </div>

                  <div>
                    <label
                      for="edit-action-{story.id}"
                      class="block text-sm font-semibold text-[var(--dash-text)] mb-1"
                    >
                      Action
                    </label>
                    <textarea
                      id="edit-action-{story.id}"
                      bind:value={editAction}
                      rows={4}
                      class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent resize-y min-h-[150px] sm:min-h-0"
                    ></textarea>
                  </div>

                  <div>
                    <label
                      for="edit-result-{story.id}"
                      class="block text-sm font-semibold text-[var(--dash-text)] mb-1"
                    >
                      Result
                    </label>
                    <textarea
                      id="edit-result-{story.id}"
                      bind:value={editResult}
                      rows={3}
                      class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent resize-y min-h-[120px] sm:min-h-0"
                    ></textarea>
                  </div>

                  <div>
                    <label
                      for="edit-reflection-{story.id}"
                      class="block text-sm font-semibold text-[var(--dash-text)] mb-1"
                    >
                      Reflection (optional)
                    </label>
                    <textarea
                      id="edit-reflection-{story.id}"
                      bind:value={editReflection}
                      rows={2}
                      class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent resize-y min-h-[100px] sm:min-h-0"
                    ></textarea>
                  </div>
                </div>

                <div class="flex items-center mt-4">
                  <button
                    type="button"
                    onclick={() => deleteId = story.id}
                    class="px-3 py-2 text-xs bg-red-500/10 border border-red-500/30 rounded-lg text-red-500 hover:bg-red-500/20 hover:border-red-500/50 transition-colors flex items-center gap-1.5"
                  >
                    <FontAwesomeIcon icon={faTrash} class="w-3 h-3" />
                    Delete
                  </button>
                  <div class="flex gap-2 ml-auto">
                    <button
                      type="button"
                      onclick={cancelEdit}
                      class="px-4 py-2 border border-[var(--dash-border)] rounded-lg text-[var(--dash-text)] hover:bg-[var(--dash-bg)] transition-colors"
                    >
                      Cancel
                    </button>
                    <SectionSaveButton state={editSaveState} onClick={saveEditedStory} />
                  </div>
                </div>
              {:else}
                <!-- View Mode -->
                <div class="space-y-3 sm:space-y-4">
                  {#if story.situation}
                    <div>
                      <p class="text-xs text-[var(--dash-text-secondary)] uppercase tracking-wide mb-1">Situation</p>
                      <p class="text-sm text-[var(--dash-text)] whitespace-pre-wrap">{story.situation}</p>
                    </div>
                  {/if}

                  {#if story.task}
                    <div>
                      <p class="text-xs text-[var(--dash-text-secondary)] uppercase tracking-wide mb-1">Task</p>
                      <p class="text-sm text-[var(--dash-text)] whitespace-pre-wrap">{story.task}</p>
                    </div>
                  {/if}

                  {#if story.action}
                    <div>
                      <p class="text-xs text-[var(--dash-text-secondary)] uppercase tracking-wide mb-1">Action</p>
                      <p class="text-sm text-[var(--dash-text)] whitespace-pre-wrap">{story.action}</p>
                    </div>
                  {/if}

                  {#if story.result}
                    <div>
                      <p class="text-xs text-[var(--dash-text-secondary)] uppercase tracking-wide mb-1">Result</p>
                      <p class="text-sm text-[var(--dash-text)] whitespace-pre-wrap">{story.result}</p>
                    </div>
                  {/if}

                  {#if story.reflection}
                    <div>
                      <p class="text-xs text-[var(--dash-text-secondary)] uppercase tracking-wide mb-1">Reflection</p>
                      <p class="text-sm text-[var(--dash-text)] whitespace-pre-wrap">{story.reflection}</p>
                    </div>
                  {/if}
                </div>
              {/if}
            </div>
          {/if}

          <!-- Footer with action buttons (hidden in edit mode) -->
          {#if editingId !== story.id}
            <div class="border-t border-[var(--dash-border)] px-3 py-2 sm:px-4 flex justify-end md:justify-start items-center gap-2">
              <button
                type="button"
                onclick={() => startEdit(story)}
                class="px-3 py-1.5 text-xs bg-blue-500/10 border border-blue-500/30 rounded-lg text-blue-500 hover:bg-blue-500/20 hover:border-blue-500/50 transition-colors flex items-center gap-1.5 whitespace-nowrap"
              >
                <FontAwesomeIcon icon={faPencil} class="w-3 h-3" />
                Edit
              </button>
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
  title="Delete Story"
  message="Are you sure you want to delete this project story? This action cannot be undone."
  onCancel={() => (deleteId = null)}
  onConfirm={deleteStory}
/>
