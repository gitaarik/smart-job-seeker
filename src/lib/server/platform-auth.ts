/**
 * Platform authentication utilities
 * Handles login automation and cookie management for job platforms
 */

import { dbDirect } from "$lib/db";
import type { BrowserContext } from "patchright";
import { BrowserUseClient } from "./browser-use-client";

export interface PlatformCredentials {
  platformId: number;
  profileId: number;
  username?: string | null;
  password?: string | null;
  cookies?: any | null;
}

/**
 * Load saved cookies for a platform profile from the database
 * Note: Fingerprint support removed - now using Browser-Use with credentials
 * @param profileId Profile ID
 * @param platformId Platform ID
 * @returns Cookie array or null if not found
 */
export async function loadPlatformCookies(
  profileId: number,
  platformId: number,
): Promise<
  Array<{
    name: string;
    value: string;
    domain: string;
    path?: string;
    expires?: number;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: "Strict" | "Lax" | "None";
  }> | null
> {
  const platformProfile = await dbDirect.platform_profiles.findFirst({
    where: {
      profile: profileId,
      platform: platformId,
    },
  });

  if (!platformProfile || !platformProfile.cookies) {
    return null;
  }

  return platformProfile.cookies as any;
}

/**
 * Save cookies for a platform profile to the database
 * @param profileId Profile ID
 * @param platformId Platform ID
 * @param cookies Cookie array from browser context
 */
export async function savePlatformCookies(
  profileId: number,
  platformId: number,
  cookies: Array<{
    name: string;
    value: string;
    domain: string;
    path?: string;
    expires?: number;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: "Strict" | "Lax" | "None";
  }>,
): Promise<void> {
  // Find existing platform profile or create new one
  const existingProfile = await dbDirect.platform_profiles.findFirst({
    where: {
      profile: profileId,
      platform: platformId,
    },
  });

  if (existingProfile) {
    await dbDirect.platform_profiles.update({
      where: { id: existingProfile.id },
      data: {
        cookies,
        last_login_at: new Date(),
        login_error: null,
      },
    });
  } else {
    await dbDirect.platform_profiles.create({
      data: {
        profile: profileId,
        platform: platformId,
        cookies,
        last_login_at: new Date(),
        status: "active",
      },
    });
  }

  console.log(`✅ Saved ${cookies.length} cookies to database`);
}

/**
 * Get platform credentials from database
 * @param profileId Profile ID
 * @param platformId Platform ID
 * @returns Platform credentials or null
 */
export async function getPlatformCredentials(
  profileId: number,
  platformId: number,
): Promise<PlatformCredentials | null> {
  const platformProfile = await dbDirect.platform_profiles.findFirst({
    where: {
      profile: profileId,
      platform: platformId,
    },
  });

  if (!platformProfile) {
    return null;
  }

  return {
    platformId,
    profileId,
    username: platformProfile.username,
    password: platformProfile.password,
    cookies: platformProfile.cookies,
  };
}

/**
 * Perform automated login using Browser-Use
 * @param platformUrl URL of the platform login page
 * @param username Username or email
 * @param password Password
 * @returns Whether login was successful
 */
export async function loginWithBrowserUse(
  platformUrl: string,
  username: string,
  password: string,
): Promise<{ success: boolean; error?: string; cookies?: any[] }> {
  const browserUseClient = new BrowserUseClient();

  try {
    console.log(`🤖 Using Browser-Use to log in to ${platformUrl}...`);

    const task =
      `Navigate to ${platformUrl} and log in with username "${username}" and password "${password}".
Fill in any login forms, handle 2FA if present, and wait until fully logged in.
Return "success" when logged in, or describe any errors encountered.`;

    const response = await browserUseClient.executeTask({
      task,
      startUrl: platformUrl,
      maxTime: 120, // 2 minutes for login
    });

    console.log("✅ Browser-Use login completed");
    console.log("Result:", response.result);

    // Check if login was successful based on response
    const resultStr = typeof response.result === "string"
      ? response.result
      : JSON.stringify(response.result);

    const success = resultStr.toLowerCase().includes("success") ||
      resultStr.toLowerCase().includes("logged in");

    return {
      success,
      error: success ? undefined : resultStr,
    };
  } catch (error) {
    console.error("❌ Browser-Use login failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Save cookies from a browser context to the database
 * Only saves cookies that match the platform's domain
 * @param context Browser context
 * @param profileId Profile ID
 * @param platformId Platform ID
 */
export async function saveCookiesFromContext(
  context: BrowserContext,
  profileId: number,
  platformId: number,
): Promise<void> {
  // Get platform to extract its domain
  const platform = await dbDirect.job_platforms.findUnique({
    where: { id: platformId },
  });

  if (!platform) {
    console.error(`Platform ${platformId} not found`);
    return;
  }

  // Extract domain from platform URL
  let platformDomain: string;
  try {
    const url = new URL(platform.url);
    platformDomain = url.hostname.replace(/^www\./, "");
  } catch {
    console.error(`Invalid URL for platform ${platform.name}: ${platform.url}`);
    return;
  }

  // Get all cookies and filter to only those matching the platform's domain
  const allCookies = await context.cookies();
  const platformCookies = allCookies.filter((cookie) => {
    const cookieDomain = cookie.domain.replace(/^\./, ""); // Remove leading dot
    return cookieDomain === platformDomain ||
      cookieDomain.endsWith(`.${platformDomain}`);
  });

  // Only save if there are cookies for this platform
  if (platformCookies.length === 0) {
    console.log(`   ⚠️  No cookies found for ${platform.name}`);
    return;
  }

  await savePlatformCookies(profileId, platformId, platformCookies);
}

/**
 * Update login error in database
 * @param profileId Profile ID
 * @param platformId Platform ID
 * @param error Error message
 */
export async function updateLoginError(
  profileId: number,
  platformId: number,
  error: string,
): Promise<void> {
  const existingProfile = await dbDirect.platform_profiles.findFirst({
    where: {
      profile: profileId,
      platform: platformId,
    },
  });

  if (existingProfile) {
    await dbDirect.platform_profiles.update({
      where: { id: existingProfile.id },
      data: {
        login_error: error,
      },
    });
  }
}
