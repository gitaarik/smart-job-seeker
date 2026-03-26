<script lang="ts">
  import type { ActionData, PageData } from "./$types";
  import { enhance } from "$app/forms";
  import { goto, invalidateAll } from "$app/navigation";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faCheck,
    faChevronDown,
    faChevronUp,
    faEnvelope,
    faQuestionCircle,
    faRobot,
    faTimes,
    faTrash,
  } from "@fortawesome/free-solid-svg-icons";
  import Card from "../../components/Card.svelte";
  import Spinner from "$lib/components/Spinner.svelte";
  import SectionHeader from "../../profile/components/SectionHeader.svelte";
  import EmptyState from "../../profile/components/EmptyState.svelte";
  import ConfirmModal from "../../profile/components/ConfirmModal.svelte";

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

  // AI generation states
  let generatingIds = $state<Set<string>>(new Set());
  let aiError = $state<string | null>(null);
  let followupText = $state<Record<string, string>>({});
  let followupIncludeContext = $state<Record<string, boolean>>({});
  let showFollowup = $state<Record<string, boolean>>({});

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

  function isGenerating(itemId: string): boolean {
    return generatingIds.has(itemId);
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

  async function generateAi(item: (typeof items)[0]) {
    const itemId = getItemId(item);
    const isLetter = item.itemType === "letter";
    const url = isLetter
      ? `/api/ai/letters/${item.id}/generate`
      : `/api/ai/questions/${item.id}/generate`;

    generatingIds.add(itemId);
    generatingIds = new Set(generatingIds);
    aiError = null;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const result = await response.json();
      if (!result.success) {
        aiError = result.message || "Generation failed";
        return;
      }
      await invalidateAll();
    } catch {
      aiError = "Network error. Please try again.";
    } finally {
      generatingIds.delete(itemId);
      generatingIds = new Set(generatingIds);
    }
  }

  async function sendFollowup(item: (typeof items)[0]) {
    const itemId = getItemId(item);
    const isLetter = item.itemType === "letter";
    const text = followupText[itemId]?.trim();
    if (!text) return;

    const url = isLetter
      ? `/api/ai/letters/${item.id}/followup`
      : `/api/ai/questions/${item.id}/followup`;

    generatingIds.add(itemId);
    generatingIds = new Set(generatingIds);
    aiError = null;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          followupRequest: text,
          includeOriginalContext: followupIncludeContext[itemId] || false,
        }),
      });
      const result = await response.json();
      if (!result.success) {
        aiError = result.message || "Follow-up failed";
        return;
      }
      followupText[itemId] = "";
      showFollowup[itemId] = false;
      await invalidateAll();
    } catch {
      aiError = "Network error. Please try again.";
    } finally {
      generatingIds.delete(itemId);
      generatingIds = new Set(generatingIds);
    }
  }
</script>

<div class="space-y-6">
  <SectionHeader
    title="Letters & Forms"
    icon={faEnvelope}
  />

  {#if form?.error || aiError}
    <div
      class="bg-[var(--dash-error-light)] border border-[var(--dash-error)] rounded-lg p-4"
    >
      <p class="text-[var(--dash-error)] text-sm">{form?.error || aiError}</p>
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
        {@const hasAiChat = !!item.ai_chat}
        {@const hasContent = isLetter ? !!item.content : !!item.answer}
        <Card class="overflow-hidden">
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

                  <!-- Action Buttons -->
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
                      onclick={() => generateAi(item)}
                      disabled={isGenerating(itemId)}
                      class="px-3 py-1.5 text-sm border border-[var(--dash-border)] rounded-lg text-[var(--dash-text)] hover:bg-[var(--dash-bg)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                    >
                      {#if isGenerating(itemId)}
                        <Spinner size="w-3.5 h-3.5" />
                      {:else}
                        <FontAwesomeIcon icon={faRobot} class="w-3.5 h-3.5" />
                      {/if}
                      {isGenerating(itemId) ? "Generating..." : hasAiChat ? "Regenerate" : "Generate"}
                    </button>
                    {#if hasAiChat}
                      <button
                        type="button"
                        onclick={() => (showFollowup[itemId] = !showFollowup[itemId])}
                        disabled={isGenerating(itemId)}
                        class="px-3 py-1.5 text-sm border border-[var(--dash-border)] rounded-lg text-[var(--dash-text)] hover:bg-[var(--dash-bg)] transition-colors disabled:opacity-50"
                      >
                        Follow-up
                      </button>
                    {/if}
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

                  <!-- Follow-up Section -->
                  {#if showFollowup[itemId]}
                    <div class="pt-2 space-y-2">
                      <textarea
                        bind:value={followupText[itemId]}
                        placeholder="Ask AI to refine the {isLetter ? 'letter' : 'answer'}..."
                        rows={3}
                        disabled={isGenerating(itemId)}
                        class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent text-sm resize-y disabled:opacity-50"
                      ></textarea>
                      <div class="flex items-center justify-between">
                        <label class="flex items-center gap-2 text-sm text-[var(--dash-text-secondary)]">
                          <input
                            type="checkbox"
                            bind:checked={followupIncludeContext[itemId]}
                            disabled={isGenerating(itemId)}
                            class="rounded"
                          />
                          Include original context
                        </label>
                        <button
                          type="button"
                          onclick={() => sendFollowup(item)}
                          disabled={isGenerating(itemId) || !followupText[itemId]?.trim()}
                          class="px-3 py-1.5 text-sm bg-[var(--dash-primary)] text-white rounded-lg hover:bg-[var(--dash-primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                        >
                          {#if isGenerating(itemId)}
                            <Spinner size="w-3.5 h-3.5" />
                            Generating...
                          {:else}
                            Send Follow-up
                          {/if}
                        </button>
                      </div>
                    </div>
                  {/if}
                </div>
              {/if}
            </div>
          {/if}
        </Card>
      {/each}
    </div>
  {/if}
</div>

<!-- Delete Confirmation Modal -->
<ConfirmModal
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
