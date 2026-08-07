import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { dbDirect as db } from '$lib/server/db';
import { and, eq } from 'drizzle-orm';
import { search_task_runs, search_tasks } from '$lib/server/db/schema';
import { parseIntParam, requireAuth } from '$lib/server/utils/api-helpers';
import { submitPendingAction } from '$lib/server/scraper/pending-action';

/**
 * POST /api/import-tasks/[id]/runs/[runId]/navigate-url
 *
 * Navigate the live browser to a URL. Used for magic-link login: the user
 * receives a login link via email and pastes it here. Works for both hosted
 * (GoLogin) and tunnel (local Chrome) modes by routing through the scraper
 * itself.
 *
 * Body: { url: string }
 */
export const POST: RequestHandler = async ({ params, locals, request }) => {
	const user = requireAuth(locals);
	const searchTaskId = parseIntParam(params.id, 'job search');
	const runId = parseIntParam(params.runId, 'run');

	let body: { url?: string };
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON body');
	}

	const { url } = body;
	if (!url || typeof url !== 'string') {
		throw error(400, "Missing or invalid 'url' field");
	}

	try {
		new URL(url);
	} catch {
		throw error(400, 'Invalid URL format');
	}

	const searchTask = await db.query.search_tasks.findFirst({
		where: eq(search_tasks.id, searchTaskId),
		columns: { profile_id: true },
		with: { profile: { columns: { user_id: true } } }
	});

	if (!searchTask) throw error(404, 'Job search not found');
	if (searchTask.profile.user_id !== user.id) {
		throw error(403, 'Not authorized');
	}

	const run = await db.query.search_task_runs.findFirst({
		where: and(eq(search_task_runs.id, runId), eq(search_task_runs.search_task_id, searchTaskId)),
		columns: { status: true }
	});

	if (!run) throw error(404, 'Run not found');
	if (!['running', 'blocked'].includes(run.status)) {
		throw error(400, `Run is not active (status: ${run.status})`);
	}

	// Navigation can take longer than a typical type-text — give it more headroom
	const result = await submitPendingAction(
		runId,
		{
			type: 'navigate_url',
			url
		},
		{ timeoutMs: 45_000 }
	);

	return json(result);
};
