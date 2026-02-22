/**
 * Get URL for entity media
 * Handles both local storage paths and legacy Directus UUIDs
 */
export function getEntityMediaUrl(
  localPath: string | null | undefined,
  legacyUuid?: string | null,
): string | null {
  // Prefer local path
  if (localPath) {
    return `/uploads/${localPath}`;
  }

  // Fall back to legacy Directus
  if (legacyUuid) {
    return `/assets/${legacyUuid}`;
  }

  return null;
}

/**
 * Get work experience logo URL
 */
export function getWorkExperienceLogoUrl(workExp: {
  logo_path?: string | null;
  logo?: string | null;
}): string | null {
  return getEntityMediaUrl(workExp.logo_path, workExp.logo);
}

/**
 * Get work experience banner URL
 */
export function getWorkExperienceBannerUrl(workExp: {
  banner_path?: string | null;
}): string | null {
  return getEntityMediaUrl(workExp.banner_path);
}

/**
 * Get education logo URL
 */
export function getEducationLogoUrl(edu: {
  logo_path?: string | null;
  logo?: string | null;
}): string | null {
  return getEntityMediaUrl(edu.logo_path, edu.logo);
}

/**
 * Get education banner URL
 */
export function getEducationBannerUrl(edu: {
  banner_path?: string | null;
}): string | null {
  return getEntityMediaUrl(edu.banner_path);
}

/**
 * Get side project image URL
 */
export function getSideProjectImageUrl(project: {
  image_path?: string | null;
}): string | null {
  return getEntityMediaUrl(project.image_path);
}
