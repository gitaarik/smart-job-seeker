/**
 * The profile photo's URL: its media library rendition, or, on a database
 * `scripts/migrate-media-library.ts` has not converted yet, the old file
 * under `uploads/` ("profiles/abc123.jpg" -> "/uploads/profiles/abc123.jpg").
 * See getEntityMediaUrl for the same story on entity logos.
 */
import { getEntityMediaUrl } from './entity-media-url';

export function getProfilePhotoUrl(
	profile:
		{ profile_photo_id?: string | null; profile_photo_path?: string | null } | null | undefined
): string | null {
	return profile ? getEntityMediaUrl(profile.profile_photo_id, profile.profile_photo_path) : null;
}
