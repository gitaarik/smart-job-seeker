import { json } from "@sveltejs/kit";
import type { RequestHandler } from "@sveltejs/kit";
import { getEnv } from "$lib/tools/get-env";
import type { WebhookPayload, WebhookResponse } from "$lib/types/webhook";
import { exportProfile } from "$lib/server/profile-export";

/**
 * Webhook endpoint for Directus Flow integration
 * Receives POST requests from Directus Flow scripts with header-based secret verification
 */

export const POST: RequestHandler = async (event) => {
  try {
    // Get webhook secret from environment
    const webhookSecret = getEnv("WEBHOOK_SECRET", "");

    if (!webhookSecret) {
      return json<WebhookResponse>(
        {
          success: false,
          message: "Webhook not configured",
          error: "WEBHOOK_SECRET environment variable is not set",
        },
        { status: 500 },
      );
    }

    // Get secret from request header
    const headerSecret = event.request.headers.get("x-webhook-secret");

    if (!headerSecret) {
      return json<WebhookResponse>(
        {
          success: false,
          message: "Unauthorized",
          error: "Missing webhook secret header",
        },
        { status: 401 },
      );
    }

    // Verify secret matches
    if (headerSecret !== webhookSecret) {
      return json<WebhookResponse>(
        {
          success: false,
          message: "Unauthorized",
          error: "Invalid webhook secret",
        },
        { status: 401 },
      );
    }

    // Parse the payload
    let payload: WebhookPayload;
    try {
      const body = await event.request.text();
      payload = JSON.parse(body) as WebhookPayload;
    } catch (parseError) {
      return json<WebhookResponse>(
        {
          success: false,
          message: "Invalid JSON payload",
          error: "Failed to parse request body as JSON",
        },
        { status: 400 },
      );
    }

    // Validate required fields
    if (!payload.eventType || !payload.data) {
      return json<WebhookResponse>(
        {
          success: false,
          message: "Invalid payload structure",
          error: "Missing required fields: eventType, data",
        },
        { status: 400 },
      );
    }

    // Process webhook based on event type
    const result = await processWebhookEvent(payload);

    return json<WebhookResponse>(
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

    return json<WebhookResponse>(
      {
        success: false,
        message: "Internal server error",
        error: errorMessage,
      },
      { status: 500 },
    );
  }
};

/**
 * Process webhook events based on their type
 * Extend this function to handle different event types from Directus
 */
async function processWebhookEvent(
  payload: WebhookPayload,
): Promise<Record<string, unknown>> {
  const { eventType, data } = payload;

  // Log incoming webhook (for debugging/auditing)
  console.log(`[Webhook] Processing event: ${eventType}`, {
    dataKeys: Object.keys(data),
  });

  // Handle different event types
  switch (eventType) {
    case "profile.export":
      return await handleProfileExport(data);
    case "item.create":
      return await handleItemCreate(data);
    case "item.update":
      return await handleItemUpdate(data);
    case "item.delete":
      return await handleItemDelete(data);
    case "custom.event":
      return await handleCustomEvent(data);
    default:
      console.warn(`[Webhook] Unknown event type: ${eventType}`);
      return {
        processed: true,
        message: "Event type not specifically handled but received",
      };
  }
}

/**
 * Handle profile.export events
 * Called to export profile schema and data to collected_data collection
 * Expected data format: { profileIds: number[] } or { profileId: number }
 */
async function handleProfileExport(
  data: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  // Support both profileIds (array) and profileId (single) for backwards compatibility
  let profileIds: number[] = [];

  if (Array.isArray(data.profileIds)) {
    profileIds = (data.profileIds as unknown[])
      .map((id) => {
        const parsed = parseInt(String(id), 10);
        return isNaN(parsed) ? null : parsed;
      })
      .filter((id): id is number => id !== null);
  } else if (typeof data.profileId === "number") {
    profileIds = [data.profileId];
  }

  if (profileIds.length === 0) {
    console.warn(
      `[Webhook] profile.export: Invalid or missing profileIds`,
      data,
    );
    return {
      processed: false,
      error:
        "Missing or invalid profileIds in data (expected array of numbers or single profileId)",
    };
  }

  try {
    console.log(`[Webhook] Exporting ${profileIds.length} profile(s)...`);

    const results = await Promise.allSettled(
      profileIds.map((profileId) =>
        exportProfile(profileId)
          .then((result) => ({
            profileId,
            success: result.success,
            schemaExport: result.schemaResult,
            dataExport: result.dataResult,
          }))
          .catch((error) => ({
            profileId,
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
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
      profileCount: profileIds.length,
      successCount: successful.length,
      results: results.map((
        r,
      ) => (r.status === "fulfilled" ? r.value : r.reason)),
      ...(failed.length > 0 && { failureCount: failed.length }),
    };
  } catch (error) {
    const errorMessage = error instanceof Error
      ? error.message
      : "Unknown error";
    console.error(`[Webhook] profile.export failed:`, errorMessage);
    return {
      processed: false,
      profileCount: profileIds.length,
      error: errorMessage,
    };
  }
}

/**
 * Handle item.create events
 * Called when a new item is created in Directus
 */
async function handleItemCreate(
  data: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  // Example: Log the created item
  console.log(`[Webhook] Item created:`, data);

  // TODO: Add your business logic here
  // For example:
  // - Send email notifications
  // - Update related records
  // - Trigger external API calls
  // - Update cache or search indices

  return {
    processed: true,
    action: "item.create",
    itemId: data.id,
  };
}

/**
 * Handle item.update events
 * Called when an existing item is updated in Directus
 */
async function handleItemUpdate(
  data: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  // Example: Log the updated item
  console.log(`[Webhook] Item updated:`, data);

  // TODO: Add your business logic here

  return {
    processed: true,
    action: "item.update",
    itemId: data.id,
  };
}

/**
 * Handle item.delete events
 * Called when an item is deleted from Directus
 */
async function handleItemDelete(
  data: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  // Example: Log the deleted item
  console.log(`[Webhook] Item deleted:`, data);

  // TODO: Add your business logic here

  return {
    processed: true,
    action: "item.delete",
    itemId: data.id,
  };
}

/**
 * Handle custom events
 * Called for custom events defined in Directus Flow
 */
async function handleCustomEvent(
  data: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  // Example: Log the custom event
  console.log(`[Webhook] Custom event:`, data);

  // TODO: Add your business logic here

  return {
    processed: true,
    action: "custom.event",
  };
}
