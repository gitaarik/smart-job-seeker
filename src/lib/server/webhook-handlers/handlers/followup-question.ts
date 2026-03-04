/**
 * Handle application_questions.create_followup events
 * Called to create a follow-up AI chat for an application question
 */

import { createApplicationQuestionFollowup } from "$lib/server/ai-chat/application-question-followup";
import { handleEntityFollowup } from "../followup-utils";
import type { WebhookHandler, WebhookHandlerResult } from "../types";

export const followupQuestionHandler: WebhookHandler = {
  eventType: "application_questions.create_followup",

  async handle(data: Record<string, unknown>): Promise<WebhookHandlerResult> {
    return handleEntityFollowup({
      data,
      idKey: "questionId",
      idLabel: "question",
      eventType: "application_questions.create_followup",
      createFollowup: createApplicationQuestionFollowup,
    });
  },
};
