/**
 * Create follow-up AI chat for application letters
 */

import { db } from "$lib/server/db";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { application_letters, letter_versions } from "$lib/server/db/schema";
import { createEntityFollowup, type FollowupResult } from "./entity-followup";
import { interviewRecordsText } from "./application-records";
import { applicationDocumentsText } from "./application-documents";
import { LETTER_PROFILE_FIELDS } from "./profile-fields";
import { buildConversationMessages } from "./conversation-messages";
import {
  ensureBaselineVersion,
  LETTER_VERSIONS,
  recordVersion,
} from "./entity-versions";

/** Maps letter_type to the review_* prompt template name */
const LETTER_TYPE_TO_REVIEW_PROMPT: Record<string, string> = {
  cover_letter: "review_cover_letter",
  cheat_sheet: "review_cheat_sheet",
};

/**
 * Parse a structured JSON letter response.
 * Expects { letter: string, feedback?: string } from structured output.
 * Falls back to treating the whole response as the letter if not JSON.
 */
function parseLetterResponse(
  response: string | null,
): { letter: string | null; feedback: string | null } {
  if (!response) return { letter: null, feedback: null };
  try {
    const parsed = JSON.parse(response);
    const text = typeof parsed.text === "string"
      ? parsed.text
      : typeof parsed.letter === "string"
      ? parsed.letter
      : null;
    if (text || typeof parsed.feedback === "string") {
      return {
        letter: text,
        feedback: typeof parsed.feedback === "string" ? parsed.feedback : null,
      };
    }
  } catch {
    // Not JSON, use raw response
  }
  return { letter: response, feedback: null };
}

/** Format job data as readable text for prompts */
function formatJobDetails(
  job: {
    title: string | null;
    job_description: string | null;
    company_description: string | null;
    job_poster: string | null;
  },
): string {
  const lines: string[] = [`**Position:** ${job.title || "Not specified"}`];
  if (job.job_poster) {
    lines.push(
      `**Company/Organization:** ${job.job_poster} (this is who the applicant is applying to)`,
    );
  }
  if (job.company_description) {
    lines.push(`**About the company:** ${job.company_description}`);
  }
  lines.push(
    "",
    "**Job Description:**",
    job.job_description || "Not specified",
  );
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
  let historyMessages: Awaited<ReturnType<typeof buildConversationMessages>> =
    [];
  if (mode === "review" || updateContent) {
    const letterRecord = await db.query.application_letters.findFirst({
      where: eq(application_letters.id, letterId),
      columns: {
        letter_type: true,
        content: true,
      },
      with: {
        application: {
          // id is needed to load this application's interview records.
          columns: { id: true },
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
      // Preserve a pre-version-era letter as a baseline before this followup
      // records its own version, so the user's original survives.
      await ensureBaselineVersion(
        LETTER_VERSIONS,
        letterId,
        letterRecord.content,
      );

      const job = letterRecord.application?.job;
      const jobDetailsText = job ? formatJobDetails(job) : "";

      // A cheat sheet is about the interviews themselves; a letter revision
      // only needs the gist of what has happened so far.
      const applicationId = letterRecord.application?.id;
      const interviewHistory = applicationId
        ? await interviewRecordsText(
          applicationId,
          letterRecord.letter_type === "cheat_sheet" ? "full" : "compact",
        )
        : "";
      const applicationDocuments = applicationId
        ? await applicationDocumentsText(
          applicationId,
          letterRecord.letter_type === "cheat_sheet" ? "full" : "compact",
        )
        : "";

      // Get the latest letter content: check letter_versions first, fall back to application_letters.content
      const latestVersion = await db.query.letter_versions.findFirst({
        where: and(
          eq(letter_versions.letter, letterId),
          isNotNull(letter_versions.content),
        ),
        orderBy: desc(letter_versions.id),
        columns: { content: true },
      });
      const currentLetterContent = latestVersion?.content ||
        letterRecord.content || "";

      // The thread so far, replayed as real turns. Both the revision and the
      // review path get it: a review that ignores what was already discussed
      // re-suggests things the applicant deliberately changed.
      historyMessages = await buildConversationMessages(
        LETTER_VERSIONS,
        letterId,
        {
          noun: letterRecord.letter_type === "cheat_sheet"
            ? "cheat sheet"
            : "letter",
          currentContent: currentLetterContent,
        },
      );

      if (mode === "review") {
        promptType = LETTER_TYPE_TO_REVIEW_PROMPT[letterRecord.letter_type] ||
          undefined;
        extraVariables = {
          generationMode: "review",
          letterContent: currentLetterContent,
          jobDetails: jobDetailsText,
          interviewHistory,
          applicationDocuments,
        };
      } else {
        // followup_letter — needs job + latest letter; the conversation itself
        // arrives as messages rather than as a recap inside the prompt.
        promptType = "followup_letter";
        extraVariables = {
          letterContent: currentLetterContent,
          jobDetails: jobDetailsText,
          interviewHistory,
          applicationDocuments,
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
    historyMessages,
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
        // Parse review response for feedback + revisedText
        let aiFeedback: string | null = null;
        let revisedText: string | null = null;
        if (aiChatResponse) {
          try {
            const parsed = JSON.parse(aiChatResponse);
            if (parsed && typeof parsed.feedback === "string") {
              aiFeedback = parsed.feedback;
              revisedText = typeof parsed.revisedText === "string"
                ? parsed.revisedText
                : typeof parsed.revisedLetter === "string"
                ? parsed.revisedLetter
                : null;
            }
          } catch {
            aiFeedback = aiChatResponse;
          }
        }
        await recordVersion(LETTER_VERSIONS, {
          entityId: id,
          content: revisedText,
          source: "ai_review",
          aiChatId,
          aiFeedback,
          userRequest: followupRequest,
        });
      } else if (updateContent && letter) {
        // The model wrote/changed the letter → a new version.
        await recordVersion(LETTER_VERSIONS, {
          entityId: id,
          content: letter,
          source: "ai_revision",
          aiChatId,
          aiFeedback: revisionFeedback,
          userRequest: followupRequest,
        });
      } else if (updateContent && revisionFeedback) {
        // No new letter — the user asked a question / wanted advice. Record the
        // exchange (their message + the AI's reply) without a new version.
        await recordVersion(LETTER_VERSIONS, {
          entityId: id,
          content: null,
          source: "ai_advice",
          aiChatId,
          aiFeedback: revisionFeedback,
          userRequest: followupRequest,
        });
      }
    },
  });
}
