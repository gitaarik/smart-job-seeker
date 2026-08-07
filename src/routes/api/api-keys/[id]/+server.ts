import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { parseIntParam, requireAuth } from '$lib/server/utils/api-helpers';
import { activateApiKey, deleteApiKey, renameApiKey, revokeApiKey } from '$lib/server/auth/api-key';

/**
 * PATCH /api/api-keys/[id] — Update an API key (activate or rename).
 */
export const PATCH: RequestHandler = async ({ params, locals, request }) => {
	const user = requireAuth(locals);
	const keyId = parseIntParam(params.id, 'api-key');

	const body = await request.json();

	if (body.action === 'activate') {
		const activated = await activateApiKey(keyId, user.id);
		if (!activated) {
			throw error(404, 'Device key not found or not revoked');
		}
		return json({ success: true });
	}

	if (body.action === 'rename') {
		const name = body.name?.trim();
		if (!name) throw error(400, 'Name is required');
		const renamed = await renameApiKey(keyId, user.id, name);
		if (!renamed) {
			throw error(404, 'Device key not found');
		}
		return json({ success: true });
	}

	throw error(400, 'Invalid action');
};

/**
 * DELETE /api/api-keys/[id]?permanent=true — Revoke or permanently delete an API key.
 */
export const DELETE: RequestHandler = async ({ params, locals, url }) => {
	const user = requireAuth(locals);
	const keyId = parseIntParam(params.id, 'api-key');
	const permanent = url.searchParams.get('permanent') === 'true';

	if (permanent) {
		const deleted = await deleteApiKey(keyId, user.id);
		if (!deleted) {
			throw error(404, 'Device key not found');
		}
		return json({ success: true });
	}

	const revoked = await revokeApiKey(keyId, user.id);
	if (!revoked) {
		throw error(404, 'Device key not found');
	}

	return json({ success: true });
};
