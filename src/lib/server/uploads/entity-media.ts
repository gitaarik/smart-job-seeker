/**
 * The image slots on profile rows: a profile's photo, the logos and banners of
 * roles and education, a side project's logo, image and banner.
 *
 * Since 2026-11 a slot points at a media library rendition rather than holding
 * its own shrunk copy (see planning/MEDIA-LIBRARY.md and server/media/). An
 * upload through a slot is an upload to the library, shown in that slot at
 * full frame; the original is kept, so the slot can be cropped or redrawn
 * later without asking for the file again.
 */

import { dbDirect } from '$lib/server/db';
import { eq, and } from 'drizzle-orm';
import { profiles, work_experiences, education, side_projects } from '$lib/server/db/schema';
import { getErrorMessage } from '$lib/server/utils/errors';
import type { Crop } from '$lib/media-library';
import { createMediaItem } from '$lib/server/media/items';
import { MediaUploadError } from '$lib/server/media/originals';
import {
	assignEntitySlot,
	clearEntitySlot,
	entityProfileId,
	resolveEntitySlot,
	SlotError,
	type EntitySlot
} from '$lib/server/media/slots';

interface UploadResult {
	success: boolean;
	renditionId?: string;
	url?: string;
	error?: string;
	status?: number;
}

const ENTITY_TYPES = ['profile', 'work_experience', 'education', 'side_project'];

/**
 * Validate that user owns the entity via profile
 */
export async function validateEntityOwnership(
	entityType: string,
	entityId: number,
	userId: string
): Promise<boolean> {
	if (!ENTITY_TYPES.includes(entityType)) return false;

	let profileId: number | null = null;

	switch (entityType) {
		case 'profile': {
			// For profiles, entityId is the profile id directly
			profileId = entityId;
			break;
		}
		case 'work_experience': {
			const entity = await dbDirect.query.work_experiences.findFirst({
				where: eq(work_experiences.id, entityId),
				columns: { profile_id: true }
			});
			profileId = entity?.profile_id ?? null;
			break;
		}
		case 'education': {
			const entity = await dbDirect.query.education.findFirst({
				where: eq(education.id, entityId),
				columns: { profile_id: true }
			});
			profileId = entity?.profile_id ?? null;
			break;
		}
		case 'side_project': {
			const entity = await dbDirect.query.side_projects.findFirst({
				where: eq(side_projects.id, entityId),
				columns: { profile_id: true }
			});
			profileId = entity?.profile_id ?? null;
			break;
		}
	}

	if (!profileId) return false;

	// Check profile ownership
	const profile = await dbDirect.query.profiles.findFirst({
		where: and(eq(profiles.id, profileId), eq(profiles.user_id, userId)),
		columns: { id: true }
	});

	return !!profile;
}

/** The slot a route's entity type and field name refer to, or null. */
export function entitySlot(entityType: string, field: string): EntitySlot | null {
	return resolveEntitySlot(entityType, field);
}

/**
 * Put an uploaded file in a slot: it becomes a library item, and the slot
 * shows all of it.
 */
export async function saveEntityMedia(
	slot: EntitySlot,
	entityId: number,
	file: File
): Promise<UploadResult> {
	try {
		const profileId = await entityProfileId(slot, entityId);
		if (!profileId) return { success: false, error: 'Not found', status: 404 };
		const item = await createMediaItem({
			profileId,
			kind: slot.spec.kind,
			label: null,
			filename: file.name,
			bytes: Buffer.from(await file.arrayBuffer())
		});
		const shown = await assignEntitySlot(slot, entityId, item.id);
		return { success: true, ...shown };
	} catch (error) {
		if (error instanceof MediaUploadError)
			return { success: false, error: error.message, status: 400 };
		if (error instanceof SlotError)
			return { success: false, error: error.message, status: error.status };
		// The media budget refuses with SvelteKit's error(), which the route rethrows.
		if (error && typeof error === 'object' && 'status' in error && 'body' in error) throw error;
		console.error('Failed to save entity media:', error);
		return { success: false, error: getErrorMessage(error, 'Upload failed'), status: 500 };
	}
}

/** Show an item already in the library in a slot, cropped as given. */
export async function pickEntityMedia(
	slot: EntitySlot,
	entityId: number,
	itemId: number,
	crop: Crop | null
): Promise<UploadResult> {
	try {
		const shown = await assignEntitySlot(slot, entityId, itemId, crop);
		return { success: true, ...shown };
	} catch (error) {
		if (error instanceof SlotError)
			return { success: false, error: error.message, status: error.status };
		console.error('Failed to set entity media:', error);
		return {
			success: false,
			error: getErrorMessage(error, 'Could not use that image'),
			status: 500
		};
	}
}

/** Empty a slot. The image stays in the library. */
export async function deleteEntityMedia(
	slot: EntitySlot,
	entityId: number
): Promise<{ success: boolean; error?: string }> {
	try {
		await clearEntitySlot(slot, entityId);
		return { success: true };
	} catch (error) {
		console.error('Failed to delete entity media:', error);
		return { success: false, error: getErrorMessage(error, 'Delete failed') };
	}
}
