/**
 * Handle application_interview_question.generate_ai_answer events
 * Called to generate AI-assisted answers for application interview questions
 */

import { generateApplicationQuestionAnswer } from "$lib/server/ai-chat-application-question";
import type { WebhookHandler, WebhookHandlerResult } from "../types";

export const applicationQuestionHandler: WebhookHandler = {
  eventType: "application_interview_question.generate_ai_answer",

  async handle(data: Record<string, unknown>): Promise<WebhookHandlerResult> {
    let questionIds: number[] = [];

    if (Array.isArray(data.ids)) {
      questionIds = (data.ids as unknown[])
        .map((id) => {
          const parsed = parseInt(String(id), 10);
          return isNaN(parsed) ? null : parsed;
        })
        .filter((id): id is number => id !== null);
    }

    if (questionIds.length === 0) {
      return {
        processed: false,
        error: "Missing or invalid ids in data (expected array of numbers)",
      };
    }

    // Try block contains ONLY the async operation
    let results;
    try {
      results = await Promise.allSettled(
        questionIds.map((questionId) =>
          generateApplicationQuestionAnswer(questionId)
            .then((result) => ({
              questionId,
              success: result.success,
              message: result.message,
            }))
            .catch((error) => ({
              questionId,
              success: false,
              message: error instanceof Error ? error.message : "Unknown error",
            }))
        ),
      );
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : "Unknown error";
      console.error(
        `[Webhook] application_interview_question.generate_ai_answer failed:`,
        errorMessage,
      );
      return {
        processed: false,
        questionCount: questionIds.length,
        error: errorMessage,
      };
    }

    // Result processing outside try block
    const successful = results.filter(
      (r) => r.status === "fulfilled" && (r.value as any).success !== false,
    );
    const failed = results.filter(
      (r) =>
        r.status === "rejected" ||
        (r.status === "fulfilled" && (r.value as any).success === false),
    );

    return {
      processed: successful.length > 0,
      questionCount: questionIds.length,
      successCount: successful.length,
      results: results.map((r) =>
        r.status === "fulfilled" ? r.value : r.reason
      ),
      ...(failed.length > 0 && { failureCount: failed.length }),
    };
  },
};
