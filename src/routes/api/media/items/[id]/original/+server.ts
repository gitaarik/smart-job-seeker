/**
 * A library original, as stored, for its owner to download.
 *
 * Always an attachment, never shown inline: an SVG original is XML that can
 * carry script, and this is the app's own origin.
 */

import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAuth, parseIntParam } from '$lib/server/utils/api-helpers';
import { itemOriginal, ownedItem } from '$lib/server/media/serve';
import { contentDisposition } from '$lib/server/files';
import {
	FORMAT_EXTENSIONS,
	FORMAT_MIME_TYPES,
	type StoredFormat
} from '$lib/server/media/originals';

export const GET: RequestHandler = async ({ params, locals }) => {
	const user = requireAuth(locals);
	const item = await ownedItem(parseIntParam(params.id, 'item'), user.id);
	if (!item) error(404, 'Not found');

	const format = item.format as StoredFormat;
	const bytes = await itemOriginal(item);
	const name = `${item.label || 'image'}${FORMAT_EXTENSIONS[format] ?? ''}`;
	return new Response(new Uint8Array(bytes), {
		headers: {
			'Content-Type': FORMAT_MIME_TYPES[format] ?? 'application/octet-stream',
			'Content-Disposition': contentDisposition(name),
			'X-Content-Type-Options': 'nosniff',
			'Cache-Control': 'private, no-store'
		}
	});
};
