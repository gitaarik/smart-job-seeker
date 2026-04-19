/**
 * User Profile Helper Module
 *
 * Functions for querying profiles owned by a specific user.
 */

import { dbDirect as db } from "$lib/server/db";
import { eq, and, count, asc, desc } from "drizzle-orm";
import { profiles } from "$lib/server/db/schema";

/**
 * Lightweight profile data for dashboard navigation
 */
export interface ProfileSummary {
  id: number;
  name: string | null;
  slug: string | null;
  title: string | null;
  is_default: boolean | null;
  profile_picture_id: string | null;
  profile_photo_path: string | null;
}

/**
 * Get all profiles owned by a user
 */
export async function getProfilesByUserId(
  userId: string,
): Promise<ProfileSummary[]> {
  return db.query.profiles.findMany({
    where: eq(profiles.user_id, userId),
    columns: {
      id: true,
      name: true,
      slug: true,
      title: true,
      is_default: true,
      profile_picture_id: true,
      profile_photo_path: true,
    },
    orderBy: [
      desc(profiles.is_default), // Default profile first
      asc(profiles.date_created), // Then by creation date
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
  const profile = await db.query.profiles.findFirst({
    where: and(eq(profiles.id, profileId), eq(profiles.user_id, userId)),
    columns: { id: true },
  });
  return !!profile;
}

/**
 * Get the count of profiles owned by a user
 */
export async function getUserProfileCount(userId: string): Promise<number> {
  const [{ value }] = await db.select({ value: count() }).from(profiles)
    .where(eq(profiles.user_id, userId));
  return value;
}
