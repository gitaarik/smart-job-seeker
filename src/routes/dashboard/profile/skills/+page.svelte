<script lang="ts">
  import type { ActionData, PageData } from "./$types";
  import { enhance } from "$app/forms";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faCheck,
    faChevronDown,
    faChevronUp,
    faCode,
    faGripVertical,
    faPencil,
    faPlus,
    faTimes,
    faTrash,
  } from "@fortawesome/free-solid-svg-icons";
  import SectionHeader from "../components/SectionHeader.svelte";
  import EmptyState from "../components/EmptyState.svelte";
  import DeleteConfirmModal from "../components/DeleteConfirmModal.svelte";

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let categories = $derived(data.categories);
  let expandedCategoryId = $state<number | null>(null);
  let editingCategoryId = $state<number | null>(null);
  let editingSkillId = $state<number | null>(null);
  let showAddCategory = $state(false);
  let addingSkillToCategoryId = $state<number | null>(null);
  let deleteCategoryId = $state<number | null>(null);
  let deleteSkillId = $state<number | null>(null);

  // Category form states
  let newCategoryName = $state("");
  let editCategoryName = $state("");

  // Skill form states
  let newSkillName = $state("");
  let newSkillLevel = $state("");
  let newSkillYears = $state("");

  let editSkillName = $state("");
  let editSkillLevel = $state("");
  let editSkillYears = $state("");

  const levelOptions = [
    { value: "expert", label: "Expert" },
    { value: "proficient", label: "Proficient" },
    { value: "intermediate", label: "Intermediate" },
    { value: "beginner", label: "Beginner" },
  ];

  function toggleCategory(id: number) {
    if (editingCategoryId === id) return;
    expandedCategoryId = expandedCategoryId === id ? null : id;
  }

  function startEditCategory(cat: typeof categories[0]) {
    editingCategoryId = cat.id;
    editCategoryName = cat.name || "";
  }

  function cancelEditCategory() {
    editingCategoryId = null;
  }

  function startEditSkill(skill: typeof categories[0]["tech_skills"][0]) {
    editingSkillId = skill.id;
    editSkillName = skill.name || "";
    editSkillLevel = skill.level || "";
    editSkillYears = skill.years_experience?.toString() || "";
  }

  function cancelEditSkill() {
    editingSkillId = null;
  }

  function resetAddCategory() {
    showAddCategory = false;
    newCategoryName = "";
  }

  function resetAddSkill() {
    addingSkillToCategoryId = null;
    newSkillName = "";
    newSkillLevel = "";
    newSkillYears = "";
  }

  function handleAddCategorySubmit() {
    return async (
      { result, update }: {
        result: { type: string };
        update: () => Promise<void>;
      },
    ) => {
      await update();
      if (result.type === "success") {
        resetAddCategory();
      }
    };
  }

  function handleEditCategorySubmit() {
    return async (
      { result, update }: {
        result: { type: string };
        update: () => Promise<void>;
      },
    ) => {
      await update();
      if (result.type === "success") {
        editingCategoryId = null;
      }
    };
  }

  function handleAddSkillSubmit() {
    return async (
      { result, update }: {
        result: { type: string };
        update: () => Promise<void>;
      },
    ) => {
      await update();
      if (result.type === "success") {
        resetAddSkill();
      }
    };
  }

  function handleEditSkillSubmit() {
    return async (
      { result, update }: {
        result: { type: string };
        update: () => Promise<void>;
      },
    ) => {
      await update();
      if (result.type === "success") {
        editingSkillId = null;
      }
    };
  }

  function getLevelLabel(value: string | null) {
    return levelOptions.find((o) => o.value === value)?.label || value ||
      "—";
  }

  // Drag and drop state
  let draggedSkillId = $state<number | null>(null);
  let dragOverSkillId = $state<number | null>(null);

  function handleDragStart(e: DragEvent, skillId: number) {
    draggedSkillId = skillId;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(skillId));
    }
  }

  function handleDragOver(e: DragEvent, skillId: number) {
    e.preventDefault();
    if (draggedSkillId !== skillId) {
      dragOverSkillId = skillId;
    }
  }

  function handleDragLeave() {
    dragOverSkillId = null;
  }

  function handleDrop(e: DragEvent, categoryId: number, skills: typeof categories[0]["tech_skills"]) {
    e.preventDefault();
    if (draggedSkillId === null || dragOverSkillId === null) return;

    const fromIndex = skills.findIndex(s => s.id === draggedSkillId);
    const toIndex = skills.findIndex(s => s.id === dragOverSkillId);

    if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) {
      draggedSkillId = null;
      dragOverSkillId = null;
      return;
    }

    // Reorder the skills array
    const reorderedSkills = [...skills];
    const [movedSkill] = reorderedSkills.splice(fromIndex, 1);
    reorderedSkills.splice(toIndex, 0, movedSkill);

    // Save the new order
    const skillIds = reorderedSkills.map(s => s.id);
    saveSkillOrder(categoryId, skillIds);

    draggedSkillId = null;
    dragOverSkillId = null;
  }

  function handleDragEnd() {
    draggedSkillId = null;
    dragOverSkillId = null;
  }

  async function saveSkillOrder(categoryId: number, skillIds: number[]) {
    const formData = new FormData();
    formData.append("categoryId", String(categoryId));
    formData.append("skillIds", JSON.stringify(skillIds));

    await fetch("?/reorderSkills", {
      method: "POST",
      body: formData,
    });

    // Refresh the page data
    window.location.reload();
  }
