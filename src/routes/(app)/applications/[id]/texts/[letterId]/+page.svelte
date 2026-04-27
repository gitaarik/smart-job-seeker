<script lang="ts">
  import type { ActionData, PageData } from "./$types";
  import type { ConversationEntry } from "./+page.server";
  import { enhance } from "$app/forms";
  import { afterNavigate, goto, invalidateAll } from "$app/navigation";
  import { tick } from "svelte";
  import { page } from "$app/stores";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faArrowLeft,
    faCheck,
    faComments,
    faEye,
    faEyeSlash,
    faPencil,
    faRobot,
    faTrash,
  } from "@fortawesome/free-solid-svg-icons";
  import { marked } from "marked";
  import Card from "../../../../components/Card.svelte";
  import Spinner from "$lib/components/Spinner.svelte";
  import SimpleEditor from "$lib/components/SimpleEditor.svelte";
  import ConfirmModal from "../../../../profile/components/ConfirmModal.svelte";

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let letter = $derived(data.letter);
  let conversation = $derived(data.conversation);
  let isNew = $derived(data.isNew);
  let appId = $derived($page.params.id);

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
    cheat_sheet: "Interview Cheat Sheet",
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

  // Scroll target
  let lastEntryEl = $state<HTMLElement | null>(null);

  // Delete
  let showDeleteConfirm = $state(false);

  // Confirm dialog for saving a previous version (will remove later entries)
  let showOverwriteConfirm = $state(false);
  let pendingOverwriteForm = $state<HTMLFormElement | null>(null);

  // Diff view state: manually toggled on/off overrides auto-show
  let diffShown = $state(new Set<number>());
  let diffHidden = $state(new Set<number>());

  type DiffSegment = { type: "same" | "added" | "removed"; text: string };

  // Scroll to last entry on page load / navigation
  afterNavigate(async () => {
    await tick();
    lastEntryEl?.scrollIntoView({ block: "start" });
  });

  function computeDiff(oldText: string, newText: string): DiffSegment[] {
    // Split into words only (ignore whitespace for comparison)
    const oldWords = oldText.split(/\s+/).filter(Boolean);
    const newWords = newText.split(/\s+/).filter(Boolean);
    const m = oldWords.length, n = newWords.length;

    // LCS via DP
    const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        dp[i][j] = oldWords[i - 1] === newWords[j - 1]
          ? dp[i - 1][j - 1] + 1
          : Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }

    // Backtrack to build word-level diff
    const raw: { type: DiffSegment["type"]; text: string }[] = [];
    let i = m, j = n;
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && oldWords[i - 1] === newWords[j - 1]) {
        raw.push({ type: "same", text: oldWords[i - 1] });
        i--; j--;
      } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
        raw.push({ type: "added", text: newWords[j - 1] });
        j--;
      } else {
        raw.push({ type: "removed", text: oldWords[i - 1] });
        i--;
      }
    }
    raw.reverse();

    // Build whitespace map from new text: whitespace before each word
    const newParts = newText.split(/(\s+)/);
    const newSpaces: string[] = [];
    let ws = "";
    for (const part of newParts) {
      if (/^\s*$/.test(part)) { ws += part; }
      else { newSpaces.push(ws); ws = ""; }
    }

    // Merge consecutive same-type words with new text's whitespace
    const segments: DiffSegment[] = [];
    let nIdx = 0; // position in new text words
    for (const seg of raw) {
      // Use new text's whitespace for added/same words; simple space for removed
      let space: string;
      if (seg.type === "removed") {
        space = segments.length > 0 ? " " : "";
      } else {
        space = nIdx > 0 ? (newSpaces[nIdx] || " ") : (newSpaces[0] || "");
        nIdx++;
      }

      if (segments.length > 0 && segments[segments.length - 1].type === seg.type) {
        segments[segments.length - 1].text += space + seg.text;
      } else {
        segments.push({ type: seg.type, text: (segments.length > 0 ? space : "") + seg.text });
      }
    }
    return segments;
  }

  function getPreviousContent(entryIndex: number): string | null {
    for (let i = entryIndex - 1; i >= 0; i--) {
      if (conversation[i].content) return conversation[i].content!;
    }
    return null;
  }

  function isSmallDiff(segments: DiffSegment[]): boolean {
    let changedChars = 0;
    let totalChars = 0;
    for (const seg of segments) {
      totalChars += seg.text.length;
      if (seg.type !== "same") changedChars += seg.text.length;
    }
    return totalChars > 0 && changedChars / totalChars < 0.3;
  }

  function shouldAutoShowDiff(entryIndex: number): boolean {
    const prev = getPreviousContent(entryIndex);
    if (!prev) return false;
    const entry = conversation[entryIndex];
    if (!entry.content) return false;
    const segments = computeDiff(prev, entry.content);
    return isSmallDiff(segments);
  }

  function toggleDiff(entryIndex: number, currentlyShowing: boolean) {
    if (currentlyShowing) {
      diffShown.delete(entryIndex);
      diffHidden.add(entryIndex);
    } else {
      diffHidden.delete(entryIndex);
      diffShown.add(entryIndex);
    }
    diffShown = new Set(diffShown);
    diffHidden = new Set(diffHidden);
  }

  async function startEdit(content?: string, index?: number) {
    editContent = content ?? letter.content ?? "";
    editStatus = letter.status || "draft";
    editingIndex = index ?? -1;
    await tick();
    const textarea = document.querySelector<HTMLTextAreaElement>('textarea[name="content"]');
    if (textarea) {
      const rect = textarea.getBoundingClientRect();
      if (rect.top < 0 || rect.bottom > window.innerHeight) {
        textarea.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }

  function cancelEdit() {
    editingIndex = null;
  }

  function isEditingPreviousVersion(): boolean {
    if (editingIndex === null || editingIndex === -1) return false;
    // Check if there are entries with content after this one
    for (let i = editingIndex + 1; i < conversation.length; i++) {
      if (conversation[i].content || conversation[i].aiFeedback || conversation[i].userRequest) return true;
    }
    return false;
  }

  function handleSaveClick(formEl: HTMLFormElement) {
    if (isEditingPreviousVersion()) {
      pendingOverwriteForm = formEl;
      showOverwriteConfirm = true;
    } else {
      formEl.requestSubmit();
    }
  }

  function confirmOverwrite() {
    showOverwriteConfirm = false;
    if (pendingOverwriteForm) {
      // Add the versionId to delete after
      const entry = conversation[editingIndex!];
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = "deleteAfterVersionId";
      input.value = String(entry.versionId);
      pendingOverwriteForm.appendChild(input);
      pendingOverwriteForm.requestSubmit();
      pendingOverwriteForm = null;
    }
  }

  function handleSave() {
    return async ({ result, update }: { result: { type: string; location?: string }; update: () => Promise<void> }) => {
      if (result.type === "redirect" && result.location) {
        await goto(result.location, { replaceState: true });
        return;
      }
      await update();
      if (result.type === "success") {
        editingIndex = null;
        await tick();
        lastEntryEl?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    };
  }

  /** Create the DB record for a new letter and navigate to the real URL. Returns the new letter ID. */
  async function ensureLetterExists(): Promise<number> {
    if (!isNew) return letter.id;

    const response = await fetch("/api/ai/letters/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        applicationId: parseInt(appId),
        letterType: letter.letter_type,
      }),
    });
    const result = await response.json();
    if (!result.success || !result.letterId) {
      throw new Error(result.message || "Failed to create letter");
    }

    // Navigate to the real URL so subsequent actions and page data work
    await goto(`/applications/${appId}/texts/${result.letterId}`, { replaceState: true });
    return result.letterId;
  }

  async function reviewVersion(content: string) {
    generating = true;
    generatingMode = "review";
    aiError = null;

    try {
      const letterId = await ensureLetterExists();

      // Only save if the content differs from the latest version (avoid duplicate entries)
      const latestContent = conversation.findLast((e) => e.content)?.content;
      if (content !== latestContent) {
        const formData = new FormData();
        formData.set("content", content);
        formData.set("status", letter.status || "draft");
        formData.set("source", "manual_edit");
        await fetch(`/applications/${appId}/texts/${letterId}?/update`, { method: "POST", body: formData });
        await invalidateAll();
      }

      if (letter.ai_chat_id) {
        await sendFollowup(
          "Please review my letter and give me concise feedback: what works well, what could be improved, and any specific suggestions.",
          true,
          false,
          "review",
        );
      } else {
        await generateAi("review");
      }
    } catch {
      aiError = "Network error. Please try again.";
    } finally {
      generating = false;
      generatingMode = null;
    }
  }

  async function generateAi(mode: "generate" | "advice" | "review" = "generate") {
    generating = true;
    generatingMode = mode;
    aiError = null;

    try {
      const letterId = await ensureLetterExists();
      const response = await fetch(`/api/ai/letters/${letterId}/generate`, {
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

      await tick();
      lastEntryEl?.scrollIntoView({ behavior: "smooth", block: "start" });
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
      const letterId = await ensureLetterExists();
      const response = await fetch(`/api/ai/letters/${letterId}/followup`, {
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

      await tick();
      lastEntryEl?.scrollIntoView({ behavior: "smooth", block: "start" });
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
      case "ai_generation": return "AI assisted letter";
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
      href="/applications/{appId}/texts"
      class="flex items-center gap-2 text-[var(--dash-text-secondary)] hover:text-[var(--dash-primary)] transition-colors"
    >
      <FontAwesomeIcon icon={faArrowLeft} class="w-4 h-4" />
      <span class="text-sm">All Texts</span>
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
    {#if !isNew}
      <button
        type="button"
        onclick={() => (showDeleteConfirm = true)}
        class="px-3 py-1.5 text-xs border border-red-500/30 rounded-lg text-red-500 hover:bg-red-500/10 hover:border-red-500/50 transition-colors flex items-center gap-1.5"
      >
        <FontAwesomeIcon icon={faTrash} class="w-3 h-3" />
        Delete
      </button>
    {/if}
  </div>

  {#if form?.error || aiError}
    <div class="bg-[var(--dash-error-light)] border border-[var(--dash-error)] rounded-lg p-4">
      <p class="text-[var(--dash-error)] text-sm">{form?.error || aiError}</p>
    </div>
  {/if}

  {#snippet conversationEntry(entry: ConversationEntry, versionNum: number, isLast: boolean, entryIndex: number)}
    {@const userEntry = isUserEntry(entry)}
    {@const borderColor = userEntry ? "border-blue-500/20" : "border-purple-500/20"}
    {@const bgColor = userEntry ? "bg-blue-500/10" : "bg-purple-500/10"}
    {@const versionBgColor = userEntry ? "bg-blue-500/15" : "bg-purple-500/15"}
    {@const iconBg = userEntry ? "bg-blue-500/15" : "bg-purple-500/15"}
    {@const iconColor = userEntry ? "text-blue-600" : "text-purple-600"}
    <div class="space-y-3">
    {#if entry.userRequest}
      <div class="ml-6 rounded-lg border border-blue-500/20 bg-blue-500/10 p-2">
        <div class="flex items-center justify-between mb-0.5">
          <div class="flex items-center gap-1.5">
            <div class="w-4 h-4 rounded-full bg-blue-500/15 flex items-center justify-center flex-shrink-0">
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
          <p class="text-sm text-[var(--dash-text)] whitespace-pre-wrap">{entry.userRequest}</p>
        {/if}
      </div>
    {/if}
    <!-- AI feedback bubble (separate from version) -->
    {#if !userEntry && entry.aiFeedback}
      <div class="rounded-lg border {borderColor} {bgColor} p-3">
        <div class="flex items-center gap-2 mb-1">
          <div class="w-5 h-5 rounded-full {iconBg} flex items-center justify-center flex-shrink-0">
            <FontAwesomeIcon icon={faRobot} class="w-2.5 h-2.5 {iconColor}" />
          </div>
          <p class="text-xs text-[var(--dash-text-muted)]">
            {entryLabel(entry)}
            {#if entry.date}
              <span class="ml-1">&middot; {formatDate(entry.date)}</span>
            {/if}
          </p>
        </div>
        <div class="ai-feedback text-sm text-[var(--dash-text)] mb-1">{@html marked(entry.aiFeedback)}</div>
        {#if !entry.content && !isEditing && entry.type !== "ai_advice"}
          {@const hasExistingVersion = conversation.some((e) => e.content)}
          <button
            type="button"
            onclick={() => sendFollowup("Please revise the letter based on your feedback above.", true, true)}
            disabled={generating}
            class="mt-1 px-2 py-1 text-xs border border-[var(--dash-border)] rounded text-[var(--dash-text-secondary)] hover:bg-[var(--dash-bg)] hover:text-[var(--dash-text)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
          >
            {#if generating && generatingMode === "followup"}
              <Spinner size="w-2.5 h-2.5" />
              Generating...
            {:else}
              <FontAwesomeIcon icon={faRobot} class="w-2.5 h-2.5" />
              Generate revision from this feedback
            {/if}
          </button>
          <!-- Feedback input on last review-only entry (no revised version) -->
          {#if isLast && hasExistingVersion && letter.ai_chat_id}
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
        {/if}
      </div>
    {/if}
    <!-- Write area after advice when no version exists yet -->
    {#if isLast && entry.type === "ai_advice" && !conversation.some((e) => e.content)}
      <div class="mt-1">
        <form method="POST" action={isNew ? "?/create" : "?/update"} use:enhance={handleSave}>
          {#if isNew}
            <input type="hidden" name="letter_type" value={letter.letter_type} />
          {/if}
          <input type="hidden" name="status" value={editStatus} />
          <input type="hidden" name="content" value={editContent} />
          <SimpleEditor
            bind:content={editContent}
            markdown={true}
            placeholder="Write your {(letterTypes[letter.letter_type] || letter.letter_type).toLowerCase()} here..."
          />
          <div class="flex items-center justify-end gap-2 mt-2">
            <button
              type="button"
              onclick={() => reviewVersion(editContent)}
              disabled={generating || !editContent.trim()}
              class="px-3 py-1.5 text-xs border border-[var(--dash-border)] rounded-lg text-[var(--dash-text-secondary)] hover:bg-[var(--dash-bg)] hover:text-[var(--dash-text)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              {#if generating && generatingMode === "review"}
                <Spinner size="w-3 h-3" />
                Reviewing...
              {:else}
                <FontAwesomeIcon icon={faRobot} class="w-3 h-3" />
                AI review
              {/if}
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
      </div>
    {/if}
    <!-- Version box: standalone for user edits, separate bubble for AI entries -->
    {#if entry.content}
      {@const isEditingThis = editingIndex === entryIndex}
      {@const editingPrevious = isEditingPreviousVersion()}
      {@const hasPrevious = getPreviousContent(entryIndex) !== null}
      {@const showingDiff = !isEditingThis && hasPrevious && (diffShown.has(entryIndex) || (!diffHidden.has(entryIndex) && shouldAutoShowDiff(entryIndex)))}
      <div class="{userEntry ? 'ml-6' : ''} rounded-lg border {borderColor} {versionBgColor}">
        <div class="flex items-center gap-2 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--dash-text-secondary)]">
          {#if userEntry}
            <FontAwesomeIcon icon={faPencil} class="w-2.5 h-2.5 {iconColor}" />
          {:else}
            <FontAwesomeIcon icon={faRobot} class="w-2.5 h-2.5 {iconColor}" />
          {/if}
          Version {versionNum}{#if !userEntry} <span class="normal-case font-normal">({versionNum === 1 ? "AI assisted" : "AI revised"})</span>{/if}
          {#if entry.date}
            <span class="normal-case font-normal text-[var(--dash-text-muted)]">&middot; {formatDate(entry.date)}</span>
          {/if}
        </div>
        <div class="px-3 pb-3">
          {#if !isEditingThis && hasPrevious && !isEditing}
            <div class="flex justify-end mb-1">
              <button
                type="button"
                onclick={() => toggleDiff(entryIndex, showingDiff)}
                class="px-2 py-1 text-xs border border-[var(--dash-border)] rounded text-[var(--dash-text-secondary)] hover:bg-[var(--dash-bg)] hover:text-[var(--dash-text)] transition-colors flex items-center gap-1"
              >
                <FontAwesomeIcon icon={showingDiff ? faEyeSlash : faEye} class="w-2.5 h-2.5" />
                {showingDiff ? "Hide changes" : "Show changes"}
              </button>
            </div>
          {/if}
          {#if showingDiff}
            {@const prevContent = getPreviousContent(entryIndex)}
            {@const segments = computeDiff(prevContent || "", entry.content || "")}
            <pre class="whitespace-pre-wrap text-xs leading-relaxed text-[var(--dash-text)]">{#each segments as seg}{#if seg.type === "added"}<span class="bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">{seg.text}</span>{:else if seg.type === "removed"}<span class="bg-red-500/20 text-red-700 dark:text-red-300 line-through">{seg.text}</span>{:else}{seg.text}{/if}{/each}</pre>
          {:else}
            <SimpleEditor
              content={entry.content || ""}
              editable={isEditingThis}
              markdown={true}
              onUpdate={(md) => {
                if (editingIndex === entryIndex) editContent = md;
              }}
            />
          {/if}
          {#if isEditingThis}
            <form method="POST" action="?/update" use:enhance={handleSave}>
              <input type="hidden" name="content" value={editContent} />
              <input type="hidden" name="status" value={editStatus} />
              <div class="flex items-center gap-1.5 mt-2">
                {#if editingPrevious}
                  <button
                    type="button"
                    disabled={!editContent.trim()}
                    onclick={(e) => handleSaveClick(e.currentTarget.closest("form")!)}
                    class="px-2 py-1 text-xs bg-amber-500/80 text-white rounded hover:bg-amber-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                  >
                    Save & continue here
                  </button>
                {:else}
                  <button
                    type="submit"
                    disabled={!editContent.trim()}
                    class="px-2 py-1 text-xs bg-[var(--dash-primary)] text-white rounded hover:bg-[var(--dash-primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                  >
                    Save
                  </button>
                {/if}
                <button
                  type="button"
                  onclick={cancelEdit}
                  class="px-2 py-1 text-xs border border-[var(--dash-border)] rounded text-[var(--dash-text-secondary)] hover:text-[var(--dash-text)] transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          {:else if !isEditing}
            {#if hasPrevious}
              <div class="flex justify-end mt-2">
                <button
                  type="button"
                  onclick={() => toggleDiff(entryIndex, showingDiff)}
                  class="px-2 py-1 text-xs border border-[var(--dash-border)] rounded text-[var(--dash-text-secondary)] hover:bg-[var(--dash-bg)] hover:text-[var(--dash-text)] transition-colors flex items-center gap-1"
                >
                  <FontAwesomeIcon icon={showingDiff ? faEyeSlash : faEye} class="w-2.5 h-2.5" />
                  {showingDiff ? "Hide changes" : "Show changes"}
                </button>
              </div>
            {/if}
            <div class="flex items-center gap-1.5 mt-2 pt-2 border-t border-[var(--dash-border)]/50">
              <button
                type="button"
                onclick={() => startEdit(entry.content ?? undefined, entryIndex)}
                class="px-2 py-1 text-xs border border-[var(--dash-border)] rounded text-[var(--dash-text-secondary)] hover:bg-[var(--dash-bg)] hover:text-[var(--dash-text)] transition-colors flex items-center gap-1"
              >
                <FontAwesomeIcon icon={faPencil} class="w-2.5 h-2.5" />
                Edit
              </button>
              {#if isLast}
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
        </div>
      </div>
    {/if}
    <!-- Feedback input after last AI-generated version -->
    {#if isLast && entry.content && !isEditing && letter.ai_chat_id && (entry.type === "ai_revision" || entry.type === "ai_review" || entry.type === "ai_generation")}
      <div class="mt-3 space-y-2">
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
    <div class="space-y-3">
      {#each conversation.slice(0, -1) as entry, i}
        {@render conversationEntry(entry, entryVersionNums[i], false, i)}
      {/each}
      <div bind:this={lastEntryEl} class="scroll-mt-16">
        {@render conversationEntry(conversation[conversation.length - 1], entryVersionNums[conversation.length - 1], true, conversation.length - 1)}
      </div>
    </div>
  {/if}

  {#if !letter.content && conversation.length === 0}
    <!-- Empty State: no content, no history -->
    <Card padding="md">
      <h3 class="text-base font-semibold text-[var(--dash-text)] mb-3">Start with AI</h3>
      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          onclick={() => generateAi("advice")}
          disabled={generating}
          class="px-3 py-1.5 text-sm bg-[var(--dash-primary)] text-white rounded-lg hover:bg-[var(--dash-primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
        >
          {#if generating && generatingMode === "advice"}
            <Spinner size="w-3.5 h-3.5" />
            Generating...
          {:else}
            <FontAwesomeIcon icon={faComments} class="w-3.5 h-3.5" />
            AI advice
          {/if}
        </button>
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
            AI generate
          {/if}
        </button>
      </div>
    </Card>

    <Card padding="md">
      <form method="POST" action={isNew ? "?/create" : "?/update"} use:enhance={handleSave}>
        {#if isNew}
          <input type="hidden" name="letter_type" value={letter.letter_type} />
        {/if}
        <input type="hidden" name="status" value={editStatus} />
        <input type="hidden" name="content" value={editContent} />
        <div>
          <h3 class="text-base font-semibold text-[var(--dash-text)] mb-3">Or write it yourself</h3>
          <SimpleEditor
            bind:content={editContent}
            markdown={true}
            placeholder="Start writing your letter here..."
          />
        </div>
        <div class="flex items-center justify-end gap-2 mt-4">
          <button
            type="button"
            onclick={() => reviewVersion(editContent)}
            disabled={generating || !editContent.trim()}
            class="px-3 py-1.5 text-xs border border-[var(--dash-border)] rounded-lg text-[var(--dash-text-secondary)] hover:bg-[var(--dash-bg)] hover:text-[var(--dash-text)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            {#if generating}
              <Spinner size="w-3 h-3" />
              Reviewing...
            {:else}
              <FontAwesomeIcon icon={faRobot} class="w-3 h-3" />
              AI review
            {/if}
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
    </Card>
  {/if}
</div>

<!-- Delete Confirmation Modal -->
<ConfirmModal
  isOpen={showDeleteConfirm}
  title="Delete Letter"
  message={"Are you sure you want to delete this letter?\n\nAll versions, feedback, and revision history will be permanently removed. This cannot be undone."}
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

<!-- Overwrite Previous Version Confirmation Modal -->
<ConfirmModal
  isOpen={showOverwriteConfirm}
  title="Save Previous Version"
  message="Saving this version will remove all feedback and versions that came after it. This cannot be undone."
  confirmLabel="Save & continue here"
  onCancel={() => { showOverwriteConfirm = false; pendingOverwriteForm = null; }}
  onConfirm={confirmOverwrite}
/>

<style>
  :global(.ai-feedback p) {
    margin-bottom: 0.5rem;
  }
  :global(.ai-feedback p:last-child) {
    margin-bottom: 0;
  }
  :global(.ai-feedback ul),
  :global(.ai-feedback ol) {
    margin: 0.5rem 0;
    padding-left: 1.5rem;
  }
  :global(.ai-feedback ul) {
    list-style-type: disc;
  }
  :global(.ai-feedback ol) {
    list-style-type: decimal;
  }
  :global(.ai-feedback li) {
    margin-bottom: 0.25rem;
  }
  :global(.ai-feedback strong) {
    font-weight: 600;
  }
  :global(.ai-feedback h1),
  :global(.ai-feedback h2),
  :global(.ai-feedback h3) {
    font-weight: 600;
    margin: 0.75rem 0 0.25rem;
  }
</style>
