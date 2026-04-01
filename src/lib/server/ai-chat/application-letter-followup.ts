/**
 * Create follow-up AI chat for application letters
 */

import { db } from "$lib/server/db";
import { createEntityFollowup, type FollowupResult } from "./entity-followup";

/** Profile data fields relevant for letter followups */
const LETTER_PROFILE_FIELDS = [
  "name", "title", "headline", "subtitle", "summary", "location",
  "core_stack", "highlights",
  "work_experiences", "side_projects", "education",
  "tech_skill_categories", "languages",
];

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

/** Format job data as readable text for prompts */
function formatJobDetails(job: { title: string | null; job_description: string | null; company_description: string | null; job_poster: string | null }): string {
  const lines: string[] = [`**Position:** ${job.title || "Not specified"}`];
  if (job.job_poster) lines.push(`**Company:** ${job.job_poster}`);
  if (job.company_description) lines.push(`**About the company:** ${job.company_description}`);
  lines.push("", "**Job Description:**", job.job_description || "Not specified");
  return lines.join("\n");
}

export async function createApplicationLetterFollowup(
  letterId: number,
  followupRequest: string,
  includeOriginalContext?: boolean,
  updateContent?: boolean,
  mode?: "feedback" | "review",
): Promise<FollowupResult> {
  // For review or followup_letter mode, look up letter and job context
  let promptType: string | undefined;
  let extraVariables: Record<string, unknown> | undefined;
  if (mode === "review" || updateContent) {
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
      const job = letterRecord.applications?.jobs;
      const jobDetailsText = job ? formatJobDetails(job) : "";

      if (mode === "review") {
        promptType = LETTER_TYPE_TO_REVIEW_PROMPT[letterRecord.letter_type] || undefined;
        extraVariables = {
          generationMode: "review",
          letterContent: letterRecord.content || "",
          jobDetails: jobDetailsText,
          additionalContext: "",
        };
      } else {
        // followup_letter — new slimmed-down prompt needs job + letter directly
        promptType = "followup_letter";
        extraVariables = {
          letterContent: letterRecord.content || "",
          jobDetails: jobDetailsText,
        };
      }
    }
  }

  return createEntityFollowup({
    entityId: letterId,
    entityLabel: "application letter",
    noAiChatHint: "Generate the initial letter first.",
    followupRequest,
    includeOriginalContext,
    promptType,
    customVariables: extraVariables,
    profileDataFields: LETTER_PROFILE_FIELDS,
    fetchEntity: (id) =>
      db.application_letters.findUnique({
        where: { id },
        select: { id: true, ai_chat: true },
      }),
    updateEntity: async (id, aiChatId, aiChatResponse) => {
      // Parse structured response (letter + summary)
      const { letter, summary } = updateContent
        ? parseLetterResponse(aiChatResponse)
        : { letter: aiChatResponse, summary: null };

      await db.application_letters.update({
        where: { id },
        data: {
          ai_chat: aiChatId,
          ai_chat_response: aiChatResponse,
          ...(updateContent ? { content: letter } : {}),
        },
      });

      // Record version in letter_versions
      if (mode === "review") {
        // Parse review response for feedback + revisedLetter
        let aiFeedback: string | null = null;
        let revisedLetter: string | null = null;
        if (aiChatResponse) {
          try {
            const parsed = JSON.parse(aiChatResponse);
            if (parsed && typeof parsed.feedback === "string") {
              aiFeedback = parsed.feedback;
              revisedLetter = typeof parsed.revisedLetter === "string" ? parsed.revisedLetter : null;
            }
          } catch {
            aiFeedback = aiChatResponse;
          }
        }
        await db.letter_versions.create({
          data: {
            letter: id,
            content: revisedLetter,
            source: "ai_review",
            ai_chat: aiChatId,
            ai_feedback: aiFeedback,
            user_request: followupRequest,
          },
        });
      } else if (updateContent && letter) {
        await db.letter_versions.create({
          data: {
            letter: id,
            content: letter,
            source: "ai_revision",
            ai_chat: aiChatId,
            ai_feedback: summary,
            user_request: followupRequest,
          },
        });
      }
    },
  });
}
