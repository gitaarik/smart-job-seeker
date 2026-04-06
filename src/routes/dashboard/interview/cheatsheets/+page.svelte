<script lang="ts">
  import type { ActionData, PageData } from "./$types";
  import { enhance } from "$app/forms";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faChevronRight,
    faFileAlt,
    faPencil,
    faTrash,
  } from "@fortawesome/free-solid-svg-icons";
  import Card from "../../components/Card.svelte";
  import SectionHeader from "../../profile/components/SectionHeader.svelte";
  import EmptyState from "../../profile/components/EmptyState.svelte";
  import ConfirmModal from "../../profile/components/ConfirmModal.svelte";
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
        <Card class="overflow-hidden relative transition-all">
          <!-- Chevron in top right corner -->
          <button
            type="button"
            onclick={(e) => {
              e.stopPropagation();
              toggleExpand(sheet.id);
            }}
            class="absolute top-3 right-3 p-1.5 text-[var(--dash-text-secondary)] hover:text-[var(--dash-primary)] transition-colors z-10"
            aria-label={expandedId === sheet.id ? "Collapse" : "Expand"}
          >
            <span class="inline-block transition-transform duration-200 {expandedId === sheet.id ? 'rotate-90' : ''}">
              <FontAwesomeIcon
                icon={faChevronRight}
                class="w-4 h-4"
              />
            </span>
          </button>

          <!-- Header (clickable to expand/collapse) -->
          <button
            type="button"
            onclick={() => toggleExpand(sheet.id)}
            class="w-full p-3 sm:p-4 hover:bg-[var(--dash-bg)] transition-colors text-left cursor-pointer"
          >
            <div class="flex items-start gap-3">
              <!-- Desktop: Icon on the left -->
              <div class="hidden md:flex flex-shrink-0">
                <div class="w-12 h-12 rounded-lg bg-[var(--dash-bg)] flex items-center justify-center">
                  <FontAwesomeIcon icon={faFileAlt} class="w-6 h-6 text-purple-600" />
                </div>
              </div>

              <div class="flex-1 min-w-0">
                <!-- Title -->
                <h3 class="font-medium text-[var(--dash-text)] text-sm sm:text-base line-clamp-2 sm:truncate pr-8">
                  {sheet.title || "Untitled"}
                </h3>
              </div>

              <!-- Mobile: Icon on the right, below chevron -->
              <div class="flex-shrink-0 md:hidden flex flex-col items-end">
                <div class="h-6 mb-1"></div> <!-- Spacer for chevron -->
                <div class="w-12 h-12 rounded-lg bg-[var(--dash-bg)] flex items-center justify-center">
                  <FontAwesomeIcon icon={faFileAlt} class="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </div>
          </button>

          <!-- Expanded Content -->
          {#if expandedId === sheet.id}
            <div class="border-t border-[var(--dash-border)] p-3 sm:p-4">
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

                  <div class="flex items-center mt-4">
                    <button
                      type="button"
                      onclick={() => deleteId = sheet.id}
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
                      <button
                        type="submit"
                        class="px-4 py-2 bg-[var(--dash-primary)] text-white rounded-lg hover:bg-[var(--dash-primary-hover)] transition-colors"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                </form>
              {:else}
                <!-- View Mode -->
                <div class="space-y-3 sm:space-y-4">
                  {#if sheet.content}
                    <div class="cheatsheet-content text-sm text-[var(--dash-text)]">
                      {@html sheet.content}
                    </div>
                  {:else}
                    <p class="text-[var(--dash-text-secondary)] italic">
                      No content yet
                    </p>
                  {/if}
                </div>
              {/if}
            </div>
          {/if}

          <!-- Footer with action buttons -->
          <div class="border-t border-[var(--dash-border)] px-3 py-2 sm:px-4 flex justify-end md:justify-start items-center gap-2">
            <button
              type="button"
              onclick={() => startEdit(sheet)}
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

<!-- Delete Confirmation Modal -->
<ConfirmModal
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
