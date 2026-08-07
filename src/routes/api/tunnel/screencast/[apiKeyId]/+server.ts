import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { parseIntParam, requireAuth } from '$lib/server/utils/api-helpers';
import { hasDeviceAccess } from '$lib/server/device-shares';

const sjsBrowserHost = process.env.SJS_TUNNEL_HOST || '127.0.0.1';
const sjsBrowserPort = process.env.SJS_TUNNEL_PORT || '9333';

/**
 * GET /api/tunnel/screencast/:apiKeyId — on-demand screenshot from device.
 *
 * Takes a CDP screenshot of the current browser page via the tunnel.
 * The frontend polls this endpoint to update the browser view.
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	const user = requireAuth(locals);
	const apiKeyId = parseIntParam(params.apiKeyId, 'apiKeyId');

	if (!(await hasDeviceAccess(apiKeyId, user.id))) {
		throw error(403, 'Not authorized for this device');
	}

	try {
		const upstream = await fetch(
			`http://${sjsBrowserHost}:${sjsBrowserPort}/screencast/${apiKeyId}/frame`,
			{ signal: AbortSignal.timeout(10000) }
		);

		if (upstream.status === 204 || !upstream.ok) {
			return new Response(null, { status: 204 });
		}

		const buf = await upstream.arrayBuffer();
		return new Response(buf, {
			headers: {
				'Content-Type': 'image/jpeg',
				'Cache-Control': 'no-cache, no-store'
			}
		});
	} catch {
		return new Response(null, { status: 502 });
	}
};
