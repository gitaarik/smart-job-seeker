import { json } from "@sveltejs/kit";
import type { RequestHandler } from "@sveltejs/kit";
import {
  getHandler,
  validateWebhookPayload,
  verifyWebhookAuth,
} from "$lib/server/webhook-handlers";
import { clearDirectusCache } from "$lib/server/directus/client";
import {
  createRateLimitResponse,
  webhookRateLimiter,
} from "$lib/server/middleware/rate-limit";
import { errorTracker } from "$lib/server/monitoring/error-tracker";

/**
 * Webhook endpoint for Directus Flow integration
 * Receives POST requests from Directus Flow scripts with header-based secret verification
 */

export const POST: RequestHandler = async (event) => {
  try {
    // Step 0: Rate limiting
    if (!webhookRateLimiter.tryConsume(event.request)) {
      errorTracker.logWarning("Webhook rate limit exceeded", {
        operation: "webhook",
        metadata: { path: event.url.pathname },
      });
      return createRateLimitResponse();
    }

    // Step 1: Verify authentication
    const authResult = await verifyWebhookAuth(event);
    if (!authResult.success) {
      return json(
        {
          success: false,
          message: authResult.message,
          error: authResult.error,
        },
        { status: authResult.status || 401 },
      );
    }

    // Step 2: Validate and parse payload
    const validationResult = await validateWebhookPayload(event);
    if (!validationResult.success || !validationResult.payload) {
      return json(
        {
          success: false,
          message: validationResult.message,
          error: validationResult.error,
        },
        { status: validationResult.status || 400 },
      );
    }

    const { eventType, data } = validationResult.payload;

    // Step 3: Get handler for event type
    const handler = getHandler(eventType);
    if (!handler) {
      return json(
        {
          success: true,
          message: "Event type not specifically handled but received",
          data: {
            processed: false,
            eventType,
          },
        },
        { status: 200 },
      );
    }

    // Step 4: Execute handler
    const result = await handler.handle(data);

    // Step 5: Clear Directus cache after successful webhook processing (skip in tests)
    if (!process.env.VITEST) {
      try {
        console.log("[Webhook] Clearing Directus cache...");
        await clearDirectusCache();
        console.log("[Webhook] Directus cache cleared successfully");
      } catch (cacheError) {
        const cacheErrorMessage = cacheError instanceof Error
          ? cacheError.message
          : "Unknown error";
        console.warn(
          `[Webhook] Failed to clear Directus cache: ${cacheErrorMessage}`,
        );
        // Don't fail the webhook response due to cache clearing failure
      }
    }

    return json(
      {
        success: true,
        message: "Webhook processed successfully",
        data: result,
      },
      { status: 200 },
    );
  } catch (error) {
    const errorMessage = error instanceof Error
      ? error.message
      : "Unknown error";

    errorTracker.logError(
      "Webhook processing failed",
      error instanceof Error ? error : new Error(String(error)),
      {
        operation: "webhook",
        metadata: { path: event.url.pathname },
      },
    );

    return json(
      {
        success: false,
        message: "Internal server error",
        error: errorMessage,
      },
      { status: 500 },
    );
  }
};
