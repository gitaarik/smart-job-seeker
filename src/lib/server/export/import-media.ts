/**
 * Import the media of an archive written before the media library.
 *
 * Those archives carry each slot's picture as a file at `media/<path>`, named
 * by the slot's old `*_path` column. Each one now becomes a library item shown
 * in its slot at full frame, the same as an upload through the slot, so an
 * import never writes an old path column again. An archive written since
 * carries the library itself (import-media-library.ts) and has no such files
 * for a slot the library fills.
 */

import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { dbDirect } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { profiles, work_experiences, education, side_projects } from '$lib/server/db/schema';
import { createMediaItem } from '$lib/server/media/items';
import { assignEntitySlot, resolveEntitySlot } from '$lib/server/media/slots';
import { slotKey } from './import-media-library';
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
 * @param librarySlots - Slots the same import already filled from the archive's
 *   media library: those keep the library's copy. Any other slot, the profile
 *   photo an overwrite import keeps included, takes the archive's file.
 */
export async function importMediaFiles(
	mediaFiles: Map<string, Buffer>,
	mediaManifest: MediaFile[],
	profileId: number,
	mediaPathMapping: Map<string, string>,
	librarySlots: Set<string> = new Set()
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

			const slot = resolveEntitySlot(entityInfo.entityType, entityInfo.field);
			if (!slot) {
				result.failed++;
				result.errors.push(`No slot for: ${entityInfo.entityType}.${entityInfo.field}`);
				continue;
			}
			// Already filled from the archive's library: that copy is the newer one.
			if (librarySlots.has(slotKey(slot.table, entityInfo.entityId, slot.column))) continue;

			const item = await createMediaItem({
				profileId,
				kind: slot.spec.kind,
				label: null,
				filename: manifest.path.split('/').pop() ?? 'image',
				bytes: buffer
			});
			await assignEntitySlot(slot, entityInfo.entityId, item.id);

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
 * Delete old media files when overwriting a profile
 */
export async function deleteProfileMediaFiles(profileId: number): Promise<void> {
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
