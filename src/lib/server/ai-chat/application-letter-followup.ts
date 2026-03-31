/**
 * Create follow-up AI chat for application letters
 */

import { db } from "$lib/server/db";
import { createEntityFollowup, type FollowupResult } from "./entity-followup";

export async function createApplicationLetterFollowup(
  letterId: number,
  followupRequest: string,
  includeOriginalContext?: boolean,
  updateContent?: boolean,
): Promise<FollowupResult> {
  return createEntityFollowup({
    entityId: letterId,
    entityLabel: "application letter",
    noAiChatHint: "Generate the initial letter first.",
    followupRequest,
    includeOriginalContext,
    fetchEntity: (id) =>
      db.application_letters.findUnique({
        where: { id },
        select: { id: true, ai_chat: true },
      }),
    updateEntity: (id, aiChatId, aiChatResponse) =>
      db.application_letters.update({
        where: { id },
        data: {
          ai_chat: aiChatId,
          ai_chat_response: aiChatResponse,
          ...(updateContent ? { content: aiChatResponse } : {}),
        },
      }).then(() => {}),
  });
}
