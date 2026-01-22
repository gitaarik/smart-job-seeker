/**
 * Handle application_letter.create_followup events
 * Called to create a follow-up AI chat for an application letter
 */

import { createApplicationLetterFollowup } from "$lib/server/ai-chat/application-letter-followup";
import type { WebhookHandler, WebhookHandlerResult } from "../types";

export const followupLetterHandler: WebhookHandler = {
  eventType: "application_letter.create_followup",

  async handle(data: Record<string, unknown>): Promise<WebhookHandlerResult> {
    const letterIdRaw = data.letterId;
    const letterId = typeof letterIdRaw === "number"
      ? letterIdRaw
      : (typeof letterIdRaw === "string" ? parseInt(letterIdRaw, 10) : NaN);

    if (isNaN(letterId)) {
      return {
        processed: false,
        success: false,
        error: "Missing or invalid letterId in data (expected number)",
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
      result = await createApplicationLetterFollowup(
        letterId,
        followupRequest,
        includeOriginalContext,
      );
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : "Unknown error";
      console.error(
        `[Webhook] application_letter.create_followup failed:`,
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
          letterId: letterId,
        }
        : undefined,
      ...(result.success ? {} : { error: result.message }),
    };
  },
};
