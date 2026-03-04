/**
 * Handle application_interview_question.generate_ai_answer events
 * Called to generate AI-assisted answers for application interview questions
 */

import { generateApplicationQuestionAnswer } from "$lib/server/ai-chat/application-question";
import { parseWebhookIds, processBatchWebhook } from "../batch-utils";
import type { WebhookHandler, WebhookHandlerResult } from "../types";

export const applicationQuestionHandler: WebhookHandler = {
  eventType: "application_interview_question.generate_ai_answer",

  async handle(data: Record<string, unknown>): Promise<WebhookHandlerResult> {
    const questionIds = parseWebhookIds(data, "ids");

    if (questionIds.length === 0) {
      return {
        processed: false,
        error: "Missing or invalid ids in data (expected array of numbers)",
      };
    }

    return processBatchWebhook({
      ids: questionIds,
      idLabel: "question",
      eventType: "application_interview_question.generate_ai_answer",
      processOne: (questionId) =>
        generateApplicationQuestionAnswer(questionId)
          .then((result) => ({
            questionId,
            success: result.success,
            message: result.message,
          })),
    });
  },
};
