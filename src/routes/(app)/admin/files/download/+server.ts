/**
 * Downloading any stored file, as an admin.
 *
 * The file browser needs to look at *anything* in `files` — that is the point
 * of it, and orphans especially, since deciding whether a row is litter often
 * means opening it. `/assets/[id]` used to serve that, and serving it was the
 * same thing as serving it to everybody: that route is public and asks nothing
 * about the caller. It now answers only for the four shapes that belong on a
 * public page, which leaves the admin case needing a door of its own. This is
 * it, and it checks.
 *
 * A route rather than an action on the page: where a page and an endpoint share
 * a path, SvelteKit prefers the page for anything accepting text/html, so a
 * download link rendered the page instead of the file.
 *
 * `hooks.server.ts` already refuses every `/admin/*` path to a non-admin, so in
 * practice nothing below ever sees one. The check stays anyway: it is what
 * makes this handler correct on its own terms, and a route that hands over
 * another user's private file should not be relying on a guard three files
 * away to be the only thing between it and the internet. It mirrors
 * `requireAdmin`'s condition — including `adminUser`, so an impersonating admin
 * keeps the tool — but errors rather than redirects, because a 302 to /home
 * arrives at an `<a download>` as a saved HTML page.
 */

import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { dbDirect as db } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { files } from '$lib/server/db/schema';
import { contentDisposition, getFile } from '$lib/server/files';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const GET: RequestHandler = async ({ url, locals }) => {
	const isAdmin =
		(locals.user as { is_admin?: boolean } | null)?.is_admin ||
		(locals.adminUser as { is_admin?: boolean } | null)?.is_admin;
	if (!isAdmin) error(403, 'Forbidden');

	// `files.id` is a uuid column; a path that isn't one reaches Postgres as an
	// invalid cast and comes back a 500. Same shape check as `/assets/[id]`.
	const fileId = url.searchParams.get('fileId') ?? '';
	if (!UUID_RE.test(fileId)) error(404, 'Not found');

	const file = await db.query.files.findFirst({
		where: eq(files.id, fileId),
		columns: { filename_disk: true, filename_download: true, type: true }
	});
	if (!file?.filename_disk) error(404, 'Not found');

	let buffer: Buffer;
	try {
		buffer = await getFile(fileId);
	} catch {
		// A row whose bytes are gone — which on this page is a finding, not a
		// fault, so it says so rather than 500ing.
		error(404, 'The stored file is missing');
	}

	return new Response(new Uint8Array(buffer), {
		headers: {
			'Content-Type': file.type || 'application/octet-stream',
			'Content-Disposition': contentDisposition(file.filename_download),
			// Belt to the attachment disposition's braces: this route hands over
			// arbitrary stored bytes, including whatever a user uploaded.
			'X-Content-Type-Options': 'nosniff',
			// Never cached anywhere but here: this is the one route that will hand
			// over another user's private file, and only to an admin.
			'Cache-Control': 'private, no-store'
		}
	});
};
