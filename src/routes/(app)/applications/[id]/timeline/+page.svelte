<script lang="ts">
  import type { ActionData, PageData } from "./$types";
  import { enhance } from "$app/forms";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faCalendar,
    faCheck,
    faEllipsisVertical,
    faHistory,
    faPencil,
    faPlus,
    faTimes,
    faTrash,
  } from "@fortawesome/free-solid-svg-icons";
  import Card from "../../../components/Card.svelte";
  import EmptyState from "../../../profile/components/EmptyState.svelte";
  import ConfirmModal from "../../../profile/components/ConfirmModal.svelte";
  import { getStatusLabel, getStatusColor, getStatusBgColor } from "$lib/application-status";
  import { page } from "$app/stores";
  import { formatDate as fmtDate, formatTimeShort } from "$lib/format-date";
  import type { TimeFormat } from "$lib/format-date";

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let app = $derived(data.application);
  let entries = $derived(app.application_status_logs || []);
  const tf = $derived(($page.data as { timeFormat: TimeFormat }).timeFormat);

  let showAddForm = $state(false);
  let editingId = $state<number | null>(null);
  let deleteId = $state<number | null>(null);
  let menuOpenId = $state<number | null>(null);

  // Add form states
  let newDescription = $state("");

  // Edit form states
  let editDescription = $state("");

  function formatDate(date: Date | string | null): string {
    return fmtDate(date, { fallback: "" });
  }

  function formatTime(date: Date | string | null): string {
    return formatTimeShort(date, tf, { fallback: "" });
  }

  function startEdit(entry: (typeof entries)[0]) {
    editingId = entry.id;
    editDescription = entry.description || "";
  }

  function cancelEdit() {
    editingId = null;
  }

  function resetAddForm() {
    showAddForm = false;
    newDescription = "";
  }

  function handleAddSubmit() {
    return async ({ result, update }: { result: { type: string }; update: () => Promise<void> }) => {
      await update();
      if (result.type === "success") {
        resetAddForm();
      }
    };
  }

  function handleEditSubmit() {
    return async ({ result, update }: { result: { type: string }; update: () => Promise<void> }) => {
      await update();
      if (result.type === "success") {
        editingId = null;
      }
    };
  }
</script>

<svelte:window onclick={() => { if (menuOpenId !== null) menuOpenId = null; }} />

