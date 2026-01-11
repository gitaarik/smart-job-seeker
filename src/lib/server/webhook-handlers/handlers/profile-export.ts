/**
 * Handle profile.export events
 * Called to export profile schema and data to collected_data collection
 */

import { exportProfile } from "$lib/server/profile-export";
import type { WebhookHandler, WebhookHandlerResult } from "../types";

export const profileExportHandler: WebhookHandler = {
  eventType: "profile.export",

  async handle(data: Record<string, unknown>): Promise<WebhookHandlerResult> {
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
      return {
        processed: false,
        error:
          "Missing or invalid profileIds in data (expected array of numbers or single profileId)",
      };
    }

    // Try block contains ONLY the async operation
    let results;
    try {
      results = await Promise.allSettled(
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

    // Result processing outside try block
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
      results: results.map((r) =>
        r.status === "fulfilled" ? r.value : r.reason
      ),
      ...(failed.length > 0 && { failureCount: failed.length }),
    };
  },
};
