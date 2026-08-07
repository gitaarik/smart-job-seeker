/**
 * Debug API — Screenshot file
 *
 * GET /api/debug/run/[id]/screenshots/[name]
 *
 * Serve a debug screenshot referenced by `scraper_logs.screenshot_path` for
 * the given run. Protected by `DEBUG_API_KEY` (Bearer token) — companion to
 * the session-auth endpoint at /api/import-tasks/.../screenshots/[name].
 */

import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { dbDirect as db } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { search_task_runs } from '$lib/server/db/schema';
import * as fs from 'node:fs';
import * as path from 'node:path';

const SCREENSHOTS_ROOT = '/data/scraper-screenshots';

function requireDebugAuth(request: Request): void {
	const key = process.env.DEBUG_API_KEY;
	if (!key) throw error(503, 'Debug API not configured');

	const auth = request.headers.get('authorization');
	if (!auth || auth !== `Bearer ${key}`) {
		throw error(401, 'Invalid or missing debug API key');
	}
}

export const GET: RequestHandler = async ({ params, request }) => {
	requireDebugAuth(request);

	const runId = parseInt(params.id, 10);
	if (isNaN(runId)) throw error(400, 'Invalid run ID');

	const name = params.name ?? '';
	if (!/^[A-Za-z0-9._-]+$/.test(name)) {
		throw error(400, 'Invalid screenshot name');
	}

	const run = await db.query.search_task_runs.findFirst({
		where: eq(search_task_runs.id, runId),
		columns: { id: true, search_task_id: true }
	});

	if (!run) throw error(404, 'Run not found');

	const filePath = path.join(SCREENSHOTS_ROOT, String(run.search_task_id), String(runId), name);

	let stream: fs.ReadStream;
	try {
		await fs.promises.access(filePath, fs.constants.R_OK);
		stream = fs.createReadStream(filePath);
	} catch {
		throw error(404, 'Screenshot not found');
	}

	const body = new ReadableStream<Uint8Array>({
		start(controller) {
			stream.on('data', (chunk: string | Buffer) => {
				const buf = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
				controller.enqueue(new Uint8Array(buf));
			});
			stream.on('end', () => controller.close());
			stream.on('error', (err) => controller.error(err));
		},
		cancel() {
			stream.destroy();
		}
	});

	return new Response(body, {
		headers: {
			'Content-Type': 'image/png',
			'Cache-Control': 'private, max-age=300'
		}
	});
};
