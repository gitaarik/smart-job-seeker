<script lang="ts">
  import type { ActionData, PageData } from "./$types";
  import { enhance } from "$app/forms";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faArrowsUpDown,
    faCertificate,
    faCircleNotch,
    faGripVertical,
    faPencil,
    faTrash,
  } from "@fortawesome/free-solid-svg-icons";
  import { dragHandleZone, dragHandle } from "svelte-dnd-action";
  import { flip } from "svelte/animate";
  import { invalidateAll } from "$app/navigation";
  import SectionHeader from "../../components/SectionHeader.svelte";
  import EmptyState from "../../components/EmptyState.svelte";
  import ConfirmModal from "../../components/ConfirmModal.svelte";
  import ItemCard from "../../components/ItemCard.svelte";
  import Card from "../../../components/Card.svelte";

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let certificates = $derived(data.certificates);
  let expandedId = $state<number | null>(null);
  let showAddForm = $state(false);
  let deleteId = $state<number | null>(null);

  // Form states
  let newName = $state("");
  let newIssuer = $state("");
  let newDate = $state("");
  let newUrl = $state("");

  let editName = $state("");
  let editIssuer = $state("");
  let editDate = $state("");
  let editUrl = $state("");
  let originalName = $state("");
  let originalIssuer = $state("");
  let originalDate = $state("");
  let originalUrl = $state("");
  let showDiscardConfirm = $state(false);

  function formatDateForInput(date: Date | string | null): string {
    if (!date) return "";
    const d = new Date(date);
    return d.toISOString().split("T")[0];
  }

  function formatDateForDisplay(date: Date | string | null): string {
    if (!date) return "";
    const d = new Date(date);
    return d.toLocaleDateString("en-US", { year: "numeric", month: "short" });
  }

  function isEditDirty(): boolean {
    return editName !== originalName || editIssuer !== originalIssuer || editDate !== originalDate || editUrl !== originalUrl;
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
      const cert = certificates.find((c) => c.id === id);
      if (cert) {
        editName = cert.name || "";
        editIssuer = cert.issuer || "";
        editDate = formatDateForInput(cert.date);
        editUrl = cert.url || "";
        originalName = editName;
        originalIssuer = editIssuer;
        originalDate = editDate;
        originalUrl = editUrl;
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
    newIssuer = "";
    newDate = "";
    newUrl = "";
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

  // --- Reorder mode ---
  let reorderMode = $state(false);
  let reorderSaving = $state(false);
  interface DndItem {
    id: string;
    cert: (typeof certificates)[0];
    [key: string]: unknown;
  }
  let dndItems = $state<DndItem[]>([]);
  const flipDurationMs = 150;

  let canReorder = $derived(certificates.length > 1);

  function startReorder() {
    dndItems = certificates.map((cert) => ({
      id: String(cert.id),
      cert,
    }));
    reorderMode = true;
  }

  function handleDndConsider(e: CustomEvent<{ items: DndItem[] }>) {
    dndItems = e.detail.items;
  }

  function handleDndFinalize(e: CustomEvent<{ items: DndItem[] }>) {
    dndItems = e.detail.items;
  }

  async function confirmReorder() {
    reorderSaving = true;
    const ids = dndItems.map((d) => parseInt(d.id)).filter((id) => !isNaN(id));
    try {
      await fetch("/api/certificates", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile_id: data.profileId, order: ids }),
      });
      await invalidateAll();
    } catch {
      // silently fail
    }
    reorderSaving = false;
    reorderMode = false;
  }

  function cancelReorder() {
    reorderMode = false;
  }
</script>

<svelte:head>
  <title>Certificates - Profile - Smart Job Seeker</title>
</svelte:head>

