/**
 * A rendition, shown to its owner: the crop previews on the media page.
 *
 * This is the door for a picture that was only ever cut for a platform and
 * so is not public at `/assets/<id>`. `./download` hands the same bytes over
 * as a file named for the platform and size.
 */

import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAuth } from '$lib/server/utils/api-helpers';
import { ownedRendition, renditionBytes } from '$lib/server/media/serve';

export const GET: RequestHandler = async ({ params, locals }) => {
	const user = requireAuth(locals);
	const owned = await ownedRendition(params.id, user.id);
	if (!owned) error(404, 'Not found');

	const served = await renditionBytes(owned.rendition.id);
	if (!served) error(404, 'Not found');

	return new Response(new Uint8Array(served.bytes), {
		headers: {
			'Content-Type': served.type,
			'X-Content-Type-Options': 'nosniff',
			// A rendition never changes, so its owner's browser may keep it.
			'Cache-Control': 'private, max-age=31536000, immutable'
		}
	});
};
