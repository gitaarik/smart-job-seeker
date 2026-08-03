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
import { and, desc, eq, isNotNull } from "drizzle-orm";
import {
  application_questions,
  question_versions,
} from "$lib/server/db/schema";
import { createEntityFollowup, type FollowupResult } from "./entity-followup";
import type { GenerationContextOption } from "./generation-context";
import { buildConversationMessages } from "./conversation-messages";
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
  let context: GenerationContextOption | undefined;
  let historyMessages: Awaited<ReturnType<typeof buildConversationMessages>> =
    [];
  if (mode === "review" || updateContent) {
    const questionRecord = await db.query.application_questions.findFirst({
      where: eq(application_questions.id, questionId),
      columns: {
        question: true,
        answer: true,
      },
      with: {
        // id is all that's needed — the job, records and documents are loaded
        // by the context provider from this application id.
        application: { columns: { id: true } },
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

      // The job, what has already happened on the application, and the files on
      // its Documents tab all come from the entity via the context provider —
      // same sources, same budget, as the initial generation.
      const applicationId = questionRecord.application?.id;
      if (applicationId != null) {
        context = {
          entity: { type: "application", id: applicationId },
          sources: ["job", "application_activity"],
        };
        // A revision turn gets the same retrieved evidence the initial answer
        // had; without it turn 2 onward writes from the conversation alone.
        // Ranked against what the applicant just asked for PLUS the question
        // itself, so "make it punchier" still retrieves against the subject.
        // Review deliberately doesn't — its template has no retrieval slots,
        // and critiquing an answer needs the answer, not fresh material.
        if (mode !== "review") {
          context.query = {
            text: [followupRequest, questionRecord.question]
              .filter(Boolean)
              .join("\n"),
          };
          context.sources = [
            ...context.sources,
            "projects",
            "stories",
            "application_texts",
          ];
        }
      }

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

      // The thread so far, replayed as real turns — for review as well as
      // revision, so a review doesn't re-suggest what was already settled.
      historyMessages = await buildConversationMessages(
        QUESTION_VERSIONS,
        questionId,
        { noun: "answer", currentContent: currentAnswer },
      );

      if (mode === "review") {
        promptType = "review_application_question";
        extraVariables = {
          question: questionRecord.question,
          answer: currentAnswer,
        };
      } else {
        // Answer revision — needs job + current answer; the conversation itself
        // arrives as messages rather than as a recap inside the prompt.
        promptType = "followup_application_question";
        extraVariables = {
          question: questionRecord.question,
          answerContent: currentAnswer,
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
    context,
    historyMessages,
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
        // The model wrote/changed the answer → a new version, and it becomes the
        // live answer (a revision you asked for should show on the overview
        // without a separate "use as answer" click). Earlier versions remain
        // pickable via "use as answer".
        await recordVersion(QUESTION_VERSIONS, {
          entityId: id,
          content: answer,
          source: "ai_revision",
          aiChatId,
          aiFeedback: revisionFeedback,
          userRequest: followupRequest,
        });
        await db.update(application_questions).set({
          answer,
          date_updated: new Date(),
        }).where(eq(application_questions.id, id));
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
