/**
 * Handle application_letter.generate events
 * Called to generate AI-assisted letters for application_letters
 */

import { generateApplicationLetter } from "$lib/server/ai-chat/application-letter";
import { parseWebhookIds, processBatchWebhook } from "../batch-utils";
import type { WebhookHandler, WebhookHandlerResult } from "../types";

export const applicationLetterHandler: WebhookHandler = {
  eventType: "application_letter.generate",

  async handle(data: Record<string, unknown>): Promise<WebhookHandlerResult> {
    const letterIds = parseWebhookIds(data, "letterIds");

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

    return processBatchWebhook({
      ids: letterIds,
      idLabel: "letter",
      eventType: "application_letter.generate",
      processOne: (letterId) =>
        generateApplicationLetter(letterId, additionalContext)
          .then((result) => ({
            letterId,
            success: result.success,
            message: result.message,
          })),
    });
  },
};
