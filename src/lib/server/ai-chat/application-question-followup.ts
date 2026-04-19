/**
 * Create follow-up AI chat for application questions
 */

import { db } from "$lib/server/db";
import { eq } from "drizzle-orm";
import { application_questions } from "$lib/server/db/schema";
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
      db.query.application_questions.findFirst({
        where: eq(application_questions.id, id),
        columns: { id: true, ai_chat_id: true },
      }).then((r) => r ?? null),
    updateEntity: (id, aiChatId, aiChatResponse) =>
      db.update(application_questions).set({ ai_chat_id: aiChatId, ai_chat_response: aiChatResponse, answer: aiChatResponse })
        .where(eq(application_questions.id, id))
        .then(() => {}),
  });
}
