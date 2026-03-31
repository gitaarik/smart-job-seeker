/**
 * Create follow-up AI chat for application letters
 */

import { db } from "$lib/server/db";
import { createEntityFollowup, type FollowupResult } from "./entity-followup";

/**
 * Parse a structured JSON letter response.
 * Expects { letter: string, summary?: string } from structured output.
 * Falls back to treating the whole response as the letter if not JSON.
 */
function parseLetterResponse(response: string | null): { letter: string | null; summary: string | null } {
  if (!response) return { letter: null, summary: null };
  try {
    const parsed = JSON.parse(response);
    if (parsed && typeof parsed.letter === "string") {
      return {
        letter: parsed.letter,
        summary: typeof parsed.summary === "string" ? parsed.summary : null,
      };
    }
  } catch {
    // Not JSON, use raw response
  }
  return { letter: response, summary: null };
}

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
    // Use followup_letter prompt when updating content (feedback mode)
    // to get structured response with changes summary
    promptType: updateContent ? "followup_letter" : undefined,
    fetchEntity: (id) =>
      db.application_letters.findUnique({
        where: { id },
        select: { id: true, ai_chat: true },
      }),
    updateEntity: (id, aiChatId, aiChatResponse) => {
      // For feedback mode, parse out the letter from any summary
      const { letter } = updateContent
        ? parseLetterResponse(aiChatResponse)
        : { letter: aiChatResponse };

      return db.application_letters.update({
        where: { id },
        data: {
          ai_chat: aiChatId,
          ai_chat_response: aiChatResponse,
          ...(updateContent ? { content: letter } : {}),
        },
      }).then(() => {});
    },
  });
}
