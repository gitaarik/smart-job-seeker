import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAuth } from '$lib/server/utils/api-helpers';
import { createApiKey, listApiKeys } from '$lib/server/auth/api-key';

/**
 * GET /api/api-keys — List API keys for the logged-in user.
 *
 * Devices belong to the user (not a profile), so any of the user's
 * profiles surfaces the same list.
 */
export const GET: RequestHandler = async ({ locals }) => {
	const user = requireAuth(locals);
	const keys = await listApiKeys(user.id);
	return json({ keys });
};

/**
 * POST /api/api-keys — Create a new API key for the logged-in user.
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	const user = requireAuth(locals);

	const body = await request.json();
	const name = typeof body.name === 'string' ? body.name.trim() : '';
	if (!name) {
		return json({ error: 'Name is required' }, { status: 400 });
	}

	const result = await createApiKey(user.id, name);

	return json({
		id: result.id,
		key: result.key
	});
};
