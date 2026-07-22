/**
 * Create follow-up AI chat for application question answers.
 *
 * Mirrors application-letter-followup.ts: the question editor's feedback loop
 * chains an ai_chat thread and records each turn as a question_versions row
 * through the shared engine. Like letters, the entity's `answer` column is a
 * saved checkpoint set on generate/save — followup turns append versions, they
 * do not overwrite `answer` directly.
 */

import { db } from "$lib/server/db";
import { and, asc, desc, eq, isNotNull, or } from "drizzle-orm";
import {
  application_questions,
  question_versions,
} from "$lib/server/db/schema";
import { createEntityFollowup, type FollowupResult } from "./entity-followup";
import {
  ensureBaselineVersion,
  QUESTION_VERSIONS,
  recordVersion,
} from "./entity-versions";
import { QUESTION_PROFILE_FIELDS } from "./application-question";

/**
 * Parse a structured JSON answer response.
 * Expects { text: string, feedback?: string } from structured output.
 * Falls back to treating the whole response as the answer if not JSON.
 */
function parseAnswerResponse(
  response: string | null,
): { text: string | null; feedback: string | null } {
  if (!response) return { text: null, feedback: null };
  try {
    const parsed = JSON.parse(response);
    const text = typeof parsed.text === "string"
      ? parsed.text
      : typeof parsed.answer === "string"
      ? parsed.answer
      : null;
    if (text || typeof parsed.feedback === "string") {
      return {
        text,
        feedback: typeof parsed.feedback === "string" ? parsed.feedback : null,
      };
    }
  } catch {
    // Not JSON, use raw response
  }
  return { text: response, feedback: null };
}

/** Build a condensed conversation history from previous question versions */
async function buildConversationHistory(questionId: number): Promise<string> {
  const versions = await db.query.question_versions.findMany({
    where: and(
      eq(question_versions.question, questionId),
      or(
        isNotNull(question_versions.user_request),
        isNotNull(question_versions.ai_feedback),
      ),
    ),
    orderBy: asc(question_versions.id),
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

export async function createApplicationQuestionFollowup(
  questionId: number,
  followupRequest: string,
  includeOriginalContext?: boolean,
  updateContent?: boolean,
  mode?: "feedback" | "review",
): Promise<FollowupResult> {
  // For review or answer-revision mode, look up the question + job context.
  let promptType: string | undefined;
  let extraVariables: Record<string, unknown> | undefined;
  if (mode === "review" || updateContent) {
    const questionRecord = await db.query.application_questions.findFirst({
      where: eq(application_questions.id, questionId),
      columns: {
        question: true,
        answer: true,
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
    if (questionRecord) {
      // Preserve a pre-version-era answer as a baseline before this followup
      // records its own version, so the user's original survives.
      await ensureBaselineVersion(
        QUESTION_VERSIONS,
        questionId,
        questionRecord.answer,
      );

      const job = questionRecord.application?.job;
      const jobDetailsText = job ? formatJobDetails(job) : "";

      // Latest answer content: prefer the newest version, fall back to answer.
      const latestVersion = await db.query.question_versions.findFirst({
        where: and(
          eq(question_versions.question, questionId),
          isNotNull(question_versions.content),
        ),
        orderBy: desc(question_versions.id),
        columns: { content: true },
      });
      const currentAnswer = latestVersion?.content || questionRecord.answer ||
        "";

      if (mode === "review") {
        promptType = "review_application_question";
        extraVariables = {
          jobDescription: job?.job_description || "",
          question: questionRecord.question,
          answer: currentAnswer,
        };
      } else {
        // Answer revision — needs job + current answer + conversation history.
        const conversationHistory = await buildConversationHistory(questionId);
        promptType = "followup_application_question";
        extraVariables = {
          question: questionRecord.question,
          answerContent: currentAnswer,
          jobDetails: jobDetailsText,
          conversationHistory,
        };
      }
    }
  }

  return createEntityFollowup({
    entityId: questionId,
    entityLabel: "application question",
    noAiChatHint: "Generate the initial answer first.",
    followupRequest,
    includeOriginalContext,
    promptType,
    customVariables: extraVariables,
    profileDataFields: QUESTION_PROFILE_FIELDS,
    fetchEntity: (id) =>
      db.query.application_questions.findFirst({
        where: eq(application_questions.id, id),
        columns: { id: true, ai_chat_id: true },
      }).then((r) => r ?? null),
    updateEntity: async (id, aiChatId, aiChatResponse) => {
      // Parse structured response (answer + feedback)
      const { text: answer, feedback: revisionFeedback } = updateContent
        ? parseAnswerResponse(aiChatResponse)
        : { text: aiChatResponse, feedback: null };

      await db.update(application_questions).set({
        ai_chat_id: aiChatId,
        ai_chat_response: aiChatResponse,
      }).where(eq(application_questions.id, id));

      // Record version in question_versions
      if (mode === "review") {
        let aiFeedback: string | null = null;
        let revisedText: string | null = null;
        if (aiChatResponse) {
          try {
            const parsed = JSON.parse(aiChatResponse);
            if (parsed && typeof parsed.feedback === "string") {
              aiFeedback = parsed.feedback;
              revisedText = typeof parsed.revisedText === "string"
                ? parsed.revisedText
                : null;
            }
          } catch {
            aiFeedback = aiChatResponse;
          }
        }
        await recordVersion(QUESTION_VERSIONS, {
          entityId: id,
          content: revisedText,
          source: "ai_review",
          aiChatId,
          aiFeedback,
          userRequest: followupRequest,
        });
      } else if (updateContent && answer) {
        // The model wrote/changed the answer → a new version.
        await recordVersion(QUESTION_VERSIONS, {
          entityId: id,
          content: answer,
          source: "ai_revision",
          aiChatId,
          aiFeedback: revisionFeedback,
          userRequest: followupRequest,
        });
      } else if (updateContent && revisionFeedback) {
        // No new answer — the user asked a question / wanted advice. Record the
        // exchange (their message + the AI's reply) without a new version.
        await recordVersion(QUESTION_VERSIONS, {
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
