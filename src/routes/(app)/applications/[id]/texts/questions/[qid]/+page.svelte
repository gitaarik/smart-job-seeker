<script lang="ts">
import type { ActionData, PageData } from "./$types";
import { enhance } from "$app/forms";
import { invalidateAll } from "$app/navigation";
import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
import { faArrowLeft, faCheck } from "@fortawesome/free-solid-svg-icons";
import Card from "../../../../../components/Card.svelte";
import ConversationTimeline from "$lib/components/conversation/ConversationTimeline.svelte";
import type { VersionSource } from "$lib/server/ai-chat/entity-versions";

let { data, form }: { data: PageData; form: ActionData } = $props();

let appId = $derived(data.appId);
let question = $derived(data.question);
let questionId = $derived(data.question.id);
let conversation = $derived(data.conversation);

// Question text is edited + saved independently of answer versioning.
let questionText = $state(data.question.question ?? "");
let savedQuestionText = $derived(data.question.question ?? "");
let questionDirty = $derived(
  questionText.trim() !== savedQuestionText && questionText.trim().length > 0,
);

const QUESTION_LABELS: Record<VersionSource, string> = {
  manual_edit: "Manual edit",
  ai_generation: "AI drafted answer",
  ai_advice: "AI recommendations",
  ai_review: "AI review",
  ai_revision: "AI revised answer",
};

const placeholder = "Write your answer here, or start with AI below.";

async function apiGenerate(mode: "generate" | "advice" | "review") {
  const res = await fetch(`/api/ai/questions/${questionId}/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode }),
  });
  const result = await res.json();
  if (!result.success) throw new Error(result.message || "Generation failed");
}

async function apiFollowup(
  text: string,
  updateContent: boolean,
  mode?: "feedback" | "review",
  replaceVersionId?: number,
) {
  const res = await fetch(`/api/ai/questions/${questionId}/followup`, {
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

async function apiSaveContent(content: string, deleteAfterVersionId?: number) {
  const fd = new FormData();
  fd.set("content", content);
  fd.set("source", "manual_edit");
  if (deleteAfterVersionId) {
    fd.set("deleteAfterVersionId", String(deleteAfterVersionId));
  }
  await fetch(`/applications/${appId}/texts/questions/${questionId}?/save`, {
    method: "POST",
    body: fd,
  });
}

// ---- Timeline callbacks (persist + invalidate; throw a message on failure) ----

async function onGenerate(mode: "generate" | "advice") {
  await apiGenerate(mode);
  await invalidateAll();
}

async function onReview(content: string) {
  // Save the content first if it differs from the latest version (avoid dupes)
  const latestContent = conversation.findLast((e) => e.content)?.content;
  if (content !== latestContent) {
    await apiSaveContent(content);
    await invalidateAll();
  }
  if (question.ai_chat_id) {
    await apiFollowup(
      "Please review my answer and give me concise feedback: what works well, what could be improved, and any specific suggestions.",
      false,
      "review",
    );
  } else {
    await apiGenerate("review");
  }
  await invalidateAll();
}

async function onSendFollowup(
  text: string,
  opts: { updateContent: boolean; replaceVersionId?: number },
) {
  await apiFollowup(text, opts.updateContent, undefined, opts.replaceVersionId);
  await invalidateAll();
}

async function onSaveVersion(
  content: string,
  opts: { deleteAfterVersionId?: number },
) {
  await apiSaveContent(content, opts.deleteAfterVersionId);
  await invalidateAll();
}

// Non-destructive: make a chosen version the live answer without trimming.
async function onApplyVersion(content: string) {
  const fd = new FormData();
  fd.set("content", content);
  await fetch(
    `/applications/${appId}/texts/questions/${questionId}?/applyVersion`,
    {
      method: "POST",
      body: fd,
    },
  );
  await invalidateAll();
}

// Delete a turn's AI response but keep the message (rewind to it).
async function onClearResponse(versionId: number) {
  const fd = new FormData();
  fd.set("versionId", String(versionId));
  await fetch(
    `/applications/${appId}/texts/questions/${questionId}?/clearResponse`,
    {
      method: "POST",
      body: fd,
    },
  );
  await invalidateAll();
}

function handleQuestionSave() {
  return async (
    { result, update }: {
      result: { type: string };
      update: () => Promise<void>;
    },
  ) => {
    await update();
    if (result.type === "success") await invalidateAll();
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

  {#if form?.error}
    <div class="bg-[var(--dash-error-light)] border border-[var(--dash-error)] rounded-lg p-4">
      <p class="text-[var(--dash-error)] text-sm">{form.error}</p>
    </div>
  {/if}

  <!-- Question text (saved independently of the answer) -->
  <Card padding="md">
    <form method="POST" action="?/saveQuestionText" use:enhance={handleQuestionSave}>
      <label for="q-text" class="block text-sm font-medium text-[var(--dash-text-secondary)] mb-1">Question</label>
      <div class="flex items-start gap-2">
        <input
          id="q-text"
          name="question"
          type="text"
          bind:value={questionText}
          class="flex-1 px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
        />
        {#if questionDirty}
          <button
            type="submit"
            class="px-3 py-2 text-sm bg-[var(--dash-primary)] text-white rounded-lg hover:bg-[var(--dash-primary-hover)] transition-colors flex items-center gap-1.5 whitespace-nowrap"
          >
            <FontAwesomeIcon icon={faCheck} class="w-3.5 h-3.5" /> Save question
          </button>
        {/if}
      </div>
    </form>
  </Card>

  <ConversationTimeline
    {conversation}
    aiChatId={question.ai_chat_id}
    hasContent={!!question.answer}
    {placeholder}
    labels={QUESTION_LABELS}
    {onGenerate}
    {onReview}
    {onSendFollowup}
    {onSaveVersion}
    {onApplyVersion}
    {onClearResponse}
    currentContent={question.answer}
  />
</div>
