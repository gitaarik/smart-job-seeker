<script lang="ts">
  import type { ActionData, PageData } from "./$types";
  import { enhance } from "$app/forms";
  import { invalidateAll } from "$app/navigation";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faArrowRight,
    faCheck,
    faChevronRight,
    faEnvelope,
    faLayerGroup,
    faPen,
    faPlus,
    faQuestionCircle,
    faRobot,
    faTimes,
    faTrash,
    faXmark,
  } from "@fortawesome/free-solid-svg-icons";
  import Spinner from "$lib/components/Spinner.svelte";
  import EmptyState from "../../../profile/components/EmptyState.svelte";
  import FilterTabs from "../../../components/FilterTabs.svelte";
  import ConfirmModal from "../../../profile/components/ConfirmModal.svelte";

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let app = $derived(data.application);
  let letters = $derived(app.application_letters || []);
  let questions = $derived(app.application_questions || []);

  let currentType = $state("all");
  let expandedId = $state<string | null>(null);
  let editingId = $state<string | null>(null);
  let deleteItem = $state<{ id: number; type: "letter" | "question" } | null>(null);
  let showAddQuestion = $state(false);
  let showAddMenu = $state(false);

  // Edit states (for questions only)
  let editAnswer = $state("");

  // AI generation states (for questions only)
  let generatingIds = $state<Set<string>>(new Set());
  let aiError = $state<string | null>(null);
  // Add form states
  let newQuestion = $state("");

  type LetterItem = (typeof letters)[0] & { itemType: "letter" };
  type QuestionItem = (typeof questions)[0] & { itemType: "question" };
  type Item = LetterItem | QuestionItem;

  let items = $derived.by((): Item[] => {
    const letterItems: Item[] = letters.map((l) => ({ ...l, itemType: "letter" as const }));
    const questionItems: Item[] = questions.map((q) => ({ ...q, itemType: "question" as const }));

    if (currentType === "letters") return letterItems;
    if (currentType === "questions") return questionItems;

    return [...letterItems, ...questionItems].sort((a, b) => {
      const dateA = a.date_updated || a.date_created || new Date(0);
      const dateB = b.date_updated || b.date_created || new Date(0);
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });
  });

  const letterTypes: Record<string, string> = {
    cover_letter: "Cover Letter",
  };

  const typeFilters = [
    { value: "all", label: "All", icon: faLayerGroup },
    { value: "letters", label: "Letters", icon: faEnvelope },
    { value: "questions", label: "Questions", icon: faQuestionCircle },
  ];

  function getItemId(item: Item): string {
    return `${item.itemType}-${item.id}`;
  }

  function formatDate(date: Date | string | null): string {
    if (!date) return "";
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  function toggleExpand(id: string) {
    if (editingId === id) return;
    expandedId = expandedId === id ? null : id;
  }

  function startEdit(item: Item) {
    const id = getItemId(item);
    editingId = id;
    expandedId = id;
    editAnswer = (item as QuestionItem).answer || "";
  }

  function cancelEdit() {
    editingId = null;
  }

  function handleEditSubmit() {
    return async ({ result, update }: { result: { type: string }; update: () => Promise<void> }) => {
      await update();
      if (result.type === "success") {
        editingId = null;
      }
    };
  }

  function handleAddSubmit() {
    return async ({ result, update }: { result: { type: string }; update: () => Promise<void> }) => {
      await update();
      if (result.type === "success") {
        showAddQuestion = false;
        newQuestion = "";
      }
    };
  }

  async function generateAi(item: Item) {
    const itemId = getItemId(item);
    const url = `/api/ai/questions/${item.id}/generate`;

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

  function handleClickOutside(e: MouseEvent) {
    if (showAddMenu && !(e.target as HTMLElement).closest("[data-add-menu]")) {
      showAddMenu = false;
    }
  }
</script>

<svelte:window onclick={handleClickOutside} />

<div class="space-y-6">
  {#if form?.error || aiError}
    <div class="bg-[var(--dash-error-light)] border border-[var(--dash-error)] rounded-lg p-4">
      <p class="text-[var(--dash-error)] text-sm">{form?.error || aiError}</p>
    </div>
  {/if}

  <!-- Header with filter + add button (only shown when there are items) -->
  {#if letters.length > 0 || questions.length > 0}
    <div class="flex items-center justify-between flex-wrap gap-3">
      {#if letters.length > 0 && questions.length > 0}
        <FilterTabs filters={typeFilters} value={currentType} onchange={(v) => (currentType = v)} />
      {:else}
        <div></div>
      {/if}

      <div class="relative" data-add-menu>
        <button
          type="button"
          onclick={() => (showAddMenu = !showAddMenu)}
          class="flex items-center justify-center gap-2 p-3 sm:px-4 sm:py-2 bg-[var(--dash-primary)] text-white rounded-lg hover:bg-[var(--dash-primary-hover)] transition-colors"
        >
          <FontAwesomeIcon icon={faPlus} class="w-5 h-5 sm:w-4 sm:h-4" />
          <span class="hidden sm:inline">Add</span>
        </button>
        {#if showAddMenu}
          <div class="absolute top-full right-0 mt-1 z-20 bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-lg shadow-lg py-1 min-w-[220px]">
            {#each Object.entries(letterTypes) as [value, label]}
              <a
                href="/dashboard/applications/{app.id}/letters/new?type={value}"
                class="w-full px-3 py-2 text-sm text-left flex items-center gap-2 hover:bg-[var(--dash-bg)] transition-colors text-[var(--dash-text)]"
                onclick={() => (showAddMenu = false)}
              >
                <FontAwesomeIcon icon={faEnvelope} class="w-3.5 h-3.5 opacity-50" />
                {label}
              </a>
            {/each}
            <div class="border-t border-[var(--dash-border)] my-1"></div>
            <button
              type="button"
              onclick={() => { showAddQuestion = true; showAddMenu = false; }}
              class="w-full px-3 py-2 text-sm text-left flex items-center gap-2 hover:bg-[var(--dash-bg)] transition-colors text-[var(--dash-text)]"
            >
              <FontAwesomeIcon icon={faQuestionCircle} class="w-3.5 h-3.5 opacity-50" />
              Application Question
            </button>
          </div>
        {/if}
      </div>
    </div>
  {/if}

  <!-- Add Question Form -->
  {#if showAddQuestion}
    <div class="sm:bg-[var(--dash-card)] sm:rounded-lg sm:border sm:border-[var(--dash-border)] sm:p-4">
      <form method="POST" action="?/createQuestion" use:enhance={handleAddSubmit}>
        <h3 class="font-medium text-[var(--dash-text)] mb-3">Add Question</h3>
        <div class="space-y-3">
          <div>
            <label for="new-question" class="block text-sm text-[var(--dash-text-secondary)] mb-1">Question</label>
            <input
              type="text"
              id="new-question"
              name="question"
              bind:value={newQuestion}
              placeholder="e.g., Why do you want to work at our company?"
              required
              class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
            />
          </div>
          <div class="flex justify-end gap-2">
            <button
              type="button"
              onclick={() => (showAddQuestion = false)}
              class="px-4 py-2 border border-[var(--dash-border)] rounded-lg text-[var(--dash-text)] hover:bg-[var(--dash-bg)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="px-4 py-2 bg-[var(--dash-primary)] text-white rounded-lg hover:bg-[var(--dash-primary-hover)] transition-colors"
            >
              Add Question
            </button>
          </div>
        </div>
      </form>
    </div>
  {/if}

  <!-- Items List -->
  {#if items.length === 0 && !showAddQuestion}
    <div class="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div class="w-16 h-16 rounded-full bg-[var(--dash-bg)] flex items-center justify-center mb-4">
        <FontAwesomeIcon icon={faEnvelope} class="w-8 h-8 text-[var(--dash-text-muted)]" />
      </div>
      <h3 class="text-lg font-medium text-[var(--dash-text)] mb-2">No texts yet</h3>
      <p class="text-sm text-[var(--dash-text-secondary)] max-w-md mb-6">
        Add a cover letter or answer application questions to prepare your application.
      </p>
      <div class="relative inline-block" data-add-menu>
        <button
          type="button"
          onclick={() => (showAddMenu = !showAddMenu)}
          class="flex items-center gap-2 px-4 py-2 text-sm bg-[var(--dash-primary)] text-white rounded-lg hover:bg-[var(--dash-primary-hover)] transition-colors"
        >
          <FontAwesomeIcon icon={faPlus} class="w-3.5 h-3.5" />
          Add
        </button>
        {#if showAddMenu}
          <div class="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-20 bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-lg shadow-lg py-1 min-w-[220px]">
            {#each Object.entries(letterTypes) as [value, label]}
              <a
                href="/dashboard/applications/{app.id}/letters/new?type={value}"
                class="w-full px-3 py-2 text-sm text-left flex items-center gap-2 hover:bg-[var(--dash-bg)] transition-colors text-[var(--dash-text)]"
                onclick={() => (showAddMenu = false)}
              >
                <FontAwesomeIcon icon={faEnvelope} class="w-3.5 h-3.5 opacity-50" />
                {label}
              </a>
            {/each}
            <div class="border-t border-[var(--dash-border)] my-1"></div>
            <button
              type="button"
              onclick={() => { showAddQuestion = true; showAddMenu = false; }}
              class="w-full px-3 py-2 text-sm text-left flex items-center gap-2 hover:bg-[var(--dash-bg)] transition-colors text-[var(--dash-text)]"
            >
              <FontAwesomeIcon icon={faQuestionCircle} class="w-3.5 h-3.5 opacity-50" />
              Application Question
            </button>
          </div>
        {/if}
      </div>
    </div>
  {:else}
    <div class="space-y-3">
      {#each items as item (getItemId(item))}
        {@const itemId = getItemId(item)}
        {@const isLetter = item.itemType === "letter"}
        {@const hasAiChat = !!(item as QuestionItem).ai_chat}
        {@const hasContent = isLetter ? !!(item as LetterItem).content : !!(item as QuestionItem).answer}

        {#if isLetter}
          {@const letterItem = item as LetterItem}
          {@const versions = letterItem.letter_versions || []}
          {@const versionCount = versions.filter((v: { content: string | null }) => v.content).length}
          {@const firstContentVersion = versions.find((v: { content: string | null }) => v.content)}
          {@const isAiStarted = firstContentVersion
            ? firstContentVersion.source === "ai_generation"
            : !!letterItem.ai_chat}
          {@const latestContent = (() => {
            for (let i = versions.length - 1; i >= 0; i--) {
              if (versions[i].content) return versions[i].content;
            }
            return letterItem.content;
          })()}
          {@const isExpanded = expandedId === itemId}
          <!-- Letter Card: expandable with text preview -->
          <div class="overflow-hidden sm:bg-[var(--dash-card)] sm:rounded-lg sm:border sm:border-[var(--dash-border)]">
            <button
              type="button"
              onclick={() => toggleExpand(itemId)}
              class="w-full p-4 text-left {latestContent ? 'hover:bg-[var(--dash-bg)]' : ''} transition-colors"
              disabled={!latestContent}
            >
              <div class="flex items-center gap-4">
                <div class="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-[var(--dash-bg)]">
                  <FontAwesomeIcon icon={faEnvelope} class="w-5 h-5 text-blue-600" />
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 flex-wrap">
                    <h3 class="font-medium text-[var(--dash-text)] truncate">
                      {letterTypes[letterItem.letter_type] || letterItem.letter_type}
                    </h3>
                    <span
                      class="text-xs px-2 py-0.5 rounded-full capitalize {letterItem.status === 'ready'
                        ? 'bg-[var(--dash-success-light)] text-[var(--dash-success)]'
                        : letterItem.status === 'sent'
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                        : 'bg-[var(--dash-bg)] text-[var(--dash-text-muted)]'}"
                    >
                      {letterItem.status}
                    </span>
                  </div>
                  <p class="text-sm text-[var(--dash-text-secondary)]">
                    {formatDate(item.date_updated || item.date_created)}
                    {#if latestContent}
                      <span class="mx-1">&middot;</span>
                      <span class="inline-flex items-center gap-1">
                        <FontAwesomeIcon icon={isAiStarted ? faRobot : faPen} class="w-3 h-3" />
                        {isAiStarted ? "AI generated" : "Self-written"}
                      </span>
                      {#if versionCount > 1}
                        <span class="mx-1">&middot;</span>
                        <span>{versionCount} versions</span>
                      {/if}
                    {:else}
                      <span class="mx-1">&middot;</span>
                      <span class="text-[var(--dash-text-muted)] italic">No content yet</span>
                    {/if}
                  </p>
                </div>
                {#if latestContent}
                  <span class="inline-block transition-transform duration-200 {isExpanded ? 'rotate-90' : ''}">
                    <FontAwesomeIcon
                      icon={faChevronRight}
                      class="w-4 h-4 text-[var(--dash-text-secondary)] flex-shrink-0"
                    />
                  </span>
                {/if}
              </div>
            </button>

            {#if isExpanded && latestContent}
              <div class="border-t border-[var(--dash-border)] px-4 py-3">
                <p class="text-sm text-[var(--dash-text)] whitespace-pre-wrap line-clamp-8">{latestContent}</p>
              </div>
            {/if}

            <div class="border-t border-[var(--dash-border)] px-4 py-2 flex justify-end md:justify-start items-center gap-2">
              <a
                href="/dashboard/applications/{app.id}/letters/{item.id}"
                class="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-[var(--dash-primary)] text-white hover:bg-[var(--dash-primary-hover)] transition-colors whitespace-nowrap"
              >
                {letterItem.content ? "Edit" : "Write"}
                <FontAwesomeIcon icon={faArrowRight} class="w-3 h-3" />
              </a>
            </div>
          </div>
        {:else}
          <!-- Question Card: expandable with inline editing -->
          <div class="overflow-hidden sm:bg-[var(--dash-card)] sm:rounded-lg sm:border sm:border-[var(--dash-border)]">
            <!-- Header -->
            <button
              type="button"
              onclick={() => toggleExpand(itemId)}
              class="w-full flex items-center justify-between p-4 hover:bg-[var(--dash-bg)] transition-colors text-left"
            >
              <div class="flex items-center gap-4 flex-1 min-w-0">
                <div class="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-[var(--dash-bg)]">
                  <FontAwesomeIcon icon={faQuestionCircle} class="w-5 h-5 text-purple-600" />
                </div>
                <div class="flex-1 min-w-0">
                  <h3 class="font-medium text-[var(--dash-text)] truncate">
                    {(item as QuestionItem).question}
                  </h3>
                  <p class="text-sm text-[var(--dash-text-secondary)]">
                    {formatDate(item.date_updated || item.date_created)}
                    {#if (item as QuestionItem).answer}
                      <span class="mx-1">&middot;</span>
                      <span class="text-[var(--dash-success)]">Answered</span>
                    {/if}
                  </p>
                </div>
              </div>
              <span class="inline-block transition-transform duration-200 {expandedId === itemId ? 'rotate-90' : ''}">
                <FontAwesomeIcon
                  icon={faChevronRight}
                  class="w-4 h-4 text-[var(--dash-text-secondary)]"
                />
              </span>
            </button>

            <!-- Expanded Content -->
            {#if expandedId === itemId}
              <div class="border-t border-[var(--dash-border)] p-4">
                {#if editingId === itemId}
                  <!-- Edit Mode -->
                  <form method="POST" action="?/updateQuestion" use:enhance={handleEditSubmit}>
                    <input type="hidden" name="id" value={item.id} />
                    <div class="space-y-4">
                      <div>
                        <p class="text-sm font-medium text-[var(--dash-text)] mb-2">Question</p>
                        <p class="text-[var(--dash-text)] bg-[var(--dash-bg)] p-3 rounded-lg">{(item as QuestionItem).question}</p>
                      </div>
                      <div>
                        <label for="edit-answer-{item.id}" class="block text-sm font-medium text-[var(--dash-text)] mb-1">Answer</label>
                        <textarea
                          id="edit-answer-{item.id}"
                          name="answer"
                          bind:value={editAnswer}
                          rows={6}
                          class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent resize-y"
                        ></textarea>
                      </div>
                    </div>
                    <div class="flex items-center justify-between mt-4">
                      <button
                        type="button"
                        onclick={() => (deleteItem = { id: item.id, type: "question" })}
                        class="px-3 py-1.5 text-xs bg-red-500/10 border border-red-500/30 rounded-lg text-red-500 hover:bg-red-500/20 hover:border-red-500/50 hover:text-red-600 transition-colors flex items-center gap-1.5"
                      >
                        <FontAwesomeIcon icon={faTrash} class="w-3 h-3" />
                        Delete
                      </button>
                      <div class="flex gap-1.5">
                        <button type="button" onclick={cancelEdit} class="px-3 py-1.5 text-xs bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-lg text-[var(--dash-text-secondary)] hover:text-[var(--dash-text)] hover:border-[var(--dash-text-muted)] transition-colors flex items-center gap-1.5">
                          <FontAwesomeIcon icon={faXmark} class="w-3 h-3" />
                          Cancel
                        </button>
                        <button type="submit" class="px-3 py-1.5 text-xs bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-600 hover:bg-emerald-500/20 hover:border-emerald-500/50 hover:text-emerald-700 transition-colors flex items-center gap-1.5">
                          <FontAwesomeIcon icon={faCheck} class="w-3 h-3" />
                          Save
                        </button>
                      </div>
                    </div>
                  </form>
                {:else}
                  <!-- View Mode -->
                  <div class="space-y-4">
                    <div>
                      <p class="text-sm font-medium text-[var(--dash-text-secondary)] mb-1">Question</p>
                      <p class="text-[var(--dash-text)]">{(item as QuestionItem).question}</p>
                    </div>
                    {#if (item as QuestionItem).answer}
                      <div>
                        <p class="text-sm font-medium text-[var(--dash-text-secondary)] mb-1">Answer</p>
                        <p class="text-[var(--dash-text)] whitespace-pre-wrap">{(item as QuestionItem).answer}</p>
                      </div>
                    {:else}
                      <p class="text-[var(--dash-text-secondary)] italic">No answer yet. Write it manually or generate with AI.</p>
                    {/if}

                    <!-- Action Buttons -->
                    <div class="flex items-center justify-end gap-2 pt-2 border-t border-[var(--dash-border)]">
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
                        disabled={generatingIds.has(itemId)}
                        class="px-3 py-1.5 text-sm border border-[var(--dash-border)] rounded-lg text-[var(--dash-text)] hover:bg-[var(--dash-bg)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                      >
                        {#if generatingIds.has(itemId)}
                          <Spinner size="w-3.5 h-3.5" />
                        {:else}
                          <FontAwesomeIcon icon={faRobot} class="w-3.5 h-3.5" />
                        {/if}
                        {generatingIds.has(itemId) ? "Generating..." : hasAiChat ? "Regenerate" : "Generate"}
                      </button>
                    </div>
                  </div>
                {/if}
              </div>
            {/if}
          </div>
        {/if}
      {/each}
    </div>
  {/if}
</div>

<!-- Delete Confirmation Modal -->
<ConfirmModal
  isOpen={deleteItem !== null}
  title="Delete Question"
  message="Are you sure you want to delete this question? This action cannot be undone."
  onCancel={() => (deleteItem = null)}
  onConfirm={() => {
    if (deleteItem !== null) {
      const form = document.createElement("form");
      form.method = "POST";
      form.action = "?/deleteQuestion";
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
