/**
 * Webhook handlers registry
 * Central registry for all webhook event handlers
 */

import type { WebhookHandler } from "./types";
import { profileExportHandler } from "./handlers/profile-export";
import { aiChatGeneratePromptHandler } from "./handlers/ai-chat-generate-prompt";
import { aiChatGenerateResponseHandler } from "./handlers/ai-chat-generate-response";
import { applicationQuestionHandler } from "./handlers/application-question";
import { applicationLetterHandler } from "./handlers/application-letter";
import { followupLetterHandler } from "./handlers/followup-letter";
import { followupQuestionHandler } from "./handlers/followup-question";
import { followupChatHandler } from "./handlers/followup-chat";
import { profileVersionLinksHandler } from "./handlers/profile-version-links";

/**
 * Registry of all webhook handlers
 * Maps event types to their respective handlers
 */
const handlers: Map<string, WebhookHandler> = new Map([
  [profileExportHandler.eventType, profileExportHandler],
  [aiChatGeneratePromptHandler.eventType, aiChatGeneratePromptHandler],
  [aiChatGenerateResponseHandler.eventType, aiChatGenerateResponseHandler],
  [applicationQuestionHandler.eventType, applicationQuestionHandler],
  [applicationLetterHandler.eventType, applicationLetterHandler],
  [followupLetterHandler.eventType, followupLetterHandler],
  [followupQuestionHandler.eventType, followupQuestionHandler],
  [followupChatHandler.eventType, followupChatHandler],
  [profileVersionLinksHandler.eventType, profileVersionLinksHandler],
]);

/**
 * Get a handler for a specific event type
 * @param eventType - The webhook event type
 * @returns The handler for the event type, or undefined if not found
 */
export function getHandler(eventType: string): WebhookHandler | undefined {
  return handlers.get(eventType);
}

/**
 * Get all registered event types
 * @returns Array of all registered event types
 */
export function getRegisteredEventTypes(): string[] {
  return Array.from(handlers.keys());
}

/**
 * Export middleware functions
 */
export { verifyWebhookAuth } from "./middleware/auth";
export { validateWebhookPayload } from "./middleware/validation";

/**
 * Export types
 */
export type {
  WebhookHandler,
  WebhookHandlerResult,
  WebhookMiddleware,
  WebhookMiddlewareResult,
} from "./types";
