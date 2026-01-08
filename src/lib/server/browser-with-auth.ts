/**
 * Browser utilities with authentication support
 * Combines browser launching with cookie restoration and fingerprint randomization
 */

import type { BrowserContext } from "patchright";
import { type BrowserLaunchOptions, launchBrowser } from "./browser-utils";
import { dbDirect } from "$lib/db";

export interface AuthenticatedBrowserOptions extends BrowserLaunchOptions {
  /**
   * Profile ID for cookie restoration
   * If not provided, will try to use default profile
   */
  profileId?: number;

  /**
   * Platform ID for cookie restoration
   * If not provided, cookies won't be restored
   */
  platformId?: number;

  /**
   * Whether to load cookies from database
   * @default true if platformId is provided
   */
  loadCookies?: boolean;
}

/**
 * Launch browser with authentication (cookies restored from database)
 * This is the recommended way to launch browsers for job scraping
 *
 * @param options Browser and authentication options
 * @returns Browser context with cookies restored
 */
export async function launchAuthenticatedBrowser(
  options: AuthenticatedBrowserOptions = {},
): Promise<BrowserContext> {
  let profileId = options.profileId;

  // If no profile ID provided, try to get default
  if (!profileId) {
    const config = await dbDirect.config.findFirst();
    profileId = config?.default_profile ?? undefined;
  }

  // Note: Cookie/fingerprint loading removed - now using Browser-Use for authentication
  // This function now just launches a basic browser for Playwright-based scraping
  // For authenticated scraping, use Browser-Use with credentials from the database

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
