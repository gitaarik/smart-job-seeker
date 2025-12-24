/**
 * Validation middleware for webhook payloads
 * Validates request body structure and required fields
 */

import type { WebhookPayload } from "$lib/types/webhook";
import type { WebhookMiddlewareResult } from "../types";

/**
 * Validate and parse webhook payload from request
 * @param event - SvelteKit request event
 * @returns Middleware result with parsed payload or validation error
 */
export async function validateWebhookPayload(event: {
  request: Request;
}): Promise<
  WebhookMiddlewareResult & { payload?: WebhookPayload }
> {
  // Parse the payload
  let payload: WebhookPayload;

  try {
    const body = await event.request.text();
    payload = JSON.parse(body) as WebhookPayload;
  } catch (parseError) {
    return {
      success: false,
      message: "Invalid JSON payload",
      error: "Failed to parse request body as JSON",
      status: 400,
    };
  }

  // Validate required fields
  if (!payload.eventType || !payload.data) {
    return {
      success: false,
      message: "Invalid payload structure",
      error: "Missing required fields: eventType, data",
      status: 400,
    };
  }

  return {
    success: true,
    payload,
  };
}
