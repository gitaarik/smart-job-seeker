/**
 * Create follow-up AI chat for application letters
 */

import { db } from "$lib/server/db";
import { eq, and, or, isNotNull, desc, asc } from "drizzle-orm";
import { application_letters, letter_versions } from "$lib/server/db/schema";
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
  follow_up_email: "review_follow_up_email",
  thank_you_letter: "review_thank_you_letter",
};

/**
 * Parse a structured JSON letter response.
 * Expects { letter: string, feedback?: string } from structured output.
 * Falls back to treating the whole response as the letter if not JSON.
 */
function parseLetterResponse(response: string | null): { letter: string | null; feedback: string | null } {
  if (!response) return { letter: null, feedback: null };
  try {
    const parsed = JSON.parse(response);
    if (parsed && (typeof parsed.letter === "string" || typeof parsed.feedback === "string")) {
      return {
        letter: typeof parsed.letter === "string" ? parsed.letter : null,
        feedback: typeof parsed.feedback === "string" ? parsed.feedback : null,
      };
    }
  } catch {
    // Not JSON, use raw response
  }
  return { letter: response, feedback: null };
}

/** Build a condensed conversation history from previous letter versions */
async function buildConversationHistory(letterId: number): Promise<string> {
  const versions = await db.query.letter_versions.findMany({
    where: and(
      eq(letter_versions.letter, letterId),
      or(
        isNotNull(letter_versions.user_request),
        isNotNull(letter_versions.ai_feedback),
      ),
    ),
    orderBy: asc(letter_versions.id),
    columns: { user_request: true, ai_feedback: true },
  });

  if (versions.length === 0) return "";

  const lines: string[] = [];
  for (const v of versions) {
    if (v.user_request) lines.push(`**User:** ${v.user_request}`);
    if (v.ai_feedback) lines.push(`**AI:** ${v.ai_feedback}`);
  }
  return lines.join("\n\n");
}

/** Format job data as readable text for prompts */
function formatJobDetails(job: { title: string | null; job_description: string | null; company_description: string | null; job_poster: string | null }): string {
  const lines: string[] = [`**Position:** ${job.title || "Not specified"}`];
  if (job.job_poster) lines.push(`**Company/Organization:** ${job.job_poster} (this is who the applicant is applying to)`);
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
    const letterRecord = await db.query.application_letters.findFirst({
      where: eq(application_letters.id, letterId),
      columns: {
        letter_type: true,
        content: true,
      },
      with: {
        application: {
          columns: {},
          with: {
            job: {
              columns: {
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
      const job = letterRecord.application?.job;
      const jobDetailsText = job ? formatJobDetails(job) : "";

      // Get the latest letter content: check letter_versions first, fall back to application_letters.content
      const latestVersion = await db.query.letter_versions.findFirst({
        where: and(eq(letter_versions.letter, letterId), isNotNull(letter_versions.content)),
        orderBy: desc(letter_versions.id),
        columns: { content: true },
      });
      const currentLetterContent = latestVersion?.content || letterRecord.content || "";

      if (mode === "review") {
        const conversationHistory = await buildConversationHistory(letterId);
        promptType = LETTER_TYPE_TO_REVIEW_PROMPT[letterRecord.letter_type] || undefined;
        extraVariables = {
          generationMode: "review",
          letterContent: currentLetterContent,
          jobDetails: jobDetailsText,
          additionalContext: conversationHistory
            ? `## Previous conversation context:\n\nThe user has been iterating on this letter with AI assistance. Consider this history when reviewing — respect the direction they've taken and avoid re-suggesting things that were intentionally changed or omitted during the conversation.\n\n${conversationHistory}`
            : "",
        };
      } else {
        // followup_letter — needs job + latest letter + conversation history
        const conversationHistory = await buildConversationHistory(letterId);
        promptType = "followup_letter";
        extraVariables = {
          letterContent: currentLetterContent,
          jobDetails: jobDetailsText,
          conversationHistory,
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
      db.query.application_letters.findFirst({
        where: eq(application_letters.id, id),
        columns: { id: true, ai_chat_id: true },
      }).then((r) => r ?? null),
    updateEntity: async (id, aiChatId, aiChatResponse) => {
      // Parse structured response (letter + feedback)
      const { letter, feedback: revisionFeedback } = updateContent
        ? parseLetterResponse(aiChatResponse)
        : { letter: aiChatResponse, feedback: null };

      await db.update(application_letters).set({
        ai_chat_id: aiChatId,
        ai_chat_response: aiChatResponse,
      }).where(eq(application_letters.id, id));

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
        await db.insert(letter_versions).values({
          letter: id,
          content: revisedLetter,
          source: "ai_review",
          ai_chat: aiChatId,
          ai_feedback: aiFeedback,
          user_request: followupRequest,
        });
      } else if (updateContent && letter) {
        await db.insert(letter_versions).values({
          letter: id,
          content: letter,
          source: "ai_revision",
          ai_chat: aiChatId,
          ai_feedback: revisionFeedback,
          user_request: followupRequest,
        });
      }
    },
  });
}
