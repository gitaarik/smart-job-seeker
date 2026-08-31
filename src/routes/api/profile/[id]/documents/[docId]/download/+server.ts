/**
 * The stored file behind one document row.
 *
 *   GET /api/profile/[id]/documents/[docId]/download        — save it
 *   GET /api/profile/[id]/documents/[docId]/download?inline=1 — show it in place
 *
 * A route of its own rather than a query on the parent endpoint, because a
 * download is a browser navigation and the parent answers JSON.
 *
 * **This is the only door to these bytes.** They live under `uploads/files/`,
 * which the public `/uploads/[...path]` route deliberately refuses to serve —
 * so every read of a private attachment passes the profile check below. The
 * `files` table has no owner column; reachability is the only ownership signal
 * it has, which is why the row is looked up by document id *scoped to the
 * profile* rather than by the file id the caller hands us.
 *
 * `inline` is offered only for a closed set of raster types. The reasoning that
 * would justify a looser test — everything the media path stores came back out
 * of sharp as WebP, and `uploadFile` cannot even name an SVG, since its
 * extension table has no `.svg` — is true today and is the wrong thing to rely
 * on: it is an invariant held in two other modules, and `image/svg+xml` served
 * inline from this origin is script running as the user. A prefix test would
 * start allowing it the day someone adds one line to `EXT_TO_MIME`. So the list
 * is written out here, where the decision is, and `nosniff` stops the browser
 * reinterpreting what the list let through.
 */

import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { dbDirect as db } from '$lib/server/db';
import { and, eq } from 'drizzle-orm';
import { profile_document_projects } from '$lib/server/db/schema';
import { contentDisposition, getFile } from '$lib/server/files';
import { parseIntParam, requireAuth, requireProfileAccess } from '$lib/server/utils/api-helpers';

/**
 * Types that may render in place. Raster only: each is decoded by an image
 * decoder and cannot become a document, which is exactly what SVG can.
 */
const INLINE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif']);

export const GET: RequestHandler = async ({ params, url, locals }) => {
	const user = requireAuth(locals);
	const profileId = parseIntParam(params.id, 'profile');
	const docId = parseIntParam(params.docId, 'document');
	await requireProfileAccess(profileId, user.id);

	const doc = await db.query.profile_document_projects.findFirst({
		where: and(
			eq(profile_document_projects.id, docId),
			eq(profile_document_projects.profile_id, profileId)
		),
		columns: { id: true, file_id: true },
		with: { file: { columns: { filename_download: true, type: true } } }
	});
	if (!doc) error(404, 'Document not found');
	if (!doc.file_id || !doc.file) error(404, 'This document has no stored file');

	const contentType = doc.file.type || 'application/octet-stream';
	const inline = url.searchParams.get('inline') === '1' && INLINE_TYPES.has(contentType);

	let buffer: Buffer;
	try {
		buffer = await getFile(doc.file_id);
	} catch {
		// The row outlived its bytes. Worth saying plainly rather than a 500:
		// nothing the caller does will fix it, and a 404 is what it means.
		error(404, 'The stored file is missing');
	}

	return new Response(new Uint8Array(buffer), {
		headers: {
			'Content-Type': contentType,
			'Content-Disposition': contentDisposition(doc.file.filename_download, inline),
			// Take the declared type literally. Without this a browser is free to
			// sniff the bytes and decide they are something else, which puts the
			// list above back at the mercy of whatever it just decided.
			'X-Content-Type-Options': 'nosniff',
			// Immutable content at a stable URL, but private to this profile: a
			// shared cache holding it would hand it to the next caller.
			'Cache-Control': 'private, max-age=3600'
		}
	});
};
