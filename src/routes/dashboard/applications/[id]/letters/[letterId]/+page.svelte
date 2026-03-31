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
  let lastEntry = $derived(conversation.length > 1 ? conversation[conversation.length - 1] : null);
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

  function startWriting() {
    editContent = "";
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
        await sendFollowup(
          "I've updated my letter. Please review my changes and give me concise feedback: what works well, what could be improved, and any specific suggestions. Keep it short — bullet points.",
          true,
        );
      }
    };
  }

  async function generateAi(mode: "generate" | "advice" = "generate") {
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

  {#if isEditing}
    <!-- Edit Mode -->
    <Card padding="md">
      <form method="POST" action="?/update" use:enhance={handleSave}>
        <div class="space-y-4">
          <div>
            <label for="edit-content" class="block text-sm font-medium text-[var(--dash-text)] mb-1">Content</label>
            <textarea
              id="edit-content"
              name="content"
              bind:value={editContent}
              rows={14}
              class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent font-mono text-sm resize-y"
            ></textarea>
          </div>
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
            <button
              type="button"
              onclick={cancelEdit}
              class="px-3 py-1.5 text-xs bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-lg text-[var(--dash-text-secondary)] hover:text-[var(--dash-text)] hover:border-[var(--dash-text-muted)] transition-colors flex items-center gap-1.5"
            >
              <FontAwesomeIcon icon={faXmark} class="w-3 h-3" />
              Cancel
            </button>
            <button
              type="submit"
              class="px-3 py-1.5 text-xs bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-600 hover:bg-emerald-500/20 hover:border-emerald-500/50 hover:text-emerald-700 transition-colors flex items-center gap-1.5"
            >
              <FontAwesomeIcon icon={faCheck} class="w-3 h-3" />
              Save
            </button>
          </div>
        </div>
      </form>
      {#if letter.ai_chat}
        <!-- Save & Review: separate form that also submits update but triggers AI review after -->
        <div class="mt-3 pt-3 border-t border-[var(--dash-border)]">
          <form method="POST" action="?/update" use:enhance={handleSaveAndReview}>
            <input type="hidden" name="content" value={editContent} />
            <input type="hidden" name="status" value={editStatus} />
            <button
              type="submit"
              disabled={generating}
              class="w-full px-3 py-1.5 text-xs border border-[var(--dash-border)] rounded-lg text-[var(--dash-text)] hover:bg-[var(--dash-bg)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
            >
              {#if generating && generatingMode === "followup"}
                <Spinner size="w-3 h-3" />
                Saving & reviewing...
              {:else}
                <FontAwesomeIcon icon={faRobot} class="w-3 h-3" />
                Save & get AI review
              {/if}
            </button>
          </form>
        </div>
      {/if}
    </Card>
  {:else if letter.content}
    <!-- View Mode: has content -->

    <!-- Conversation card: last entry + collapsible history -->
    {#if lastEntry}
      <Card padding="md">
        <!-- History toggle at top -->
        {#if conversation.length > 1}
          <button
            type="button"
            onclick={() => { showHistory = !showHistory; }}
            class="text-xs text-[var(--dash-text-muted)] hover:text-[var(--dash-primary)] transition-colors mb-3"
          >
            {showHistory ? "Hide" : "Show"} full history ({conversation.length} iterations)
          </button>
        {/if}

        <!-- Expanded history timeline -->
        {#if showHistory}
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
                    {entry.type === "generation" ? "Generated letter" : entry.type === "review" ? "AI review" : "Revised letter"}
                    {#if entry.date}
                      <span class="ml-1">&middot; {formatDate(entry.date)}</span>
                    {/if}
                  </p>
                  {#if entry.type === "review"}
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

        <!-- Last entry -->
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
              {lastEntry.type === "review" ? "AI review" : "Revised letter"}
              {#if lastEntry.date}
                <span class="ml-1">&middot; {formatDate(lastEntry.date)}</span>
              {/if}
            </p>
            {#if lastEntry.type === "review"}
              <div class="prose prose-sm max-w-none text-[var(--dash-text)] [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-1 [&_p]:mb-2 [&_strong]:font-semibold">
                {@html marked(lastEntry.response)}
              </div>
            {:else if lastEntry.summary}
              <p class="text-sm text-[var(--dash-text-secondary)]">{lastEntry.summary}</p>
            {:else}
              <p class="text-xs text-[var(--dash-text-muted)]">Letter updated based on your feedback.</p>
            {/if}
          </div>
        </div>
      </Card>
    {/if}

    <!-- Current letter content -->
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
      </div>

      <!-- AI Feedback Input (always visible when ai_chat exists) -->
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
    <!-- Empty State: no content yet -->
    <div class="space-y-3">
      {#if letter.ai_chat_response}
        <!-- AI advice rendered as markdown -->
        <Card padding="md">
          <h3 class="font-medium text-[var(--dash-text)] mb-3 flex items-center gap-2">
            <FontAwesomeIcon icon={faComments} class="w-4 h-4 text-amber-600" />
            AI Advice
          </h3>
          <div class="prose prose-sm max-w-none text-[var(--dash-text)] [&_h1]:text-lg [&_h2]:text-base [&_h3]:text-sm [&_h4]:text-sm [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-1 [&_p]:mb-2 [&_strong]:font-semibold">
            {@html marked(letter.ai_chat_response)}
          </div>
          <div class="flex items-center gap-2 pt-4 mt-4 border-t border-[var(--dash-border)]">
            <button
              type="button"
              onclick={() => generateAi("advice")}
              disabled={generating}
              class="px-3 py-1.5 text-sm border border-[var(--dash-border)] rounded-lg text-[var(--dash-text)] hover:bg-[var(--dash-bg)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              {#if generating && generatingMode === "advice"}
                <Spinner size="w-3.5 h-3.5" />
                Regenerating...
              {:else}
                <FontAwesomeIcon icon={faComments} class="w-3.5 h-3.5" />
                Regenerate advice
              {/if}
            </button>
            <button
              type="button"
              onclick={() => generateAi("generate")}
              disabled={generating}
              class="px-3 py-1.5 text-sm border border-[var(--dash-border)] rounded-lg text-[var(--dash-text)] hover:bg-[var(--dash-bg)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              {#if generating && generatingMode === "generate"}
                <Spinner size="w-3.5 h-3.5" />
                Generating...
              {:else}
                <FontAwesomeIcon icon={faRobot} class="w-3.5 h-3.5" />
                Generate draft instead
              {/if}
            </button>
          </div>
        </Card>

        <!-- Editor below advice -->
        <Card padding="md">
          <form method="POST" action="?/update" use:enhance={handleSave}>
            <div class="space-y-4">
              <div>
                <label for="edit-content" class="block text-sm font-medium text-[var(--dash-text)] mb-1">Write your letter</label>
                <textarea
                  id="edit-content"
                  name="content"
                  bind:value={editContent}
                  rows={14}
                  placeholder="Start writing your letter here, using the advice above as a guide..."
                  class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent font-mono text-sm resize-y"
                ></textarea>
              </div>
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
                class="px-3 py-1.5 text-xs bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-600 hover:bg-emerald-500/20 hover:border-emerald-500/50 hover:text-emerald-700 transition-colors flex items-center gap-1.5"
              >
                <FontAwesomeIcon icon={faCheck} class="w-3 h-3" />
                Save
              </button>
            </div>
          </form>
        </Card>
      {:else}
        <p class="text-sm text-[var(--dash-text-secondary)]">
          How would you like to get started?
        </p>

      <button
        type="button"
        onclick={() => generateAi("generate")}
        disabled={generating}
        class="w-full text-left"
      >
        <Card padding="md" class="hover:border-[var(--dash-primary)]/40 transition-colors cursor-pointer {generating && generatingMode === 'generate' ? 'opacity-60 pointer-events-none' : ''} {generating && generatingMode !== 'generate' ? 'opacity-40 pointer-events-none' : ''}">
          <div class="flex items-start gap-4">
            <div class="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center flex-shrink-0">
              {#if generating && generatingMode === "generate"}
                <Spinner size="w-5 h-5" />
              {:else}
                <FontAwesomeIcon icon={faRobot} class="w-5 h-5 text-purple-600" />
              {/if}
            </div>
            <div>
              <h3 class="font-medium text-[var(--dash-text)]">Generate with AI</h3>
              <p class="text-sm text-[var(--dash-text-secondary)] mt-0.5">
                Create a draft based on your profile and the job description for you to review and adjust.
              </p>
            </div>
          </div>
        </Card>
      </button>

      <button
        type="button"
        onclick={() => generateAi("advice")}
        disabled={generating}
        class="w-full text-left"
      >
        <Card padding="md" class="hover:border-[var(--dash-primary)]/40 transition-colors cursor-pointer {generating && generatingMode === 'advice' ? 'opacity-60 pointer-events-none' : ''} {generating && generatingMode !== 'advice' ? 'opacity-40 pointer-events-none' : ''}">
          <div class="flex items-start gap-4">
            <div class="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center flex-shrink-0">
              {#if generating && generatingMode === "advice"}
                <Spinner size="w-5 h-5" />
              {:else}
                <FontAwesomeIcon icon={faComments} class="w-5 h-5 text-amber-600" />
              {/if}
            </div>
            <div>
              <h3 class="font-medium text-[var(--dash-text)]">Get advice first</h3>
              <p class="text-sm text-[var(--dash-text-secondary)] mt-0.5">
                AI analyzes your profile and the job to recommend what to include and how to structure the letter.
              </p>
            </div>
          </div>
        </Card>
      </button>

      <button
        type="button"
        onclick={startWriting}
        disabled={generating}
        class="w-full text-left"
      >
        <Card padding="md" class="hover:border-[var(--dash-primary)]/40 transition-colors cursor-pointer {generating ? 'opacity-40 pointer-events-none' : ''}">
          <div class="flex items-start gap-4">
            <div class="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0">
              <FontAwesomeIcon icon={faPencil} class="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 class="font-medium text-[var(--dash-text)]">Write it yourself</h3>
              <p class="text-sm text-[var(--dash-text-secondary)] mt-0.5">
                Start with a blank editor. You can always ask AI for help later.
              </p>
            </div>
          </div>
        </Card>
      </button>
      {/if}
    </div>
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
