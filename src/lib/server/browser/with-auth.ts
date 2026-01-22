/**
 * Browser utilities with authentication support
 * Note: Authentication is now handled by Browser-Use. This provides basic browser launching.
 */

import { dbDirect } from "$lib/db"; // Still used in getPlatformIdFromUrl

/**
 * Get platform ID from URL by matching against job_platforms table
 * @param url URL to match
 * @returns Platform ID or null if not found
 */
export async function getPlatformIdFromUrl(
  url: string,
): Promise<number | null> {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.replace(/^www\./, "");

    // Try to find platform by URL hostname
    const platforms = await dbDirect.job_platforms.findMany({
      where: { status: "published" },
    });

    for (const platform of platforms) {
      try {
        const platformUrl = new URL(platform.url);
        const platformHostname = platformUrl.hostname.replace(/^www\./, "");

        if (
          hostname === platformHostname || hostname.includes(platformHostname)
        ) {
          return platform.id;
        }
      } catch {
        // Invalid platform URL, skip
        continue;
      }
    }

    return null;
  } catch {
    return null;
  }
}
