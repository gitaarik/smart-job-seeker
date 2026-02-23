<script lang="ts">
  import type { ActionData, PageData } from "./$types";
  import { enhance } from "$app/forms";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faCheck,
    faChevronDown,
    faChevronUp,
    faFileAlt,
    faPencil,
    faTimes,
    faTrash,
  } from "@fortawesome/free-solid-svg-icons";
  import SectionHeader from "../../profile/components/SectionHeader.svelte";
  import EmptyState from "../../profile/components/EmptyState.svelte";
  import DeleteConfirmModal from "../../profile/components/DeleteConfirmModal.svelte";
  import SimpleEditor from "$lib/components/SimpleEditor.svelte";

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let cheatsheets = $derived(data.cheatsheets);
  let expandedId = $state<number | null>(null);
  let editingId = $state<number | null>(null);
  let showAddForm = $state(false);
  let deleteId = $state<number | null>(null);

  // Form states for new entry
  let newTitle = $state("");
  let newContent = $state("");

  // Form states for editing
  let editTitle = $state("");
  let editContent = $state("");

  function toggleExpand(id: number) {
    if (editingId === id) return;
    expandedId = expandedId === id ? null : id;
  }

  function startEdit(sheet: (typeof cheatsheets)[0]) {
    editingId = sheet.id;
    expandedId = sheet.id;
    editTitle = sheet.title || "";
    editContent = sheet.content || "";
  }

  function cancelEdit() {
    editingId = null;
  }

  function resetAddForm() {
    showAddForm = false;
    newTitle = "";
    newContent = "";
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

  function getPreview(content: string | null): string {
    if (!content) return "No content";
    const preview = content.substring(0, 150);
    return content.length > 150 ? preview + "..." : preview;
  }
</script>

<div class="space-y-6">
  <SectionHeader
    title="Cheat Sheets"
    icon={faFileAlt}
    showAddButton={!showAddForm && cheatsheets.length > 0}
    addLabel="Add Cheat Sheet"
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
        Add New Cheat Sheet
      </h3>
      <div class="space-y-4">
        <div>
          <label
            for="new-title"
            class="block text-sm font-medium text-[var(--dash-text)] mb-1"
          >
            Title <span class="text-[var(--dash-error)]">*</span>
          </label>
          <input
            type="text"
            id="new-title"
            name="title"
            bind:value={newTitle}
            placeholder="e.g., System Design Interview Topics"
            required
            class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
          />
        </div>

        <div>
          <label
            class="block text-sm font-medium text-[var(--dash-text)] mb-1"
          >
            Content
          </label>
          <input type="hidden" name="content" value={newContent} />
          <SimpleEditor
            bind:content={newContent}
            placeholder="Add your notes, key points, or reference material..."
          />
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
          Add Cheat Sheet
        </button>
      </div>
    </form>
  {/if}

  <!-- Cheat Sheets List -->
  {#if cheatsheets.length === 0 && !showAddForm}
    <EmptyState
      icon={faFileAlt}
      title="No cheat sheets yet"
      description="Create quick reference cards for interview topics, technical concepts, or talking points you want to remember."
      actionLabel="Add First Cheat Sheet"
      onAction={() => (showAddForm = true)}
    />
  {:else}
    <div class="space-y-3">
      {#each cheatsheets as sheet (sheet.id)}
        <div
          class="bg-[var(--dash-card)] rounded-lg border border-[var(--dash-border)] overflow-hidden"
        >
          <!-- Header -->
          <button
            type="button"
            onclick={() => toggleExpand(sheet.id)}
            class="w-full flex items-center justify-between p-4 hover:bg-[var(--dash-bg)] transition-colors text-left"
          >
            <div class="flex items-center gap-4 flex-1 min-w-0">
              <div
                class="w-10 h-10 rounded-full bg-[var(--dash-bg)] flex items-center justify-center flex-shrink-0"
              >
                <FontAwesomeIcon
                  icon={faFileAlt}
                  class="w-5 h-5 text-purple-600"
                />
              </div>

              <div class="flex-1 min-w-0">
                <h3 class="font-medium text-[var(--dash-text)] truncate">
                  {sheet.title || "Untitled"}
                </h3>
                <p class="text-sm text-[var(--dash-text-secondary)] truncate">
                  {getPreview(sheet.content)}
                </p>
              </div>
            </div>

            <FontAwesomeIcon
              icon={expandedId === sheet.id ? faChevronUp : faChevronDown}
              class="w-4 h-4 text-[var(--dash-text-secondary)]"
            />
          </button>

          <!-- Expanded Content -->
          {#if expandedId === sheet.id}
            <div class="border-t border-[var(--dash-border)] p-4">
              {#if editingId === sheet.id}
                <!-- Edit Mode -->
                <form
                  method="POST"
                  action="?/update"
                  use:enhance={handleEditSubmit}
                >
                  <input type="hidden" name="id" value={sheet.id} />
                  <div class="space-y-4">
                    <div>
                      <label
                        for="edit-title-{sheet.id}"
                        class="block text-sm font-medium text-[var(--dash-text)] mb-1"
                      >
                        Title <span class="text-[var(--dash-error)]">*</span>
                      </label>
                      <input
                        type="text"
                        id="edit-title-{sheet.id}"
                        name="title"
                        bind:value={editTitle}
                        required
                        class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label
                        class="block text-sm font-medium text-[var(--dash-text)] mb-1"
                      >
                        Content
                      </label>
                      <input type="hidden" name="content" value={editContent} />
                      <SimpleEditor
                        bind:content={editContent}
                        placeholder="Add your notes..."
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
                <div class="space-y-4">
                  {#if sheet.content}
                    <div class="cheatsheet-content text-sm text-[var(--dash-text)]">
                      {@html sheet.content}
                    </div>
                  {:else}
                    <p class="text-[var(--dash-text-secondary)] italic">
                      No content yet
                    </p>
                  {/if}

                  <div
                    class="flex items-center justify-end gap-2 pt-2 border-t border-[var(--dash-border)]"
                  >
                    <button
                      type="button"
                      onclick={() => startEdit(sheet)}
                      class="p-2 text-[var(--dash-text-secondary)] hover:text-[var(--dash-primary)] transition-colors"
                      aria-label="Edit"
                    >
                      <FontAwesomeIcon icon={faPencil} class="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onclick={() => (deleteId = sheet.id)}
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
  title="Delete Cheat Sheet"
  message="Are you sure you want to delete this cheat sheet? This action cannot be undone."
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

<style>
  .cheatsheet-content :global(h3) {
    font-size: 1.1em;
    font-weight: 600;
    margin-top: 0.75em;
    margin-bottom: 0.5em;
  }
  .cheatsheet-content :global(p) {
    margin-bottom: 0.5em;
  }
  .cheatsheet-content :global(ul),
  .cheatsheet-content :global(ol) {
    margin-left: 1.25em;
    margin-bottom: 0.5em;
  }
  .cheatsheet-content :global(ul) {
    list-style-type: disc;
  }
  .cheatsheet-content :global(ol) {
    list-style-type: decimal;
  }
  .cheatsheet-content :global(li) {
    margin-bottom: 0.25em;
  }
  .cheatsheet-content :global(strong) {
    font-weight: 600;
  }
  .cheatsheet-content :global(em) {
    font-style: italic;
  }
</style>
