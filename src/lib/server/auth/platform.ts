/**
 * Platform authentication utilities
 * Handles login automation for job platforms
 */

import { dbDirect } from "$lib/server/db";
import { eq, and } from "drizzle-orm";
import { platform_profiles } from "$lib/server/db/schema";

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
  const platformProfile = await dbDirect.query.platform_profiles.findFirst({
    where: and(eq(platform_profiles.profile_id, profileId), eq(platform_profiles.platform_id, platformId)),
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
  const existingProfile = await dbDirect.query.platform_profiles.findFirst({
    where: and(eq(platform_profiles.profile_id, profileId), eq(platform_profiles.platform_id, platformId)),
  });

  if (existingProfile) {
    await dbDirect.update(platform_profiles).set({
      login_error: error,
    }).where(eq(platform_profiles.id, existingProfile.id));
  }
}
