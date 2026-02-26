<script lang="ts">
  import type { ActionData, PageData } from "./$types";
  import { enhance } from "$app/forms";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faCheck,
    faPencil,
    faPlus,
    faQuoteLeft,
    faTimes,
    faTrash,
  } from "@fortawesome/free-solid-svg-icons";
  import SectionHeader from "../components/SectionHeader.svelte";
  import EmptyState from "../components/EmptyState.svelte";
  import DeleteConfirmModal from "../components/DeleteConfirmModal.svelte";

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let references = $derived(data.references);
  let editingId = $state<number | null>(null);
  let showAddForm = $state(false);
  let deleteId = $state<number | null>(null);

  // Form states
  let newAuthor = $state("");
  let newAuthorPosition = $state("");
  let newText = $state("");

  let editAuthor = $state("");
  let editAuthorPosition = $state("");
  let editText = $state("");

  function startEdit(ref: typeof references[0]) {
    editingId = ref.id;
    editAuthor = ref.author || "";
    editAuthorPosition = ref.author_position || "";
    editText = ref.text || "";
  }

  function cancelEdit() {
    editingId = null;
  }

  function resetAddForm() {
    showAddForm = false;
    newAuthor = "";
    newAuthorPosition = "";
    newText = "";
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
    title="References"
    icon={faQuoteLeft}
    showAddButton={!showAddForm && references.length > 0}
    addLabel="Add Reference"
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
      <h3 class="font-medium text-[var(--dash-text)] mb-4">Add New Reference</h3>
      <div class="space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label
              for="new-author"
              class="block text-sm font-medium text-[var(--dash-text)] mb-1"
            >
              Author Name <span class="text-[var(--dash-error)]">*</span>
            </label>
            <input
              type="text"
              id="new-author"
              name="author"
              bind:value={newAuthor}
              placeholder="e.g., John Smith"
              required
              class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
            />
          </div>

          <div>
            <label
              for="new-position"
              class="block text-sm font-medium text-[var(--dash-text)] mb-1"
            >
              Position
            </label>
            <input
              type="text"
              id="new-position"
              name="author_position"
              bind:value={newAuthorPosition}
              placeholder="e.g., CTO at Company Inc."
              class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
            />
          </div>
        </div>

        <div>
          <label
            for="new-text"
            class="block text-sm font-medium text-[var(--dash-text)] mb-1"
          >
            Reference Text
          </label>
          <textarea
            id="new-text"
            name="text"
            bind:value={newText}
            rows={4}
            placeholder="Write the reference text..."
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
          Add Reference
        </button>
      </div>
    </form>
  {/if}

  <!-- References List -->
  {#if references.length === 0 && !showAddForm}
    <EmptyState
      icon={faQuoteLeft}
      title="No references yet"
      description="Add professional references and recommendations to strengthen your profile."
      actionLabel="Add First Reference"
      onAction={() => (showAddForm = true)}
    />
  {:else}
    <div class="space-y-4">
      {#each references as ref (ref.id)}
        <div class="bg-[var(--dash-card)] rounded-lg border border-[var(--dash-border)] overflow-hidden relative transition-all">
          {#if editingId === ref.id}
            <!-- Edit Mode -->
            <div class="p-3 sm:p-4">
              <form
                method="POST"
                action="?/update"
                use:enhance={handleEditSubmit}
              >
                <input type="hidden" name="id" value={ref.id} />
                <div class="space-y-4">
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label
                        for="edit-author-{ref.id}"
                        class="block text-sm font-medium text-[var(--dash-text)] mb-1"
                      >
                        Author Name <span class="text-[var(--dash-error)]">*</span>
                      </label>
                      <input
                        type="text"
                        id="edit-author-{ref.id}"
                        name="author"
                        bind:value={editAuthor}
                        required
                        class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label
                        for="edit-position-{ref.id}"
                        class="block text-sm font-medium text-[var(--dash-text)] mb-1"
                      >
                        Position
                      </label>
                      <input
                        type="text"
                        id="edit-position-{ref.id}"
                        name="author_position"
                        bind:value={editAuthorPosition}
                        class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      for="edit-text-{ref.id}"
                      class="block text-sm font-medium text-[var(--dash-text)] mb-1"
                    >
                      Reference Text
                    </label>
                    <textarea
                      id="edit-text-{ref.id}"
                      name="text"
                      bind:value={editText}
                      rows={4}
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
            </div>
          {:else}
            <!-- View Mode -->
            <!-- Header -->
            <div class="p-3 sm:p-4 hover:bg-[var(--dash-bg)] transition-colors">
              <div class="flex items-start gap-3">
                <!-- Desktop: Icon on the left -->
                <div class="hidden md:flex flex-shrink-0">
                  <div class="w-12 h-12 rounded-lg bg-[var(--dash-bg)] flex items-center justify-center">
                    <FontAwesomeIcon icon={faQuoteLeft} class="w-6 h-6 text-[var(--dash-primary)]" />
                  </div>
                </div>

                <!-- Content -->
                <div class="flex-1 min-w-0">
                  <!-- Author Name -->
                  <h3 class="font-medium text-[var(--dash-text)] text-sm sm:text-base">
                    {ref.author}
                  </h3>

                  <!-- Position -->
                  {#if ref.author_position}
                    <div class="mt-1 text-xs sm:text-sm text-[var(--dash-text-secondary)]">
                      {ref.author_position}
                    </div>
                  {/if}

                  <!-- Quote -->
                  {#if ref.text}
                    <p class="text-[var(--dash-text)] mt-2 text-sm italic">"{ref.text}"</p>
                  {/if}
                </div>

                <!-- Mobile: Icon on the right -->
                <div class="flex-shrink-0 md:hidden">
                  <div class="w-12 h-12 rounded-lg bg-[var(--dash-bg)] flex items-center justify-center">
                    <FontAwesomeIcon icon={faQuoteLeft} class="w-6 h-6 text-[var(--dash-primary)]" />
                  </div>
                </div>
              </div>
            </div>

            <!-- Footer with action buttons -->
            <div class="border-t border-[var(--dash-border)] px-3 py-2 sm:px-4 flex justify-end md:justify-start items-center gap-2">
              <button
                type="button"
                onclick={() => deleteId = ref.id}
                class="px-3 py-1.5 text-xs bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-lg text-[var(--dash-text)] hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-500 transition-colors flex items-center gap-1.5 whitespace-nowrap"
              >
                <FontAwesomeIcon icon={faTrash} class="w-3 h-3" />
                Delete
              </button>
              <button
                type="button"
                onclick={() => startEdit(ref)}
                class="px-3 py-1.5 text-xs bg-blue-500/10 border border-blue-500/30 rounded-lg text-blue-500 hover:bg-blue-500/20 hover:border-blue-500/50 transition-colors flex items-center gap-1.5 whitespace-nowrap"
              >
                <FontAwesomeIcon icon={faPencil} class="w-3 h-3" />
                Edit
              </button>
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
  title="Delete Reference"
  message="Are you sure you want to delete this reference? This action cannot be undone."
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