<div class="space-y-6">
  {#if form?.error}
    <div class="bg-[var(--dash-error-light)] border border-[var(--dash-error)] rounded-lg p-4">
      <p class="text-[var(--dash-error)] text-sm">{form.error}</p>
    </div>
  {/if}

  <!-- Header -->
  <div class="flex items-center justify-between">
    <div class="flex items-center gap-2">
      <FontAwesomeIcon icon={faHistory} class="w-5 h-5 text-[var(--dash-primary)]" />
      <h2 class="text-lg font-semibold text-[var(--dash-text)]">Timeline</h2>
    </div>
    {#if !showAddForm}
      <button
        type="button"
        onclick={() => (showAddForm = true)}
        class="flex items-center gap-2 px-3 py-1.5 text-sm bg-[var(--dash-primary)] text-white rounded-lg hover:bg-[var(--dash-primary-hover)] transition-colors"
      >
        <FontAwesomeIcon icon={faPlus} class="w-3 h-3" />
        Add Event
      </button>
    {/if}
  </div>

  <!-- Add Event Form -->
  {#if showAddForm}
    <Card padding="md">
      <form method="POST" action="?/create" use:enhance={handleAddSubmit}>
        <h3 class="font-medium text-[var(--dash-text)] mb-3">Add Timeline Event</h3>
        <div class="space-y-3">
          <div>
            <label for="new-description" class="block text-sm text-[var(--dash-text-secondary)] mb-1">
              Description <span class="text-[var(--dash-error)]">*</span>
            </label>
            <textarea
              id="new-description"
              name="description"
              bind:value={newDescription}
              rows={3}
              placeholder="e.g., Received coding challenge, need to complete by Friday..."
              required
              class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent resize-y"
            ></textarea>
          </div>
          <div class="flex justify-end gap-2">
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
              Add Event
            </button>
          </div>
        </div>
      </form>
    </Card>
  {/if}

  <!-- Timeline -->
  {#if entries.length === 0 && !showAddForm}
    <EmptyState
      icon={faHistory}
      title="No timeline entries yet"
      description="Status changes are logged automatically. You can also add events manually."
      actionLabel="Add First Event"
      onAction={() => (showAddForm = true)}
    />
  {:else}
    <div class="relative">
      <!-- Vertical line -->
      <div class="absolute left-[19px] top-0 bottom-0 w-0.5 bg-[var(--dash-border)]"></div>

      <div class="space-y-0">
        {#each entries as entry (entry.id)}
          <div class="relative flex gap-4 pb-6">
            <!-- Dot -->
            <div class="relative z-10 flex-shrink-0 w-10 flex justify-center">
              <div class="w-4 h-4 rounded-full {getStatusBgColor(entry.to_status)} border-2 border-[var(--dash-card)] mt-1"></div>
            </div>

            <!-- Content -->
            <div class="flex-1 min-w-0 -mt-0.5">
              {#if editingId === entry.id}
                <!-- Edit Mode -->
                <Card padding="md">
                  <form method="POST" action="?/update" use:enhance={handleEditSubmit}>
                    <input type="hidden" name="id" value={entry.id} />
                    <div class="space-y-3">
                      <div>
                        <label for="edit-description-{entry.id}" class="block text-sm text-[var(--dash-text-secondary)] mb-1">Description</label>
                        <textarea
                          id="edit-description-{entry.id}"
                          name="description"
                          bind:value={editDescription}
                          rows={3}
                          class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent resize-y"
                        ></textarea>
                      </div>
                      <div class="flex justify-end gap-2">
                        <button type="button" onclick={cancelEdit} class="p-2 text-[var(--dash-text-secondary)] hover:text-[var(--dash-text)] transition-colors" aria-label="Cancel">
                          <FontAwesomeIcon icon={faTimes} class="w-4 h-4" />
                        </button>
                        <button type="submit" class="p-2 text-[var(--dash-primary)] hover:text-[var(--dash-primary-hover)] transition-colors" aria-label="Save">
                          <FontAwesomeIcon icon={faCheck} class="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </form>
                </Card>
              {:else}
                <!-- View Mode -->
                <div class="flex items-start justify-between gap-2">
                  <div class="min-w-0 space-y-0.5">
                    {#if entry.from_status !== entry.to_status}
                      <div class="mb-1.5">
                        <span class="text-sm px-2.5 py-1 rounded-full font-medium {getStatusColor(entry.to_status)}">
                          {getStatusLabel(entry.to_status)}
                        </span>
                      </div>
                    {/if}

                    {#if entry.step}
                      <p class="text-sm text-[var(--dash-text-secondary)] italic">{entry.step}</p>
                    {/if}
                    {#if entry.action}
                      <p class="text-xs text-[var(--dash-primary)] font-medium">
                        → {entry.action}
                        {#if entry.action_date}
                          — {formatDate(entry.action_date)}
                        {/if}
                      </p>
                    {/if}
                    {#if entry.description}
                      <p class="text-sm text-[var(--dash-text)] whitespace-pre-wrap">{entry.description}</p>
                    {/if}

                    <p class="text-xs text-[var(--dash-text-muted)] mt-1 flex items-center gap-1">
                      <FontAwesomeIcon icon={faCalendar} class="w-3 h-3" />
                      {formatDate(entry.date_created)}
                      {formatTime(entry.date_created)}
                    </p>
                  </div>
                  <div class="relative flex-shrink-0">
                    <button
                      type="button"
                      onclick={(e) => { e.stopPropagation(); menuOpenId = menuOpenId === entry.id ? null : entry.id; }}
                      class="p-1.5 text-[var(--dash-text-muted)] hover:text-[var(--dash-text)] transition-colors"
                      aria-label="Actions"
                    >
                      <FontAwesomeIcon icon={faEllipsisVertical} class="w-3.5 h-3.5" />
                    </button>
                    {#if menuOpenId === entry.id}
                      <div class="absolute right-0 top-8 bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-lg shadow-lg z-20 py-1 min-w-[120px]">
                        <button
                          type="button"
                          onclick={() => { startEdit(entry); menuOpenId = null; }}
                          class="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--dash-text)] hover:bg-[var(--dash-bg)] transition-colors"
                        >
                          <FontAwesomeIcon icon={faPencil} class="w-3 h-3" />
                          Edit
                        </button>
                        <button
                          type="button"
                          onclick={() => { deleteId = entry.id; menuOpenId = null; }}
                          class="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--dash-error)] hover:bg-[var(--dash-bg)] transition-colors"
                        >
                          <FontAwesomeIcon icon={faTrash} class="w-3 h-3" />
                          Delete
                        </button>
                      </div>
                    {/if}
                  </div>
                </div>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>

<!-- Delete Confirmation Modal -->
<ConfirmModal
  isOpen={deleteId !== null}
  title="Delete Timeline Entry"
  message="Are you sure you want to delete this timeline entry? This action cannot be undone."
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
