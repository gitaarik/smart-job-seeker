/**
 * Handle ai_chats.generate_full_prompt events
 * Called to generate and update the full_prompt field
 */

import { generateAiChatFullPrompt } from "$lib/server/ai-chat/full-prompt-generate";
import { parseWebhookIds, processBatchWebhook } from "../batch-utils";
import type { WebhookHandler, WebhookHandlerResult } from "../types";

export const aiChatGeneratePromptHandler: WebhookHandler = {
  eventType: "ai_chats.generate_full_prompt",

  async handle(data: Record<string, unknown>): Promise<WebhookHandlerResult> {
    const aiChatIds = parseWebhookIds(data, "aiChatIds");

    if (aiChatIds.length === 0) {
      return {
        processed: false,
        error:
          "Missing or invalid aiChatIds in data (expected array of numeric strings)",
      };
    }

    return processBatchWebhook({
      ids: aiChatIds,
      idLabel: "aiChat",
      eventType: "ai_chats.generate_full_prompt",
      processOne: (aiChatId) =>
        generateAiChatFullPrompt(aiChatId)
          .then((result) => ({
            aiChatId,
            success: result.success,
            message: result.message,
          })),
    });
  },
};
