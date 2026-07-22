<script lang="ts">
  import type { PageData } from "./$types";
  import { enhance } from "$app/forms";
  import { invalidateAll } from "$app/navigation";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faArrowLeft,
    faCheck,
    faRobot,
    faWandMagicSparkles,
    faXmark,
  } from "@fortawesome/free-solid-svg-icons";
  import Card from "../../../../../components/Card.svelte";
  import Spinner from "$lib/components/Spinner.svelte";
  import { renderSafeMarkdown } from "$lib/utils/safe-markdown";

  let { data }: { data: PageData } = $props();

  const appId = $derived(data.appId);
  const questionId = $derived(data.question.id);

  // Working copies. AI iteration mutates the draft; nothing is persisted until
  // the explicit Save.
  let questionText = $state(data.question.question ?? "");
  let draft = $state(data.question.answer ?? "");
  let savedQuestion = $state(data.question.question ?? "");
  let savedAnswer = $state(data.question.answer ?? "");

  let dirty = $derived(draft !== savedAnswer || questionText.trim() !== savedQuestion);

  // AI state
  let busy = $state<"generate" | "revise" | "review" | null>(null);
  let aiError = $state<string | null>(null);
  let instruction = $state("");
  // A candidate draft the user can accept or discard (from generate / refine).
  let suggestion = $state<{ label: string; text: string; source: "ai_generation" | "ai_revision" } | null>(null);
  // Review feedback (non-destructive) with an optional revision to apply.
  let review = $state<{ feedback: string; revisedText: string | null } | null>(null);
  // Provenance of the current draft, sent with Save so the version is attributed.
  let draftSource = $state<"manual_edit" | "ai_generation" | "ai_revision">("manual_edit");
  // Saved version trail; newest first for the history panel.
  let history = $derived([...(data.conversation ?? [])].reverse());

  const SOURCE_LABELS: Record<string, string> = {
    manual_edit: "Manual edit",
    ai_generation: "AI draft",
    ai_revision: "AI revision",
    ai_review: "AI review",
    ai_advice: "AI advice",
  };

  function formatDate(date: Date | string | null): string {
    if (!date) return "";
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  async function callAi(
    kind: "generate" | "revise" | "review",
    url: string,
    body: Record<string, unknown>,
  ): Promise<any | null> {
    busy = kind;
    aiError = null;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await res.json();
      if (!result.success) {
        aiError = result.message || "AI request failed";
        return null;
      }
      return result;
    } catch {
      aiError = "Network error. Please try again.";
      return null;
    } finally {
      busy = null;
    }
  }

  async function generateDraft() {
    const result = await callAi("generate", `/api/ai/questions/${questionId}/generate`, {
      commit: false,
    });
    if (result?.text) suggestion = { label: "Generated draft", text: result.text, source: "ai_generation" };
  }

  async function refine() {
    if (!draft.trim()) {
      aiError = "Write a draft to refine first.";
      return;
    }
    const result = await callAi("revise", `/api/ai/questions/${questionId}/revise`, {
      draft,
      instruction,
    });
    if (result?.revisedText) {
      suggestion = { label: instruction.trim() ? "Refined draft" : "Improved draft", text: result.revisedText, source: "ai_revision" };
      instruction = "";
    }
  }

  async function reviewDraft() {
    if (!draft.trim()) {
      aiError = "Write a draft to review first.";
      return;
    }
    // Review the live draft directly — non-destructive, no forced save.
    const result = await callAi("review", `/api/ai/questions/${questionId}/review`, { draft });
    if (result) review = { feedback: result.feedback, revisedText: result.revisedText };
  }

  function useSuggestion() {
    if (suggestion) {
      draft = suggestion.text;
      draftSource = suggestion.source;
    }
    suggestion = null;
  }

  function applyRevision() {
    if (review?.revisedText) {
      draft = review.revisedText;
      draftSource = "ai_revision";
    }
    review = null;
  }

  // Restoring an earlier version is a manual choice — attribute the next save
  // as a manual edit.
  function restoreVersion(content: string | null | undefined) {
    draft = content ?? "";
    draftSource = "manual_edit";
  }

  function handleSave() {
    return async (
      { result, update }: {
        result: { type: string };
        update: (opts?: { reset?: boolean }) => Promise<void>;
      },
    ) => {
      await update({ reset: false });
      if (result.type === "success") {
        savedAnswer = draft;
        savedQuestion = questionText.trim();
        draftSource = "manual_edit";
        await invalidateAll();
      }
    };
  }
