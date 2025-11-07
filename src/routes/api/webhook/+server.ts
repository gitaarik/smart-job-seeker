import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { createHmac } from 'crypto';
import { getEnv } from '$lib/tools/get-env';
import type { WebhookPayload, WebhookResponse } from '$lib/types/webhook';
import { exportProfile } from '$lib/server/profile-export';

/**
 * Webhook endpoint for Directus Flow integration
 * Receives POST requests from Directus Flow scripts with secure HMAC-SHA256 authentication
 */

export const POST: RequestHandler = async (event) => {
  try {
    // Get webhook secret from environment
    const webhookSecret = getEnv('WEBHOOK_SECRET', '');

    if (!webhookSecret) {
      return json<WebhookResponse>(
        {
          success: false,
          message: 'Webhook not configured',
          error: 'WEBHOOK_SECRET environment variable is not set',
          timestamp: new Date().toISOString(),
        },
        { status: 500 }
      );
    }

    // Get signature from request headers
    const signature = event.request.headers.get('x-webhook-signature');

    if (!signature) {
      return json<WebhookResponse>(
        {
          success: false,
          message: 'Unauthorized',
          error: 'Missing webhook signature header',
          timestamp: new Date().toISOString(),
        },
        { status: 401 }
      );
    }

    // Get raw request body for signature verification
    const rawBody = await event.request.text();

    // Verify HMAC signature
    const expectedSignature = createHmac('sha256', webhookSecret).update(rawBody).digest('hex');

    if (signature !== expectedSignature) {
      return json<WebhookResponse>(
        {
          success: false,
          message: 'Unauthorized',
          error: 'Invalid webhook signature',
          timestamp: new Date().toISOString(),
        },
        { status: 401 }
      );
    }

    // Parse the payload
    let payload: WebhookPayload;
    try {
      payload = JSON.parse(rawBody) as WebhookPayload;
    } catch (parseError) {
      return json<WebhookResponse>(
        {
          success: false,
          message: 'Invalid JSON payload',
          error: 'Failed to parse request body as JSON',
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // Validate required fields
    if (!payload.eventId || !payload.eventType || !payload.data) {
      return json<WebhookResponse>(
        {
          success: false,
          message: 'Invalid payload structure',
          error: 'Missing required fields: eventId, eventType, data',
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // Process webhook based on event type
    const result = await processWebhookEvent(payload);

    return json<WebhookResponse>(
      {
        success: true,
        message: 'Webhook processed successfully',
        data: result,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return json<WebhookResponse>(
      {
        success: false,
        message: 'Internal server error',
        error: errorMessage,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
};

/**
 * Process webhook events based on their type
 * Extend this function to handle different event types from Directus
 */
async function processWebhookEvent(payload: WebhookPayload): Promise<Record<string, unknown>> {
  const { eventType, data, eventId, metadata } = payload;

  // Log incoming webhook (for debugging/auditing)
  console.log(`[Webhook] Processing event: ${eventType}`, {
    eventId,
    timestamp: payload.timestamp,
    dataKeys: Object.keys(data),
  });

  // Handle different event types
  switch (eventType) {
    case 'profile.export':
      return await handleProfileExport(data, eventId, metadata);
    case 'item.create':
      return await handleItemCreate(data, eventId, metadata);
    case 'item.update':
      return await handleItemUpdate(data, eventId, metadata);
    case 'item.delete':
      return await handleItemDelete(data, eventId, metadata);
    case 'custom.event':
      return await handleCustomEvent(data, eventId, metadata);
    default:
      console.warn(`[Webhook] Unknown event type: ${eventType}`);
      return { processed: true, eventId, message: 'Event type not specifically handled but received' };
  }
}

/**
 * Handle profile.export events
 * Called to export profile schema and data to collected_data collection
 * Expected data format: { profileId: number }
 */
async function handleProfileExport(
  data: Record<string, unknown>,
  eventId: string,
  metadata?: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const profileId = data.profileId as number | undefined;

  if (!profileId || typeof profileId !== 'number') {
    console.warn(`[Webhook] profile.export: Invalid or missing profileId`, data);
    return {
      processed: false,
      eventId,
      error: 'Missing or invalid profileId in data',
    };
  }

  try {
    console.log(`[Webhook] Exporting profile ${profileId}...`);
    const result = await exportProfile(profileId);

    return {
      processed: result.success,
      eventId,
      profileId,
      schemaExport: result.schemaResult,
      dataExport: result.dataResult,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Webhook] profile.export failed:`, errorMessage);
    return {
      processed: false,
      eventId,
      profileId,
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
  eventId: string,
  metadata?: Record<string, unknown>
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
    eventId,
    action: 'item.create',
    itemId: data.id,
    collection: metadata?.collection,
  };
}

/**
 * Handle item.update events
 * Called when an existing item is updated in Directus
 */
async function handleItemUpdate(
  data: Record<string, unknown>,
  eventId: string,
  metadata?: Record<string, unknown>
): Promise<Record<string, unknown>> {
  // Example: Log the updated item
  console.log(`[Webhook] Item updated:`, data);

  // TODO: Add your business logic here

  return {
    processed: true,
    eventId,
    action: 'item.update',
    itemId: data.id,
    collection: metadata?.collection,
  };
}

/**
 * Handle item.delete events
 * Called when an item is deleted from Directus
 */
async function handleItemDelete(
  data: Record<string, unknown>,
  eventId: string,
  metadata?: Record<string, unknown>
): Promise<Record<string, unknown>> {
  // Example: Log the deleted item
  console.log(`[Webhook] Item deleted:`, data);

  // TODO: Add your business logic here

  return {
    processed: true,
    eventId,
    action: 'item.delete',
    itemId: data.id,
    collection: metadata?.collection,
  };
}

/**
 * Handle custom events
 * Called for custom events defined in Directus Flow
 */
async function handleCustomEvent(
  data: Record<string, unknown>,
  eventId: string,
  metadata?: Record<string, unknown>
): Promise<Record<string, unknown>> {
  // Example: Log the custom event
  console.log(`[Webhook] Custom event:`, data);

  // TODO: Add your business logic here

  return {
    processed: true,
    eventId,
    action: 'custom.event',
    metadata,
  };
}
