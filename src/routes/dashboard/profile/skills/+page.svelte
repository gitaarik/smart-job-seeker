<script lang="ts">
  import type { ActionData, PageData } from "./$types";
  import { enhance } from "$app/forms";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faCheck,
    faChevronDown,
    faChevronUp,
    faCode,
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
          class="px-4 py-2 border border-[var(--dash-border)] rounded-lg text-[var(--dash-text)] hover:bg-gray-100 transition-colors"
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
        <div class="bg-[var(--dash-card)] rounded-lg border border-[var(--dash-border)] overflow-hidden">
          <!-- Category Header -->
          <div class="flex items-center justify-between p-4">
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
              <button
                type="button"
                onclick={() => toggleCategory(category.id)}
                class="flex-1 flex items-center gap-4 text-left"
              >
                <div
                  class="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0"
                >
                  <FontAwesomeIcon icon={faCode} class="w-5 h-5 text-[var(--dash-primary)]" />
                </div>
                <div>
                  <h3 class="font-medium text-[var(--dash-text)]">{category.name}</h3>
                  <p class="text-sm text-[var(--dash-text-secondary)]">
                    {category.tech_skills.length} skill(s)
                  </p>
                </div>
              </button>

              <div class="flex items-center gap-2">
                <button
                  type="button"
                  onclick={() => startEditCategory(category)}
                  class="p-2 text-[var(--dash-text-secondary)] hover:text-[var(--dash-primary)] transition-colors"
                  aria-label="Edit category"
                >
                  <FontAwesomeIcon icon={faPencil} class="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onclick={() => (deleteCategoryId = category.id)}
                  class="p-2 text-[var(--dash-text-secondary)] hover:text-[var(--dash-error)] transition-colors"
                  aria-label="Delete category"
                >
                  <FontAwesomeIcon icon={faTrash} class="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onclick={() => toggleCategory(category.id)}
                  class="p-2 text-[var(--dash-text-secondary)]"
                  aria-label="Toggle category"
                >
                  <FontAwesomeIcon
                    icon={expandedCategoryId === category.id
                      ? faChevronUp
                      : faChevronDown}
                    class="w-4 h-4"
                  />
                </button>
              </div>
            {/if}
          </div>

          <!-- Skills List (Expanded) -->
          {#if expandedCategoryId === category.id}
            <div class="border-t border-[var(--dash-border)] p-4">
              <!-- Add Skill Button -->
              {#if addingSkillToCategoryId !== category.id}
                <button
                  type="button"
                  onclick={() => (addingSkillToCategoryId = category.id)}
                  class="w-full flex items-center justify-center gap-2 py-2 border border-dashed border-[var(--dash-border)] rounded-lg text-[var(--dash-text-secondary)] hover:text-[var(--dash-primary)] hover:border-[var(--dash-primary)] transition-colors mb-4"
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
                  class="bg-gray-100 rounded-lg p-3 mb-4"
                >
                  <input type="hidden" name="categoryId" value={category.id} />
                  <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <input
                        type="text"
                        name="name"
                        bind:value={newSkillName}
                        placeholder="Skill name *"
                        required
                        class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
                      />
                    </div>
                    <div>
                      <select
                        name="level"
                        bind:value={newSkillLevel}
                        class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
                      >
                        <option value="">Level</option>
                        {#each levelOptions as option}
                          <option value={option.value}>{option.label}</option>
                        {/each}
                      </select>
                    </div>
                    <div>
                      <input
                        type="number"
                        name="years_experience"
                        bind:value={newSkillYears}
                        placeholder="Years"
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
                        class="bg-gray-100 rounded-lg p-3"
                      >
                        <input type="hidden" name="id" value={skill.id} />
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div>
                            <input
                              type="text"
                              name="name"
                              bind:value={editSkillName}
                              required
                              class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
                            />
                          </div>
                          <div>
                            <select
                              name="level"
                              bind:value={editSkillLevel}
                              class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
                            >
                              <option value="">Level</option>
                              {#each levelOptions as option}
                                <option value={option.value}>
                                  {option.label}
                                </option>
                              {/each}
                            </select>
                          </div>
                          <div>
                            <input
                              type="number"
                              name="years_experience"
                              bind:value={editSkillYears}
                              placeholder="Years"
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
                        class="flex items-center justify-between py-2 px-3 bg-gray-100 rounded-lg"
                      >
                        <div>
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
                        </div>
                        <div class="flex items-center gap-1">
                          <button
                            type="button"
                            onclick={() => startEditSkill(skill)}
                            class="p-2 text-[var(--dash-text-secondary)] hover:text-[var(--dash-primary)] transition-colors"
                            aria-label="Edit skill"
                          >
                            <FontAwesomeIcon icon={faPencil} class="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onclick={() => (deleteSkillId = skill.id)}
                            class="p-2 text-[var(--dash-text-secondary)] hover:text-[var(--dash-error)] transition-colors"
                            aria-label="Delete skill"
                          >
                            <FontAwesomeIcon icon={faTrash} class="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    {/if}
                  {/each}
                </div>
              {/if}
            </div>
          {/if}
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
