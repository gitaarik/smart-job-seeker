/**
 * Handle ai_chat.generate_response events
 * Called to generate AI responses using Groq API
 */

import { generateAiChatResponse } from "$lib/server/ai-chat-response-generate";
import type { WebhookHandler, WebhookHandlerResult } from "../types";

export const aiChatGenerateResponseHandler: WebhookHandler = {
  eventType: "ai_chat.generate_response",

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

    try {
      const results = await Promise.allSettled(
        aiChatIds.map((aiChatId) =>
          generateAiChatResponse(aiChatId)
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
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : "Unknown error";
      console.error(
        `[Webhook] ai_chat.generate_response failed:`,
        errorMessage,
      );
      return {
        processed: false,
        aiChatCount: aiChatIds.length,
        error: errorMessage,
      };
    }
  },
};
