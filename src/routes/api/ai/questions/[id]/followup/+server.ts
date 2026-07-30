import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db } from "$lib/server/db";
import { eq } from "drizzle-orm";
import { application_questions } from "$lib/server/db/schema";
import { parseIntParam, requireAuth } from "$lib/server/utils/api-helpers";
import {
  followupRequestSchema,
  parseBody,
} from "$lib/server/validation/api-schemas";
import { createApplicationQuestionFollowup } from "$lib/server/ai-chat/application-question-followup";
import { generateApplicationQuestionAnswer } from "$lib/server/ai-chat/application-question";
import { trackGeneration } from "$lib/server/ai-chat/ai-generation-status";
import {
  QUESTION_VERSIONS,
  trimVersionsFrom,
} from "$lib/server/ai-chat/entity-versions";
import { requireCredits } from "$lib/server/billing/require-credits";

export const POST: RequestHandler = async ({ params, request, locals }) => {
  const user = requireAuth(locals);
  const questionId = parseIntParam(params.id, "question");

  // Verify ownership: question -> application -> profile -> user
  const question = await db.query.application_questions.findFirst({
    where: eq(application_questions.id, questionId),
    with: {
      application: {
        with: { profile: { columns: { user_id: true } } },
      },
    },
  });

  if (!question || question.application.profile.user_id !== user.id) {
    return json({ success: false, message: "Question not found" }, {
      status: 404,
    });
  }

  const {
    followupRequest,
    includeOriginalContext,
    updateContent,
    mode,
    replaceVersionId,
  } = parseBody(
    followupRequestSchema,
    await request.json(),
  );

  // If replacing a version, delete it and all subsequent versions first, then
  // restore the ai_chat pointer to the last remaining version — via the engine.
  //
  // Editing the message of the turn that STARTED the thread is a special case:
  // the trim takes that turn's ai_chat with it, so there is nothing left to
  // follow up on. Restart the same kind of turn instead, with the edited
  // message as its brief, rather than failing with "does not have an ai_chats
  // yet". Only generate/advice can start a thread with a message attached.
  let restartMode: "generate" | "advice" | null = null;
  if (replaceVersionId) {
    const { existed, removedSource, last } = await trimVersionsFrom(
      QUESTION_VERSIONS,
      questionId,
      replaceVersionId,
    );
    if (!existed) {
      return json({ success: false, message: "Version not found" }, {
        status: 404,
      });
    }
    await db.update(application_questions).set({
      ai_chat_id: last?.ai_chat ?? null,
    }).where(eq(application_questions.id, questionId));
    if (!last?.ai_chat) {
      restartMode = removedSource === "ai_advice" ? "advice" : "generate";
    }
  }

  await requireCredits(user.id, 5);

  const result = await trackGeneration(
    "question",
    questionId,
    mode ?? "followup",
    () =>
      restartMode
        ? generateApplicationQuestionAnswer(questionId, {
          mode: restartMode,
          instructions: followupRequest,
        })
        : createApplicationQuestionFollowup(
          questionId,
          followupRequest,
          includeOriginalContext,
          updateContent,
          mode,
        ),
  );

  if (!result.success) {
    return json(result, { status: 422 });
  }

  return json(result);
};