<div class="space-y-6">
  <SectionHeader
    title="Certificates"
    icon={faCertificate}
    showAddButton={!showAddForm && certificates.length > 0}
    addLabel="Add Certificate"
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
      <h3 class="font-medium text-[var(--dash-text)] mb-4">Add New Certificate</h3>
      <div class="space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label
              for="new-name"
              class="block text-sm font-medium text-[var(--dash-text)] mb-1"
            >
              Certificate Name <span class="text-[var(--dash-error)]">*</span>
            </label>
            <input
              type="text"
              id="new-name"
              name="name"
              bind:value={newName}
              placeholder="e.g., AWS Solutions Architect"
              required
              class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
            />
          </div>

          <div>
            <label
              for="new-issuer"
              class="block text-sm font-medium text-[var(--dash-text)] mb-1"
            >
              Issuer
            </label>
            <input
              type="text"
              id="new-issuer"
              name="issuer"
              bind:value={newIssuer}
              placeholder="e.g., Amazon Web Services"
              class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
            />
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label
              for="new-date"
              class="block text-sm font-medium text-[var(--dash-text)] mb-1"
            >
              Date Obtained
            </label>
            <input
              type="date"
              id="new-date"
              name="date"
              bind:value={newDate}
              class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
            />
          </div>

          <div>
            <label
              for="new-url"
              class="block text-sm font-medium text-[var(--dash-text)] mb-1"
            >
              URL
            </label>
            <input
              type="url"
              id="new-url"
              name="url"
              bind:value={newUrl}
              placeholder="e.g., https://www.credly.com/..."
              class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
            />
          </div>
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
          Add Certificate
        </button>
      </div>
    </form>
  {/if}

  {#if canReorder && !reorderMode && !showAddForm}
    <div class="flex justify-end">
      <button
        type="button"
        onclick={startReorder}
        class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors bg-[var(--dash-bg)] text-[var(--dash-text-muted)] border-[var(--dash-border)] hover:text-[var(--dash-text-secondary)]"
      >
        <FontAwesomeIcon icon={faArrowsUpDown} class="w-3 h-3" />
        Reorder
      </button>
    </div>
  {/if}

  <!-- Certificates List -->
  {#if certificates.length === 0 && !showAddForm}
    <EmptyState
      icon={faCertificate}
      title="No certificates yet"
      description="Add professional certifications to strengthen your profile and match with jobs that require them."
      actionLabel="Add First Certificate"
      onAction={() => (showAddForm = true)}
    />
  {:else if reorderMode}
    {#snippet reorderConfirmCancel()}
      <div class="flex items-center justify-end gap-2">
        <span class="text-xs text-[var(--dash-text-muted)]">Reorder Certificates</span>
        <button
          type="button"
          onclick={cancelReorder}
          class="px-3 py-1 border border-[var(--dash-border)] text-[var(--dash-text)] rounded-lg hover:bg-[var(--dash-bg)] transition-colors text-xs"
        >
          Cancel
        </button>
        <button
          type="button"
          onclick={confirmReorder}
          disabled={reorderSaving}
          class="px-3 py-1 bg-[var(--dash-success)] text-white rounded-lg hover:opacity-90 transition-colors text-xs inline-flex items-center gap-1.5 disabled:opacity-70"
        >
          {#if reorderSaving}<FontAwesomeIcon icon={faCircleNotch} spin class="w-3 h-3" />{/if}
          Save
        </button>
      </div>
    {/snippet}

    {@render reorderConfirmCancel()}
    <div
      class="space-y-2 mt-2"
      use:dragHandleZone={{ items: dndItems, flipDurationMs, type: "certificates" }}
      onconsider={handleDndConsider}
      onfinalize={handleDndFinalize}
    >
      {#each dndItems as dndItem (dndItem.id)}
        <div animate:flip={{ duration: flipDurationMs }}>
          <Card class="p-3 sm:p-4">
            <div class="flex items-center gap-3">
              <div use:dragHandle class="cursor-grab active:cursor-grabbing touch-none p-1 -m-1">
                <FontAwesomeIcon
                  icon={faGripVertical}
                  class="w-4 h-4 text-[var(--dash-text-muted)] flex-shrink-0"
                />
              </div>
              <FontAwesomeIcon
                icon={faCertificate}
                class="w-4 h-4 text-[var(--dash-primary)] flex-shrink-0"
              />
              <h3 class="text-base font-semibold text-[var(--dash-text)] truncate">
                {dndItem.cert.name || "Untitled"}
              </h3>
              {#if dndItem.cert.issuer}
                <span class="text-xs text-[var(--dash-text-muted)] flex-shrink-0">
                  {dndItem.cert.issuer}
                </span>
              {/if}
            </div>
          </Card>
        </div>
      {/each}
    </div>
    <div class="mt-2">
      {@render reorderConfirmCancel()}
    </div>
  {:else}
    <div class="space-y-4">
      {#each certificates as cert (cert.id)}
        <ItemCard
          id={cert.id}
          {expandedId}
          onToggle={toggleExpand}
          icon={faCertificate}
        >
          {#snippet title()}
            {cert.name}
          {/snippet}

          {#snippet subtitle()}
            {#if cert.issuer}
              {cert.issuer}
            {/if}
          {/snippet}

          {#snippet dateline()}
            {#if cert.date}
              <span class="text-[var(--dash-text-muted)] text-sm">{formatDateForDisplay(cert.date)}</span>
            {/if}
            {#if cert.url}
              <a
                href={cert.url}
                target="_blank"
                rel="noopener noreferrer"
                onclick={(e) => e.stopPropagation()}
                class="text-[var(--dash-primary)] text-sm hover:underline"
              >{cert.url}</a>
            {/if}
          {/snippet}

          {#snippet headerActions()}
            <button
              type="button"
              onclick={(e) => { e.stopPropagation(); if (expandedId !== cert.id) toggleExpand(cert.id); }}
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
              <input type="hidden" name="id" value={cert.id} />
              <div class="space-y-4">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label
                      for="edit-name-{cert.id}"
                      class="block text-sm font-medium text-[var(--dash-text)] mb-1"
                    >
                      Certificate Name <span class="text-[var(--dash-error)]">*</span>
                    </label>
                    <input
                      type="text"
                      id="edit-name-{cert.id}"
                      name="name"
                      bind:value={editName}
                      required
                      class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label
                      for="edit-issuer-{cert.id}"
                      class="block text-sm font-medium text-[var(--dash-text)] mb-1"
                    >
                      Issuer
                    </label>
                    <input
                      type="text"
                      id="edit-issuer-{cert.id}"
                      name="issuer"
                      bind:value={editIssuer}
                      class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
                    />
                  </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label
                      for="edit-date-{cert.id}"
                      class="block text-sm font-medium text-[var(--dash-text)] mb-1"
                    >
                      Date Obtained
                    </label>
                    <input
                      type="date"
                      id="edit-date-{cert.id}"
                      name="date"
                      bind:value={editDate}
                      class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label
                      for="edit-url-{cert.id}"
                      class="block text-sm font-medium text-[var(--dash-text)] mb-1"
                    >
                      URL
                    </label>
                    <input
                      type="url"
                      id="edit-url-{cert.id}"
                      name="url"
                      bind:value={editUrl}
                      placeholder="e.g., https://www.credly.com/..."
                      class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              <div class="flex items-center mt-4">
                <button
                  type="button"
                  onclick={() => { expandedId = null; deleteId = cert.id; }}
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
  title="Delete Certificate"
  message="Are you sure you want to delete this certificate? This action cannot be undone."
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
