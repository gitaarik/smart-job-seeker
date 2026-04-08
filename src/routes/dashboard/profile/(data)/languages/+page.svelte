<script lang="ts">
  import type { ActionData, PageData } from "./$types";
  import { enhance } from "$app/forms";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faCheck,
    faGlobe,
    faPlus,
    faTimes,
    faTrash,
  } from "@fortawesome/free-solid-svg-icons";
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

  const proficiencyOptions = [
    { value: "native", label: "Native" },
    { value: "fluent", label: "Fluent" },
    { value: "proficient", label: "Proficient" },
    { value: "conversational", label: "Conversational" },
    { value: "basic", label: "Basic" },
  ];

  function toggleExpand(id: number) {
    if (expandedId === id) {
      expandedId = null;
    } else {
      expandedId = id;
      const lang = languages.find((l) => l.id === id);
      if (lang) {
        editName = lang.name || "";
        editProficiency = lang.proficiency || "";
      }
    }
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

<div class="space-y-6">
  {#if !showAddForm && languages.length > 0}
    <div class="flex justify-end">
      <button
        type="button"
        onclick={() => (showAddForm = true)}
        class="flex items-center justify-center gap-2 p-3 sm:px-4 sm:py-2 bg-[var(--dash-primary)] text-white rounded-lg hover:bg-[var(--dash-primary-hover)] transition-colors"
      >
        <FontAwesomeIcon icon={faPlus} class="w-5 h-5 sm:w-4 sm:h-4" />
        <span class="hidden sm:inline">Add Language</span>
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
        <ItemCard card={false}
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

              <div class="flex justify-between items-center mt-4">
                <button
                  type="button"
                  onclick={() => { expandedId = null; deleteId = lang.id; }}
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
