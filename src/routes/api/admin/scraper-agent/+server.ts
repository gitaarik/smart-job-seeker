/**
 * Admin Scraper Agent API
 *
 * GET  - List all scraper agent sessions
 * POST - Create a new session
 */

import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { dbDirect as db } from '$lib/server/db';
import { eq, and, inArray, desc } from 'drizzle-orm';
import {
	scraper_agent_sessions,
	scraper_agent_iterations,
	search_tasks,
	search_task_runs
} from '$lib/server/db/schema';
import { requireAuth } from '$lib/server/utils/api-helpers';
import { searchTaskDisplayName } from '$lib/format';

export const GET: RequestHandler = async ({ locals }) => {
	const user = requireAuth(locals);
	if (!(user as { is_admin?: boolean }).is_admin) {
		throw error(403, 'Admin access required');
	}

	const sessions = await db.query.scraper_agent_sessions.findMany({
		orderBy: desc(scraper_agent_sessions.created_at),
		with: {
			search_task: {
				columns: {
					id: true,
					note: true,
					search_url: true,
					platform_id: true,
					browser_provider: true
				},
				with: {
					job_platform: { columns: { name: true } }
				}
			},
			scraper_agent_iterations: {
				orderBy: desc(scraper_agent_iterations.iteration),
				limit: 1,
				columns: {
					iteration: true,
					stage: true,
					success_pct: true,
					run_id: true,
					run_status: true,
					goal_met: true,
					finished_at: true
				}
			}
		}
	});

	// For sessions with blocked runs, fetch the blocked reason
	const blockedRunIds = sessions
		.filter(
			(s) =>
				s.scraper_agent_iterations[0]?.stage === 'blocked' && s.scraper_agent_iterations[0]?.run_id
		)
		.map((s) => s.scraper_agent_iterations[0].run_id!);

	const blockedRuns =
		blockedRunIds.length > 0
			? await db.query.search_task_runs.findMany({
					where: inArray(search_task_runs.id, blockedRunIds),
					columns: { id: true, error_message: true }
				})
			: [];
	const blockedMessageMap = new Map(blockedRuns.map((r) => [r.id, r.error_message]));

	return json({
		sessions: sessions.map((s) => ({
			id: s.id,
			searchTaskId: s.search_task_id,
			searchTaskName: searchTaskDisplayName(s.search_task.job_platform?.name, s.search_task.note),
			status: s.status,
			goal: s.goal,
			maxIterations: s.max_iterations,
			currentIteration: s.current_iteration,
			latestStage: s.scraper_agent_iterations[0]?.stage ?? null,
			latestSuccessPct: s.scraper_agent_iterations[0]?.success_pct ?? null,
			latestRunId: s.scraper_agent_iterations[0]?.run_id ?? null,
			latestRunStatus: s.scraper_agent_iterations[0]?.run_status ?? null,
			latestGoalMet: s.scraper_agent_iterations[0]?.goal_met ?? null,
			blockedMessage: s.scraper_agent_iterations[0]?.run_id
				? (blockedMessageMap.get(s.scraper_agent_iterations[0].run_id) ?? null)
				: null,
			systemPrompt: s.system_prompt,
			runFirst: s.run_first,
			pendingHint: s.pending_hint,
			needsInput: s.needs_input,
			errorMessage: s.error_message,
			createdAt: s.created_at,
			updatedAt: s.updated_at,
			finishedAt: s.finished_at
		}))
	});
};

export const POST: RequestHandler = async ({ request, locals }) => {
	const user = requireAuth(locals);
	if (!(user as { is_admin?: boolean }).is_admin) {
		throw error(403, 'Admin access required');
	}

	const body = await request.json();
	const { searchTaskId, maxIterations = 10, systemPrompt, goal, runFirst = false } = body;

	if (!searchTaskId) {
		throw error(400, 'searchTaskId is required');
	}

	if (!goal?.trim()) {
		throw error(400, 'goal is required');
	}

	// Validate search task exists and is properly configured. A task is
	// runnable if it has a platform AND either its own search_url (legacy) or
	// a search_page_url on the platform (new search-form flow).
	const searchTask = await db.query.search_tasks.findFirst({
		where: eq(search_tasks.id, searchTaskId),
		with: {
			job_platform: { columns: { search_page_url: true } }
		}
	});

	if (!searchTask) {
		throw error(404, 'Search task not found');
	}

	if (!searchTask.platform_id) {
		throw error(400, 'Search task must have a platform configured');
	}

	if (!searchTask.search_url && !searchTask.job_platform?.search_page_url) {
		throw error(400, 'Search task has no search URL and its platform has no search_page_url');
	}

	// Check no other active session for this search task
	const existing = await db.query.scraper_agent_sessions.findFirst({
		where: and(
			eq(scraper_agent_sessions.search_task_id, searchTaskId),
			inArray(scraper_agent_sessions.status, ['active', 'paused'])
		)
	});

	if (existing) {
		throw error(409, `An active session (${existing.id}) already exists for this search task`);
	}

	const [session] = await db
		.insert(scraper_agent_sessions)
		.values({
			search_task_id: searchTaskId,
			max_iterations: Math.min(50, Math.max(1, maxIterations)),
			run_first: !!runFirst,
			goal: goal.trim(),
			system_prompt: systemPrompt || null
		})
		.returning();

	return json({ id: session.id, status: 'active' }, { status: 201 });
};
