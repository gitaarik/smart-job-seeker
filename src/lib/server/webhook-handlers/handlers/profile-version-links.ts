/**
 * Handle profile_version.generate_preview_links events
 * Called to generate preview link HTML for profile versions
 */

import { db } from "$lib/server/db";
import { config } from "$lib/server/config";
import { parseWebhookIds, processBatchWebhook } from "../batch-utils";
import type { WebhookHandler, WebhookHandlerResult } from "../types";

export const profileVersionLinksHandler: WebhookHandler = {
  eventType: "profile_version.generate_preview_links",

  async handle(data: Record<string, unknown>): Promise<WebhookHandlerResult> {
    const profileVersionIds = parseWebhookIds(data, "profileVersionIds");

    if (profileVersionIds.length === 0) {
      return {
        processed: false,
        error:
          "Missing or invalid profileVersionIds in data (expected array of numbers)",
      };
    }

    return processBatchWebhook({
      ids: profileVersionIds,
      idLabel: "profileVersion",
      eventType: "profile_version.generate_preview_links",
      processOne: async (profileVersionId) => {
        const profileVersion = await db.profile_versions.findUnique({
          where: { id: profileVersionId },
          select: {
            name: true,
            profiles: {
              select: { slug: true },
            },
          },
        });

        if (!profileVersion || !profileVersion.name) {
          throw new Error(
            `Profile version ${profileVersionId} not found or has no name`,
          );
        }

        if (!profileVersion.profiles?.slug) {
          throw new Error(
            `Profile for version ${profileVersionId} not found or has no slug`,
          );
        }

        const versionName = encodeURIComponent(profileVersion.name);
        const profileSlug = profileVersion.profiles.slug;
        const baseUrl = config.publicSiteUrl;

        const previewHtml =
          `<div style="display: flex; gap: 32px; font-size: 16px;">` +
          `<div style="display: flex; flex-direction: column; gap: 8px;">` +
          `<div style="font-weight: 600; margin-bottom: 10px;">📄 Resume</div>` +
          `<div style="display: flex; gap: 12px;">` +
          `<a href="${baseUrl}/p/${profileSlug}/resume?version=${versionName}" target="_blank">HTML</a>` +
          `<a href="${baseUrl}/p/${profileSlug}/resume.pdf?version=${versionName}" target="_blank">PDF</a>` +
          `</div>` +
          `</div>` +
          `<div style="display: flex; flex-direction: column; gap: 8px;">` +
          `<div style="font-weight: 600; margin-bottom: 10px;">📋 CV</div>` +
          `<div style="display: flex; gap: 12px;">` +
          `<a href="${baseUrl}/p/${profileSlug}/cv?version=${versionName}" target="_blank">HTML</a>` +
          `<a href="${baseUrl}/p/${profileSlug}/cv.pdf?version=${versionName}" target="_blank">PDF</a>` +
          `</div>` +
          `</div>` +
          `</div>`;

        await db.profile_versions.update({
          where: { id: profileVersionId },
          data: { preview_links: previewHtml },
        });

        return {
          profileVersionId,
          success: true,
          message: "Preview links generated successfully",
        };
      },
    });
  },
};
