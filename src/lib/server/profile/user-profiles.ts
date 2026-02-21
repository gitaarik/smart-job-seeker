/**
 * User Profile Helper Module
 *
 * Functions for querying profiles owned by a specific user.
 */

import { dbDirect as db } from "$lib/server/db";

/**
 * Lightweight profile data for dashboard navigation
 */
export interface ProfileSummary {
  id: number;
  name: string | null;
  slug: string | null;
  title: string | null;
  is_default: boolean | null;
  profile_picture: string | null;
  profile_photo_path: string | null;
}

/**
 * Get all profiles owned by a user
 */
export async function getProfilesByUserId(
  userId: string,
): Promise<ProfileSummary[]> {
  return db.profiles.findMany({
    where: { user_id: userId },
    select: {
      id: true,
      name: true,
      slug: true,
      title: true,
      is_default: true,
      profile_picture: true,
      profile_photo_path: true,
    },
    orderBy: [
      { is_default: "desc" }, // Default profile first
      { date_created: "asc" }, // Then by creation date
    ],
  });
}

/**
 * Check if a user owns a specific profile
 */
export async function userOwnsProfile(
  userId: string,
  profileId: number,
): Promise<boolean> {
  const profile = await db.profiles.findFirst({
    where: {
      id: profileId,
      user_id: userId,
    },
    select: { id: true },
  });
  return profile !== null;
}

/**
 * Get the count of profiles owned by a user
 */
export async function getUserProfileCount(userId: string): Promise<number> {
  return db.profiles.count({
    where: { user_id: userId },
  });
}
