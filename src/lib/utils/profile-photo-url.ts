/**
 * Generate URL for profile photo: "profiles/abc123.jpg" -> "/uploads/profiles/abc123.jpg".
 *
 * Had a second branch for `profile_picture_id`, the uuid of a `files` row served
 * from `/assets/<uuid>`, which is how photos were stored before `uploads/`. That
 * column is gone; see getEntityMediaUrl for the same story on entity logos.
 */
export function getProfilePhotoUrl(
	profile: { profile_photo_path?: string | null } | null | undefined
): string | null {
	return profile?.profile_photo_path ? `/uploads/${profile.profile_photo_path}` : null;
}
