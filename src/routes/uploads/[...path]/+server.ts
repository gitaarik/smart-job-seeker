import { error } from '@sveltejs/kit';
import { readFile } from 'fs/promises';
import { join, resolve, extname } from 'path';
import type { RequestHandler } from './$types';

const UPLOADS_DIR = resolve('uploads');

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
