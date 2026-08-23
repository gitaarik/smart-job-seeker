import { error } from '@sveltejs/kit';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { dbDirect as db } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { files } from '$lib/server/db/schema';
import type { RequestHandler } from './$types';

const UPLOADS_DIR = join(process.cwd(), 'uploads', 'files');

/**
 * `files.id` is a `uuid` column, so a path segment that isn't one reaches
 * Postgres as an invalid cast and comes back as a 500, not the 404 the route
 * means. Scanners probe this prefix constantly — `/assets/.env`,
 * `/assets/mail.json`, `/assets/manifest.json` — and every probe was landing in
 * GlitchTip as an application error with the failing query and its parameters
 * in the title (9 issues, 84 events). `isFrameworkClientError` never saw them:
 * it matches SvelteKit's own `Not found:` message, and this failed a step
 * earlier than that.
 *
 * Checking the shape first turns those back into the 404 they always were.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const GET: RequestHandler = async ({ params }) => {
	if (!UUID_RE.test(params.id)) throw error(404);

	const file = await db.query.files.findFirst({
		where: eq(files.id, params.id),
		columns: { filename_disk: true, type: true, filename_download: true }
	});

	if (!file?.filename_disk) throw error(404);

	let buffer: Buffer;
	try {
		buffer = await readFile(join(UPLOADS_DIR, file.filename_disk));
	} catch {
		throw error(404);
	}

	return new Response(new Uint8Array(buffer), {
		headers: {
			'Content-Type': file.type || 'application/octet-stream',
			'Cache-Control': 'public, max-age=31536000, immutable'
		}
	});
};
