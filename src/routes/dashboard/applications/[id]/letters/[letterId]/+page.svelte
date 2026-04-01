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
    faChevronRight,
    faComments,
    faPencil,
    faRobot,
    faTrash,
  } from "@fortawesome/free-solid-svg-icons";
  import Card from "../../../../components/Card.svelte";
  import Spinner from "$lib/components/Spinner.svelte";
  import ConfirmModal from "../../../../profile/components/ConfirmModal.svelte";

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let letter = $derived(data.letter);
  let conversation = $derived(data.conversation);
  let appId = $derived($page.params.id);
  let showHistory = $state(false);
  // When true, expand penultimate version too (set after actions, not on fresh page load)
  let expandPenultimate = $state(false);

  // Compute version numbers: only entries with content get a version number
  let entryVersionNums = $derived.by(() => {
    const nums: number[] = [];
    let ver = 1;
    for (const entry of conversation) {
      if (entry.content) {
        nums.push(ver);
        ver++;
      } else {
        nums.push(0); // no version for advice-only entries
      }
    }
    return nums;
  });

  const letterTypes: Record<string, string> = {
    cover_letter: "Cover Letter",
    motivation_letter: "Motivation Letter",
    follow_up: "Follow-up",
    thank_you: "Thank You",
  };

  // Inline edit state: tracks which version is being edited (by index), or -1 for new letter
  let editingIndex = $state<number | null>(null);
  let editContent = $state("");
  let editStatus = $state(letter.status || "draft");
  let isEditing = $derived(editingIndex !== null);

  // AI states
  let generating = $state(false);
  let generatingMode = $state<"generate" | "advice" | "followup" | "review" | null>(null);
  let aiError = $state<string | null>(null);
  let feedbackText = $state("");

  // Feedback editing state
  let editingFeedbackIndex = $state<number | null>(null);
  let editingFeedbackText = $state("");

  // Delete
  let showDeleteConfirm = $state(false);

  function startEdit(content?: string, index?: number) {
    editContent = content ?? letter.content ?? "";
    editStatus = letter.status || "draft";
    editingIndex = index ?? -1;
  }

  function cancelEdit() {
    editingIndex = null;
  }

  function handleSave() {
    return async ({ result, update }: { result: { type: string }; update: () => Promise<void> }) => {
      await update();
      if (result.type === "success") {
        editingIndex = null;
        expandPenultimate = true;
      }
    };
  }

  async function reviewVersion(content: string) {
    // Save the content first so the review prompt sees it
    const formData = new FormData();
    formData.set("content", content);
    formData.set("status", letter.status || "draft");
    formData.set("source", "manual_edit");
    await fetch(`?/update`, { method: "POST", body: formData });
    await invalidateAll();

    if (letter.ai_chat) {
      await sendFollowup(
        "I've updated my letter. Please review my changes and give me concise feedback: what works well, what could be improved, and any specific suggestions.",
        true,
        false,
        "review",
      );
    } else {
      await generateAi("review");
    }
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
      expandPenultimate = true;
    } catch {
      aiError = "Network error. Please try again.";
    } finally {
      generating = false;
      generatingMode = null;
    }
  }

  async function sendFollowup(text: string, includeContext: boolean = true, updateContent: boolean = false, mode?: "feedback" | "review", replaceVersionId?: number) {
    if (!text.trim()) return;

    generating = true;
    generatingMode = mode === "review" ? "review" : "followup";
    aiError = null;

    try {
      const response = await fetch(`/api/ai/letters/${letter.id}/followup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          followupRequest: text,
          includeOriginalContext: includeContext,
          updateContent,
          ...(mode ? { mode } : {}),
          ...(replaceVersionId ? { replaceVersionId } : {}),
        }),
      });
      const result = await response.json();
      if (!result.success) {
        aiError = result.message || "Follow-up failed";
        return;
      }
      feedbackText = "";
      editingFeedbackIndex = null;
      await invalidateAll();
      expandPenultimate = true;
    } catch {
      aiError = "Network error. Please try again.";
    } finally {
      generating = false;
      generatingMode = null;
    }
  }

  function formatDate(date: Date | string | null): string {
    if (!date) return "";
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  function entryLabel(entry: ConversationEntry): string {
    switch (entry.type) {
      case "manual_edit": return "Manual edit";
      case "ai_generation": return "AI generated letter";
      case "ai_advice": return "AI recommendations";
      case "ai_review": return "AI review";
      case "ai_revision": return "AI revised letter";
      default: return "Version";
    }
  }

  function isUserEntry(entry: ConversationEntry): boolean {
    return entry.type === "manual_edit";
  }
</script>

<div class="space-y-6">
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

  {#snippet conversationEntry(entry: ConversationEntry, versionNum: number, isLast: boolean, isPenultimate: boolean, entryIndex: number)}
    {@const userEntry = isUserEntry(entry)}
    {@const borderColor = userEntry ? "border-blue-500/20" : "border-purple-500/20"}
    {@const bgColor = userEntry ? "bg-blue-500/5" : "bg-purple-500/5"}
    {@const iconBg = userEntry ? "bg-blue-500/10" : "bg-purple-500/10"}
    {@const iconColor = userEntry ? "text-blue-600" : "text-purple-600"}
    {@const detailsBg = userEntry ? "bg-blue-500/10" : "bg-purple-500/10"}
    {@const detailsHoverBg = userEntry ? "hover:bg-blue-500/15" : "hover:bg-purple-500/15"}
    {#if entry.userRequest}
      <div class="ml-6 rounded-lg border border-blue-500/20 bg-blue-500/5 p-2">
        <div class="flex items-center justify-between mb-0.5">
          <div class="flex items-center gap-1.5">
            <div class="w-4 h-4 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0">
              <FontAwesomeIcon icon={faPencil} class="w-2 h-2 text-blue-600" />
            </div>
            <p class="text-xs text-[var(--dash-text-muted)]">Your feedback</p>
          </div>
          {#if editingFeedbackIndex !== entryIndex && !generating}
            <button
              type="button"
              onclick={() => { editingFeedbackIndex = entryIndex; editingFeedbackText = entry.userRequest!; }}
              class="text-xs text-[var(--dash-text-muted)] hover:text-[var(--dash-primary)] transition-colors flex items-center gap-1"
            >
              <FontAwesomeIcon icon={faPencil} class="w-2 h-2" />
              Edit
            </button>
          {/if}
        </div>
        {#if editingFeedbackIndex === entryIndex}
          <textarea
            bind:value={editingFeedbackText}
            rows={3}
            disabled={generating}
            class="w-full px-2 py-1.5 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent text-sm resize-y disabled:opacity-50 mt-1"
          ></textarea>
          <div class="flex items-center gap-1.5 mt-1.5">
            <button
              type="button"
              onclick={() => sendFollowup(editingFeedbackText, true, true, undefined, entry.versionId)}
              disabled={generating || !editingFeedbackText.trim()}
              class="px-2 py-1 text-xs bg-[var(--dash-primary)] text-white rounded hover:bg-[var(--dash-primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            >
              {#if generating && generatingMode === "followup"}
                <Spinner size="w-2.5 h-2.5" />
                Resending...
              {:else}
                Resend
              {/if}
            </button>
            <button
              type="button"
              onclick={() => { editingFeedbackIndex = null; }}
              disabled={generating}
              class="px-2 py-1 text-xs border border-[var(--dash-border)] rounded text-[var(--dash-text-secondary)] hover:text-[var(--dash-text)] transition-colors"
            >
              Cancel
            </button>
          </div>
        {:else}
          <p class="text-sm text-[var(--dash-text)]">{entry.userRequest}</p>
        {/if}
      </div>
    {/if}
    <div class="{userEntry ? 'ml-6' : ''} rounded-lg border {borderColor} {bgColor} p-3">
      <div class="flex items-center gap-2 mb-1">
        <div class="w-5 h-5 rounded-full {iconBg} flex items-center justify-center flex-shrink-0">
          <FontAwesomeIcon icon={userEntry ? faPencil : faRobot} class="w-2.5 h-2.5 {iconColor}" />
        </div>
        <p class="text-xs text-[var(--dash-text-muted)]">
          {entryLabel(entry)}
          {#if entry.date}
            <span class="ml-1">&middot; {formatDate(entry.date)}</span>
          {/if}
        </p>
      </div>
      {#if entry.aiFeedback}
        <p class="text-sm text-[var(--dash-text)] mb-1">{entry.aiFeedback}</p>
      {/if}
      {#if entry.content}
        <details class="mt-4 rounded {detailsBg} group/v" open={isLast || (isPenultimate && expandPenultimate) || editingIndex === entryIndex}>
          <summary class="flex items-center gap-2 w-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--dash-text-secondary)] {detailsHoverBg} hover:text-[var(--dash-primary)] cursor-pointer transition-colors rounded">
            <FontAwesomeIcon icon={faChevronRight} class="w-2.5 h-2.5 transition-transform group-open/v:rotate-90" />
            Version {versionNum}{#if entry.type === "ai_revision" || entry.type === "ai_review" || entry.type === "ai_generation"} <span class="normal-case font-normal">(AI revised)</span>{/if}
          </summary>
          <div class="px-3 pt-2 pb-3">
            {#if editingIndex === entryIndex}
              <form method="POST" action="?/update" use:enhance={handleSave}>
                <textarea
                  name="content"
                  bind:value={editContent}
                  rows={14}
                  class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent font-mono text-sm resize-y"
                ></textarea>
                <input type="hidden" name="status" value={editStatus} />
                <div class="flex items-center gap-1.5 mt-2">
                  <button
                    type="submit"
                    disabled={!editContent.trim()}
                    class="px-2 py-1 text-xs bg-[var(--dash-primary)] text-white rounded hover:bg-[var(--dash-primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onclick={cancelEdit}
                    class="px-2 py-1 text-xs border border-[var(--dash-border)] rounded text-[var(--dash-text-secondary)] hover:text-[var(--dash-text)] transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            {:else}
              <pre class="whitespace-pre-wrap text-xs leading-relaxed text-[var(--dash-text)]">{entry.content}</pre>
              {#if !isEditing}
                <div class="flex items-center gap-1.5 mt-2">
                  <button
                    type="button"
                    onclick={() => startEdit(entry.content ?? undefined, entryIndex)}
                    class="px-2 py-1 text-xs border border-[var(--dash-border)] rounded text-[var(--dash-text-secondary)] hover:bg-[var(--dash-bg)] hover:text-[var(--dash-text)] transition-colors flex items-center gap-1"
                  >
                    <FontAwesomeIcon icon={faPencil} class="w-2.5 h-2.5" />
                    Edit
                  </button>
                  {#if entry.type !== "ai_revision" && entry.type !== "ai_review" && entry.type !== "ai_generation"}
                    <button
                      type="button"
                      onclick={() => reviewVersion(entry.content!)}
                      disabled={generating}
                      class="px-2 py-1 text-xs border border-[var(--dash-border)] rounded text-[var(--dash-text-secondary)] hover:bg-[var(--dash-bg)] hover:text-[var(--dash-text)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                    >
                      {#if generating && generatingMode === "review"}
                        <Spinner size="w-2.5 h-2.5" />
                      {:else}
                        <FontAwesomeIcon icon={faRobot} class="w-2.5 h-2.5" />
                      {/if}
                      AI review
                    </button>
                  {/if}
                </div>
              {/if}
            {/if}
          </div>
        </details>
      {/if}
      <!-- Feedback input on last entry -->
      {#if isLast && !isEditing && letter.ai_chat}
        <div class="mt-3 pt-3 border-t {borderColor} space-y-2">
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
              class="px-3 py-1.5 text-xs bg-[var(--dash-primary)] text-white rounded-lg hover:bg-[var(--dash-primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              {#if generating && generatingMode === "followup"}
                <Spinner size="w-3 h-3" />
                Generating...
              {:else}
                Send feedback
              {/if}
            </button>
          </div>
        </div>
      {/if}
    </div>
  {/snippet}

  <!-- Timeline -->
  {#if conversation.length > 0}
    {@const lastEntry = conversation[conversation.length - 1]}
    <div class="space-y-3">
      {#if conversation.length <= 2}
        <!-- Show all entries when there are only 1-2 -->
        {#each conversation.slice(0, -1) as entry, i}
          {@render conversationEntry(entry, entryVersionNums[i], false, i === conversation.length - 2, i)}
        {/each}
      {:else}
        <!-- Collapsible history for 3+ entries -->
        <button
          type="button"
          onclick={() => { showHistory = !showHistory; }}
          class="flex items-center gap-2 w-full px-3 py-1.5 rounded-lg border border-[var(--dash-border)] text-xs font-medium text-[var(--dash-text-secondary)] hover:bg-[var(--dash-bg)] hover:text-[var(--dash-primary)] transition-colors"
        >
          <FontAwesomeIcon icon={faChevronRight} class="w-2.5 h-2.5 transition-transform {showHistory ? 'rotate-90' : ''}" />
          {showHistory ? "Hide" : "Show"} full history ({conversation.length} entries)
        </button>

        {#if showHistory}
          <div class="space-y-3">
            {#each conversation.slice(0, -1) as entry, i}
              {@render conversationEntry(entry, entryVersionNums[i], false, i === conversation.length - 2, i)}
            {/each}
          </div>
        {/if}
      {/if}

      {@render conversationEntry(lastEntry, entryVersionNums[conversation.length - 1], true, false, conversation.length - 1)}
    </div>
  {/if}

  {#if !letter.content && conversation.length === 0}
    <!-- Empty State: no content, no history -->
    <Card padding="md">
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
      <div class="mt-3 pt-3 border-t border-[var(--dash-border)]">
        <button
          type="button"
          onclick={() => reviewVersion(editContent)}
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
