<script lang="ts">
  import type { ActionData, PageData } from "./$types";
  import { enhance } from "$app/forms";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faCheck,
    faLightbulb,
    faPencil,
    faPlus,
    faStar,
    faTimes,
    faTrash,
  } from "@fortawesome/free-solid-svg-icons";
  import SectionHeader from "../components/SectionHeader.svelte";
  import EmptyState from "../components/EmptyState.svelte";
  import DeleteConfirmModal from "../components/DeleteConfirmModal.svelte";

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let highlights = $derived(data.highlights);
  let editingId = $state<number | null>(null);
  let showAddForm = $state(false);
  let deleteId = $state<number | null>(null);

  // Form states
  let newText = $state("");
  let newIconName = $state("");

  let editText = $state("");
  let editIconName = $state("");

  function startEdit(highlight: typeof highlights[0]) {
    editingId = highlight.id;
    editText = highlight.text || "";
    editIconName = highlight.icon_name || "";
  }

  function cancelEdit() {
    editingId = null;
  }

  function resetAddForm() {
    showAddForm = false;
    newText = "";
    newIconName = "";
  }

  function handleAddSubmit() {
    return async (
      { result, update }: {
        result: { type: string };
        update: () => Promise<void>;
      },
    ) => {
      await update();
      if (result.type === "success") {
        resetAddForm();
      }
    };
  }

  function handleEditSubmit() {
    return async (
      { result, update }: {
        result: { type: string };
        update: () => Promise<void>;
      },
    ) => {
      await update();
      if (result.type === "success") {
        editingId = null;
      }
    };
  }

  function handleDeleteSubmit() {
    return async (
      { result, update }: {
        result: { type: string };
        update: () => Promise<void>;
      },
    ) => {
      await update();
      if (result.type === "success") {
        deleteId = null;
      }
    };
  }
</script>

<div class="space-y-6">
  <SectionHeader
    title="Highlights"
    icon={faLightbulb}
    showAddButton={!showAddForm && highlights.length > 0}
    addLabel="Add Highlight"
    onAdd={() => (showAddForm = true)}
  />

  {#if form?.error}
    <div class="bg-[var(--dash-error-light)] border border-[var(--dash-error)] rounded-lg p-4">
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
      <h3 class="font-medium text-[var(--dash-text)] mb-4">Add New Highlight</h3>
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div class="md:col-span-3">
          <label
            for="new-text"
            class="block text-sm font-medium text-[var(--dash-text)] mb-1"
          >
            Highlight Text <span class="text-[var(--dash-error)]">*</span>
          </label>
          <input
            type="text"
            id="new-text"
            name="text"
            bind:value={newText}
            placeholder="e.g., 10+ years of experience in software development"
            required
            class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
          />
        </div>

        <div>
          <label
            for="new-icon"
            class="block text-sm font-medium text-[var(--dash-text)] mb-1"
          >
            Icon Name
          </label>
          <input
            type="text"
            id="new-icon"
            name="icon_name"
            bind:value={newIconName}
            placeholder="e.g., star"
            class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
          />
        </div>
      </div>

      <div class="flex justify-end gap-2 mt-4">
        <button
          type="button"
          onclick={resetAddForm}
          class="px-4 py-2 border border-[var(--dash-border)] rounded-lg text-[var(--dash-text)] hover:bg-gray-100 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          class="px-4 py-2 bg-[var(--dash-primary)] text-white rounded-lg hover:bg-[var(--dash-primary-hover)] transition-colors"
        >
          Add Highlight
        </button>
      </div>
    </form>
  {/if}

  <!-- Highlights List -->
  {#if highlights.length === 0 && !showAddForm}
    <EmptyState
      icon={faLightbulb}
      title="No highlights yet"
      description="Add key achievements and career highlights to showcase your accomplishments."
      actionLabel="Add First Highlight"
      onAction={() => (showAddForm = true)}
    />
  {:else}
    <div class="space-y-3">
      {#each highlights as highlight (highlight.id)}
        <div class="bg-[var(--dash-card)] rounded-lg border border-[var(--dash-border)] p-4">
          {#if editingId === highlight.id}
            <!-- Edit Mode -->
            <form
              method="POST"
              action="?/update"
              use:enhance={handleEditSubmit}
            >
              <input type="hidden" name="id" value={highlight.id} />
              <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div class="md:col-span-3">
                  <label
                    for="edit-text-{highlight.id}"
                    class="block text-sm font-medium text-[var(--dash-text)] mb-1"
                  >
                    Highlight Text <span class="text-[var(--dash-error)]">*</span>
                  </label>
                  <input
                    type="text"
                    id="edit-text-{highlight.id}"
                    name="text"
                    bind:value={editText}
                    required
                    class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
                  />
                </div>

                <div>
                  <label
                    for="edit-icon-{highlight.id}"
                    class="block text-sm font-medium text-[var(--dash-text)] mb-1"
                  >
                    Icon Name
                  </label>
                  <input
                    type="text"
                    id="edit-icon-{highlight.id}"
                    name="icon_name"
                    bind:value={editIconName}
                    class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
                  />
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
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-4">
                <div
                  class="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center"
                >
                  <FontAwesomeIcon icon={faStar} class="w-5 h-5 text-[var(--dash-primary)]" />
                </div>
                <div>
                  <p class="text-[var(--dash-text)]">{highlight.text}</p>
                  {#if highlight.icon_name}
                    <p class="text-sm text-[var(--dash-text-secondary)]">
                      Icon: {highlight.icon_name}
                    </p>
                  {/if}
                </div>
              </div>

              <div class="flex items-center gap-2">
                <button
                  type="button"
                  onclick={() => startEdit(highlight)}
                  class="p-2 text-[var(--dash-text-secondary)] hover:text-[var(--dash-primary)] transition-colors"
                  aria-label="Edit"
                >
                  <FontAwesomeIcon icon={faPencil} class="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onclick={() => (deleteId = highlight.id)}
                  class="p-2 text-[var(--dash-text-secondary)] hover:text-[var(--dash-error)] transition-colors"
                  aria-label="Delete"
                >
                  <FontAwesomeIcon icon={faTrash} class="w-4 h-4" />
                </button>
              </div>
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
  title="Delete Highlight"
  message="Are you sure you want to delete this highlight? This action cannot be undone."
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
