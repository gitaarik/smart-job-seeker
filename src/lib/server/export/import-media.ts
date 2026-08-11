/**
 * Import media files from export
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import { dbDirect } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { profiles, work_experiences, education, side_projects } from '$lib/server/db/schema';
import type { MediaFile } from './types';

const UPLOADS_DIR = join(process.cwd(), 'uploads');

interface MediaImportResult {
	imported: number;
	failed: number;
	errors: string[];
}

/**
 * Import media files from a ZIP export
 *
 * @param mediaFiles - Map of original path -> file buffer from the ZIP
 * @param mediaManifest - Array of MediaFile from export data
 * @param profileId - The newly created profile ID
 * @param mediaPathMapping - Map from import-data with keys like "profile:123:profile_photo_path"
 */
export async function importMediaFiles(
	mediaFiles: Map<string, Buffer>,
	mediaManifest: MediaFile[],
	profileId: number,
	mediaPathMapping: Map<string, string>
): Promise<MediaImportResult> {
	const result: MediaImportResult = {
		imported: 0,
		failed: 0,
		errors: []
	};

	// Build a reverse mapping: original path -> entity info
	const entityByOriginalPath = new Map<
		string,
		{ entityType: string; entityId: number; field: string }
	>();

	for (const [key, originalPath] of mediaPathMapping) {
		const [entityType, entityIdStr, field] = key.split(':');
		const entityId = parseInt(entityIdStr);
		if (entityType && !isNaN(entityId) && field) {
			entityByOriginalPath.set(originalPath, { entityType, entityId, field });
		}
	}

	// Process each media file in the manifest
	for (const manifest of mediaManifest) {
		try {
			const buffer = mediaFiles.get(manifest.path);
			if (!buffer) {
				result.failed++;
				result.errors.push(`File not found in archive: ${manifest.path}`);
				continue;
			}

			// Determine the target entity (use new IDs from mediaPathMapping)
			const entityInfo = entityByOriginalPath.get(manifest.path);
			if (!entityInfo) {
				result.failed++;
				result.errors.push(`No entity mapping for: ${manifest.path}`);
				continue;
			}

			// Generate new file path with UUID
			const ext = getExtension(manifest.path);
			const subdir = getSubdirForEntityType(entityInfo.entityType);
			const newFilename = `${uuidv4()}${ext}`;
			const newRelativePath = `${subdir}/${newFilename}`;
			const newAbsolutePath = join(UPLOADS_DIR, newRelativePath);

			// Ensure directory exists
			await mkdir(dirname(newAbsolutePath), { recursive: true });

			// Write file
			await writeFile(newAbsolutePath, buffer);

			// Update database with new path
			await updateEntityMediaPath(
				entityInfo.entityType,
				entityInfo.entityId,
				entityInfo.field,
				newRelativePath,
				profileId
			);

			result.imported++;
		} catch (error) {
			result.failed++;
			result.errors.push(
				`Failed to import ${manifest.path}: ${error instanceof Error ? error.message : String(error)}`
			);
		}
	}

	return result;
}

/**
 * Get file extension from path
 */
function getExtension(path: string): string {
	const lastDot = path.lastIndexOf('.');
	if (lastDot === -1) return '';
	return path.substring(lastDot);
}

/**
 * Get upload subdirectory for entity type
 */
function getSubdirForEntityType(entityType: string): string {
	switch (entityType) {
		case 'profile':
			return 'profiles';
		case 'work_experience':
			return 'work-experiences';
		case 'education':
			return 'education';
		case 'side_project':
			return 'side-projects';
		default:
			return 'misc';
	}
}

/**
 * Update entity's media path in database
 */
async function updateEntityMediaPath(
	entityType: string,
	entityId: number,
	field: string,
	newPath: string,
	profileId: number
): Promise<void> {
	switch (entityType) {
		case 'profile':
			if (field === 'profile_photo_path') {
				await dbDirect
					.update(profiles)
					.set({ profile_photo_path: newPath })
					.where(eq(profiles.id, profileId));
			}
			break;

		case 'work_experience':
			if (field === 'logo_path' || field === 'banner_path') {
				await dbDirect
					.update(work_experiences)
					.set({ [field]: newPath })
					.where(eq(work_experiences.id, entityId));
			}
			break;

		case 'education':
			if (field === 'logo_path' || field === 'banner_path') {
				await dbDirect
					.update(education)
					.set({ [field]: newPath })
					.where(eq(education.id, entityId));
			}
			break;

		case 'side_project':
			if (field === 'image_path' || field === 'banner_path') {
				await dbDirect
					.update(side_projects)
					.set({ [field]: newPath })
					.where(eq(side_projects.id, entityId));
			}
			break;
	}
}

/**
 * Delete old media files when overwriting a profile
 */
export async function deleteProfileMediaFiles(profileId: number): Promise<void> {
	const { unlink } = await import('node:fs/promises');

	// Get profile photo
	const profile = await dbDirect.query.profiles.findFirst({
		where: eq(profiles.id, profileId),
		columns: { profile_photo_path: true }
	});

	if (profile?.profile_photo_path) {
		try {
			await unlink(join(UPLOADS_DIR, profile.profile_photo_path));
		} catch {
			// File might not exist
		}
	}

	// Get work experience media
	const workExps = await dbDirect.query.work_experiences.findMany({
		where: eq(work_experiences.profile_id, profileId),
		columns: { logo_path: true, banner_path: true }
	});

	for (const we of workExps) {
		for (const path of [we.logo_path, we.banner_path]) {
			if (!path) continue;
			try {
				await unlink(join(UPLOADS_DIR, path));
			} catch {
				// File might not exist
			}
		}
	}

	// Get education media
	const eduRecords = await dbDirect.query.education.findMany({
		where: eq(education.profile_id, profileId),
		columns: { logo_path: true, banner_path: true }
	});

	for (const edu of eduRecords) {
		for (const path of [edu.logo_path, edu.banner_path]) {
			if (!path) continue;
			try {
				await unlink(join(UPLOADS_DIR, path));
			} catch {
				// File might not exist
			}
		}
	}

	// Get side project media
	const sideProjectRecords = await dbDirect.query.side_projects.findMany({
		where: eq(side_projects.profile_id, profileId),
		columns: { image_path: true, banner_path: true }
	});

	for (const sp of sideProjectRecords) {
		for (const path of [sp.image_path, sp.banner_path]) {
			if (!path) continue;
			try {
				await unlink(join(UPLOADS_DIR, path));
			} catch {
				// File might not exist
			}
		}
	}
}
