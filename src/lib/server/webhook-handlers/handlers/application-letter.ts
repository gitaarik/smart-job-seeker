/**
 * Handle application_letter.generate events
 * Called to generate AI-assisted letters for application_letters
 */

import { generateApplicationLetter } from "$lib/server/ai-chat-application-letter";
import type { WebhookHandler, WebhookHandlerResult } from "../types";

export const applicationLetterHandler: WebhookHandler = {
  eventType: "application_letter.generate",

  async handle(data: Record<string, unknown>): Promise<WebhookHandlerResult> {
    let letterIds: number[] = [];

    if (Array.isArray(data.letterIds)) {
      letterIds = (data.letterIds as unknown[])
        .map((id) => {
          const parsed = parseInt(String(id), 10);
          return isNaN(parsed) ? null : parsed;
        })
        .filter((id): id is number => id !== null);
    }

    if (letterIds.length === 0) {
      return {
        processed: false,
        error:
          "Missing or invalid letterIds in data (expected array of numbers)",
      };
    }

    const additionalContext = typeof data.additionalContext === "string"
      ? data.additionalContext
      : undefined;

    try {
      const results = await Promise.allSettled(
        letterIds.map((letterId) =>
          generateApplicationLetter(letterId, additionalContext)
            .then((result) => ({
              letterId,
              success: result.success,
              message: result.message,
            }))
            .catch((error) => ({
              letterId,
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
        letterCount: letterIds.length,
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
        `[Webhook] application_letter.generate failed:`,
        errorMessage,
      );
      return {
        processed: false,
        letterCount: letterIds.length,
        error: errorMessage,
      };
    }
  },
};
