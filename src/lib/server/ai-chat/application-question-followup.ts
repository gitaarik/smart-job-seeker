/**
 * Create follow-up AI chat for application questions
 */

import { db } from "$lib/server/db";
import { createEntityFollowup, type FollowupResult } from "./entity-followup";

export async function createApplicationQuestionFollowup(
  questionId: number,
  followupRequest: string,
  includeOriginalContext?: boolean,
): Promise<FollowupResult> {
  return createEntityFollowup({
    entityId: questionId,
    entityLabel: "application question",
    noAiChatHint: "Generate the initial answer first.",
    followupRequest,
    includeOriginalContext,
    fetchEntity: (id) =>
      db.application_questions.findUnique({
        where: { id },
        select: { id: true, ai_chat: true },
      }),
    updateEntity: (id, aiChatId, aiChatResponse) =>
      db.application_questions.update({
        where: { id },
        data: { ai_chat: aiChatId, ai_chat_response: aiChatResponse },
      }).then(() => {}),
  });
}
