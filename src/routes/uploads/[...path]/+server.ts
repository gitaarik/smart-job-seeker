/**
 * Public media: profile photos, logos and banners.
 *
 * Unauthenticated by design — these are rendered on public profile pages, and
 * an unguessable path is the whole of the protection they need.
 *
 * `uploads/files/` is NOT that. It is the blob store behind the `files` table:
 * CVs, profile exports, application attachments, project images. Those are
 * private to one profile, and this route sits over the same directory tree, so
 * without the refusal below every one of them would be readable by anyone
 * holding the URL. They have their own routes, which check who is asking.
 */

import { error } from '@sveltejs/kit';
import { readFile } from 'fs/promises';
import { join, resolve, extname, relative, sep } from 'path';
import type { RequestHandler } from './$types';

const UPLOADS_DIR = resolve('uploads');

/** The private blob store, served only through routes that check ownership. */
const PRIVATE_SUBDIR = 'files';

const MIME_TYPES: Record<string, string> = {
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.png': 'image/png',
	'.webp': 'image/webp',
	'.gif': 'image/gif'
};

export const GET: RequestHandler = async ({ params }) => {
	const filePath = params.path;
	if (!filePath) throw error(404);

	const fullPath = resolve(join(UPLOADS_DIR, filePath));

	// Prevent path traversal
	if (!fullPath.startsWith(UPLOADS_DIR)) {
		throw error(403);
	}

	// Checked on the resolved path, not on `params.path`, so that `a/../files/x`
	// and any other spelling of the same destination are refused too.
	const rel = relative(UPLOADS_DIR, fullPath);
	if (rel === PRIVATE_SUBDIR || rel.startsWith(PRIVATE_SUBDIR + sep)) {
		throw error(403);
	}

	try {
		const buffer = await readFile(fullPath);
		const ext = extname(fullPath).toLowerCase();
		const contentType = MIME_TYPES[ext] || 'application/octet-stream';

		return new Response(new Uint8Array(buffer), {
			headers: {
				'Content-Type': contentType,
				'Cache-Control': 'public, max-age=31536000, immutable'
			}
		});
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
			throw error(404);
		}
		throw error(500);
	}
};
