/**
 * Handle application_questions.create_followup events
 * Called to create a follow-up AI chat for an application question
 */

import { createApplicationQuestionFollowup } from "$lib/server/ai-chat-application-question-followup";
import type { WebhookHandler, WebhookHandlerResult } from "../types";

export const followupQuestionHandler: WebhookHandler = {
  eventType: "application_questions.create_followup",

  async handle(data: Record<string, unknown>): Promise<WebhookHandlerResult> {
    const questionIdRaw = data.questionId;
    const questionId = typeof questionIdRaw === "number"
      ? questionIdRaw
      : (typeof questionIdRaw === "string" ? parseInt(questionIdRaw, 10) : NaN);

    if (isNaN(questionId)) {
      return {
        processed: false,
        success: false,
        error: "Missing or invalid questionId in data (expected number)",
      };
    }

    const followupRequest = typeof data.followup_request === "string"
      ? data.followup_request
      : "";

    if (!followupRequest.trim()) {
      return {
        processed: false,
        success: false,
        error: "Missing or empty followup_request in data",
      };
    }

    const includeOriginalContext = data.include_original_context === "true" ||
      data.include_original_context === true;

    // Try block contains ONLY the async operation
    let result;
    try {
      result = await createApplicationQuestionFollowup(
        questionId,
        followupRequest,
        includeOriginalContext,
      );
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : "Unknown error";
      console.error(
        `[Webhook] application_questions.create_followup failed:`,
        errorMessage,
      );
      return {
        processed: false,
        success: false,
        error: errorMessage,
      };
    }

    // Result processing outside try block
    return {
      processed: true,
      success: result.success,
      message: result.message,
      data: result.aiChat
        ? {
          aiChatId: result.aiChat.id,
          questionId: questionId,
        }
        : undefined,
      ...(result.success ? {} : { error: result.message }),
    };
  },
};
