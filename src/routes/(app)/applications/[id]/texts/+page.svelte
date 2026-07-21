<script lang="ts">
  import type { ActionData, PageData } from "./$types";
  import { enhance } from "$app/forms";
  import { invalidateAll } from "$app/navigation";
  import { renderSafeMarkdown } from "$lib/utils/safe-markdown";
  import { normalizeQuestion } from "$lib/utils/normalize-question";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faCheck,
    faChevronRight,
    faEnvelope,
    faLayerGroup,
    faPaste,
    faPen,
    faPencil,
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
  // AI review states (for questions only) — non-destructive feedback, keyed by item id
  let reviewingIds = $state<Set<string>>(new Set());
  let reviewResults = $state<Record<string, { feedback: string; revisedText: string | null }>>({});
  // Add form states
  let newQuestion = $state("");
  let newAnswer = $state("");
  let addWithReview = $state(false);

  // Paste-and-extract states
  type DupChoice = "skip" | "add" | "fill";
  type Pair = {
    question: string;
    answer: string;
    confidence: "high" | "low";
    // Explicit user decision when the question duplicates an existing one;
    // null means "use the default" (skip). Ignored when there's no match.
    choice: DupChoice | null;
  };
  let showPaste = $state(false);
  let pasteText = $state("");
  let extracting = $state(false);
  let extractError = $state<string | null>(null);
  let previewPairs = $state<Pair[] | null>(null);

  // Exact-match dedup: normalize away trivial differences (case, whitespace,
  // trailing punctuation) so "Why us?" and "why us" collide, but never fuzzy-
  // match — a wrong match would silently file an answer under the wrong
  // question, worse than a visible duplicate.
  function findExistingMatch(q: string) {
    const n = normalizeQuestion(q);
    if (!n) return undefined;
    return questions.find((eq) => normalizeQuestion(eq.question) === n);
  }
  // A pasted answer can fill an existing question only when that question has
  // no answer yet and the pasted pair actually carries one.
  function canFill(pair: Pair): boolean {
    const match = findExistingMatch(pair.question);
    return !!match && !match.answer?.trim() && !!pair.answer.trim();
  }
  function effectiveChoice(pair: Pair): DupChoice {
    const match = findExistingMatch(pair.question);
    if (!match) return "add";
    if (pair.choice === "add") return "add";
    if (pair.choice === "fill") return canFill(pair) ? "fill" : "skip";
    return "skip"; // duplicates are excluded by default
  }

  // What actually gets sent on save, split by action.
  let saveAdds = $derived(
    (previewPairs ?? [])
      .filter((p) => effectiveChoice(p) === "add")
      .map((p) => ({ question: p.question, answer: p.answer })),
  );
  let saveFills = $derived(
    (previewPairs ?? [])
      .filter((p) => effectiveChoice(p) === "fill")
      .map((p) => {
        const match = findExistingMatch(p.question);
        return match ? { id: match.id, answer: p.answer } : null;
      })
      .filter((f): f is { id: number; answer: string } => f !== null),
  );
  let skipCount = $derived((previewPairs?.length ?? 0) - saveAdds.length - saveFills.length);

  let canSavePairs = $derived.by(() => {
    if (!previewPairs || previewPairs.length === 0) return false;
    // Every row that will be inserted needs a question (NOT NULL guard).
    for (const p of previewPairs) {
      if (effectiveChoice(p) === "add" && !p.question.trim()) return false;
    }
    return saveAdds.length > 0 || saveFills.length > 0;
  });

  let saveLabel = $derived.by(() => {
    const parts: string[] = [];
    if (saveAdds.length) parts.push(`Add ${saveAdds.length}`);
    if (saveFills.length) parts.push(`fill ${saveFills.length}`);
    if (parts.length === 0) return "Nothing to save";
    let label = parts.join(" · ");
    if (skipCount) label += ` · skip ${skipCount}`;
    return label;
  });

  function openPaste() {
    showPaste = true;
    showAddMenu = false;
    showAddQuestion = false;
    pasteText = "";
    previewPairs = null;
    extractError = null;
  }

  function cancelPaste() {
    showPaste = false;
    pasteText = "";
    previewPairs = null;
    extractError = null;
  }

  async function runExtract() {
    if (!pasteText.trim()) return;
    extracting = true;
    extractError = null;
    try {
      const response = await fetch("/api/ai/questions/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: pasteText }),
      });
      const result = await response.json();
      if (!result.success) {
        extractError = result.message || "Extraction failed";
        return;
      }
      if (!result.pairs?.length) {
        extractError = "No questions and answers found in that text.";
        return;
      }
      previewPairs = (result.pairs as Omit<Pair, "choice">[]).map((p) => ({ ...p, choice: null }));
    } catch {
      extractError = "Network error. Please try again.";
    } finally {
      extracting = false;
    }
  }

  function addPair() {
    previewPairs = [...(previewPairs ?? []), { question: "", answer: "", confidence: "high", choice: null }];
  }

  function removePair(index: number) {
    if (!previewPairs) return;
    previewPairs = previewPairs.filter((_, i) => i !== index);
  }

  function handleSavePairs() {
    return async ({ result, update }: { result: { type: string }; update: () => Promise<void> }) => {
      await update();
      if (result.type === "success") {
        cancelPaste();
      }
    };
  }

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
    cheat_sheet: "Interview Cheat Sheet",
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
    return async (
      { result, update }: {
        result: { type: string; data?: { questionId?: number } };
        update: () => Promise<void>;
      },
    ) => {
      const wantReview = addWithReview;
      await update();
      if (result.type === "success") {
        const qid = result.data?.questionId;
        showAddQuestion = false;
        newQuestion = "";
        newAnswer = "";
        addWithReview = false;
        // "Add & review" saves the question, then kicks off a review of the
        // just-saved answer so the user doesn't have to find and expand the card.
        if (wantReview && qid) {
          reviewAnswer({ id: qid, itemType: "question" } as Item);
        }
      } else {
        addWithReview = false;
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

  async function reviewAnswer(item: Item) {
    const itemId = getItemId(item);
    generatingIds.delete(itemId);
    reviewingIds.add(itemId);
    reviewingIds = new Set(reviewingIds);
    aiError = null;
    expandedId = itemId;

    try {
      const response = await fetch(`/api/ai/questions/${item.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const result = await response.json();
      if (!result.success) {
        aiError = result.message || "Review failed";
        return;
      }
      reviewResults = {
        ...reviewResults,
        [itemId]: { feedback: result.feedback, revisedText: result.revisedText },
      };
    } catch {
      aiError = "Network error. Please try again.";
    } finally {
      reviewingIds.delete(itemId);
      reviewingIds = new Set(reviewingIds);
    }
  }

  function dismissReview(itemId: string) {
    const { [itemId]: _removed, ...rest } = reviewResults;
    reviewResults = rest;
  }

  // Load the AI's revised text into the edit textarea so the user reviews and
  // saves it themselves — never overwrite their answer without confirmation.
  function applyRevision(item: Item, revised: string) {
    startEdit(item);
    editAnswer = revised;
    dismissReview(getItemId(item));
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

  <!-- Header with title, filter + add button -->
  <div class="flex items-center justify-between flex-wrap gap-3">
    <div class="flex items-center gap-3">
      <FontAwesomeIcon icon={faEnvelope} class="w-7 h-7 text-[var(--dash-primary)]" />
      <h2 class="text-2xl font-bold text-[var(--dash-text)]">Texts</h2>
      {#if letters.length > 0 && questions.length > 0}
        <FilterTabs filters={typeFilters} value={currentType} onchange={(v) => (currentType = v)} />
      {/if}
    </div>
    {#if letters.length > 0 || questions.length > 0}
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
                href="/applications/{app.id}/texts/new?type={value}"
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
            <button
              type="button"
              onclick={openPaste}
              class="w-full px-3 py-2 text-sm text-left flex items-center gap-2 hover:bg-[var(--dash-bg)] transition-colors text-[var(--dash-text)]"
            >
              <FontAwesomeIcon icon={faPaste} class="w-3.5 h-3.5 opacity-50" />
              Paste answers
            </button>
          </div>
        {/if}
      </div>
    {/if}
  </div>

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
          <div>
            <label for="new-answer" class="block text-sm text-[var(--dash-text-secondary)] mb-1">
              Answer <span class="text-[var(--dash-text-muted)]">(optional)</span>
            </label>
            <textarea
              id="new-answer"
              name="answer"
              bind:value={newAnswer}
              rows={4}
              placeholder="Write your answer now, or leave blank and come back to it."
              class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent resize-y"
            ></textarea>
          </div>
          <div class="flex justify-end gap-2 flex-wrap">
            <button
              type="button"
              onclick={() => { showAddQuestion = false; newAnswer = ""; }}
              class="px-4 py-2 border border-[var(--dash-border)] rounded-lg text-[var(--dash-text)] hover:bg-[var(--dash-bg)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              onclick={() => (addWithReview = false)}
              class="px-4 py-2 bg-[var(--dash-primary)] text-white rounded-lg hover:bg-[var(--dash-primary-hover)] transition-colors"
            >
              Add Question
            </button>
            <button
              type="submit"
              onclick={() => (addWithReview = true)}
              disabled={!newAnswer.trim()}
              title={newAnswer.trim() ? "" : "Write an answer to review it with AI"}
              class="px-4 py-2 border border-[var(--dash-primary)] text-[var(--dash-primary)] rounded-lg hover:bg-[var(--dash-primary-light)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <FontAwesomeIcon icon={faRobot} class="w-4 h-4" />
              Add &amp; review
            </button>
          </div>
        </div>
      </form>
    </Card>
  {/if}

  <!-- Paste & Extract Panel -->
  {#if showPaste}
    <Card padding="md">
      {#if !previewPairs}
        <!-- Step 1: paste the blob -->
        <div class="flex items-center gap-2 mb-3">
          <FontAwesomeIcon icon={faPaste} class="w-4 h-4 text-[var(--dash-primary)]" />
          <h3 class="font-medium text-[var(--dash-text)]">Paste answers</h3>
        </div>
        <p class="text-sm text-[var(--dash-text-secondary)] mb-3">
          Paste text that already contains your questions and answers. AI will split it into
          separate question/answer pairs for you to review before they're added.
        </p>
        <textarea
          bind:value={pasteText}
          rows={10}
          placeholder="Paste your questions and answers here…"
          class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent resize-y"
        ></textarea>
        {#if extractError}
          <p class="text-sm text-[var(--dash-error)] mt-2">{extractError}</p>
        {/if}
        <div class="flex justify-end gap-2 mt-3">
          <button
            type="button"
            onclick={cancelPaste}
            class="px-4 py-2 border border-[var(--dash-border)] rounded-lg text-[var(--dash-text)] hover:bg-[var(--dash-bg)] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onclick={runExtract}
            disabled={extracting || !pasteText.trim()}
            class="px-4 py-2 bg-[var(--dash-primary)] text-white rounded-lg hover:bg-[var(--dash-primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {#if extracting}
              <Spinner size="w-4 h-4" />
            {:else}
              <FontAwesomeIcon icon={faRobot} class="w-4 h-4" />
            {/if}
            {extracting ? "Extracting…" : "Extract with AI"}
          </button>
        </div>
      {:else}
        <!-- Step 2: editable preview -->
        <div class="flex items-center justify-between mb-1">
          <div class="flex items-center gap-2">
            <FontAwesomeIcon icon={faQuestionCircle} class="w-4 h-4 text-[var(--dash-primary)]" />
            <h3 class="font-medium text-[var(--dash-text)]">Review extracted questions</h3>
          </div>
          <span class="text-sm text-[var(--dash-text-secondary)]">{previewPairs.length} found</span>
        </div>
        <p class="text-sm text-[var(--dash-text-secondary)] mb-4">
          Edit anything that looks off. Pairs marked <span class="text-[var(--dash-warning)]">needs review</span>
          had an unclear split. Questions <span class="text-[var(--dash-info)]">already added</span> to this
          application are skipped by default — you can add them anyway or use a pasted answer to fill an empty one.
        </p>
        <div class="space-y-4">
          {#each previewPairs as pair, i (i)}
            {@const match = findExistingMatch(pair.question)}
            {@const eff = effectiveChoice(pair)}
            <div class="border border-[var(--dash-border)] rounded-lg p-3 space-y-2 {eff === 'skip' ? 'opacity-60' : ''}">
              <div class="flex items-center justify-between">
                <span class="text-xs text-[var(--dash-text-muted)]">#{i + 1}</span>
                <div class="flex items-center gap-2">
                  {#if match}
                    <span class="text-xs px-2 py-0.5 rounded-full bg-[var(--dash-info-light)] text-[var(--dash-info)]">
                      already added
                    </span>
                  {/if}
                  {#if pair.confidence === "low"}
                    <span class="text-xs px-2 py-0.5 rounded-full bg-[var(--dash-warning-light)] text-[var(--dash-warning)]">
                      needs review
                    </span>
                  {/if}
                  <button
                    type="button"
                    onclick={() => removePair(i)}
                    aria-label="Remove pair"
                    class="p-1 text-[var(--dash-text-secondary)] hover:text-red-500 transition-colors"
                  >
                    <FontAwesomeIcon icon={faTrash} class="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div>
                <label class="block text-xs font-medium text-[var(--dash-text-secondary)] mb-1" for="pair-q-{i}">Question</label>
                <input
                  id="pair-q-{i}"
                  type="text"
                  bind:value={pair.question}
                  placeholder="Enter the question…"
                  class="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent {pair.question.trim() ? 'border-[var(--dash-border)]' : 'border-[var(--dash-warning)]'}"
                />
              </div>
              <div>
                <label class="block text-xs font-medium text-[var(--dash-text-secondary)] mb-1" for="pair-a-{i}">Answer</label>
                <textarea
                  id="pair-a-{i}"
                  bind:value={pair.answer}
                  rows={4}
                  class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent resize-y"
                ></textarea>
              </div>
              {#if match}
                <div class="rounded-md bg-[var(--dash-bg)] p-2 text-xs space-y-2">
                  <p class="text-[var(--dash-text-secondary)]">
                    Already on this application{match.answer?.trim() ? " with an answer" : " (no answer yet)"}.
                  </p>
                  <div class="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onclick={() => (pair.choice = "skip")}
                      class="px-2 py-1 rounded border transition-colors {eff === 'skip' ? 'border-[var(--dash-primary)] bg-[var(--dash-primary-light)] text-[var(--dash-primary)]' : 'border-[var(--dash-border)] text-[var(--dash-text-secondary)] hover:bg-[var(--dash-bg-hover)]'}"
                    >
                      Skip
                    </button>
                    <button
                      type="button"
                      onclick={() => (pair.choice = "add")}
                      class="px-2 py-1 rounded border transition-colors {eff === 'add' ? 'border-[var(--dash-primary)] bg-[var(--dash-primary-light)] text-[var(--dash-primary)]' : 'border-[var(--dash-border)] text-[var(--dash-text-secondary)] hover:bg-[var(--dash-bg-hover)]'}"
                    >
                      Add anyway
                    </button>
                    {#if canFill(pair)}
                      <button
                        type="button"
                        onclick={() => (pair.choice = "fill")}
                        class="px-2 py-1 rounded border transition-colors {eff === 'fill' ? 'border-[var(--dash-primary)] bg-[var(--dash-primary-light)] text-[var(--dash-primary)]' : 'border-[var(--dash-border)] text-[var(--dash-text-secondary)] hover:bg-[var(--dash-bg-hover)]'}"
                      >
                        Fill in existing answer
                      </button>
                    {/if}
                  </div>
                </div>
              {/if}
            </div>
          {/each}
        </div>
        <button
          type="button"
          onclick={addPair}
          class="mt-3 text-sm text-[var(--dash-primary)] hover:underline flex items-center gap-1.5"
        >
          <FontAwesomeIcon icon={faPlus} class="w-3 h-3" /> Add another
        </button>
        <form
          method="POST"
          action="?/createQuestions"
          use:enhance={handleSavePairs}
          class="flex items-center justify-between mt-4 pt-4 border-t border-[var(--dash-border)]"
        >
          <input type="hidden" name="questions" value={JSON.stringify(saveAdds)} />
          <input type="hidden" name="fills" value={JSON.stringify(saveFills)} />
          <button
            type="button"
            onclick={cancelPaste}
            class="px-4 py-2 border border-[var(--dash-border)] rounded-lg text-[var(--dash-text)] hover:bg-[var(--dash-bg)] transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSavePairs}
            class="px-4 py-2 bg-[var(--dash-primary)] text-white rounded-lg hover:bg-[var(--dash-primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <FontAwesomeIcon icon={faCheck} class="w-4 h-4" />
            {saveLabel}
          </button>
        </form>
      {/if}
    </Card>
  {/if}

  <!-- Items List -->
  {#if items.length === 0 && !showAddQuestion && !showPaste}
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
                href="/applications/{app.id}/texts/new?type={value}"
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
            <button
              type="button"
              onclick={openPaste}
              class="w-full px-3 py-2 text-sm text-left flex items-center gap-2 hover:bg-[var(--dash-bg)] transition-colors text-[var(--dash-text)]"
            >
              <FontAwesomeIcon icon={faPaste} class="w-3.5 h-3.5 opacity-50" />
              Paste answers
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
        {@const hasAiChat = !!(item as QuestionItem).ai_chat_id}
        {@const hasContent = isLetter ? !!(item as LetterItem).content : !!(item as QuestionItem).answer}

        {#if isLetter}
          {@const letterItem = item as LetterItem}
          {@const versions = letterItem.letter_versions || []}
          {@const versionCount = versions.filter((v: { content: string | null }) => v.content).length}
          {@const firstContentVersion = versions.find((v: { content: string | null }) => v.content)}
          {@const isAiStarted = firstContentVersion
            ? firstContentVersion.source === "ai_generation"
            : !!letterItem.ai_chat_id}
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
                        {isAiStarted ? "AI assisted" : "Self-written"}
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
                <div class="flex items-center gap-1 flex-shrink-0">
                  <a
                    href="/applications/{app.id}/texts/{item.id}"
                    class="p-1.5 text-[var(--dash-text-secondary)] hover:text-[var(--dash-primary)] transition-colors cursor-pointer"
                    aria-label="Edit"
                    onclick={(e) => e.stopPropagation()}
                  >
                    <FontAwesomeIcon icon={faPencil} class="w-4 h-4" />
                  </a>
                  {#if latestContent}
                    <span class="inline-block transition-transform duration-200 {isExpanded ? 'rotate-90' : ''}">
                      <FontAwesomeIcon
                        icon={faChevronRight}
                        class="w-4 h-4 text-[var(--dash-text-secondary)]"
                      />
                    </span>
                  {/if}
                </div>
              </div>
            </button>

            {#if isExpanded && latestContent}
              <div class="border-t border-[var(--dash-border)] px-4 py-3">
                <p class="text-sm text-[var(--dash-text)] whitespace-pre-wrap line-clamp-8">{latestContent}</p>
              </div>
            {/if}
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
              <div class="flex items-center gap-1 flex-shrink-0">
                <span
                  role="button"
                  tabindex="0"
                  onclick={(e) => { e.stopPropagation(); startEdit(item); }}
                  onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); startEdit(item); } }}
                  class="p-1.5 text-[var(--dash-text-secondary)] hover:text-[var(--dash-primary)] transition-colors cursor-pointer"
                  aria-label="Edit"
                >
                  <FontAwesomeIcon icon={faPencil} class="w-4 h-4" />
                </span>
                <span class="inline-block transition-transform duration-200 {expandedId === itemId ? 'rotate-90' : ''}">
                  <FontAwesomeIcon
                    icon={faChevronRight}
                    class="w-4 h-4 text-[var(--dash-text-secondary)]"
                  />
                </span>
              </div>
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

                    <!-- AI review feedback -->
                    {#if reviewResults[itemId]}
                      {@const rev = reviewResults[itemId]!}
                      <div class="rounded-lg border border-[var(--dash-border)] bg-[var(--dash-primary-light)] p-3">
                        <div class="flex items-center justify-between mb-2">
                          <span class="text-sm font-medium text-[var(--dash-primary)] flex items-center gap-1.5">
                            <FontAwesomeIcon icon={faRobot} class="w-3.5 h-3.5" /> AI review
                          </span>
                          <button
                            type="button"
                            onclick={() => dismissReview(itemId)}
                            aria-label="Dismiss review"
                            class="p-1 text-[var(--dash-text-secondary)] hover:text-[var(--dash-text)] transition-colors"
                          >
                            <FontAwesomeIcon icon={faXmark} class="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div class="ai-feedback text-sm text-[var(--dash-text)]">{@html renderSafeMarkdown(rev.feedback)}</div>
                        {#if rev.revisedText}
                          <button
                            type="button"
                            onclick={() => applyRevision(item, rev.revisedText!)}
                            class="mt-3 px-3 py-1.5 text-sm bg-[var(--dash-primary)] text-white rounded-lg hover:bg-[var(--dash-primary-hover)] transition-colors flex items-center gap-1.5"
                          >
                            <FontAwesomeIcon icon={faCheck} class="w-3.5 h-3.5" /> Apply suggestion
                          </button>
                        {/if}
                      </div>
                    {/if}

                    <!-- Action Buttons -->
                    <div class="flex items-center justify-end gap-2 pt-2 border-t border-[var(--dash-border)]">
                      {#if (item as QuestionItem).answer}
                        <button
                          type="button"
                          onclick={() => reviewAnswer(item)}
                          disabled={reviewingIds.has(itemId)}
                          class="px-3 py-1.5 text-sm border border-[var(--dash-border)] rounded-lg text-[var(--dash-text)] hover:bg-[var(--dash-bg)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                        >
                          {#if reviewingIds.has(itemId)}
                            <Spinner size="w-3.5 h-3.5" />
                          {:else}
                            <FontAwesomeIcon icon={faRobot} class="w-3.5 h-3.5" />
                          {/if}
                          {reviewingIds.has(itemId) ? "Reviewing…" : "Review"}
                        </button>
                      {/if}
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
