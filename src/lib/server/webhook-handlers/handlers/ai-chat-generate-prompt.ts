/**
 * Handle ai_chats.generate_full_prompt events
 * Called to generate and update the full_prompt field
 */

import { generateAiChatFullPrompt } from "$lib/server/ai-chat/full-prompt-generate";
import type { WebhookHandler, WebhookHandlerResult } from "../types";

export const aiChatGeneratePromptHandler: WebhookHandler = {
  eventType: "ai_chats.generate_full_prompt",

  async handle(data: Record<string, unknown>): Promise<WebhookHandlerResult> {
    let aiChatIds: number[] = [];

    if (Array.isArray(data.aiChatIds)) {
      aiChatIds = (data.aiChatIds as unknown[])
        .map((id) => {
          const parsed = parseInt(String(id), 10);
          return isNaN(parsed) ? null : parsed;
        })
        .filter((id): id is number => id !== null);
    }

    if (aiChatIds.length === 0) {
      return {
        processed: false,
        error:
          "Missing or invalid aiChatIds in data (expected array of numeric strings)",
      };
    }

    // Try block contains ONLY the async operation
    let results;
    try {
      results = await Promise.allSettled(
        aiChatIds.map((aiChatId) =>
          generateAiChatFullPrompt(aiChatId)
            .then((result) => ({
              aiChatId,
              success: result.success,
              message: result.message,
            }))
            .catch((error) => ({
              aiChatId,
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
        `[Webhook] ai_chats.generate_full_prompt failed:`,
        errorMessage,
      );
      return {
        processed: false,
        aiChatCount: aiChatIds.length,
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
      aiChatCount: aiChatIds.length,
      successCount: successful.length,
      results: results.map((r) =>
        r.status === "fulfilled" ? r.value : r.reason
      ),
      ...(failed.length > 0 && { failureCount: failed.length }),
    };
  },
};
