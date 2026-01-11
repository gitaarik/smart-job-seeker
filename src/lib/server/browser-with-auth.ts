/**
 * Browser utilities with authentication support
 * Note: Authentication is now handled by Browser-Use. This provides basic browser launching.
 */

import type { BrowserContext } from "patchright";
import { type BrowserLaunchOptions, launchBrowser } from "./browser-utils";
import { dbDirect } from "$lib/db"; // Still used in getPlatformIdFromUrl

export interface AuthenticatedBrowserOptions extends BrowserLaunchOptions {
  /**
   * Profile ID (legacy - no longer used)
   * @deprecated Use Browser-Use for authenticated scraping
   */
  profileId?: number;

  /**
   * Platform ID (legacy - no longer used)
   * @deprecated Use Browser-Use for authenticated scraping
   */
  platformId?: number;
}

/**
 * Launch browser without authentication
 * @deprecated Use Browser-Use for authenticated scraping
 *
 * @param options Browser launch options
 * @returns Browser context
 */
export async function launchAuthenticatedBrowser(
  options: AuthenticatedBrowserOptions = {},
): Promise<BrowserContext> {
  // This launches a browser without authentication.
  // For authenticated scraping, use Browser-Use with credentials from the database.

  console.log("⚠️  Launching browser without authentication");
  console.log(
    "   For authenticated scraping, use Browser-Use with credentials",
  );

  const context = await launchBrowser({
    ...options,
  });

  return context;
}

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
