/**
 * Handle profile.export events
 * Called to export profile schema and data to collected_data collection
 */

import { exportProfile } from "$lib/server/profile/export";
import { parseWebhookIds, processBatchWebhook } from "../batch-utils";
import type { WebhookHandler, WebhookHandlerResult } from "../types";

export const profileExportHandler: WebhookHandler = {
  eventType: "profile.export",

  async handle(data: Record<string, unknown>): Promise<WebhookHandlerResult> {
    // Support both profileIds (array) and profileId (single) for backwards compatibility
    let profileIds = parseWebhookIds(data, "profileIds");

    if (profileIds.length === 0 && typeof data.profileId === "number") {
      profileIds = [data.profileId];
    }

    if (profileIds.length === 0) {
      return {
        processed: false,
        error:
          "Missing or invalid profileIds in data (expected array of numbers or single profileId)",
      };
    }

    return processBatchWebhook({
      ids: profileIds,
      idLabel: "profile",
      eventType: "profile.export",
      processOne: (profileId) =>
        exportProfile(profileId)
          .then((result) => ({
            profileId,
            success: result.success,
            schemaExport: result.schemaResult,
            dataExport: result.dataResult,
          })),
    });
  },
};
