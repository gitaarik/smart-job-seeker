import { dbDirect as db } from "$lib/server/db";
import { eq } from "drizzle-orm";
import { profiles } from "$lib/server/db/schema";

/**
 * Bump the profile's `date_updated` so downstream consumers know the profile
 * changed. Child-record edits (skills, work experiences, languages, interview
 * stories, cheat sheets, etc.) live in their own tables and don't otherwise
 * touch the parent row — but the matcher's `collected_data` staleness check
 * keys off `profiles.date_updated`, so without this a child edit would keep
 * scoring against a stale profile snapshot. Call after any successful
 * child-record mutation.
 */
export async function touchProfile(profileId: number): Promise<void> {
  await db
    .update(profiles)
    .set({ date_updated: new Date() })
    .where(eq(profiles.id, profileId));
}
