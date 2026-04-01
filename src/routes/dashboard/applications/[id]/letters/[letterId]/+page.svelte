<script lang="ts">
  import type { ActionData, PageData } from "./$types";
  import type { ConversationEntry } from "./+page.server";
  import { enhance } from "$app/forms";
  import { invalidateAll } from "$app/navigation";
  import { page } from "$app/stores";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faArrowLeft,
    faCheck,
    faComments,
    faPencil,
    faRobot,
    faTrash,
    faXmark,
  } from "@fortawesome/free-solid-svg-icons";
  import { marked } from "marked";
  import Card from "../../../../components/Card.svelte";
  import Spinner from "$lib/components/Spinner.svelte";
  import ConfirmModal from "../../../../profile/components/ConfirmModal.svelte";

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let letter = $derived(data.letter);
  let conversation = $derived(data.conversation);
  let appId = $derived($page.params.id);
  let showHistory = $state(false);
  let pageTop: HTMLElement;

  const letterTypes: Record<string, string> = {
    cover_letter: "Cover Letter",
    motivation_letter: "Motivation Letter",
    follow_up: "Follow-up",
    thank_you: "Thank You",
  };

  // Edit state
  let isEditing = $state(false);
  let editContent = $state(letter.content || "");
  let editStatus = $state(letter.status || "draft");

  // AI states
  let generating = $state(false);
  let generatingMode = $state<"generate" | "advice" | "followup" | "review" | null>(null);
  let aiError = $state<string | null>(null);
  let feedbackText = $state("");

  // Delete
  let showDeleteConfirm = $state(false);

  function startEdit() {
    editContent = letter.content || "";
    editStatus = letter.status || "draft";
    isEditing = true;
  }

  function cancelEdit() {
    isEditing = false;
  }

  function handleSave() {
    return async ({ result, update }: { result: { type: string }; update: () => Promise<void> }) => {
      await update();
      if (result.type === "success") {
        isEditing = false;
        scrollToTop();
      }
    };
  }

  // Save and then request AI review of the saved content
  function handleSaveAndReview() {
    return async ({ result, update }: { result: { type: string }; update: () => Promise<void> }) => {
      await update();
      if (result.type === "success") {
        isEditing = false;
        if (letter.ai_chat) {
          // Has existing chat — use followup
          await sendFollowup(
            "I've updated my letter. Please review my changes and give me concise feedback: what works well, what could be improved, and any specific suggestions.",
            true,
          );
        } else {
          // No chat yet — use the review generate mode
          await generateAi("review");
        }
      }
    };
  }

  async function generateAi(mode: "generate" | "advice" | "review" = "generate") {
    generating = true;
    generatingMode = mode;
    aiError = null;

    try {
      const response = await fetch(`/api/ai/letters/${letter.id}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      const result = await response.json();
      if (!result.success) {
        aiError = result.message || "Generation failed";
        return;
      }
      await invalidateAll();
      scrollToTop();
    } catch {
      aiError = "Network error. Please try again.";
    } finally {
      generating = false;
      generatingMode = null;
    }
  }

  async function sendFollowup(text: string, includeContext: boolean = true, updateContent: boolean = false) {
    if (!text.trim()) return;

    generating = true;
    generatingMode = "followup";
    aiError = null;

    try {
      const response = await fetch(`/api/ai/letters/${letter.id}/followup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          followupRequest: text,
          includeOriginalContext: includeContext,
          updateContent,
        }),
      });
      const result = await response.json();
      if (!result.success) {
        aiError = result.message || "Follow-up failed";
        return;
      }
      feedbackText = "";
      await invalidateAll();
      scrollToTop();
    } catch {
      aiError = "Network error. Please try again.";
    } finally {
      generating = false;
      generatingMode = null;
    }
  }

  function scrollToTop() {
    pageTop?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function formatDate(date: Date | string | null): string {
    if (!date) return "";
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  function entryLabel(entry: ConversationEntry): string {
    switch (entry.type) {
      case "generation": return "AI generated letter";
      case "advice": return "AI recommendations";
      case "review": return "AI review";
      case "feedback": return "AI revised letter";
      default: return "AI response";
    }
  }
</script>

<div class="space-y-6" bind:this={pageTop}>
  <!-- Back link -->
  <div>
    <a
      href="/dashboard/applications/{appId}/letters"
      class="flex items-center gap-2 text-[var(--dash-text-secondary)] hover:text-[var(--dash-primary)] transition-colors"
    >
      <FontAwesomeIcon icon={faArrowLeft} class="w-4 h-4" />
      <span class="text-sm">Back to Texts</span>
    </a>
  </div>

  <!-- Header -->
  <div class="flex items-center justify-between flex-wrap gap-3">
    <div>
      <h2 class="text-xl font-bold text-[var(--dash-text)]">
        {letterTypes[letter.letter_type] || letter.letter_type}
      </h2>
      <div class="flex items-center gap-3 mt-1">
        <span
          class="text-xs px-2 py-0.5 rounded-full capitalize {letter.status === 'ready'
            ? 'bg-[var(--dash-success-light)] text-[var(--dash-success)]'
            : letter.status === 'sent'
            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
            : 'bg-[var(--dash-bg)] text-[var(--dash-text-muted)]'}"
        >
          {letter.status}
        </span>
        {#if letter.date_updated || letter.date_created}
          <span class="text-sm text-[var(--dash-text-secondary)]">
            {formatDate(letter.date_updated || letter.date_created)}
          </span>
        {/if}
      </div>
    </div>
  </div>

  {#if form?.error || aiError}
    <div class="bg-[var(--dash-error-light)] border border-[var(--dash-error)] rounded-lg p-4">
      <p class="text-[var(--dash-error)] text-sm">{form?.error || aiError}</p>
    </div>
  {/if}

  <!-- Timeline: all conversation entries -->
  {#if conversation.length > 0}
    <Card padding="md">
      <!-- History toggle -->
      {#if conversation.length > 1}
        <button
          type="button"
          onclick={() => { showHistory = !showHistory; }}
          class="text-xs text-[var(--dash-text-muted)] hover:text-[var(--dash-primary)] transition-colors mb-3"
        >
          {showHistory ? "Hide" : "Show"} full history ({conversation.length} entries)
        </button>
      {/if}

      <!-- Expanded history -->
      {#if showHistory && conversation.length > 1}
        <div class="space-y-3 mb-4 pb-4 border-b border-[var(--dash-border)]">
          {#each conversation.slice(0, -1) as entry, i}
            {#if entry.request}
              <div class="flex gap-3">
                <div class="w-5 h-5 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <FontAwesomeIcon icon={faPencil} class="w-2.5 h-2.5 text-blue-600" />
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-xs text-[var(--dash-text-muted)] mb-0.5">
                    {entry.type === "review" ? "Manual edit — AI review requested" : "Your feedback"}
                  </p>
                  <p class="text-xs text-[var(--dash-text)]">{entry.request}</p>
                </div>
              </div>
            {/if}
            <div class="flex gap-3">
              <div class="w-5 h-5 rounded-full bg-purple-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <FontAwesomeIcon icon={faRobot} class="w-2.5 h-2.5 text-purple-600" />
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-xs text-[var(--dash-text-muted)] mb-0.5">
                  {entryLabel(entry)}
                  {#if entry.date}
                    <span class="ml-1">&middot; {formatDate(entry.date)}</span>
                  {/if}
                </p>
                {#if entry.type === "review" || entry.type === "advice"}
                  <div class="prose prose-xs max-w-none text-[var(--dash-text-secondary)] [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_li]:mb-0.5 [&_p]:mb-1 [&_strong]:font-semibold text-xs">
                    {@html marked(entry.response)}
                  </div>
                {:else}
                  {#if entry.summary}
                    <p class="text-xs text-[var(--dash-text-secondary)] mb-1">{entry.summary}</p>
                  {/if}
                  <details>
                    <summary class="text-xs text-[var(--dash-text-muted)] hover:text-[var(--dash-primary)] cursor-pointer">
                      Show version {i + 1}
                    </summary>
                    <pre class="mt-1 whitespace-pre-wrap text-xs text-[var(--dash-text-secondary)] bg-[var(--dash-bg)] p-2 rounded-lg overflow-x-auto max-h-36 overflow-y-auto">{entry.response}</pre>
                  </details>
                {/if}
              </div>
            </div>
            {#if i < conversation.length - 2}
              <div class="ml-2.5 border-l border-[var(--dash-border)] h-1"></div>
            {/if}
          {/each}
        </div>
      {/if}

      <!-- Last entry (always visible) -->
      {@const lastEntry = conversation[conversation.length - 1]}
      {#if lastEntry.request}
        <div class="flex gap-3 mb-3">
          <div class="w-6 h-6 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
            <FontAwesomeIcon icon={faPencil} class="w-3 h-3 text-blue-600" />
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-xs text-[var(--dash-text-muted)] mb-1">
              {lastEntry.type === "review" ? "Manual edit — AI review requested" : "Your feedback"}
            </p>
            <p class="text-sm text-[var(--dash-text)]">{lastEntry.request}</p>
          </div>
        </div>
      {/if}
      <div class="flex gap-3">
        <div class="w-6 h-6 rounded-full bg-purple-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
          <FontAwesomeIcon icon={faRobot} class="w-3 h-3 text-purple-600" />
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-xs text-[var(--dash-text-muted)] mb-1">
            {entryLabel(lastEntry)}
            {#if lastEntry.date}
              <span class="ml-1">&middot; {formatDate(lastEntry.date)}</span>
            {/if}
          </p>
          {#if lastEntry.type === "review" || lastEntry.type === "advice"}
            <div class="prose prose-sm max-w-none text-[var(--dash-text)] [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-1 [&_p]:mb-2 [&_strong]:font-semibold">
              {@html marked(lastEntry.response)}
            </div>
          {:else if lastEntry.summary}
            <p class="text-sm text-[var(--dash-text-secondary)]">{lastEntry.summary}</p>
          {:else if lastEntry.type === "generation"}
            <p class="text-xs text-[var(--dash-text-muted)]">Letter generated.</p>
          {:else}
            <p class="text-xs text-[var(--dash-text-muted)]">Letter updated based on your feedback.</p>
          {/if}
        </div>
      </div>
    </Card>
  {/if}

  {#if isEditing}
    <!-- Edit Mode -->
    <Card padding="md">
      <form method="POST" action="?/update" use:enhance={handleSave}>
        <div class="space-y-4">
          <div>
            <label for="edit-content" class="block text-sm font-medium text-[var(--dash-text)] mb-1">
              {letter.content ? "Content" : "Write your letter"}
            </label>
            <textarea
              id="edit-content"
              name="content"
              bind:value={editContent}
              rows={14}
              placeholder="Start writing your letter here..."
              class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent font-mono text-sm resize-y"
            ></textarea>
          </div>
          {#if letter.content}
            <div>
              <label for="edit-status" class="block text-sm font-medium text-[var(--dash-text)] mb-1">Status</label>
              <select
                id="edit-status"
                name="status"
                bind:value={editStatus}
                class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
              >
                <option value="draft">Draft</option>
                <option value="ready">Ready</option>
                <option value="sent">Sent</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          {:else}
            <input type="hidden" name="status" value={editStatus} />
          {/if}
        </div>
        <div class="flex items-center justify-between mt-4">
          <button
            type="button"
            onclick={() => (showDeleteConfirm = true)}
            class="px-3 py-1.5 text-xs bg-red-500/10 border border-red-500/30 rounded-lg text-red-500 hover:bg-red-500/20 hover:border-red-500/50 hover:text-red-600 transition-colors flex items-center gap-1.5"
          >
            <FontAwesomeIcon icon={faTrash} class="w-3 h-3" />
            Delete
          </button>
          <div class="flex gap-1.5">
            {#if letter.content}
              <button
                type="button"
                onclick={cancelEdit}
                class="px-3 py-1.5 text-xs bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-lg text-[var(--dash-text-secondary)] hover:text-[var(--dash-text)] hover:border-[var(--dash-text-muted)] transition-colors flex items-center gap-1.5"
              >
                <FontAwesomeIcon icon={faXmark} class="w-3 h-3" />
                Cancel
              </button>
            {/if}
            <button
              type="submit"
              disabled={!editContent.trim()}
              class="px-3 py-1.5 text-xs bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-600 hover:bg-emerald-500/20 hover:border-emerald-500/50 hover:text-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              <FontAwesomeIcon icon={faCheck} class="w-3 h-3" />
              Save
            </button>
          </div>
        </div>
      </form>
      <!-- Save & get AI review (separate form) -->
      <div class="mt-3 pt-3 border-t border-[var(--dash-border)]">
        <form method="POST" action="?/update" use:enhance={handleSaveAndReview}>
          <input type="hidden" name="content" value={editContent} />
          <input type="hidden" name="status" value={editStatus} />
          <button
            type="submit"
            disabled={generating || !editContent.trim()}
            class="w-full px-3 py-1.5 text-xs border border-[var(--dash-border)] rounded-lg text-[var(--dash-text)] hover:bg-[var(--dash-bg)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
          >
            {#if generating}
              <Spinner size="w-3 h-3" />
              Saving & reviewing...
            {:else}
              <FontAwesomeIcon icon={faRobot} class="w-3 h-3" />
              Save & get AI review
            {/if}
          </button>
        </form>
      </div>
    </Card>
  {:else if letter.content}
    <!-- View Mode: has content -->
    <Card padding="md">
      <pre class="whitespace-pre-wrap text-sm text-[var(--dash-text)] bg-[var(--dash-bg)] p-4 rounded-lg overflow-x-auto">{letter.content}</pre>

      <div class="flex items-center flex-wrap gap-2 pt-4 mt-4 border-t border-[var(--dash-border)]">
        <button
          type="button"
          onclick={startEdit}
          class="px-3 py-1.5 text-sm bg-[var(--dash-primary)] text-white rounded-lg hover:bg-[var(--dash-primary-hover)] transition-colors flex items-center gap-1.5"
        >
          <FontAwesomeIcon icon={faPencil} class="w-3.5 h-3.5" />
          Edit
        </button>
        {#if !letter.ai_chat}
          <button
            type="button"
            onclick={() => generateAi("review")}
            disabled={generating}
            class="px-3 py-1.5 text-sm border border-[var(--dash-border)] rounded-lg text-[var(--dash-text)] hover:bg-[var(--dash-bg)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            {#if generating && generatingMode === "review"}
              <Spinner size="w-3.5 h-3.5" />
              Reviewing...
            {:else}
              <FontAwesomeIcon icon={faRobot} class="w-3.5 h-3.5" />
              Get AI review
            {/if}
          </button>
        {/if}
      </div>

      <!-- AI Feedback Input (when AI chat exists) -->
      {#if letter.ai_chat}
        <div class="pt-4 space-y-2">
          <textarea
            bind:value={feedbackText}
            placeholder="Tell the AI what to change, improve, or adjust..."
            rows={3}
            disabled={generating}
            class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent text-sm resize-y disabled:opacity-50"
          ></textarea>
          <div class="flex items-center justify-end">
            <button
              type="button"
              onclick={() => sendFollowup(feedbackText, true, true)}
              disabled={generating || !feedbackText.trim()}
              class="px-3 py-1.5 text-sm bg-[var(--dash-primary)] text-white rounded-lg hover:bg-[var(--dash-primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              {#if generating && generatingMode === "followup"}
                <Spinner size="w-3.5 h-3.5" />
                Generating...
              {:else}
                Send feedback
              {/if}
            </button>
          </div>
        </div>
      {/if}
    </Card>
  {:else}
    <!-- Empty State: editor with AI actions -->
    <Card padding="md">
      <!-- AI action buttons -->
      <div class="flex flex-wrap gap-2 mb-4">
        <button
          type="button"
          onclick={() => generateAi("generate")}
          disabled={generating}
          class="px-3 py-1.5 text-sm bg-[var(--dash-primary)] text-white rounded-lg hover:bg-[var(--dash-primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
        >
          {#if generating && generatingMode === "generate"}
            <Spinner size="w-3.5 h-3.5" />
            Generating...
          {:else}
            <FontAwesomeIcon icon={faRobot} class="w-3.5 h-3.5" />
            Generate with AI
          {/if}
        </button>
        <button
          type="button"
          onclick={() => generateAi("advice")}
          disabled={generating}
          class="px-3 py-1.5 text-sm border border-[var(--dash-border)] rounded-lg text-[var(--dash-text)] hover:bg-[var(--dash-bg)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
        >
          {#if generating && generatingMode === "advice"}
            <Spinner size="w-3.5 h-3.5" />
            Generating...
          {:else}
            <FontAwesomeIcon icon={faComments} class="w-3.5 h-3.5" />
            Get AI recommendations
          {/if}
        </button>
      </div>

      <!-- Editor -->
      <form method="POST" action="?/update" use:enhance={handleSave}>
        <input type="hidden" name="status" value={editStatus} />
        <div>
          <label for="new-content" class="block text-sm font-medium text-[var(--dash-text)] mb-1">Write your letter</label>
          <textarea
            id="new-content"
            name="content"
            bind:value={editContent}
            rows={14}
            placeholder="Start writing your letter here..."
            class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent font-mono text-sm resize-y"
          ></textarea>
        </div>
        <div class="flex items-center justify-between mt-4">
          <button
            type="button"
            onclick={() => (showDeleteConfirm = true)}
            class="px-3 py-1.5 text-xs bg-red-500/10 border border-red-500/30 rounded-lg text-red-500 hover:bg-red-500/20 hover:border-red-500/50 hover:text-red-600 transition-colors flex items-center gap-1.5"
          >
            <FontAwesomeIcon icon={faTrash} class="w-3 h-3" />
            Delete
          </button>
          <button
            type="submit"
            disabled={!editContent.trim()}
            class="px-3 py-1.5 text-xs bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-600 hover:bg-emerald-500/20 hover:border-emerald-500/50 hover:text-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            <FontAwesomeIcon icon={faCheck} class="w-3 h-3" />
            Save
          </button>
        </div>
      </form>
      <!-- Save & get AI review (separate form) -->
      <div class="mt-3 pt-3 border-t border-[var(--dash-border)]">
        <form method="POST" action="?/update" use:enhance={handleSaveAndReview}>
          <input type="hidden" name="content" value={editContent} />
          <input type="hidden" name="status" value={editStatus} />
          <button
            type="submit"
            disabled={generating || !editContent.trim()}
            class="w-full px-3 py-1.5 text-xs border border-[var(--dash-border)] rounded-lg text-[var(--dash-text)] hover:bg-[var(--dash-bg)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
          >
            {#if generating}
              <Spinner size="w-3 h-3" />
              Saving & reviewing...
            {:else}
              <FontAwesomeIcon icon={faRobot} class="w-3 h-3" />
              Save & get AI review
            {/if}
          </button>
        </form>
      </div>
    </Card>
  {/if}
</div>

<!-- Delete Confirmation Modal -->
<ConfirmModal
  isOpen={showDeleteConfirm}
  title="Delete Letter"
  message="Are you sure you want to delete this letter? This action cannot be undone."
  onCancel={() => (showDeleteConfirm = false)}
  onConfirm={() => {
    showDeleteConfirm = false;
    const form = document.createElement("form");
    form.method = "POST";
    form.action = "?/delete";
    document.body.appendChild(form);
    form.submit();
  }}
/>
