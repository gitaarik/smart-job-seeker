<script lang="ts">
import type { ActionData, PageData } from "./$types";
import { goto, invalidateAll } from "$app/navigation";
import { page } from "$app/stores";
import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
import { faArrowLeft, faTrash } from "@fortawesome/free-solid-svg-icons";
import { track } from "$lib/tools/analytics";
import ConversationTimeline from "$lib/components/conversation/ConversationTimeline.svelte";
import ConfirmModal from "../../../../profile/components/ConfirmModal.svelte";
import type { VersionSource } from "$lib/server/ai-chat/entity-versions";

let { data, form }: { data: PageData; form: ActionData } = $props();

let letter = $derived(data.letter);
let conversation = $derived(data.conversation);
let isNew = $derived(data.isNew);
let appId = $derived($page.params.id);

let showDeleteConfirm = $state(false);

const letterTypes: Record<string, string> = {
  cover_letter: "Cover Letter",
  cheat_sheet: "Interview Cheat Sheet",
};

const LETTER_LABELS: Record<VersionSource, string> = {
  manual_edit: "Manual edit",
  ai_generation: "AI assisted letter",
  ai_advice: "AI recommendations",
  ai_review: "AI review",
  ai_revision: "AI revised letter",
};

let typeLabel = $derived(letterTypes[letter.letter_type] || letter.letter_type);
let placeholder = $derived(`Write your ${typeLabel.toLowerCase()} here...`);

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
  await goto(`/applications/${appId}/texts/${result.letterId}`, {
    replaceState: true,
  });
  return result.letterId;
}

async function apiGenerate(
  letterId: number,
  mode: "generate" | "advice" | "review",
) {
  const res = await fetch(`/api/ai/letters/${letterId}/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode }),
  });
  const result = await res.json();
  if (!result.success) throw new Error(result.message || "Generation failed");
}

async function apiFollowup(
  letterId: number,
  text: string,
  updateContent: boolean,
  mode?: "feedback" | "review",
  replaceVersionId?: number,
) {
  const res = await fetch(`/api/ai/letters/${letterId}/followup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      followupRequest: text,
      includeOriginalContext: true,
      updateContent,
      ...(mode ? { mode } : {}),
      ...(replaceVersionId ? { replaceVersionId } : {}),
    }),
  });
  const result = await res.json();
  if (!result.success) throw new Error(result.message || "Follow-up failed");
}

// POST a form action and throw if it didn't succeed, so callers (wrapped in the
// timeline's run()) surface the failure instead of silently doing nothing.
async function postAction(letterId: number, action: string, fd: FormData) {
  const res = await fetch(
    `/applications/${appId}/texts/${letterId}?/${action}`,
    { method: "POST", headers: { "x-sveltekit-action": "true" }, body: fd },
  );
  const result = await res.json().catch(() => null);
  if (result?.type !== "success") {
    throw new Error("That change couldn't be saved — please try again.");
  }
}

async function apiSaveContent(
  letterId: number,
  content: string,
  deleteAfterVersionId?: number,
) {
  const fd = new FormData();
  fd.set("content", content);
  fd.set("status", letter.status || "draft");
  fd.set("source", "manual_edit");
  if (deleteAfterVersionId) {
    fd.set("deleteAfterVersionId", String(deleteAfterVersionId));
  }
  await postAction(letterId, "update", fd);
}

// ---- Timeline callbacks (persist + invalidate; throw a message on failure) ----

async function onGenerate(mode: "generate" | "advice") {
  const letterId = await ensureLetterExists();
  await apiGenerate(letterId, mode);
  // Activation funnel: only count fresh "generate" runs, not advice/review.
  if (mode === "generate") track("ai_letter_generated");
  await invalidateAll();
}

async function onReview(content: string) {
  const letterId = await ensureLetterExists();
  // Only save if the content differs from the latest version (avoid dupes)
  const latestContent = conversation.findLast((e) => e.content)?.content;
  if (content !== latestContent) {
    await apiSaveContent(letterId, content);
    await invalidateAll();
  }
  if (letter.ai_chat_id) {
    await apiFollowup(
      letterId,
      "Please review my letter and give me concise feedback: what works well, what could be improved, and any specific suggestions.",
      false,
      "review",
    );
  } else {
    await apiGenerate(letterId, "review");
  }
  await invalidateAll();
}

async function onSendFollowup(
  text: string,
  opts: { updateContent: boolean; replaceVersionId?: number },
) {
  const letterId = await ensureLetterExists();
  await apiFollowup(
    letterId,
    text,
    opts.updateContent,
    undefined,
    opts.replaceVersionId,
  );
  await invalidateAll();
}

async function onSaveVersion(
  content: string,
  opts: { deleteAfterVersionId?: number },
) {
  const letterId = await ensureLetterExists();
  await apiSaveContent(letterId, content, opts.deleteAfterVersionId);
  await invalidateAll();
}

// Delete a turn's AI response but keep the message (rewind to it).
async function onClearResponse(versionId: number) {
  if (isNew) return;
  const fd = new FormData();
  fd.set("versionId", String(versionId));
  await postAction(letter.id, "clearResponse", fd);
  await invalidateAll();
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
      <h2 class="text-xl font-bold text-[var(--dash-text)]">{typeLabel}</h2>
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

  {#if form?.error}
    <div class="bg-[var(--dash-error-light)] border border-[var(--dash-error)] rounded-lg p-4">
      <p class="text-[var(--dash-error)] text-sm">{form.error}</p>
    </div>
  {/if}

  <ConversationTimeline
    {conversation}
    aiChatId={letter.ai_chat_id}
    hasContent={!!letter.content}
    {placeholder}
    labels={LETTER_LABELS}
    {onGenerate}
    {onReview}
    {onSendFollowup}
    {onSaveVersion}
    {onClearResponse}
  />
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
