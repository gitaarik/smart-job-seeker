/**
 * Handle application_letter.create_followup events
 * Called to create a follow-up AI chat for an application letter
 */

import { createApplicationLetterFollowup } from "$lib/server/ai-chat/application-letter-followup";
import { handleEntityFollowup } from "../followup-utils";
import type { WebhookHandler, WebhookHandlerResult } from "../types";

export const followupLetterHandler: WebhookHandler = {
  eventType: "application_letter.create_followup",

  async handle(data: Record<string, unknown>): Promise<WebhookHandlerResult> {
    return handleEntityFollowup({
      data,
      idKey: "letterId",
      idLabel: "letter",
      eventType: "application_letter.create_followup",
      createFollowup: createApplicationLetterFollowup,
    });
  },
};
