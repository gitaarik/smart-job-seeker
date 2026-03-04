/**
 * Handle ai_chats.create_followup events
 * Called to create follow-up ai_chats instances for iterative refinement
 */

import { createFollowupAiChat } from "$lib/server/ai-chat/create-followup";
import { parseWebhookIds, processBatchWebhook } from "../batch-utils";
import type { WebhookHandler, WebhookHandlerResult } from "../types";

export const followupChatHandler: WebhookHandler = {
  eventType: "ai_chats.create_followup",

  async handle(data: Record<string, unknown>): Promise<WebhookHandlerResult> {
    const parentAiChatIds = parseWebhookIds(data, "keys");

    if (parentAiChatIds.length === 0) {
      return {
        processed: false,
        error:
          "Missing or invalid keys in data (expected array of ai_chats IDs)",
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

    return processBatchWebhook({
      ids: parentAiChatIds,
      idLabel: "parentAiChat",
      eventType: "ai_chats.create_followup",
      processOne: (parentAiChatId) =>
        createFollowupAiChat(parentAiChatId, followupRequest, {
          includeOriginalContext,
        })
          .then((result) => ({
            parentAiChatId,
            success: result.success,
            message: result.message,
            newAiChatId: result.aiChat?.id,
          })),
    });
  },
};
