import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAuth, parseIntParam } from '$lib/server/utils/api-helpers';
import {
	shareDevice,
	unshareDevice,
	listDeviceShares,
	listSharedWithMe
} from '$lib/server/device-shares';

/**
 * GET /api/device-shares?apiKeyId=123 — List shares for a device
 * GET /api/device-shares?sharedWithMe=true — List devices shared with current user
 */
export const GET: RequestHandler = async ({ locals, url }) => {
	const user = requireAuth(locals);

	if (url.searchParams.get('sharedWithMe') === 'true') {
		const shared = await listSharedWithMe(user.id);
		return json({ shares: shared });
	}

	const apiKeyId = parseIntParam(url.searchParams.get('apiKeyId') ?? '', 'apiKeyId');
	const shares = await listDeviceShares(apiKeyId);
	return json({ shares });
};

/**
 * POST /api/device-shares — Share a device with a contact
 * Body: { apiKeyId: number, userId: string }
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	const user = requireAuth(locals);
	const body = await request.json();

	const apiKeyId = body.apiKeyId;
	const sharedWithUserId = body.userId;

	if (!apiKeyId || typeof apiKeyId !== 'number') {
		throw error(400, 'apiKeyId is required');
	}
	if (!sharedWithUserId || typeof sharedWithUserId !== 'string') {
		throw error(400, 'userId is required');
	}

	const result = await shareDevice(apiKeyId, user.id, sharedWithUserId);

	if (!result.success) {
		return json({ error: result.error }, { status: 400 });
	}

	return json({ success: true });
};

/**
 * DELETE /api/device-shares — Unshare a device
 * Body: { apiKeyId: number, userId: string }
 */
export const DELETE: RequestHandler = async ({ request, locals }) => {
	const user = requireAuth(locals);
	const body = await request.json();

	const apiKeyId = body.apiKeyId;
	const sharedWithUserId = body.userId;

	if (!apiKeyId || typeof apiKeyId !== 'number') {
		throw error(400, 'apiKeyId is required');
	}
	if (!sharedWithUserId || typeof sharedWithUserId !== 'string') {
		throw error(400, 'userId is required');
	}

	const removed = await unshareDevice(apiKeyId, user.id, sharedWithUserId);
	if (!removed) {
		throw error(404, 'Share not found');
	}

	return json({ success: true });
};
