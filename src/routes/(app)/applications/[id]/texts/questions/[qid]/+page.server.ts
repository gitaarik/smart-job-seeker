import type { Actions, PageServerLoad } from "./$types";
import { error, fail } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";
import { and, eq } from "drizzle-orm";
import { application_questions, applications } from "$lib/server/db/schema";
import { getSelectedProfileId } from "../../../../../profile/utils";
import {
  buildConversation,
  type ConversationEntry,
  deleteResponse,
  ensureBaselineVersion,
  QUESTION_VERSIONS,
  recordVersionIfChanged,
  trimVersionsAfter,
  type VersionSource,
} from "$lib/server/ai-chat/entity-versions";

export const load: PageServerLoad = async ({ parent, params }) => {
  const layoutData = await parent();
  const application = layoutData.application;

  const qid = parseInt(params.qid);
  if (isNaN(qid)) error(400, "Invalid question ID");

  const question = application.application_questions?.find(
    (q: { id: number }) => q.id === qid,
  );
  if (!question) error(404, "Question not found");

  // The version trail (oldest→newest) drives the timeline editor.
  let conversation = await buildConversation(QUESTION_VERSIONS, qid);

  // Answers created before the version trail existed (question_versions is new)
  // have no rows — surface the saved answer as an initial manual version so the
  // timeline isn't blank. Once any real version is recorded this no longer fires.
  if (conversation.length === 0 && question.answer) {
    const initial: ConversationEntry = {
      versionId: -1,
      type: "manual_edit",
      content: question.answer,
      aiFeedback: null,
      userRequest: null,
      date: question.date_updated ?? question.date_created ?? null,
    };
    conversation = [initial];
  }

  return { question, appId: parseInt(params.id), conversation };
};

/** Verify the question belongs to a profile the user owns; returns it or a fail. */
async function loadOwnedQuestion(
  locals: App.Locals,
  cookies: import("@sveltejs/kit").Cookies,
  appIdRaw: string,
  qidRaw: string,
) {
  const user = locals.user;
  if (!user) {
    return { fail: fail(401, { error: "Not authenticated" }) } as const;
  }

  const profileId = await getSelectedProfileId(cookies, user.id);
  if (!profileId) {
    return { fail: fail(400, { error: "No profile selected" }) } as const;
  }

  const appId = parseInt(appIdRaw);
  if (isNaN(appId)) {
    return { fail: fail(400, { error: "Invalid application ID" }) } as const;
  }

  const qid = parseInt(qidRaw);
  if (isNaN(qid)) {
    return { fail: fail(400, { error: "Invalid question ID" }) } as const;
  }

  const existing = await db.query.applications.findFirst({
    where: and(
      eq(applications.id, appId),
      eq(applications.profile_id, profileId),
    ),
  });
  if (!existing) {
    return { fail: fail(404, { error: "Application not found" }) } as const;
  }

  const question = await db.query.application_questions.findFirst({
    where: and(
      eq(application_questions.id, qid),
      eq(application_questions.application_id, appId),
    ),
  });
  if (!question) {
    return { fail: fail(404, { error: "Question not found" }) } as const;
  }

  return { question, qid } as const;
}

export const actions: Actions = {
  // Commit an answer as a new version. This is the timeline's version writer:
  // it sets the `answer` checkpoint and appends a version when the content
  // actually changed. AI turns append their own versions server-side.
  save: async ({ request, locals, cookies, params }) => {
    const owned = await loadOwnedQuestion(
      locals,
      cookies,
      params.id,
      params.qid,
    );
    if ("fail" in owned) return owned.fail;
    const { question, qid } = owned;

    const formData = await request.formData();
    const answer = (formData.get("content") as string | null)?.trim() || null;
    const deleteAfterVersionId = formData.get("deleteAfterVersionId");

    // Provenance hint from the editor: whether the committed content came from AI.
    const sourceRaw = formData.get("source");
    const source: VersionSource =
      sourceRaw === "ai_generation" || sourceRaw === "ai_revision"
        ? sourceRaw
        : "manual_edit";

    // Saving a previous version removes everything recorded after it.
    if (deleteAfterVersionId) {
      const afterId = parseInt(deleteAfterVersionId as string);
      if (!isNaN(afterId)) {
        await trimVersionsAfter(QUESTION_VERSIONS, qid, afterId);
      }
    }

    // Preserve a pre-version-era answer as a baseline before recording this save.
    await ensureBaselineVersion(QUESTION_VERSIONS, qid, question.answer);

    await db.update(application_questions).set({
      answer,
      date_updated: new Date(),
    }).where(eq(application_questions.id, qid));

    await recordVersionIfChanged(QUESTION_VERSIONS, {
      entityId: qid,
      newContent: answer,
      previousContent: question.answer,
      source,
    });

    return { success: true };
  },

  // Apply a specific version's content as the live answer, without trimming any
  // later versions — a non-destructive "use this version" pointer update. The
  // content already exists as a version, so no new version is recorded.
  applyVersion: async ({ request, locals, cookies, params }) => {
    const owned = await loadOwnedQuestion(
      locals,
      cookies,
      params.id,
      params.qid,
    );
    if ("fail" in owned) return owned.fail;
    const { qid } = owned;

    const formData = await request.formData();
    const content = (formData.get("content") as string | null)?.trim() || null;
    if (!content) return fail(400, { error: "Nothing to apply" });

    await db.update(application_questions).set({
      answer: content,
      date_updated: new Date(),
    }).where(eq(application_questions.id, qid));

    return { success: true };
  },

  // Delete a turn's AI response but keep the user's message, rewinding to that
  // message so it can be edited/regenerated. Non-destructive to the message.
  clearResponse: async ({ request, locals, cookies, params }) => {
    const owned = await loadOwnedQuestion(
      locals,
      cookies,
      params.id,
      params.qid,
    );
    if ("fail" in owned) return owned.fail;
    const { qid } = owned;

    const formData = await request.formData();
    const versionId = parseInt(formData.get("versionId") as string);
    if (isNaN(versionId)) return fail(400, { error: "Invalid version" });

    const { existed, keptMessage, aiChatId, liveContent } =
      await deleteResponse(
        QUESTION_VERSIONS,
        qid,
        versionId,
      );
    if (!existed) return fail(404, { error: "Version not found" });

    // Keep the answer when a message was kept (regenerate will set it); rewind
    // it to the last remaining version on a full delete (null = back to empty).
    await db.update(application_questions).set({
      ai_chat_id: aiChatId,
      ...(keptMessage ? {} : { answer: liveContent }),
    }).where(eq(application_questions.id, qid));

    return { success: true };
  },

  // Persist the question text — a separate concern from answer versioning.
  saveQuestionText: async ({ request, locals, cookies, params }) => {
    const owned = await loadOwnedQuestion(
      locals,
      cookies,
      params.id,
      params.qid,
    );
    if ("fail" in owned) return owned.fail;
    const { qid } = owned;

    const formData = await request.formData();
    const questionText = (formData.get("question") as string | null)?.trim();
    if (!questionText) {
      return fail(400, { error: "Question text cannot be empty" });
    }

    await db.update(application_questions).set({
      question: questionText,
      date_updated: new Date(),
    }).where(eq(application_questions.id, qid));

    return { success: true };
  },
};
