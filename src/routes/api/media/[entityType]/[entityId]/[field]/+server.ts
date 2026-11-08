/**
 * One image slot on a profile row: the profile photo, a role's or a school's
 * logo and banner, a side project's image and banner.
 *
 * - POST a file: it goes into the profile's media library, and the slot shows
 *   all of it.
 * - PUT `{ itemId, crop? }`: show an image already in the library, cropped.
 * - DELETE: empty the slot. The image stays in the library.
 *
 * `field` is the slot's name (`photo`, `logo`, `banner`, `image`); the old
 * column names (`logo_path` and the rest) are still understood.
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAuth, parseIntParam } from '$lib/server/utils/api-helpers';
import {
	validateEntityOwnership,
	entitySlot,
	saveEntityMedia,
	pickEntityMedia,
	deleteEntityMedia
} from '$lib/server/uploads/entity-media';
import type { Crop } from '$lib/media-library';

async function guard(params: Record<string, string>, userId: string) {
	const { entityType, entityId, field } = params;
	const entityIdNum = parseIntParam(entityId, 'entity');
	const slot = entitySlot(entityType, field);
	if (!slot) error(400, 'Invalid entity type or field');
	if (!(await validateEntityOwnership(entityType, entityIdNum, userId))) {
		error(403, 'Access denied');
	}
	return { slot, entityId: entityIdNum };
}

function parseCrop(value: unknown): Crop | null {
	if (!value || typeof value !== 'object') return null;
	const { x, y, w, h } = value as Record<string, unknown>;
	if ([x, y, w, h].every((n) => typeof n === 'number' && Number.isFinite(n))) {
		return { x: x as number, y: y as number, w: w as number, h: h as number };
	}
	return null;
}

export const POST: RequestHandler = async ({ params, request, locals }) => {
	const user = requireAuth(locals);
	const { slot, entityId } = await guard(params, user.id);

	const formData = await request.formData();
	const file = formData.get('file');
	if (!(file instanceof File) || file.size === 0) {
		error(400, 'No file provided');
	}

	const result = await saveEntityMedia(slot, entityId, file);
	if (!result.success) {
		error(result.status ?? 400, result.error || 'Upload failed');
	}
	return json({ success: true, renditionId: result.renditionId, url: result.url });
};

export const PUT: RequestHandler = async ({ params, request, locals }) => {
	const user = requireAuth(locals);
	const { slot, entityId } = await guard(params, user.id);

	const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
	const itemId = Number(body?.itemId);
	if (!Number.isInteger(itemId) || itemId <= 0) error(400, 'Choose an image');

	const result = await pickEntityMedia(slot, entityId, itemId, parseCrop(body?.crop));
	if (!result.success) {
		error(result.status ?? 400, result.error || 'Could not use that image');
	}
	return json({ success: true, renditionId: result.renditionId, url: result.url });
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	const user = requireAuth(locals);
	const { slot, entityId } = await guard(params, user.id);

	const result = await deleteEntityMedia(slot, entityId);
	if (!result.success) {
		error(500, result.error || 'Delete failed');
	}
	return json({ success: true });
};
