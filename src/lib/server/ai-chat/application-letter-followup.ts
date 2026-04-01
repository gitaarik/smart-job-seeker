/**
 * Create follow-up AI chat for application letters
 */

import { db } from "$lib/server/db";
import { createEntityFollowup, type FollowupResult } from "./entity-followup";

/** Maps letter_type to the review_* prompt template name */
const LETTER_TYPE_TO_REVIEW_PROMPT: Record<string, string> = {
  cover_letter: "review_cover_letter",
  motivation_letter: "review_motivation_letter",
  follow_up_email: "review_follow_up_email",
  thank_you_letter: "review_thank_you_letter",
};

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
  mode?: "feedback" | "review",
): Promise<FollowupResult> {
  // For review mode, look up the letter type and fetch context for the review prompt
  let promptType: string | undefined;
  let extraVariables: Record<string, unknown> | undefined;
  if (mode === "review") {
    const letterRecord = await db.application_letters.findUnique({
      where: { id: letterId },
      select: {
        letter_type: true,
        content: true,
        applications: {
          select: {
            jobs: {
              select: {
                title: true,
                job_description: true,
                company_description: true,
                job_poster: true,
              },
            },
          },
        },
      },
    });
    if (letterRecord) {
      promptType = LETTER_TYPE_TO_REVIEW_PROMPT[letterRecord.letter_type] || undefined;
      const job = letterRecord.applications?.jobs;
      extraVariables = {
        generationMode: "review",
        letterContent: letterRecord.content || "",
        jobDetails: job ? {
          position: job.title || "Not specified",
          job_description: job.job_description || "Not specified",
          ...(job.company_description ? { company_description: job.company_description } : {}),
          ...(job.job_poster ? { postedBy: job.job_poster } : {}),
        } : {},
        additionalContext: "",
      };
    }
  } else if (updateContent) {
    promptType = "followup_letter";
  }

  return createEntityFollowup({
    entityId: letterId,
    entityLabel: "application letter",
    noAiChatHint: "Generate the initial letter first.",
    followupRequest,
    includeOriginalContext,
    promptType,
    customVariables: extraVariables,
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
