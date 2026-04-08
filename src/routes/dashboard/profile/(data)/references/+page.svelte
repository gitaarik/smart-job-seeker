<script lang="ts">
  import type { ActionData, PageData } from "./$types";
  import { enhance } from "$app/forms";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faCheck,
    faPlus,
    faQuoteLeft,
    faTimes,
    faTrash,
  } from "@fortawesome/free-solid-svg-icons";
  import EmptyState from "../../components/EmptyState.svelte";
  import ConfirmModal from "../../components/ConfirmModal.svelte";
  import ItemCard from "../../components/ItemCard.svelte";

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let references = $derived(data.references);
  let expandedId = $state<number | null>(null);
  let showAddForm = $state(false);
  let deleteId = $state<number | null>(null);

  // Form states
  let newAuthor = $state("");
  let newAuthorPosition = $state("");
  let newText = $state("");

  let editAuthor = $state("");
  let editAuthorPosition = $state("");
  let editText = $state("");

  function toggleExpand(id: number) {
    if (expandedId === id) {
      expandedId = null;
    } else {
      expandedId = id;
      const ref = references.find((r) => r.id === id);
      if (ref) {
        editAuthor = ref.author || "";
        editAuthorPosition = ref.author_position || "";
        editText = ref.text || "";
      }
    }
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
        expandedId = null;
      }
    };
  }
</script>

<div class="space-y-6">
  {#if !showAddForm && references.length > 0}
    <div class="flex justify-end">
      <button
        type="button"
        onclick={() => (showAddForm = true)}
        class="flex items-center justify-center gap-2 p-3 sm:px-4 sm:py-2 bg-[var(--dash-primary)] text-white rounded-lg hover:bg-[var(--dash-primary-hover)] transition-colors"
      >
        <FontAwesomeIcon icon={faPlus} class="w-5 h-5 sm:w-4 sm:h-4" />
        <span class="hidden sm:inline">Add Reference</span>
      </button>
    </div>
  {/if}

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
        <ItemCard card={false}
          id={ref.id}
          {expandedId}
          onToggle={toggleExpand}
          icon={faQuoteLeft}
        >
          {#snippet title()}
            {ref.author}
          {/snippet}

          {#snippet subtitle()}
            {#if ref.author_position}
              {ref.author_position}
            {/if}
          {/snippet}

          {#snippet dateline()}
            {#if ref.text}
              <span class="text-[var(--dash-text)] italic text-sm">"{ref.text}"</span>
            {/if}
          {/snippet}

          {#snippet expandedContent()}
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

              <div class="flex justify-between items-center mt-4">
                <button
                  type="button"
                  onclick={() => { expandedId = null; deleteId = ref.id; }}
                  class="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-red-500/10 border border-red-500/30 rounded-lg text-red-500 hover:bg-red-500/20 hover:border-red-500/50 transition-colors"
                >
                  <FontAwesomeIcon icon={faTrash} class="w-3 h-3" />
                  Delete
                </button>
                <div class="flex gap-2">
                  <button
                    type="button"
                    onclick={() => expandedId = null}
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
              </div>
            </form>
          {/snippet}
        </ItemCard>
      {/each}
    </div>
  {/if}
</div>

<!-- Delete Confirmation Modal -->
<ConfirmModal
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
