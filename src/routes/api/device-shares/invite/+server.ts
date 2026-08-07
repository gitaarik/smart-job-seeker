import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAuth } from '$lib/server/utils/api-helpers';
import { createDeviceInvite } from '$lib/server/device-shares';

/**
 * POST /api/device-shares/invite — Mint a single-use device-invite link.
 * Body: { apiKeyId: number }
 *
 * The recipient accepts at the returned URL, which makes them an accepted
 * contact and shares the device in one step — no prior contact request needed.
 */
export const POST: RequestHandler = async ({ request, locals, url }) => {
	const user = requireAuth(locals);
	const body = await request.json();

	const apiKeyId = body.apiKeyId;
	if (!apiKeyId || typeof apiKeyId !== 'number') {
		return json({ error: 'apiKeyId is required' }, { status: 400 });
	}

	const result = await createDeviceInvite(apiKeyId, user.id);
	if (!result.success) {
		return json({ error: result.error }, { status: 400 });
	}

	return json({
		token: result.token,
		url: `${url.origin}/invite/${result.token}`
	});
};
