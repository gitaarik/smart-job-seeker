/**
 * Authentication middleware for webhook requests
 * Verifies the webhook secret from request headers
 */

import { getEnv } from "$lib/tools/get-env";
import type { WebhookMiddlewareResult } from "../types";

/**
 * Verify webhook authentication using secret header
 * @param event - SvelteKit request event
 * @returns Middleware result with validation status
 */
export async function verifyWebhookAuth(event: {
  request: Request;
}): Promise<WebhookMiddlewareResult> {
  // Get webhook secret from environment
  const webhookSecret = getEnv("SJS_WEBHOOK_SECRET", "");

  if (!webhookSecret) {
    return {
      success: false,
      message: "Webhook not configured",
      error: "SJS_WEBHOOK_SECRET environment variable is not set",
      status: 500,
    };
  }

  // Get secret from request header
  const headerSecret = event.request.headers.get("x-webhook-secret");

  if (!headerSecret) {
    return {
      success: false,
      message: "Unauthorized",
      error: "Missing webhook secret header",
      status: 401,
    };
  }

  // Verify secret matches
  if (headerSecret !== webhookSecret) {
    return {
      success: false,
      message: "Unauthorized",
      error: "Invalid webhook secret",
      status: 401,
    };
  }

  return {
    success: true,
  };
}
