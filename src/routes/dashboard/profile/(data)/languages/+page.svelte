<script lang="ts">
  import type { ActionData, PageData } from "./$types";
  import { enhance } from "$app/forms";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faGlobe,
    faPencil,
    faTrash,
  } from "@fortawesome/free-solid-svg-icons";
  import SectionHeader from "../../components/SectionHeader.svelte";
  import EmptyState from "../../components/EmptyState.svelte";
  import ConfirmModal from "../../components/ConfirmModal.svelte";
  import ItemCard from "../../components/ItemCard.svelte";

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let languages = $derived(data.languages);
  let expandedId = $state<number | null>(null);
  let showAddForm = $state(false);
  let deleteId = $state<number | null>(null);

  // Form states
  let newName = $state("");
  let newProficiency = $state("");

  let editName = $state("");
  let editProficiency = $state("");
  let originalName = $state("");
  let originalProficiency = $state("");
  let showDiscardConfirm = $state(false);

  const proficiencyOptions = [
    { value: "native", label: "Native" },
    { value: "fluent", label: "Fluent" },
    { value: "proficient", label: "Proficient" },
    { value: "conversational", label: "Conversational" },
    { value: "basic", label: "Basic" },
  ];

  function isEditDirty(): boolean {
    return editName !== originalName || editProficiency !== originalProficiency;
  }

  function toggleExpand(id: number) {
    if (expandedId === id) {
      if (isEditDirty()) {
        showDiscardConfirm = true;
      } else {
        expandedId = null;
      }
    } else {
      expandedId = id;
      const lang = languages.find((l) => l.id === id);
      if (lang) {
        editName = lang.name || "";
        editProficiency = lang.proficiency || "";
        originalName = editName;
        originalProficiency = editProficiency;
      }
    }
  }

  function confirmDiscard() {
    expandedId = null;
    showDiscardConfirm = false;
  }

  function resetAddForm() {
    showAddForm = false;
    newName = "";
    newProficiency = "";
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

  function getProficiencyLabel(value: string | null) {
    return proficiencyOptions.find((o) => o.value === value)?.label ||
      value || "—";
  }
</script>

<svelte:head>
  <title>Languages - Profile - Smart Job Seeker</title>
</svelte:head>

<div class="space-y-6">
  <SectionHeader
    title="Languages"
    icon={faGlobe}
    showAddButton={!showAddForm && languages.length > 0}
    addLabel="Add Language"
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
      <h3 class="font-medium text-[var(--dash-text)] mb-4">Add New Language</h3>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label
            for="new-name"
            class="block text-sm font-medium text-[var(--dash-text)] mb-1"
          >
            Language <span class="text-[var(--dash-error)]">*</span>
          </label>
          <input
            type="text"
            id="new-name"
            name="name"
            bind:value={newName}
            placeholder="e.g., English"
            required
            class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
          />
        </div>

        <div>
          <label
            for="new-proficiency"
            class="block text-sm font-medium text-[var(--dash-text)] mb-1"
          >
            Proficiency
          </label>
          <select
            id="new-proficiency"
            name="proficiency"
            bind:value={newProficiency}
            class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
          >
            <option value="">Select proficiency</option>
            {#each proficiencyOptions as option}
              <option value={option.value}>{option.label}</option>
            {/each}
          </select>
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
          Add Language
        </button>
      </div>
    </form>
  {/if}

  <!-- Languages List -->
  {#if languages.length === 0 && !showAddForm}
    <EmptyState
      icon={faGlobe}
      title="No languages yet"
      description="Add languages you speak and your proficiency level to showcase your communication skills."
      actionLabel="Add First Language"
      onAction={() => (showAddForm = true)}
    />
  {:else}
    <div class="space-y-3">
      {#each languages as lang (lang.id)}
        <ItemCard
          id={lang.id}
          {expandedId}
          onToggle={toggleExpand}
          icon={faGlobe}
        >
          {#snippet title()}
            {lang.name}
          {/snippet}

          {#snippet subtitle()}
            {getProficiencyLabel(lang.proficiency)}
          {/snippet}

          {#snippet headerActions()}
            <button
              type="button"
              onclick={(e) => { e.stopPropagation(); if (expandedId !== lang.id) toggleExpand(lang.id); }}
              class="p-1.5 text-[var(--dash-text-secondary)] hover:text-[var(--dash-primary)] transition-colors cursor-pointer"
              aria-label="Edit"
            >
              <FontAwesomeIcon icon={faPencil} class="w-4 h-4" />
            </button>
          {/snippet}

          {#snippet expandedContent()}
            <form
              method="POST"
              action="?/update"
              use:enhance={handleEditSubmit}
            >
              <input type="hidden" name="id" value={lang.id} />
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label
                    for="edit-name-{lang.id}"
                    class="block text-sm font-medium text-[var(--dash-text)] mb-1"
                  >
                    Language <span class="text-[var(--dash-error)]">*</span>
                  </label>
                  <input
                    type="text"
                    id="edit-name-{lang.id}"
                    name="name"
                    bind:value={editName}
                    required
                    class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
                  />
                </div>

                <div>
                  <label
                    for="edit-proficiency-{lang.id}"
                    class="block text-sm font-medium text-[var(--dash-text)] mb-1"
                  >
                    Proficiency
                  </label>
                  <select
                    id="edit-proficiency-{lang.id}"
                    name="proficiency"
                    bind:value={editProficiency}
                    class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
                  >
                    <option value="">Select proficiency</option>
                    {#each proficiencyOptions as option}
                      <option value={option.value}>{option.label}</option>
                    {/each}
                  </select>
                </div>
              </div>

              <div class="flex items-center mt-4">
                <button
                  type="button"
                  onclick={() => { expandedId = null; deleteId = lang.id; }}
                  class="px-3 py-2 text-xs bg-red-500/10 border border-red-500/30 rounded-lg text-red-500 hover:bg-red-500/20 hover:border-red-500/50 transition-colors flex items-center gap-1.5"
                >
                  <FontAwesomeIcon icon={faTrash} class="w-3 h-3" /> Delete
                </button>
                <div class="flex gap-2 ml-auto">
                  <button
                    type="button"
                    onclick={() => expandedId = null}
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
          {/snippet}
        </ItemCard>
      {/each}
    </div>
  {/if}
</div>

<!-- Delete Confirmation Modal -->
<ConfirmModal
  isOpen={deleteId !== null}
  title="Delete Language"
  message="Are you sure you want to delete this language? This action cannot be undone."
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

<ConfirmModal
  isOpen={showDiscardConfirm}
  title="Discard Changes"
  message="You have unsaved changes. Are you sure you want to discard them?"
  onCancel={() => (showDiscardConfirm = false)}
  onConfirm={confirmDiscard}
/>
