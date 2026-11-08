/**
 * A rendition as a file to upload somewhere, named for the platform and size
 * it was cut for (`linkedin-background-1584x396.jpg`).
 */

import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { requireAuth } from '$lib/server/utils/api-helpers';
import { ownedRendition, renditionBytes } from '$lib/server/media/serve';
import { renditionFilename } from '$lib/server/media/renditions';
import { contentDisposition } from '$lib/server/files';
import { dbDirect as db } from '$lib/server/db';
import { media_presets } from '$lib/server/db/schema';

export const GET: RequestHandler = async ({ params, locals }) => {
	const user = requireAuth(locals);
	const owned = await ownedRendition(params.id, user.id);
	if (!owned) error(404, 'Not found');

	const served = await renditionBytes(owned.rendition.id);
	if (!served) error(404, 'Not found');

	const preset = owned.rendition.preset_id
		? await db.query.media_presets.findFirst({
				where: eq(media_presets.id, owned.rendition.preset_id),
				columns: { platform: true, slot: true }
			})
		: null;
	const name = renditionFilename(
		owned.item.label,
		preset ?? null,
		served.rendition.width,
		served.rendition.height,
		served.rendition.format
	);
	return new Response(new Uint8Array(served.bytes), {
		headers: {
			'Content-Type': served.type,
			'Content-Disposition': contentDisposition(name),
			'X-Content-Type-Options': 'nosniff',
			'Cache-Control': 'private, no-store'
		}
	});
};
