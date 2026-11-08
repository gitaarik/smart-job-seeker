/**
 * An upright, scaled-down copy of a library original, for its owner's page.
 *
 * Private, but cacheable for good: an item's original never changes (a new
 * version is a new item), so neither does its preview.
 */

import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAuth, parseIntParam } from '$lib/server/utils/api-helpers';
import { itemPreview, ownedItem } from '$lib/server/media/serve';

export const GET: RequestHandler = async ({ params, url, locals }) => {
	const user = requireAuth(locals);
	const item = await ownedItem(parseIntParam(params.id, 'item'), user.id);
	if (!item) error(404, 'Not found');

	const width = Number(url.searchParams.get('w') ?? 480);
	const bytes = await itemPreview(item, Number.isFinite(width) ? width : 480);
	return new Response(new Uint8Array(bytes), {
		headers: {
			'Content-Type': 'image/webp',
			'X-Content-Type-Options': 'nosniff',
			'Cache-Control': 'private, max-age=31536000, immutable'
		}
	});
};