</script>

<div class="space-y-6">
  <SectionHeader
    title="Skills"
    icon={faCode}
    showAddButton={!showAddCategory && categories.length > 0}
    addLabel="Add Category"
    onAdd={() => (showAddCategory = true)}
  />

  {#if form?.error}
    <div class="bg-[var(--dash-error-light)] border border-[var(--dash-error)] rounded-lg p-4">
      <p class="text-[var(--dash-error)] text-sm">{form.error}</p>
    </div>
  {/if}

  <!-- Add Category Form -->
  {#if showAddCategory}
    <form
      method="POST"
      action="?/createCategory"
      use:enhance={handleAddCategorySubmit}
      class="bg-[var(--dash-card)] rounded-lg border border-[var(--dash-primary)] p-4"
    >
      <h3 class="font-medium text-[var(--dash-text)] mb-4">Add New Category</h3>
      <div class="flex gap-4">
        <div class="flex-1">
          <label
            for="new-category-name"
            class="block text-sm font-medium text-[var(--dash-text)] mb-1"
          >
            Category Name <span class="text-[var(--dash-error)]">*</span>
          </label>
          <input
            type="text"
            id="new-category-name"
            name="name"
            bind:value={newCategoryName}
            placeholder="e.g., Frontend, Backend, DevOps"
            required
            class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
          />
        </div>
      </div>

      <div class="flex justify-end gap-2 mt-4">
        <button
          type="button"
          onclick={resetAddCategory}
          class="px-4 py-2 border border-[var(--dash-border)] rounded-lg text-[var(--dash-text)] hover:bg-[var(--dash-bg)] transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          class="px-4 py-2 bg-[var(--dash-primary)] text-white rounded-lg hover:bg-[var(--dash-primary-hover)] transition-colors"
        >
          Add Category
        </button>
      </div>
    </form>
  {/if}

  <!-- Categories List -->
  {#if categories.length === 0 && !showAddCategory}
    <EmptyState
      icon={faCode}
      title="No skill categories yet"
      description="Organize your technical skills by creating categories like Frontend, Backend, or DevOps."
      actionLabel="Add First Category"
      onAction={() => (showAddCategory = true)}
    />
  {:else}
    <div class="space-y-4">
      {#each categories as category (category.id)}
        <div class="bg-[var(--dash-card)] rounded-lg border border-[var(--dash-border)] overflow-hidden relative transition-all">
          <!-- Chevron in top right corner -->
          {#if editingCategoryId !== category.id}
            <button
              type="button"
              onclick={(e) => {
                e.stopPropagation();
                toggleCategory(category.id);
              }}
              class="absolute top-3 right-3 p-1.5 text-[var(--dash-text-secondary)] hover:text-[var(--dash-primary)] transition-colors z-10"
              aria-label={expandedCategoryId === category.id ? "Collapse" : "Expand"}
            >
              <FontAwesomeIcon
                icon={expandedCategoryId === category.id ? faChevronUp : faChevronDown}
                class="w-4 h-4"
              />
            </button>
          {/if}

          <!-- Category Header -->
          <div class="p-3 sm:p-4 hover:bg-[var(--dash-bg)] transition-colors">
            {#if editingCategoryId === category.id}
              <!-- Edit Category -->
              <form
                method="POST"
                action="?/updateCategory"
                use:enhance={handleEditCategorySubmit}
                class="flex-1 flex items-center gap-2"
              >
                <input type="hidden" name="id" value={category.id} />
                <input
                  type="text"
                  name="name"
                  bind:value={editCategoryName}
                  required
                  class="flex-1 px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
                />
                <button
                  type="button"
                  onclick={cancelEditCategory}
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
              </form>
            {:else}
              <div class="flex items-start gap-3">
                <!-- Desktop: Icon on the left -->
                <div class="hidden md:flex flex-shrink-0">
                  <div class="w-12 h-12 rounded-lg bg-[var(--dash-bg)] flex items-center justify-center">
                    <FontAwesomeIcon icon={faCode} class="w-6 h-6 text-[var(--dash-primary)]" />
                  </div>
                </div>

                <!-- Clickable area for expand/collapse -->
                <button
                  type="button"
                  onclick={() => toggleCategory(category.id)}
                  class="flex items-start gap-3 flex-1 min-w-0 text-left"
                >
                  <div class="flex-1 min-w-0">
                    <!-- Category Name -->
                    <h3 class="font-medium text-[var(--dash-text)] text-sm sm:text-base line-clamp-2 sm:truncate pr-8">
                      {category.name}
                    </h3>

                    <!-- Skills list -->
                    <div class="mt-1 text-xs sm:text-sm text-[var(--dash-text-secondary)]">
                      {#if category.tech_skills.length > 0}
                        {category.tech_skills.map(s => s.name).join(", ")}
                      {:else}
                        No skills yet
                      {/if}
                    </div>
                  </div>
                </button>

                <!-- Mobile: Icon on the right, below chevron -->
                <div class="flex-shrink-0 md:hidden flex flex-col items-end">
                  <div class="h-6 mb-1"></div> <!-- Spacer for chevron -->
                  <button
                    type="button"
                    onclick={() => toggleCategory(category.id)}
                  >
                    <div class="w-12 h-12 rounded-lg bg-[var(--dash-bg)] flex items-center justify-center">
                      <FontAwesomeIcon icon={faCode} class="w-6 h-6 text-[var(--dash-primary)]" />
                    </div>
                  </button>
                </div>
              </div>
            {/if}
          </div>

          <!-- Skills List (Expanded) -->
          {#if expandedCategoryId === category.id}
            <div class="border-t border-[var(--dash-border)] p-3 sm:p-4">
              <!-- Skills -->
              {#if category.tech_skills.length === 0}
                <p class="text-[var(--dash-text-secondary)] text-sm text-center py-4">
                  No skills in this category yet.
                </p>
              {:else}
                <div class="space-y-2">
                  {#each category.tech_skills as skill (skill.id)}
                    {#if editingSkillId === skill.id}
                      <!-- Edit Skill Form -->
                      <form
                        method="POST"
                        action="?/updateSkill"
                        use:enhance={handleEditSkillSubmit}
                        class="bg-[var(--dash-bg)] rounded-lg p-3"
                      >
                        <input type="hidden" name="id" value={skill.id} />
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div>
                            <label class="block text-xs text-[var(--dash-text-secondary)] mb-1">Skill</label>
                            <input
                              type="text"
                              name="name"
                              bind:value={editSkillName}
                              required
                              class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
                            />
                          </div>
                          <div>
                            <label class="block text-xs text-[var(--dash-text-secondary)] mb-1">Level</label>
                            <select
                              name="level"
                              bind:value={editSkillLevel}
                              class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
                            >
                              <option value="">—</option>
                              {#each levelOptions as option}
                                <option value={option.value}>
                                  {option.label}
                                </option>
                              {/each}
                            </select>
                          </div>
                          <div>
                            <label class="block text-xs text-[var(--dash-text-secondary)] mb-1">Years experience</label>
                            <input
                              type="number"
                              name="years_experience"
                              bind:value={editSkillYears}
                              min="0"
                              max="50"
                              class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
                            />
                          </div>
                        </div>
                        <div class="flex justify-end gap-2 mt-3">
                          <button
                            type="button"
                            onclick={cancelEditSkill}
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
                      <!-- Skill View -->
                      <div
                        draggable="true"
                        ondragstart={(e) => handleDragStart(e, skill.id)}
                        ondragover={(e) => handleDragOver(e, skill.id)}
                        ondragleave={handleDragLeave}
                        ondrop={(e) => handleDrop(e, category.id, category.tech_skills)}
                        ondragend={handleDragEnd}
                        class="flex items-center justify-between py-2 px-3 bg-[var(--dash-bg)] rounded-lg transition-all {draggedSkillId === skill.id ? 'opacity-50' : ''} {dragOverSkillId === skill.id ? 'ring-2 ring-[var(--dash-primary)]' : ''}"
                      >
                        <div class="flex items-center gap-2 flex-1">
                          <div class="cursor-grab active:cursor-grabbing text-[var(--dash-text-muted)] hover:text-[var(--dash-text-secondary)]">
                            <FontAwesomeIcon icon={faGripVertical} class="w-3 h-3" />
                          </div>
                          <button
                            type="button"
                            onclick={() => startEditSkill(skill)}
                            class="flex-1 text-left hover:opacity-75 transition-opacity"
                          >
                            <span class="font-medium text-[var(--dash-text)]">{
                              skill.name
                            }</span>
                            {#if skill.level}
                              <span class="text-[var(--dash-text-secondary)] text-sm ml-2"
                              >({getLevelLabel(skill.level)})</span>
                            {/if}
                            {#if skill.years_experience}
                              <span class="text-[var(--dash-text-secondary)] text-sm ml-2">{
                                  skill.years_experience
                                } yrs</span>
                            {/if}
                          </button>
                        </div>
                        <button
                          type="button"
                          onclick={() => (deleteSkillId = skill.id)}
                          class="p-2 text-[var(--dash-text-secondary)] hover:text-[var(--dash-error)] transition-colors"
                          aria-label="Delete skill"
                        >
                          <FontAwesomeIcon icon={faTrash} class="w-3 h-3" />
                        </button>
                      </div>
                    {/if}
                  {/each}
                </div>
              {/if}

              <!-- Add Skill Button -->
              {#if addingSkillToCategoryId !== category.id}
                <button
                  type="button"
                  onclick={() => (addingSkillToCategoryId = category.id)}
                  class="w-full flex items-center justify-center gap-2 py-2 border border-dashed border-[var(--dash-border)] rounded-lg text-[var(--dash-text-secondary)] hover:text-[var(--dash-primary)] hover:border-[var(--dash-primary)] transition-colors mt-4"
                >
                  <FontAwesomeIcon icon={faPlus} class="w-4 h-4" />
                  Add Skill
                </button>
              {:else}
                <!-- Add Skill Form -->
                <form
                  method="POST"
                  action="?/createSkill"
                  use:enhance={handleAddSkillSubmit}
                  class="bg-[var(--dash-bg)] rounded-lg p-3 mt-4"
                >
                  <input type="hidden" name="categoryId" value={category.id} />
                  <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label class="block text-xs text-[var(--dash-text-secondary)] mb-1">Skill <span class="text-[var(--dash-error)]">*</span></label>
                      <input
                        type="text"
                        name="name"
                        bind:value={newSkillName}
                        required
                        class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label class="block text-xs text-[var(--dash-text-secondary)] mb-1">Level</label>
                      <select
                        name="level"
                        bind:value={newSkillLevel}
                        class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
                      >
                        <option value="">—</option>
                        {#each levelOptions as option}
                          <option value={option.value}>{option.label}</option>
                        {/each}
                      </select>
                    </div>
                    <div>
                      <label class="block text-xs text-[var(--dash-text-secondary)] mb-1">Years experience</label>
                      <input
                        type="number"
                        name="years_experience"
                        bind:value={newSkillYears}
                        min="0"
                        max="50"
                        class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
                      />
                    </div>
                  </div>
                  <div class="flex justify-end gap-2 mt-3">
                    <button
                      type="button"
                      onclick={resetAddSkill}
                      class="px-3 py-1 text-sm text-[var(--dash-text)] hover:text-[var(--dash-error)] transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      class="px-3 py-1 text-sm bg-[var(--dash-primary)] text-white rounded-lg hover:bg-[var(--dash-primary-hover)] transition-colors"
                    >
                      Add
                    </button>
                  </div>
                </form>
              {/if}
            </div>
          {/if}

          <!-- Footer with action buttons -->
          <div class="border-t border-[var(--dash-border)] px-3 py-2 sm:px-4 flex justify-end md:justify-start items-center gap-2">
            <button
              type="button"
              onclick={() => deleteCategoryId = category.id}
              class="px-3 py-1.5 text-xs bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-lg text-[var(--dash-text)] hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-500 transition-colors flex items-center gap-1.5 whitespace-nowrap"
            >
              <FontAwesomeIcon icon={faTrash} class="w-3 h-3" />
              Delete
            </button>
            <button
              type="button"
              onclick={() => startEditCategory(category)}
              class="px-3 py-1.5 text-xs bg-blue-500/10 border border-blue-500/30 rounded-lg text-blue-500 hover:bg-blue-500/20 hover:border-blue-500/50 transition-colors flex items-center gap-1.5 whitespace-nowrap"
            >
              <FontAwesomeIcon icon={faPencil} class="w-3 h-3" />
              Edit
            </button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<!-- Delete Category Confirmation Modal -->
<DeleteConfirmModal
  isOpen={deleteCategoryId !== null}
  title="Delete Category"
  message="Are you sure you want to delete this category? All skills within it will also be deleted. This action cannot be undone."
  onCancel={() => (deleteCategoryId = null)}
  onConfirm={() => {
    if (deleteCategoryId !== null) {
      const form = document.createElement("form");
      form.method = "POST";
      form.action = "?/deleteCategory";
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = "id";
      input.value = String(deleteCategoryId);
      form.appendChild(input);
      document.body.appendChild(form);
      form.submit();
    }
  }}
/>

<!-- Delete Skill Confirmation Modal -->
<DeleteConfirmModal
  isOpen={deleteSkillId !== null}
  title="Delete Skill"
  message="Are you sure you want to delete this skill? This action cannot be undone."
  onCancel={() => (deleteSkillId = null)}
  onConfirm={() => {
    if (deleteSkillId !== null) {
      const form = document.createElement("form");
      form.method = "POST";
      form.action = "?/deleteSkill";
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = "id";
      input.value = String(deleteSkillId);
      form.appendChild(input);
      document.body.appendChild(form);
      form.submit();
    }
  }}
/>
