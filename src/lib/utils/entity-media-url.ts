/**
 * Get URL for entity media.
 *
 * Entity images used to be `files` rows served by id from `/assets/<uuid>`;
 * they are bytes under `uploads/` named by a `*_path` column now. The move was
 * lazy and per-row -- `saveEntityMedia` wrote the path and nulled the uuid --
 * so this took a `legacyUuid` to fall back on until the last row had crossed.
 * The columns were dropped once none had needed it for some time.
 */
export function getEntityMediaUrl(localPath: string | null | undefined): string | null {
	return localPath ? `/uploads/${localPath}` : null;
}

/**
 * Get work experience logo URL
 */
export function getWorkExperienceLogoUrl(workExp: { logo_path?: string | null }): string | null {
	return getEntityMediaUrl(workExp.logo_path);
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
export function getEducationLogoUrl(edu: { logo_path?: string | null }): string | null {
	return getEntityMediaUrl(edu.logo_path);
}

/**
 * Get education banner URL
 */
export function getEducationBannerUrl(edu: { banner_path?: string | null }): string | null {
	return getEntityMediaUrl(edu.banner_path);
}

/**
 * Get side project image URL
 */
export function getSideProjectImageUrl(project: { image_path?: string | null }): string | null {
	return getEntityMediaUrl(project.image_path);
}

/**
 * Get side project banner URL
 */
export function getSideProjectBannerUrl(project: { banner_path?: string | null }): string | null {
	return getEntityMediaUrl(project.banner_path);
}
