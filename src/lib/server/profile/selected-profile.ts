import { dbDirect as db } from '$lib/server/db';
import { and, eq } from 'drizzle-orm';
import { profiles } from '$lib/server/db/schema';

/**
 * Resolve the caller's currently-selected profile id from the
 * `selected_profile_id` cookie, verifying it belongs to the user. Shared by the
 * profile edit actions and the translations API so both scope writes to the
 * same profile.
 */
export async function getSelectedProfileId(
	cookies: { get: (name: string) => string | undefined },
	userId: string
): Promise<number | null> {
	const cookieValue = cookies.get('selected_profile_id');
	if (!cookieValue) return null;
	const profileId = parseInt(cookieValue, 10);
	if (isNaN(profileId)) return null;
	const profile = await db.query.profiles.findFirst({
		where: and(eq(profiles.id, profileId), eq(profiles.user_id, userId))
	});
	return profile ? profileId : null;
}
