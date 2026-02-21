/**
 * Generate URL for profile photo
 *
 * Priority:
 * 1. Local upload (profile_photo_path): "profiles/abc123.jpg" → "/uploads/profiles/abc123.jpg"
 * 2. Legacy Directus (profile_picture UUID): "ee492412-..." → "/assets/ee492412-..."
 *
 * @param profile - Object with profile_photo_path and/or profile_picture
 */
export function getProfilePhotoUrl(
  profile: {
    profile_photo_path?: string | null;
    profile_picture?: string | null;
  } | null | undefined,
): string | null {
  if (!profile) return null;

  // Prefer local upload
  if (profile.profile_photo_path) {
    return `/uploads/${profile.profile_photo_path}`;
  }

  // Fall back to legacy Directus UUID
  if (profile.profile_picture) {
    return `/assets/${profile.profile_picture}`;
  }

  return null;
}
