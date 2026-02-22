<script lang="ts">
  import type { ActionData, PageData } from "./$types";
  import { enhance } from "$app/forms";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faBook,
    faCheck,
    faChevronDown,
    faChevronUp,
    faPencil,
    faTimes,
    faTrash,
  } from "@fortawesome/free-solid-svg-icons";
  import SectionHeader from "../../profile/components/SectionHeader.svelte";
  import EmptyState from "../../profile/components/EmptyState.svelte";
  import DeleteConfirmModal from "../../profile/components/DeleteConfirmModal.svelte";

  let { data, form }: { data: PageData; form: ActionData } = $props();

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
  }

  function cancelEdit() {
    editingId = null;
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
              name="title"
              bind:value={newTitle}
              placeholder="e.g., Led migration to microservices"
              required
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
              name="category"
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
            name="situation"
            bind:value={newSituation}
            rows={3}
            placeholder="Describe the context and background..."
            class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent resize-y"
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
            name="task"
            bind:value={newTask}
            rows={2}
            placeholder="What was your responsibility or goal?"
            class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent resize-y"
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
            name="action"
            bind:value={newAction}
            rows={4}
            placeholder="What specific steps did you take?"
            class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent resize-y"
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
            name="result"
            bind:value={newResult}
            rows={3}
            placeholder="What was the outcome? Include metrics if possible."
            class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent resize-y"
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
            name="reflection"
            bind:value={newReflection}
            rows={2}
            placeholder="What did you learn? What would you do differently?"
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
          Add Story
        </button>
      </div>
    </form>
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
        <div
          class="bg-[var(--dash-card)] rounded-lg border border-[var(--dash-border)] overflow-hidden"
        >
          <!-- Header -->
          <button
            type="button"
            onclick={() => toggleExpand(story.id)}
            class="w-full flex items-center justify-between p-4 hover:bg-[var(--dash-bg)] transition-colors text-left"
          >
            <div class="flex items-center gap-4 flex-1 min-w-0">
              <div
                class="w-10 h-10 rounded-full bg-[var(--dash-bg)] flex items-center justify-center flex-shrink-0"
              >
                <FontAwesomeIcon icon={faBook} class="w-5 h-5 text-blue-600" />
              </div>

              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <h3 class="font-medium text-[var(--dash-text)] truncate">
                    {story.title || "Untitled Story"}
                  </h3>
                  {#if story.category}
                    <span
                      class="text-xs px-2 py-0.5 rounded-full bg-[var(--dash-bg)] text-gray-600"
                    >
                      {getCategoryLabel(story.category)}
                    </span>
                  {/if}
                </div>
                <p class="text-sm text-[var(--dash-text-secondary)] truncate">
                  {
                    story.situation?.substring(0, 100) ||
                      "No situation described"
                  }
                  {#if                 story.situation &&
                  story.situation.length > 100}...{/if}
                </p>
              </div>
            </div>

            <FontAwesomeIcon
              icon={expandedId === story.id ? faChevronUp : faChevronDown}
              class="w-4 h-4 text-[var(--dash-text-secondary)]"
            />
          </button>

          <!-- Expanded Content -->
          {#if expandedId === story.id}
            <div class="border-t border-[var(--dash-border)] p-4">
              {#if editingId === story.id}
                <!-- Edit Mode -->
                <form
                  method="POST"
                  action="?/update"
                  use:enhance={handleEditSubmit}
                >
                  <input type="hidden" name="id" value={story.id} />
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
                          name="title"
                          bind:value={editTitle}
                          required
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
                          name="category"
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
                        name="situation"
                        bind:value={editSituation}
                        rows={3}
                        class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent resize-y"
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
                        name="task"
                        bind:value={editTask}
                        rows={2}
                        class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent resize-y"
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
                        name="action"
                        bind:value={editAction}
                        rows={4}
                        class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent resize-y"
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
                        name="result"
                        bind:value={editResult}
                        rows={3}
                        class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent resize-y"
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
                        name="reflection"
                        bind:value={editReflection}
                        rows={2}
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
                  {#if story.situation}
                    <div>
                      <p class="text-sm font-semibold text-[var(--dash-text)] mb-1">
                        Situation
                      </p>
                      <p class="text-[var(--dash-text)] whitespace-pre-wrap">
                        {story.situation}
                      </p>
                    </div>
                  {/if}

                  {#if story.task}
                    <div>
                      <p class="text-sm font-semibold text-[var(--dash-text)] mb-1">
                        Task
                      </p>
                      <p class="text-[var(--dash-text)] whitespace-pre-wrap">
                        {story.task}
                      </p>
                    </div>
                  {/if}

                  {#if story.action}
                    <div>
                      <p class="text-sm font-semibold text-[var(--dash-text)] mb-1">
                        Action
                      </p>
                      <p class="text-[var(--dash-text)] whitespace-pre-wrap">
                        {story.action}
                      </p>
                    </div>
                  {/if}

                  {#if story.result}
                    <div>
                      <p class="text-sm font-semibold text-[var(--dash-text)] mb-1">
                        Result
                      </p>
                      <p class="text-[var(--dash-text)] whitespace-pre-wrap">
                        {story.result}
                      </p>
                    </div>
                  {/if}

                  {#if story.reflection}
                    <div>
                      <p
                        class="text-sm font-medium text-[var(--dash-text-secondary)] mb-1"
                      >
                        Reflection
                      </p>
                      <p class="text-[var(--dash-text)] whitespace-pre-wrap">
                        {story.reflection}
                      </p>
                    </div>
                  {/if}

                  <div
                    class="flex items-center justify-end gap-2 pt-2 border-t border-[var(--dash-border)]"
                  >
                    <button
                      type="button"
                      onclick={() => startEdit(story)}
                      class="p-2 text-[var(--dash-text-secondary)] hover:text-[var(--dash-primary)] transition-colors"
                      aria-label="Edit"
                    >
                      <FontAwesomeIcon icon={faPencil} class="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onclick={() => (deleteId = story.id)}
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
</div>

<!-- Delete Confirmation Modal -->
<DeleteConfirmModal
  isOpen={deleteId !== null}
  title="Delete Story"
  message="Are you sure you want to delete this project story? This action cannot be undone."
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
