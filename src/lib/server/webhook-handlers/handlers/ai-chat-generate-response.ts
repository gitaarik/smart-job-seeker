/**
 * Handle ai_chats.generate_response events
 * Called to generate AI responses using Groq API
 */

import { generateAiChatResponse } from "$lib/server/ai-chat/response-generate";
import { isFatalLLMError } from "$lib/server/llm";
import { getErrorMessage } from "$lib/server/utils/errors";
import type { WebhookHandler, WebhookHandlerResult } from "../types";

export const aiChatGenerateResponseHandler: WebhookHandler = {
  eventType: "ai_chats.generate_response",

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
      const results: Array<{
        aiChatId: number;
        success: boolean;
        message: string;
      }> = [];
      let fatalErrorEncountered = false;

      // Process AI chats sequentially to detect fatal errors early
      for (const aiChatId of aiChatIds) {
        if (fatalErrorEncountered) {
          // Skip remaining chats after fatal error
          results.push({
            aiChatId,
            success: false,
            message: "Skipped due to fatal error in previous chat",
          });
          continue;
        }

        try {
          const result = await generateAiChatResponse(aiChatId);
          results.push({
            aiChatId,
            success: result.success,
            message: result.message,
          });

          // Check if result message indicates a fatal error
          if (
            !result.success &&
            (result.message.includes("quota exceeded") ||
              result.message.includes("authentication failed"))
          ) {
            fatalErrorEncountered = true;
            console.error(
              `[Webhook] Fatal LLM error detected, stopping processing: ${result.message}`,
            );
          }
        } catch (error) {
          // Check for fatal LLM errors
          if (isFatalLLMError(error)) {
            fatalErrorEncountered = true;
            const message = getErrorMessage(error);
            results.push({
              aiChatId,
              success: false,
              message,
            });
            console.error(
              `[Webhook] Fatal LLM error detected, stopping processing: ${message}`,
            );
          } else {
            results.push({
              aiChatId,
              success: false,
              message: getErrorMessage(error),
            });
          }
        }
      }

      const successful = results.filter((r) => r.success);
      const failed = results.filter((r) => !r.success);

      return {
        processed: successful.length > 0,
        aiChatCount: aiChatIds.length,
        successCount: successful.length,
        results,
        ...(failed.length > 0 && { failureCount: failed.length }),
        ...(fatalErrorEncountered && {
          fatalError:
            "Processing stopped due to LLM quota or authentication error",
        }),
      };
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : "Unknown error";
      console.error(
        `[Webhook] ai_chats.generate_response failed:`,
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
