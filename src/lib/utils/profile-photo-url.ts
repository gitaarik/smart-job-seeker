/**
 * The profile photo's URL: its media library rendition. See getEntityMediaUrl
 * for the same story on entity logos.
 */
import { getEntityMediaUrl } from './entity-media-url';

export function getProfilePhotoUrl(
	profile: { profile_photo_id?: string | null } | null | undefined
): string | null {
	return profile ? getEntityMediaUrl(profile.profile_photo_id) : null;
}
