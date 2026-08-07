import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { parseIntParam, requireAuth } from '$lib/server/utils/api-helpers';
import { getDeviceById, getPreferredDevice } from '$lib/server/sjs-browser-status';

/**
 * GET /api/tunnel/status/preferred — the device that would be used when scraping.
 *
 *   - Without `apiKeyId`: the user's auto-pick — own connected devices
 *     first, then shared connected devices.
 *   - With `apiKeyId`: that specific device's status, so the search-task
 *     UI can display the device the task is actually configured to use
 *     (`search_tasks.sjsbrowser_api_key`) instead of the auto-pick.
 *
 * Returns `{ device: null }` when nothing matches/is connected.
 */
export const GET: RequestHandler = async ({ locals, url }) => {
	const user = requireAuth(locals);

	const apiKeyIdStr = url.searchParams.get('apiKeyId');
	const device = apiKeyIdStr
		? await getDeviceById(user.id, parseIntParam(apiKeyIdStr, 'apiKey'))
		: await getPreferredDevice(user.id);
	return json({ device });
};
