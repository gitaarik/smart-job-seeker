<script lang="ts">
  import type { ActionData, PageData } from "./$types";
  import { enhance } from "$app/forms";
  import { invalidateAll } from "$app/navigation";
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
  import Card from "../../components/Card.svelte";
  import SkillTagsEditor from "../../components/SkillTagsEditor.svelte";
  import type { SkillItem } from "../../components/SkillTagsEditor.svelte";

  interface DbSkillItem extends SkillItem {
    id: number;
  }

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let categories = $derived(data.categories);
  let expandedCategoryId = $state<number | null>(null);
  let editingCategoryId = $state<number | null>(null);
  let showAddCategory = $state(false);
  let deleteCategoryId = $state<number | null>(null);

  // Category form states
  let newCategoryName = $state("");
  let editCategoryName = $state("");

  function toggleCategory(id: number) {
    if (editingCategoryId === id) return;
    expandedCategoryId = expandedCategoryId === id ? null : id;
  }

  function startEditCategory(cat: (typeof categories)[0]) {
    editingCategoryId = cat.id;
    editCategoryName = cat.name || "";
  }

  function cancelEditCategory() {
    editingCategoryId = null;
  }

  function resetAddCategory() {
    showAddCategory = false;
    newCategoryName = "";
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

  function mapSkills(
    dbSkills: (typeof categories)[0]["tech_skills"],
  ): DbSkillItem[] {
    return dbSkills.map((s) => ({
      id: s.id,
      name: s.name || "",
      level: s.level || undefined,
      yearsExperience: s.years_experience || undefined,
    }));
  }

  async function postAction(
    action: string,
    data: Record<string, string>,
  ) {
    const formData = new FormData();
    for (const [key, value] of Object.entries(data)) {
      formData.append(key, value);
    }
    await fetch(`?/${action}`, { method: "POST", body: formData });
    await invalidateAll();
  }

  function handleSkillUpdate(categoryId: number) {
    return (skill: SkillItem) => {
      const dbSkill = skill as DbSkillItem;
      if (!dbSkill.id) return;
      postAction("updateSkill", {
        id: String(dbSkill.id),
        name: skill.name,
        level: skill.level || "",
        years_experience: skill.yearsExperience?.toString() || "",
      });
    };
  }

  function handleSkillCreate(categoryId: number) {
    return (skill: SkillItem) => {
      postAction("createSkill", {
        categoryId: String(categoryId),
        name: skill.name,
        level: skill.level || "",
        years_experience: skill.yearsExperience?.toString() || "",
      });
    };
  }

  function handleSkillRemove(categoryId: number) {
    return (skill: SkillItem) => {
      const dbSkill = skill as DbSkillItem;
      if (!dbSkill.id) return;
      postAction("deleteSkill", { id: String(dbSkill.id) });
    };
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
    <div
      class="bg-[var(--dash-error-light)] border border-[var(--dash-error)] rounded-lg p-4"
    >
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
      <h3 class="font-medium text-[var(--dash-text)] mb-4">
        Add New Category
      </h3>
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
        <Card class="overflow-hidden relative transition-all">
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
                icon={expandedCategoryId === category.id
                  ? faChevronUp
                  : faChevronDown}
                class="w-4 h-4"
              />
            </button>
          {/if}

          <!-- Category Header -->
          <div
            class="p-3 sm:p-4 hover:bg-[var(--dash-bg)] transition-colors"
          >
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
                  <div
                    class="w-12 h-12 rounded-lg bg-[var(--dash-bg)] flex items-center justify-center"
                  >
                    <FontAwesomeIcon
                      icon={faCode}
                      class="w-6 h-6 text-[var(--dash-primary)]"
                    />
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
                    <h3
                      class="font-medium text-[var(--dash-text)] text-sm sm:text-base line-clamp-2 sm:truncate pr-8"
                    >
                      {category.name}
                    </h3>

                    <!-- Skills list -->
                    <div
                      class="mt-1 text-xs sm:text-sm text-[var(--dash-text-secondary)]"
                    >
                      {#if category.tech_skills.length > 0}
                        {
                          category.tech_skills.map((s) => s.name)
                            .join(", ")
                        }
                      {:else}
                        No skills yet
                      {/if}
                    </div>
                  </div>
                </button>

                <!-- Mobile: Icon on the right, below chevron -->
                <div
                  class="flex-shrink-0 md:hidden flex flex-col items-end"
                >
                  <div class="h-6 mb-1"></div>
                  <!-- Spacer for chevron -->
                  <button
                    type="button"
                    onclick={() => toggleCategory(category.id)}
                  >
                    <div
                      class="w-12 h-12 rounded-lg bg-[var(--dash-bg)] flex items-center justify-center"
                    >
                      <FontAwesomeIcon
                        icon={faCode}
                        class="w-6 h-6 text-[var(--dash-primary)]"
                      />
                    </div>
                  </button>
                </div>
              </div>
            {/if}
          </div>

          <!-- Skills (Expanded) -->
          {#if expandedCategoryId === category.id}
            <div class="border-t border-[var(--dash-border)] p-3 sm:p-4">
              <SkillTagsEditor
                skills={mapSkills(category.tech_skills)}
                onupdate={handleSkillUpdate(category.id)}
                oncreate={handleSkillCreate(category.id)}
                onremove={handleSkillRemove(category.id)}
              />
            </div>
          {/if}

          <!-- Footer with action buttons -->
          <div
            class="border-t border-[var(--dash-border)] px-3 py-2 sm:px-4 flex justify-end md:justify-start items-center gap-2"
          >
            <button
              type="button"
              onclick={() => (deleteCategoryId = category.id)}
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
        </Card>
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
