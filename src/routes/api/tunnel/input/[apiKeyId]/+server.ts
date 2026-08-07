import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { parseIntParam, requireAuth } from '$lib/server/utils/api-helpers';
import { hasDeviceAccess } from '$lib/server/device-shares';

/**
 * POST /api/tunnel/input/:apiKeyId — Forward raw input events to the device.
 *
 * Accepts rawMouseEvent, rawScrollEvent, and rawKeyEvent payloads
 * and forwards them to the desktop app via the tunnel server. Keyed
 * directly on the api_key id (globally unique per device).
 */
export const POST: RequestHandler = async ({ locals, params, request }) => {
	const user = requireAuth(locals);
	const apiKeyId = parseIntParam(params.apiKeyId, 'apiKeyId');

	if (!(await hasDeviceAccess(apiKeyId, user.id))) {
		throw error(403, 'Not authorized for this device');
	}

	const sjsBrowserHost = process.env.SJS_TUNNEL_HOST || '127.0.0.1';
	const sjsBrowserPort = process.env.SJS_TUNNEL_PORT || '9333';

	try {
		const body = await request.json();

		const res = await fetch(`http://${sjsBrowserHost}:${sjsBrowserPort}/input/${apiKeyId}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
			signal: AbortSignal.timeout(5000)
		});

		if (!res.ok) {
			const data = await res.json().catch(() => ({ error: 'Unknown error' }));
			throw error(
				res.status === 404 ? 404 : res.status === 400 ? 400 : 500,
				data.error || 'Failed to forward input event'
			);
		}

		return json(await res.json());
	} catch (err) {
		if (err && typeof err === 'object' && 'status' in err) throw err;
		throw error(502, 'Tunnel server unavailable');
	}
};
