<script lang="ts">
  import type { ActionData, PageData } from "./$types";
  import { enhance } from "$app/forms";
  import { goto } from "$app/navigation";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faCheck,
    faChevronDown,
    faChevronUp,
    faEnvelope,
    faQuestionCircle,
    faTimes,
    faTrash,
  } from "@fortawesome/free-solid-svg-icons";
  import SectionHeader from "../../profile/components/SectionHeader.svelte";
  import EmptyState from "../../profile/components/EmptyState.svelte";
  import DeleteConfirmModal from "../../profile/components/DeleteConfirmModal.svelte";

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let items = $derived(data.items);
  let currentType = $derived(data.currentType);
  let expandedId = $state<string | null>(null);
  let editingId = $state<string | null>(null);
  let deleteItem = $state<
    { id: number; type: "letter" | "question" } | null
  >(
    null,
  );

  // Edit form states
  let editContent = $state("");
  let editStatus = $state("");
  let editAnswer = $state("");

  const typeFilters = [
    { value: "all", label: "All" },
    { value: "letters", label: "Cover Letters" },
    { value: "questions", label: "Application Questions" },
  ];

  const letterTypes: Record<string, string> = {
    cover_letter: "Cover Letter",
    motivation_letter: "Motivation Letter",
    follow_up: "Follow-up",
    thank_you: "Thank You",
  };

  function getItemId(item: (typeof items)[0]): string {
    return `${item.itemType}-${item.id}`;
  }

  function formatDate(date: Date | string | null): string {
    if (!date) return "";
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function toggleExpand(id: string) {
    if (editingId === id) return;
    expandedId = expandedId === id ? null : id;
  }

  function startEdit(item: (typeof items)[0]) {
    const id = getItemId(item);
    editingId = id;
    expandedId = id;
    if (item.itemType === "letter") {
      editContent = item.content || "";
      editStatus = item.status || "draft";
    } else {
      editAnswer = item.answer || "";
    }
  }

  function cancelEdit() {
    editingId = null;
  }

  function filterByType(type: string) {
    const params = new URLSearchParams();
    if (type !== "all") {
      params.set("type", type);
    }
    goto(`?${params.toString()}`);
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
</script>

<div class="space-y-6">
  <SectionHeader
    title="Letters & Forms"
    icon={faEnvelope}
  />

  {#if form?.error}
    <div
      class="bg-[var(--dash-error-light)] border border-[var(--dash-error)] rounded-lg p-4"
    >
      <p class="text-[var(--dash-error)] text-sm">{form.error}</p>
    </div>
  {/if}

  <!-- Type Filter -->
  <div class="flex flex-wrap gap-2">
    {#each typeFilters as filter}
      <button
        type="button"
        onclick={() => filterByType(filter.value)}
        class="
          px-3 py-1.5 text-sm rounded-lg transition-colors {currentType ===
          filter.value
          ? 'bg-[var(--dash-primary)] text-white'
          : 'bg-[var(--dash-card)] border border-[var(--dash-border)] text-[var(--dash-text)] hover:bg-[var(--dash-bg)]'}
        "
      >
        {filter.label}
      </button>
    {/each}
  </div>

  <!-- Items List -->
  {#if items.length === 0}
    <EmptyState
      icon={faEnvelope}
      title="No letters or forms yet"
      description={currentType === "all"
        ? "Cover letters and application questions will appear here as you apply for jobs."
        : currentType === "letters"
        ? "No cover letters found. Letters are created when you apply for jobs."
        : "No application questions found."}
    />
  {:else}
    <div class="space-y-3">
      {#each items as item (getItemId(item))}
        {@const itemId = getItemId(item)}
        {@const isLetter = item.itemType === "letter"}
        <div
          class="bg-[var(--dash-card)] rounded-lg border border-[var(--dash-border)] overflow-hidden"
        >
          <!-- Header -->
          <button
            type="button"
            onclick={() => toggleExpand(itemId)}
            class="w-full flex items-center justify-between p-4 hover:bg-[var(--dash-bg)] transition-colors text-left"
          >
            <div class="flex items-center gap-4 flex-1 min-w-0">
              <div
                class="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-[var(--dash-bg)]"
              >
                <FontAwesomeIcon
                  icon={isLetter ? faEnvelope : faQuestionCircle}
                  class="w-5 h-5 {isLetter ? 'text-blue-600' : 'text-purple-600'}"
                />
              </div>

              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <h3 class="font-medium text-[var(--dash-text)] truncate">
                    {#if isLetter}
                      {
                        letterTypes[item.letter_type] ||
                          item.letter_type
                      }
                    {:else}
                      {item.question}
                    {/if}
                  </h3>
                  {#if isLetter}
                    <span
                      class="
                        text-xs px-2 py-0.5 rounded-full capitalize {item.status ===
                        'published'
                        ? 'bg-[var(--dash-success-light)] text-[var(--dash-success)]'
                        : 'bg-[var(--dash-bg)] text-[var(--dash-text-muted)]'}
                      "
                    >
                      {item.status}
                    </span>
                  {/if}
                </div>
                <p class="text-sm text-[var(--dash-text-secondary)] truncate">
                  {
                    item.application.jobs?.title ||
                      "Unknown Position"
                  } •
                  {
                    formatDate(
                      item.date_updated || item.date_created,
                    )
                  }
                </p>
              </div>
            </div>

            <FontAwesomeIcon
              icon={expandedId === itemId ? faChevronUp : faChevronDown}
              class="w-4 h-4 text-[var(--dash-text-secondary)]"
            />
          </button>

          <!-- Expanded Content -->
          {#if expandedId === itemId}
            <div class="border-t border-[var(--dash-border)] p-4">
              {#if editingId === itemId}
                <!-- Edit Mode -->
                {#if isLetter}
                  <form
                    method="POST"
                    action="?/updateLetter"
                    use:enhance={handleEditSubmit}
                  >
                    <input type="hidden" name="id" value={item.id} />
                    <div class="space-y-4">
                      <div>
                        <label
                          for="edit-content-{item.id}"
                          class="block text-sm font-medium text-[var(--dash-text)] mb-1"
                        >
                          Content
                        </label>
                        <textarea
                          id="edit-content-{item.id}"
                          name="content"
                          bind:value={editContent}
                          rows={10}
                          class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent font-mono text-sm resize-y"
                        ></textarea>
                      </div>
                      <div>
                        <label
                          for="edit-status-{item.id}"
                          class="block text-sm font-medium text-[var(--dash-text)] mb-1"
                        >
                          Status
                        </label>
                        <select
                          id="edit-status-{item.id}"
                          name="status"
                          bind:value={editStatus}
                          class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
                        >
                          <option value="draft">Draft</option>
                          <option value="published">Published</option>
                          <option value="archived">Archived</option>
                        </select>
                      </div>
                    </div>
                    <div class="flex justify-end gap-2 mt-4">
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
                        Save Changes
                      </button>
                    </div>
                  </form>
                {:else}
                  <form
                    method="POST"
                    action="?/updateQuestion"
                    use:enhance={handleEditSubmit}
                  >
                    <input type="hidden" name="id" value={item.id} />
                    <div class="space-y-4">
                      <div>
                        <p
                          class="text-sm font-medium text-[var(--dash-text)] mb-2"
                        >
                          Question
                        </p>
                        <p
                          class="text-[var(--dash-text)] bg-[var(--dash-bg)] p-3 rounded-lg"
                        >
                          {item.question}
                        </p>
                      </div>
                      <div>
                        <label
                          for="edit-answer-{item.id}"
                          class="block text-sm font-medium text-[var(--dash-text)] mb-1"
                        >
                          Answer
                        </label>
                        <textarea
                          id="edit-answer-{item.id}"
                          name="answer"
                          bind:value={editAnswer}
                          rows={6}
                          class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent resize-y"
                        ></textarea>
                      </div>
                    </div>
                    <div class="flex justify-end gap-2 mt-4">
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
                        Save Answer
                      </button>
                    </div>
                  </form>
                {/if}
              {:else}
                <!-- View Mode -->
                <div class="space-y-4">
                  {#if isLetter}
                    {#if item.content}
                      <div class="prose prose-sm max-w-none">
                        <pre
                          class="whitespace-pre-wrap text-sm text-[var(--dash-text)] bg-[var(--dash-bg)] p-4 rounded-lg overflow-x-auto"
                        >{item.content}</pre>
                      </div>
                    {:else}
                      <p class="text-[var(--dash-text-secondary)] italic">
                        No content yet
                      </p>
                    {/if}
                  {:else}
                    <div>
                      <p
                        class="text-sm font-medium text-[var(--dash-text-secondary)] mb-1"
                      >
                        Question
                      </p>
                      <p class="text-[var(--dash-text)]">{item.question}</p>
                    </div>
                    {#if item.answer}
                      <div>
                        <p
                          class="text-sm font-medium text-[var(--dash-text-secondary)] mb-1"
                        >
                          Answer
                        </p>
                        <p class="text-[var(--dash-text)] whitespace-pre-wrap">
                          {item.answer}
                        </p>
                      </div>
                    {:else}
                      <p class="text-[var(--dash-text-secondary)] italic">
                        No answer yet
                      </p>
                    {/if}
                  {/if}

                  <div
                    class="flex items-center justify-end gap-2 pt-2 border-t border-[var(--dash-border)]"
                  >
                    <button
                      type="button"
                      onclick={() => startEdit(item)}
                      class="px-3 py-1.5 text-sm bg-[var(--dash-primary)] text-white rounded-lg hover:bg-[var(--dash-primary-hover)] transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onclick={() => (deleteItem = {
                        id: item.id,
                        type: item.itemType,
                      })}
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
  isOpen={deleteItem !== null}
  title="Delete {deleteItem?.type === 'letter' ? 'Letter' : 'Question'}"
  message="Are you sure you want to delete this {deleteItem?.type === 'letter'
    ? 'cover letter'
    : 'application question'}? This action cannot be undone."
  onCancel={() => (deleteItem = null)}
  onConfirm={() => {
    if (deleteItem !== null) {
      const form = document.createElement("form");
      form.method = "POST";
      form.action = deleteItem.type === "letter"
        ? "?/deleteLetter"
        : "?/deleteQuestion";
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = "id";
      input.value = String(deleteItem.id);
      form.appendChild(input);
      document.body.appendChild(form);
      form.submit();
    }
  }}
/>
