/**
 * URLs for the images on profile rows.
 *
 * A slot points at a media library rendition (`logo_id` and the rest), served
 * at `/assets/<id>`.
 *
 * Entity images were once `files` rows served by id from `/assets/<uuid>`,
 * then bytes under `uploads/` named by a `*_path` column; this is the third
 * home, and the first that keeps the original. Readers fell back to the
 * `*_path` file until `scripts/migrate-media-library.ts` had converted a
 * database, and the columns went in migration 0091.
 */
import { renditionUrl } from '$lib/media-library';

export function getEntityMediaUrl(renditionId: string | null | undefined): string | null {
	return renditionUrl(renditionId);
}

/**
 * Get work experience logo URL
 */
export function getWorkExperienceLogoUrl(workExp: { logo_id?: string | null }): string | null {
	return getEntityMediaUrl(workExp.logo_id);
}

/**
 * Get work experience banner URL
 */
export function getWorkExperienceBannerUrl(workExp: { banner_id?: string | null }): string | null {
	return getEntityMediaUrl(workExp.banner_id);
}

/**
 * Get education logo URL
 */
export function getEducationLogoUrl(edu: { logo_id?: string | null }): string | null {
	return getEntityMediaUrl(edu.logo_id);
}

/**
 * Get education banner URL
 */
export function getEducationBannerUrl(edu: { banner_id?: string | null }): string | null {
	return getEntityMediaUrl(edu.banner_id);
}

/**
 * Get side project logo URL
 */
export function getSideProjectLogoUrl(project: { logo_id?: string | null }): string | null {
	return getEntityMediaUrl(project.logo_id);
}

/**
 * Get side project image URL
 */
export function getSideProjectImageUrl(project: { image_id?: string | null }): string | null {
	return getEntityMediaUrl(project.image_id);
}

/**
 * Get side project banner URL
 */
export function getSideProjectBannerUrl(project: { banner_id?: string | null }): string | null {
	return getEntityMediaUrl(project.banner_id);
}
