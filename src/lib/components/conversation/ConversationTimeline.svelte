<script lang="ts">
  /**
   * Shared conversation-timeline editor for application texts (cover letters and
   * question answers). Renders the version thread as inline bubbles with
   * word-level diffs, inline editing, AI review, and a followup feedback loop.
   *
   * It owns all ephemeral UI state (which version is being edited, diff
   * show/hide, busy/error, scroll-to-last) and the busy/scroll/error
   * orchestration. It owns NO persistence: every mutation is delegated to a
   * callback the host page supplies, which performs the fetch/action and
   * `invalidateAll()`s before resolving. Callbacks throw on failure with a
   * user-facing message, which this component surfaces.
   */
  import { afterNavigate } from "$app/navigation";
  import { tick } from "svelte";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faCheck,
    faComments,
    faEye,
    faEyeSlash,
    faPencil,
    faRobot,
  } from "@fortawesome/free-solid-svg-icons";
  import { renderSafeMarkdown } from "$lib/utils/safe-markdown";
  import { computeDiff, isSmallDiff } from "$lib/utils/word-diff";
  import Card from "../../../routes/(app)/components/Card.svelte";
  import Spinner from "$lib/components/Spinner.svelte";
  import SimpleEditor from "$lib/components/SimpleEditor.svelte";
  import ConfirmModal from "../../../routes/(app)/profile/components/ConfirmModal.svelte";
  import type { ConversationEntry, VersionSource } from "$lib/server/ai-chat/entity-versions";

  type BusyMode = "generate" | "advice" | "followup" | "review";

  let {
    conversation,
    aiChatId,
    hasContent,
    placeholder,
    labels,
    onGenerate,
    onReview,
    onSendFollowup,
    onSaveVersion,
  }: {
    conversation: ConversationEntry[];
    /** Gates the followup affordances — null means no AI thread exists yet. */
    aiChatId: number | null;
    /** True when the entity already holds content outside the version trail. */
    hasContent: boolean;
    placeholder: string;
    /** Human labels per version source (entity-specific wording). */
    labels: Record<VersionSource, string>;
    onGenerate: (mode: "generate" | "advice") => Promise<void>;
    onReview: (content: string) => Promise<void>;
    onSendFollowup: (
      text: string,
      opts: { updateContent: boolean; replaceVersionId?: number },
    ) => Promise<void>;
    onSaveVersion: (
      content: string,
      opts: { deleteAfterVersionId?: number },
    ) => Promise<void>;
  } = $props();

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

  // Inline edit state: which version index is being edited, or -1 for the
  // empty-state / advice-only editors.
  let editingIndex = $state<number | null>(null);
  let editContent = $state("");
  let isEditing = $derived(editingIndex !== null);

  // AI orchestration state (owned here; callbacks are awaited through run()).
  let busy = $state(false);
  let busyMode = $state<BusyMode | null>(null);
  let aiError = $state<string | null>(null);
  let feedbackText = $state("");

  // Feedback editing state
  let editingFeedbackIndex = $state<number | null>(null);
  let editingFeedbackText = $state("");

  // Scroll target
  let lastEntryEl = $state<HTMLElement | null>(null);

  // Confirm dialog for saving a previous version (will remove later entries)
  let showOverwriteConfirm = $state(false);
  let pendingOverwrite = $state<{ content: string; versionId: number } | null>(null);

  // Diff view state: manually toggled on/off overrides auto-show
  let diffShown = $state(new Set<number>());
  let diffHidden = $state(new Set<number>());

  // Scroll to last entry on page load / navigation
  afterNavigate(async () => {
    await tick();
    lastEntryEl?.scrollIntoView({ block: "start" });
  });

  /**
   * Run one host callback with the shared busy/scroll/error choreography.
   * The callback persists + invalidates; on failure it throws a message.
   */
  async function run(mode: BusyMode, fn: () => Promise<void>) {
    busy = true;
    busyMode = mode;
    aiError = null;
    try {
      await fn();
      await tick();
      lastEntryEl?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (e) {
      aiError = e instanceof Error && e.message ? e.message : "Network error. Please try again.";
    } finally {
      busy = false;
      busyMode = null;
    }
  }

  function getPreviousContent(entryIndex: number): string | null {
    for (let i = entryIndex - 1; i >= 0; i--) {
      if (conversation[i].content) return conversation[i].content!;
    }
    return null;
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
    editContent = content ?? "";
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
    for (let i = editingIndex + 1; i < conversation.length; i++) {
      if (conversation[i].content || conversation[i].aiFeedback || conversation[i].userRequest) return true;
    }
    return false;
  }

  function saveEdit() {
    if (isEditingPreviousVersion()) {
      const entry = conversation[editingIndex!];
      pendingOverwrite = { content: editContent, versionId: entry.versionId };
      showOverwriteConfirm = true;
    } else {
      const content = editContent;
      run("followup", async () => {
        await onSaveVersion(content, {});
        editingIndex = null;
      });
    }
  }

  function confirmOverwrite() {
    showOverwriteConfirm = false;
    const pending = pendingOverwrite;
    pendingOverwrite = null;
    if (!pending) return;
    run("followup", async () => {
      await onSaveVersion(pending.content, { deleteAfterVersionId: pending.versionId });
      editingIndex = null;
    });
  }

  function formatDate(date: Date | string | null): string {
    if (!date) return "";
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  function entryLabel(entry: ConversationEntry): string {
    return labels[entry.type] ?? "Version";
  }

  function isUserEntry(entry: ConversationEntry): boolean {
    return entry.type === "manual_edit";
  }
</script>

{#if aiError}
  <div class="bg-[var(--dash-error-light)] border border-[var(--dash-error)] rounded-lg p-4">
    <p class="text-[var(--dash-error)] text-sm">{aiError}</p>
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
        {#if editingFeedbackIndex !== entryIndex && !busy}
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
          disabled={busy}
          class="w-full px-2 py-1.5 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent text-sm resize-y disabled:opacity-50 mt-1"
        ></textarea>
        <div class="flex items-center gap-1.5 mt-1.5">
          <button
            type="button"
            onclick={() => run("followup", async () => {
              await onSendFollowup(editingFeedbackText, { updateContent: true, replaceVersionId: entry.versionId });
              feedbackText = "";
              editingFeedbackIndex = null;
            })}
            disabled={busy || !editingFeedbackText.trim()}
            class="px-2 py-1 text-xs bg-[var(--dash-primary)] text-white rounded hover:bg-[var(--dash-primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
          >
            {#if busy && busyMode === "followup"}
              <Spinner size="w-2.5 h-2.5" />
              Resending...
            {:else}
              Resend
            {/if}
          </button>
          <button
            type="button"
            onclick={() => { editingFeedbackIndex = null; }}
            disabled={busy}
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
      <div class="ai-feedback text-sm text-[var(--dash-text)] mb-1">{@html renderSafeMarkdown(entry.aiFeedback)}</div>
      {#if !entry.content && !isEditing && entry.type !== "ai_advice"}
        {@const hasExistingVersion = conversation.some((e) => e.content)}
        <button
          type="button"
          onclick={() => run("followup", () => onSendFollowup("Please revise the text based on your feedback above.", { updateContent: true }))}
          disabled={busy}
          class="mt-1 px-2 py-1 text-xs border border-[var(--dash-border)] rounded text-[var(--dash-text-secondary)] hover:bg-[var(--dash-bg)] hover:text-[var(--dash-text)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
        >
          {#if busy && busyMode === "followup"}
            <Spinner size="w-2.5 h-2.5" />
            Generating...
          {:else}
            <FontAwesomeIcon icon={faRobot} class="w-2.5 h-2.5" />
            Generate revision from this feedback
          {/if}
        </button>
        <!-- Feedback input on last review-only entry (no revised version) -->
        {#if isLast && hasExistingVersion && aiChatId}
          <div class="mt-3 pt-3 border-t {borderColor} space-y-2">
            <textarea
              bind:value={feedbackText}
              placeholder="Tell the AI what to change, improve, or adjust..."
              rows={3}
              disabled={busy}
              class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent text-sm resize-y disabled:opacity-50"
            ></textarea>
            <div class="flex items-center justify-end">
              <button
                type="button"
                onclick={() => run("followup", async () => { await onSendFollowup(feedbackText, { updateContent: true }); feedbackText = ""; })}
                disabled={busy || !feedbackText.trim()}
                class="px-3 py-1.5 text-xs bg-[var(--dash-primary)] text-white rounded-lg hover:bg-[var(--dash-primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {#if busy && busyMode === "followup"}
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
      <SimpleEditor
        bind:content={editContent}
        markdown={true}
        {placeholder}
      />
      <div class="flex items-center justify-end gap-2 mt-2">
        <button
          type="button"
          onclick={() => run("review", () => onReview(editContent))}
          disabled={busy || !editContent.trim()}
          class="px-3 py-1.5 text-xs border border-[var(--dash-border)] rounded-lg text-[var(--dash-text-secondary)] hover:bg-[var(--dash-bg)] hover:text-[var(--dash-text)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
        >
          {#if busy && busyMode === "review"}
            <Spinner size="w-3 h-3" />
            Reviewing...
          {:else}
            <FontAwesomeIcon icon={faRobot} class="w-3 h-3" />
            AI review
          {/if}
        </button>
        <button
          type="button"
          onclick={() => run("followup", () => onSaveVersion(editContent, {}))}
          disabled={busy || !editContent.trim()}
          class="px-3 py-1.5 text-xs bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-600 hover:bg-emerald-500/20 hover:border-emerald-500/50 hover:text-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
        >
          <FontAwesomeIcon icon={faCheck} class="w-3 h-3" />
          Save
        </button>
      </div>
    </div>
  {/if}
  <!-- Version box -->
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
          <div class="flex items-center gap-1.5 mt-2">
            {#if editingPrevious}
              <button
                type="button"
                disabled={busy || !editContent.trim()}
                onclick={saveEdit}
                class="px-2 py-1 text-xs bg-amber-500/80 text-white rounded hover:bg-amber-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
              >
                Save & continue here
              </button>
            {:else}
              <button
                type="button"
                disabled={busy || !editContent.trim()}
                onclick={saveEdit}
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
                onclick={() => run("review", () => onReview(entry.content!))}
                disabled={busy}
                class="px-2 py-1 text-xs border border-[var(--dash-border)] rounded text-[var(--dash-text-secondary)] hover:bg-[var(--dash-bg)] hover:text-[var(--dash-text)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
              >
                {#if busy && busyMode === "review"}
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
  {#if isLast && entry.content && !isEditing && aiChatId && (entry.type === "ai_revision" || entry.type === "ai_review" || entry.type === "ai_generation")}
    <div class="mt-3 space-y-2">
      <textarea
        bind:value={feedbackText}
        placeholder="Tell the AI what to change, improve, or adjust..."
        rows={3}
        disabled={busy}
        class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent text-sm resize-y disabled:opacity-50"
      ></textarea>
      <div class="flex items-center justify-end">
        <button
          type="button"
          onclick={() => run("followup", async () => { await onSendFollowup(feedbackText, { updateContent: true }); feedbackText = ""; })}
          disabled={busy || !feedbackText.trim()}
          class="px-3 py-1.5 text-xs bg-[var(--dash-primary)] text-white rounded-lg hover:bg-[var(--dash-primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
        >
          {#if busy && busyMode === "followup"}
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

{#if !hasContent && conversation.length === 0}
  <!-- Empty State: no content, no history -->
  <Card padding="md">
    <h3 class="text-base font-semibold text-[var(--dash-text)] mb-3">Start with AI</h3>
    <div class="flex flex-wrap gap-2">
      <button
        type="button"
        onclick={() => run("advice", () => onGenerate("advice"))}
        disabled={busy}
        class="px-3 py-1.5 text-sm bg-[var(--dash-primary)] text-white rounded-lg hover:bg-[var(--dash-primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
      >
        {#if busy && busyMode === "advice"}
          <Spinner size="w-3.5 h-3.5" />
          Generating...
        {:else}
          <FontAwesomeIcon icon={faComments} class="w-3.5 h-3.5" />
          AI advice
        {/if}
      </button>
      <button
        type="button"
        onclick={() => run("generate", () => onGenerate("generate"))}
        disabled={busy}
        class="px-3 py-1.5 text-sm bg-[var(--dash-primary)] text-white rounded-lg hover:bg-[var(--dash-primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
      >
        {#if busy && busyMode === "generate"}
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
    <h3 class="text-base font-semibold text-[var(--dash-text)] mb-3">Or write it yourself</h3>
    <SimpleEditor
      bind:content={editContent}
      markdown={true}
      {placeholder}
    />
    <div class="flex items-center justify-end gap-2 mt-4">
      <button
        type="button"
        onclick={() => run("review", () => onReview(editContent))}
        disabled={busy || !editContent.trim()}
        class="px-3 py-1.5 text-xs border border-[var(--dash-border)] rounded-lg text-[var(--dash-text-secondary)] hover:bg-[var(--dash-bg)] hover:text-[var(--dash-text)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
      >
        {#if busy && busyMode === "review"}
          <Spinner size="w-3 h-3" />
          Reviewing...
        {:else}
          <FontAwesomeIcon icon={faRobot} class="w-3 h-3" />
          AI review
        {/if}
      </button>
      <button
        type="button"
        onclick={() => run("followup", () => onSaveVersion(editContent, {}))}
        disabled={busy || !editContent.trim()}
        class="px-3 py-1.5 text-xs bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-600 hover:bg-emerald-500/20 hover:border-emerald-500/50 hover:text-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
      >
        <FontAwesomeIcon icon={faCheck} class="w-3 h-3" />
        Save
      </button>
    </div>
  </Card>
{/if}

<!-- Overwrite Previous Version Confirmation Modal -->
<ConfirmModal
  isOpen={showOverwriteConfirm}
  title="Save Previous Version"
  message="Saving this version will remove all feedback and versions that came after it. This cannot be undone."
  confirmLabel="Save & continue here"
  onCancel={() => { showOverwriteConfirm = false; pendingOverwrite = null; }}
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
