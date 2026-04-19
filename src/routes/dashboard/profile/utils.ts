import { dbDirect as db } from "$lib/server/db";

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
    where: { id: profileId, user_id: userId },
  });
  return profile ? profileId : null;
}
