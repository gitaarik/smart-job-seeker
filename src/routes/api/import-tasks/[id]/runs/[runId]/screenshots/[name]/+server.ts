import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { dbDirect as db } from '$lib/server/db';
import { and, eq } from 'drizzle-orm';
import { search_task_runs } from '$lib/server/db/schema';
import { parseIntParam, requireAuth } from '$lib/server/utils/api-helpers';
import * as fs from 'node:fs';
import * as path from 'node:path';

const SCREENSHOTS_ROOT = '/data/scraper-screenshots';

/**
 * GET /api/import-tasks/[id]/runs/[runId]/screenshots/[name]
 *
 * Serve a debug screenshot captured during a scrape run. Files only exist
 * when the task had `debug_screenshots` enabled at run time — written by
 * the worker to a shared docker volume, read here by the app container.
 *
 * Ownership: the requesting user must own the task. The filename is
 * locked to `^[A-Za-z0-9._-]+$` to prevent traversal — every legitimate
 * value follows the `<seq>_<action>.png` naming the worker generates.
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	const user = requireAuth(locals);
	const searchTaskId = parseIntParam(params.id, 'job search');
	const runId = parseIntParam(params.runId, 'run');
	const name = params.name ?? '';

	if (!/^[A-Za-z0-9._-]+$/.test(name)) {
		throw error(400, 'Invalid screenshot name');
	}

	const run = await db.query.search_task_runs.findFirst({
		where: and(eq(search_task_runs.id, runId), eq(search_task_runs.search_task_id, searchTaskId)),
		with: { search_task: { with: { profile: true } } }
	});

	if (!run) throw error(404, 'Run not found');
	if (run.search_task.profile.user_id !== user.id) {
		throw error(403, 'Not authorized');
	}

	const filePath = path.join(SCREENSHOTS_ROOT, String(searchTaskId), String(runId), name);

	let stream: fs.ReadStream;
	try {
		await fs.promises.access(filePath, fs.constants.R_OK);
		stream = fs.createReadStream(filePath);
	} catch {
		throw error(404, 'Screenshot not found');
	}

	// ReadableStream from a Node stream — SvelteKit accepts both. Use a
	// simple iterator-based bridge so we don't pull in stream/web.
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
			// Short cache: the file is immutable once written, but the user
			// typically reloads runs and we don't want stale entries on
			// re-running with the same task.
			'Cache-Control': 'private, max-age=300'
		}
	});
};