</script>

<div class="max-w-3xl mx-auto space-y-6">
  <!-- Back -->
  <a
    href="/applications/{appId}/texts"
    class="inline-flex items-center gap-2 text-sm text-[var(--dash-text-secondary)] hover:text-[var(--dash-text)] transition-colors"
  >
    <FontAwesomeIcon icon={faArrowLeft} class="w-3.5 h-3.5" /> Back to texts
  </a>

  {#if aiError}
    <div class="bg-[var(--dash-error-light)] border border-[var(--dash-error)] rounded-lg p-4">
      <p class="text-[var(--dash-error)] text-sm">{aiError}</p>
    </div>
  {/if}

  <!-- Question -->
  <Card padding="md">
    <label for="q-text" class="block text-sm font-medium text-[var(--dash-text-secondary)] mb-1">Question</label>
    <input
      id="q-text"
      type="text"
      bind:value={questionText}
      class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
    />
  </Card>

  <!-- Draft editor -->
  <Card padding="md">
    <div class="flex items-center justify-between mb-2">
      <label for="draft" class="text-sm font-medium text-[var(--dash-text-secondary)]">Your answer</label>
      {#if dirty}
        <span class="text-xs text-[var(--dash-warning)]">Unsaved changes</span>
      {:else}
        <span class="text-xs text-[var(--dash-text-muted)]">Saved</span>
      {/if}
    </div>
    <textarea
      id="draft"
      bind:value={draft}
      oninput={() => (draftSource = "manual_edit")}
      rows={10}
      placeholder="Write your answer, or start with 'Draft with AI' below."
      class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent resize-y"
    ></textarea>

    <!-- AI candidate (from generate / refine) -->
    {#if suggestion}
      <div class="mt-3 rounded-lg border border-[var(--dash-border)] bg-[var(--dash-info-light)] p-3">
        <div class="flex items-center justify-between mb-2">
          <span class="text-sm font-medium text-[var(--dash-info)] flex items-center gap-1.5">
            <FontAwesomeIcon icon={faWandMagicSparkles} class="w-3.5 h-3.5" /> {suggestion.label}
          </span>
          <button
            type="button"
            onclick={() => (suggestion = null)}
            aria-label="Discard"
            class="p-1 text-[var(--dash-text-secondary)] hover:text-[var(--dash-text)] transition-colors"
          >
            <FontAwesomeIcon icon={faXmark} class="w-3.5 h-3.5" />
          </button>
        </div>
        <p class="text-sm text-[var(--dash-text)] whitespace-pre-wrap">{suggestion.text}</p>
        <button
          type="button"
          onclick={useSuggestion}
          class="mt-3 px-3 py-1.5 text-sm bg-[var(--dash-primary)] text-white rounded-lg hover:bg-[var(--dash-primary-hover)] transition-colors flex items-center gap-1.5"
        >
          <FontAwesomeIcon icon={faCheck} class="w-3.5 h-3.5" /> Use as draft
        </button>
      </div>
    {/if}

    <!-- AI review feedback -->
    {#if review}
      <div class="mt-3 rounded-lg border border-[var(--dash-border)] bg-[var(--dash-primary-light)] p-3">
        <div class="flex items-center justify-between mb-2">
          <span class="text-sm font-medium text-[var(--dash-primary)] flex items-center gap-1.5">
            <FontAwesomeIcon icon={faRobot} class="w-3.5 h-3.5" /> AI review
          </span>
          <button
            type="button"
            onclick={() => (review = null)}
            aria-label="Dismiss review"
            class="p-1 text-[var(--dash-text-secondary)] hover:text-[var(--dash-text)] transition-colors"
          >
            <FontAwesomeIcon icon={faXmark} class="w-3.5 h-3.5" />
          </button>
        </div>
        <div class="ai-feedback text-sm text-[var(--dash-text)]">{@html renderSafeMarkdown(review.feedback)}</div>
        {#if review.revisedText}
          <button
            type="button"
            onclick={applyRevision}
            class="mt-3 px-3 py-1.5 text-sm bg-[var(--dash-primary)] text-white rounded-lg hover:bg-[var(--dash-primary-hover)] transition-colors flex items-center gap-1.5"
          >
            <FontAwesomeIcon icon={faCheck} class="w-3.5 h-3.5" /> Apply revision
          </button>
        {/if}
      </div>
    {/if}
  </Card>

  <!-- AI toolbar -->
  <Card padding="md">
    <p class="text-sm font-medium text-[var(--dash-text-secondary)] mb-3">Iterate with AI</p>
    <div class="flex flex-wrap gap-2 mb-3">
      <button
        type="button"
        onclick={generateDraft}
        disabled={busy !== null}
        class="px-3 py-1.5 text-sm border border-[var(--dash-border)] rounded-lg text-[var(--dash-text)] hover:bg-[var(--dash-bg)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
      >
        {#if busy === "generate"}<Spinner size="w-3.5 h-3.5" />{:else}<FontAwesomeIcon icon={faWandMagicSparkles} class="w-3.5 h-3.5" />{/if}
        Draft with AI
      </button>
      <button
        type="button"
        onclick={reviewDraft}
        disabled={busy !== null || !draft.trim()}
        class="px-3 py-1.5 text-sm border border-[var(--dash-border)] rounded-lg text-[var(--dash-text)] hover:bg-[var(--dash-bg)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
      >
        {#if busy === "review"}<Spinner size="w-3.5 h-3.5" />{:else}<FontAwesomeIcon icon={faRobot} class="w-3.5 h-3.5" />{/if}
        Review
      </button>
    </div>
    <div class="flex gap-2">
      <input
        type="text"
        bind:value={instruction}
        placeholder="Tell the AI how to refine it — e.g. 'make it more concise'"
        onkeydown={(e) => { if (e.key === "Enter") { e.preventDefault(); refine(); } }}
        class="flex-1 px-3 py-2 text-sm border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
      />
      <button
        type="button"
        onclick={refine}
        disabled={busy !== null || !draft.trim()}
        class="px-3 py-2 text-sm bg-[var(--dash-primary)] text-white rounded-lg hover:bg-[var(--dash-primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 whitespace-nowrap"
      >
        {#if busy === "revise"}<Spinner size="w-3.5 h-3.5" />{:else}<FontAwesomeIcon icon={faWandMagicSparkles} class="w-3.5 h-3.5" />{/if}
        Refine
      </button>
    </div>
  </Card>

  <!-- Commit -->
  <form method="POST" action="?/save" use:enhance={handleSave} class="flex items-center justify-end gap-3">
    <input type="hidden" name="answer" value={draft} />
    <input type="hidden" name="question" value={questionText} />
    <input type="hidden" name="source" value={draftSource} />
    <button
      type="submit"
      disabled={!dirty || !questionText.trim()}
      class="px-5 py-2 bg-[var(--dash-primary)] text-white rounded-lg hover:bg-[var(--dash-primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
    >
      <FontAwesomeIcon icon={faCheck} class="w-4 h-4" /> Save answer
    </button>
  </form>

  <!-- Version history -->
  {#if history.length > 0}
    <Card padding="md">
      <p class="text-sm font-medium text-[var(--dash-text-secondary)] mb-3">
        History <span class="text-[var(--dash-text-muted)]">({history.length})</span>
      </p>
      <ul class="space-y-3">
        {#each history as entry, i (entry.versionId)}
          <li class="border border-[var(--dash-border)] rounded-lg p-3">
            <div class="flex items-center justify-between gap-2 mb-1">
              <span class="text-xs font-medium text-[var(--dash-text)] flex items-center gap-1.5">
                {#if entry.type !== "manual_edit"}
                  <FontAwesomeIcon icon={faRobot} class="w-3 h-3 text-[var(--dash-primary)]" />
                {/if}
                {SOURCE_LABELS[entry.type] ?? entry.type}
                {#if i === 0}<span class="text-[var(--dash-text-muted)] font-normal">· current</span>{/if}
              </span>
              <span class="text-xs text-[var(--dash-text-muted)]">{formatDate(entry.date)}</span>
            </div>
            {#if entry.content}
              <p class="text-sm text-[var(--dash-text-secondary)] whitespace-pre-wrap line-clamp-3">{entry.content}</p>
            {/if}
            <div class="mt-2 flex justify-end">
              <button
                type="button"
                onclick={() => restoreVersion(entry.content)}
                disabled={draft === (entry.content ?? "")}
                class="px-2.5 py-1 text-xs border border-[var(--dash-border)] rounded-lg text-[var(--dash-text)] hover:bg-[var(--dash-bg)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Restore to draft
              </button>
            </div>
          </li>
        {/each}
      </ul>
      <p class="mt-3 text-xs text-[var(--dash-text-muted)]">
        Restoring loads that version into the draft above — save to make it the current answer.
      </p>
    </Card>
  {/if}
</div>
