import { dbDirect as db } from "$lib/server/db";
import { eq, and } from "drizzle-orm";
import { profiles } from "$lib/server/db/schema";

export { touchProfile } from "$lib/server/profile/touch-profile";

export async function getSelectedProfileId(
  cookies: { get: (name: string) => string | undefined },
  userId: string,
): Promise<number | null> {
  const cookieValue = cookies.get("selected_profile_id");
  if (!cookieValue) return null;
  const profileId = parseInt(cookieValue, 10);
  if (isNaN(profileId)) return null;
  // Verify ownership
  const profile = await db.query.profiles.findFirst({
    where: and(eq(profiles.id, profileId), eq(profiles.user_id, userId)),
  });
  return profile ? profileId : null;
}
