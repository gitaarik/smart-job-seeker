/**
 * Shared utilities for batch webhook handlers
 */

import { getErrorMessage } from "$lib/server/utils/errors";
import type { WebhookHandlerResult } from "./types";

/**
 * Parse and validate an array of numeric IDs from webhook data.
 * Handles both numeric and string values, filtering out invalid entries.
 */
export function parseWebhookIds(
  data: Record<string, unknown>,
  key: string,
): number[] {
  const raw = data[key];
  if (!Array.isArray(raw)) return [];

  return (raw as unknown[])
    .map((id) => {
      const parsed = parseInt(String(id), 10);
      return isNaN(parsed) ? null : parsed;
    })
    .filter((id): id is number => id !== null);
}

/**
 * Generic batch processor for webhook handlers.
 * Handles the common pattern of: parse IDs → process each → count results.
 *
 * The processOne callback should handle its own errors by catching them and
 * returning a result with `success: false`. Any uncaught errors will be
 * caught by Promise.allSettled and mapped to `{ success: false, message: ... }`.
 */
export async function processBatchWebhook<T>(opts: {
  ids: number[];
  idLabel: string;
  eventType: string;
  processOne: (id: number) => Promise<T>;
}): Promise<WebhookHandlerResult> {
  const { ids, idLabel, eventType, processOne } = opts;

  let results: PromiseSettledResult<T>[];
  try {
    results = await Promise.allSettled(ids.map((id) => processOne(id)));
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    console.error(`[Webhook] ${eventType} failed:`, errorMessage);
    return {
      processed: false,
      [`${idLabel}Count`]: ids.length,
      error: errorMessage,
    };
  }

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
    [`${idLabel}Count`]: ids.length,
    successCount: successful.length,
    results: results.map((r) => {
      if (r.status === "fulfilled") return r.value;
      return {
        success: false,
        message: getErrorMessage(r.reason),
      };
    }),
    ...(failed.length > 0 && { failureCount: failed.length }),
  };
}
