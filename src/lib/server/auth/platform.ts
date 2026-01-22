/**
 * Platform authentication utilities
 * Handles login automation for job platforms
 */

import { dbDirect } from "$lib/db";
import { BrowserUseClient } from "../browser/use-client";

export interface PlatformCredentials {
  platformId: number;
  profileId: number;
  username?: string | null;
  password?: string | null;
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
