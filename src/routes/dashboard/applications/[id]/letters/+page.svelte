<script lang="ts">
  import type { ActionData, PageData } from "./$types";
  import { enhance } from "$app/forms";
  import { invalidateAll } from "$app/navigation";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faArrowRight,
    faCheck,
    faChevronDown,
    faChevronUp,
    faEnvelope,
    faPen,
    faPlus,
    faQuestionCircle,
    faRobot,
    faTimes,
    faTrash,
    faXmark,
  } from "@fortawesome/free-solid-svg-icons";
  import Card from "../../../components/Card.svelte";
  import Spinner from "$lib/components/Spinner.svelte";
  import EmptyState from "../../../profile/components/EmptyState.svelte";
  import ConfirmModal from "../../../profile/components/ConfirmModal.svelte";

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let app = $derived(data.application);
  let letters = $derived(app.application_letters || []);
  let questions = $derived(app.application_questions || []);

  let currentType = $state("all");
  let expandedId = $state<string | null>(null);
  let editingId = $state<string | null>(null);
  let deleteItem = $state<{ id: number; type: "letter" | "question" } | null>(null);
  let showAddLetter = $state(false);
  let showAddQuestion = $state(false);

  // Edit states (for questions only)
  let editAnswer = $state("");

  // AI generation states (for questions only)
  let generatingIds = $state<Set<string>>(new Set());
  let aiError = $state<string | null>(null);
  let followupText = $state<Record<string, string>>({});
  let followupIncludeContext = $state<Record<string, boolean>>({});
  let showFollowup = $state<Record<string, boolean>>({});

  // Add form states
  let newLetterType = $state("cover_letter");
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
    motivation_letter: "Motivation Letter",
    follow_up: "Follow-up",
    thank_you: "Thank You",
  };

  const typeFilters = [
    { value: "all", label: "All" },
    { value: "letters", label: "Letters" },
    { value: "questions", label: "Questions" },
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
        showAddLetter = false;
        showAddQuestion = false;
        newLetterType = "cover_letter";
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

  async function sendFollowup(item: Item) {
    const itemId = getItemId(item);
    const text = followupText[itemId]?.trim();
    if (!text) return;

    const url = `/api/ai/questions/${item.id}/followup`;

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
  {#if form?.error || aiError}
    <div class="bg-[var(--dash-error-light)] border border-[var(--dash-error)] rounded-lg p-4">
      <p class="text-[var(--dash-error)] text-sm">{form?.error || aiError}</p>
    </div>
  {/if}

  <!-- Header with Add buttons (only shown when there are items) -->
  {#if letters.length > 0 || questions.length > 0}
    <div class="flex items-center justify-between flex-wrap gap-3">
      {#if letters.length > 0 && questions.length > 0}
        <div class="flex flex-wrap gap-2">
          {#each typeFilters as filter}
            <button
              type="button"
              onclick={() => (currentType = filter.value)}
              class="px-3 py-1.5 text-sm rounded-lg transition-colors {currentType === filter.value
                ? 'bg-[var(--dash-primary)] text-white'
                : 'bg-[var(--dash-card)] border border-[var(--dash-border)] text-[var(--dash-text)] hover:bg-[var(--dash-bg)]'}"
            >
              {filter.label}
            </button>
          {/each}
        </div>
      {:else}
        <div></div>
      {/if}

      <div class="flex gap-2">
        <button
          type="button"
          onclick={() => { showAddLetter = true; showAddQuestion = false; }}
          class="flex items-center gap-2 px-3 py-1.5 text-sm bg-[var(--dash-primary)] text-white rounded-lg hover:bg-[var(--dash-primary-hover)] transition-colors"
        >
          <FontAwesomeIcon icon={faPlus} class="w-3 h-3" />
          Letter
        </button>
        <button
          type="button"
          onclick={() => { showAddQuestion = true; showAddLetter = false; }}
          class="flex items-center gap-2 px-3 py-1.5 text-sm border border-[var(--dash-border)] text-[var(--dash-text)] rounded-lg hover:bg-[var(--dash-bg)] transition-colors"
        >
          <FontAwesomeIcon icon={faPlus} class="w-3 h-3" />
          Question
        </button>
      </div>
    </div>
  {/if}

  <!-- Add Letter Form -->
  {#if showAddLetter}
    <Card padding="md">
      <h3 class="font-medium text-[var(--dash-text)] mb-3">Add Letter</h3>
      <div class="space-y-3">
        <div>
          <p class="text-sm text-[var(--dash-text-secondary)] mb-2">Letter Type</p>
          <div class="flex flex-wrap gap-2">
            {#each Object.entries(letterTypes) as [value, label]}
              <button
                type="button"
                onclick={() => (newLetterType = value)}
                class="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-full border transition-colors {newLetterType === value
                  ? 'border-[var(--dash-primary)] bg-[var(--dash-primary)]/10 text-[var(--dash-primary)]'
                  : 'border-[var(--dash-border)] text-[var(--dash-text-secondary)] hover:border-[var(--dash-text-muted)]'}"
              >
                <span class="w-3.5 h-3.5 rounded-full border flex items-center justify-center flex-shrink-0 {newLetterType === value
                  ? 'border-[var(--dash-primary)]'
                  : 'border-[var(--dash-border)]'}">
                  {#if newLetterType === value}
                    <span class="w-2 h-2 rounded-full bg-[var(--dash-primary)]"></span>
                  {/if}
                </span>
                {label}
              </button>
            {/each}
          </div>
        </div>
        <div class="flex justify-end gap-2">
          <button
            type="button"
            onclick={() => (showAddLetter = false)}
            class="px-4 py-2 border border-[var(--dash-border)] rounded-lg text-[var(--dash-text)] hover:bg-[var(--dash-bg)] transition-colors"
          >
            Cancel
          </button>
          <a
            href="/dashboard/applications/{app.id}/letters/new?type={newLetterType}"
            class="px-4 py-2 bg-[var(--dash-primary)] text-white rounded-lg hover:bg-[var(--dash-primary-hover)] transition-colors"
          >
            Add Letter
          </a>
        </div>
      </div>
    </Card>
  {/if}

  <!-- Add Question Form -->
  {#if showAddQuestion}
    <Card padding="md">
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
    </Card>
  {/if}

  <!-- Items List -->
  {#if items.length === 0 && !showAddLetter && !showAddQuestion}
    <div class="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div class="w-16 h-16 rounded-full bg-[var(--dash-bg)] flex items-center justify-center mb-4">
        <FontAwesomeIcon icon={faEnvelope} class="w-8 h-8 text-[var(--dash-text-muted)]" />
      </div>
      <h3 class="text-lg font-medium text-[var(--dash-text)] mb-2">No texts yet</h3>
      <p class="text-sm text-[var(--dash-text-secondary)] max-w-md mb-6">
        Add cover letters, motivation texts, or answer application questions to prepare your application.
      </p>
      <div class="flex gap-3">
        <button
          type="button"
          onclick={() => { showAddLetter = true; showAddQuestion = false; }}
          class="flex items-center gap-2 px-4 py-2 text-sm bg-[var(--dash-primary)] text-white rounded-lg hover:bg-[var(--dash-primary-hover)] transition-colors"
        >
          <FontAwesomeIcon icon={faPlus} class="w-3.5 h-3.5" />
          Add Letter
        </button>
        <button
          type="button"
          onclick={() => { showAddQuestion = true; showAddLetter = false; }}
          class="flex items-center gap-2 px-4 py-2 text-sm border border-[var(--dash-border)] text-[var(--dash-text)] rounded-lg hover:bg-[var(--dash-bg)] transition-colors"
        >
          <FontAwesomeIcon icon={faPlus} class="w-3.5 h-3.5" />
          Add Question
        </button>
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
          <Card class="overflow-hidden">
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
                  <FontAwesomeIcon
                    icon={isExpanded ? faChevronUp : faChevronDown}
                    class="w-4 h-4 text-[var(--dash-text-secondary)] flex-shrink-0"
                  />
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
          </Card>
        {:else}
          <!-- Question Card: expandable with inline editing -->
          <Card class="overflow-hidden">
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
                      {#if hasAiChat}
                        <button
                          type="button"
                          onclick={() => (showFollowup[itemId] = !showFollowup[itemId])}
                          disabled={generatingIds.has(itemId)}
                          class="px-3 py-1.5 text-sm border border-[var(--dash-border)] rounded-lg text-[var(--dash-text)] hover:bg-[var(--dash-bg)] transition-colors disabled:opacity-50"
                        >
                          Follow-up
                        </button>
                      {/if}
                    </div>

                    <!-- Follow-up Section -->
                    {#if showFollowup[itemId]}
                      <div class="pt-2 space-y-2">
                        <textarea
                          bind:value={followupText[itemId]}
                          placeholder="Ask AI to refine the answer..."
                          rows={3}
                          disabled={generatingIds.has(itemId)}
                          class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent text-sm resize-y disabled:opacity-50"
                        ></textarea>
                        <div class="flex items-center justify-between">
                          <label class="flex items-center gap-2 text-sm text-[var(--dash-text-secondary)]">
                            <input
                              type="checkbox"
                              bind:checked={followupIncludeContext[itemId]}
                              disabled={generatingIds.has(itemId)}
                              class="rounded"
                            />
                            Include original context
                          </label>
                          <button
                            type="button"
                            onclick={() => sendFollowup(item)}
                            disabled={generatingIds.has(itemId) || !followupText[itemId]?.trim()}
                            class="px-3 py-1.5 text-sm bg-[var(--dash-primary)] text-white rounded-lg hover:bg-[var(--dash-primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                          >
                            {#if generatingIds.has(itemId)}
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
