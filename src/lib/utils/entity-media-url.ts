/**
 * URLs for the images on profile rows.
 *
 * Since 2026-11 a slot points at a media library rendition (`logo_id` and the
 * rest), served at `/assets/<id>`. Until `scripts/migrate-media-library.ts`
 * has run on a database, a row may still hold only its old `*_path` file
 * under `uploads/`, so each helper falls back to that. Once every database is
 * converted and the path columns are dropped, the fallback goes with them.
 *
 * Entity images were once `files` rows served by id from `/assets/<uuid>`,
 * then bytes under `uploads/` named by a `*_path` column; this is the third
 * home, and the first that keeps the original.
 */
import { renditionUrl } from '$lib/media-library';

export function getEntityMediaUrl(
	renditionId: string | null | undefined,
	legacyPath?: string | null
): string | null {
	return renditionUrl(renditionId) ?? (legacyPath ? `/uploads/${legacyPath}` : null);
}

/**
 * Get work experience logo URL
 */
export function getWorkExperienceLogoUrl(workExp: {
	logo_id?: string | null;
	logo_path?: string | null;
}): string | null {
	return getEntityMediaUrl(workExp.logo_id, workExp.logo_path);
}

/**
 * Get work experience banner URL
 */
export function getWorkExperienceBannerUrl(workExp: {
	banner_id?: string | null;
	banner_path?: string | null;
}): string | null {
	return getEntityMediaUrl(workExp.banner_id, workExp.banner_path);
}

/**
 * Get education logo URL
 */
export function getEducationLogoUrl(edu: {
	logo_id?: string | null;
	logo_path?: string | null;
}): string | null {
	return getEntityMediaUrl(edu.logo_id, edu.logo_path);
}

/**
 * Get education banner URL
 */
export function getEducationBannerUrl(edu: {
	banner_id?: string | null;
	banner_path?: string | null;
}): string | null {
	return getEntityMediaUrl(edu.banner_id, edu.banner_path);
}

/**
 * Get side project image URL
 */
export function getSideProjectImageUrl(project: {
	image_id?: string | null;
	image_path?: string | null;
}): string | null {
	return getEntityMediaUrl(project.image_id, project.image_path);
}

/**
 * Get side project banner URL
 */
export function getSideProjectBannerUrl(project: {
	banner_id?: string | null;
	banner_path?: string | null;
}): string | null {
	return getEntityMediaUrl(project.banner_id, project.banner_path);
}
