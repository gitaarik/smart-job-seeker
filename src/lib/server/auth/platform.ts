/**
 * Platform authentication utilities
 * Handles login automation for job platforms
 */

import { dbDirect } from "$lib/db";

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
