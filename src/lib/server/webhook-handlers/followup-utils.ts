/**
 * Shared utilities for single-entity followup webhook handlers
 */

import { getErrorMessage } from "$lib/server/utils/errors";
import type { WebhookHandlerResult } from "./types";

/**
 * Parse a single numeric ID from webhook data, supporting both number and string values.
 */
export function parseSingleWebhookId(
  data: Record<string, unknown>,
  key: string,
): number {
  const raw = data[key];
  if (typeof raw === "number") return raw;
  if (typeof raw === "string") return parseInt(raw, 10);
  return NaN;
}

/**
 * Parse and validate followup request params from webhook data.
 * Returns the parsed params or a WebhookHandlerResult error.
 */
export function parseFollowupParams(
  data: Record<string, unknown>,
  idKey: string,
  idLabel: string,
): { entityId: number; followupRequest: string; includeOriginalContext: boolean } | WebhookHandlerResult {
  const entityId = parseSingleWebhookId(data, idKey);

  if (isNaN(entityId)) {
    return {
      processed: false,
      success: false,
      error: `Missing or invalid ${idKey} in data (expected number)`,
    };
  }

  const followupRequest = typeof data.followup_request === "string"
    ? data.followup_request
    : "";

  if (!followupRequest.trim()) {
    return {
      processed: false,
      success: false,
      error: "Missing or empty followup_request in data",
    };
  }

  const includeOriginalContext = data.include_original_context === "true" ||
    data.include_original_context === true;

  return { entityId, followupRequest, includeOriginalContext };
}

/**
 * Generic single-entity followup webhook handler.
 */
export async function handleEntityFollowup(opts: {
  data: Record<string, unknown>;
  idKey: string;
  idLabel: string;
  eventType: string;
  createFollowup: (
    entityId: number,
    followupRequest: string,
    includeOriginalContext: boolean,
  ) => Promise<{
    success: boolean;
    message: string;
    aiChat?: { id: number };
  }>;
}): Promise<WebhookHandlerResult> {
  const { data, idKey, idLabel, eventType, createFollowup } = opts;

  const params = parseFollowupParams(data, idKey, idLabel);
  if ("processed" in params) return params;

  const { entityId, followupRequest, includeOriginalContext } = params;

  let result;
  try {
    result = await createFollowup(entityId, followupRequest, includeOriginalContext);
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    console.error(`[Webhook] ${eventType} failed:`, errorMessage);
    return {
      processed: false,
      success: false,
      error: errorMessage,
    };
  }

  return {
    processed: true,
    success: result.success,
    message: result.message,
    data: result.aiChat
      ? {
        aiChatId: result.aiChat.id,
        [idKey]: entityId,
      }
      : undefined,
    ...(result.success ? {} : { error: result.message }),
  };
}
