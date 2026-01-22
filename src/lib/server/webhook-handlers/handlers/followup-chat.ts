/**
 * Handle ai_chat.create_followup events
 * Called to create follow-up ai_chat instances for iterative refinement
 */

import { createFollowupAiChat } from "$lib/server/ai-chat/create-followup";
import type { WebhookHandler, WebhookHandlerResult } from "../types";

export const followupChatHandler: WebhookHandler = {
  eventType: "ai_chat.create_followup",

  async handle(data: Record<string, unknown>): Promise<WebhookHandlerResult> {
    let parentAiChatIds: number[] = [];

    if (Array.isArray(data.keys)) {
      parentAiChatIds = (data.keys as unknown[])
        .map((id) => {
          const parsed = parseInt(String(id), 10);
          return isNaN(parsed) ? null : parsed;
        })
        .filter((id): id is number => id !== null);
    }

    if (parentAiChatIds.length === 0) {
      return {
        processed: false,
        error:
          "Missing or invalid keys in data (expected array of ai_chat IDs)",
      };
    }

    const followupRequest = data.followup_request;
    if (typeof followupRequest !== "string" || !followupRequest.trim()) {
      return {
        processed: false,
        error:
          "Missing or invalid followup_request in data (expected non-empty string)",
      };
    }

    const includeOriginalContext = data.include_original_context === "true";

    // Try block contains ONLY the async operation
    let results;
    try {
      results = await Promise.allSettled(
        parentAiChatIds.map((parentAiChatId) =>
          createFollowupAiChat(parentAiChatId, followupRequest, {
            includeOriginalContext,
          })
            .then((result) => ({
              parentAiChatId,
              success: result.success,
              message: result.message,
              newAiChatId: result.aiChat?.id,
            }))
            .catch((error) => ({
              parentAiChatId,
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
        `[Webhook] ai_chat.create_followup failed:`,
        errorMessage,
      );
      return {
        processed: false,
        parentAiChatCount: parentAiChatIds.length,
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
      parentAiChatCount: parentAiChatIds.length,
      successCount: successful.length,
      results: results.map((r) =>
        r.status === "fulfilled" ? r.value : r.reason
      ),
      ...(failed.length > 0 && { failureCount: failed.length }),
    };
  },
};
