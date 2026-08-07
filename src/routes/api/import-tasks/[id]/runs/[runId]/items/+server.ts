/**
 * Run Items API
 *
 * GET /api/import-tasks/[id]/runs/[runId]/items
 * Returns the list of jobs discovered during a scraper run with their processing status.
 */

import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { dbDirect as db } from '$lib/server/db';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { job_matches, search_task_run_items, search_task_runs } from '$lib/server/db/schema';
import { parseIntParam, requireAuth } from '$lib/server/utils/api-helpers';

export const GET: RequestHandler = async ({ params, locals }) => {
	const user = requireAuth(locals);
	const searchTaskId = parseIntParam(params.id, 'job search');
	const runId = parseIntParam(params.runId, 'run');

	// Verify the run belongs to this job search and the user owns it.
	// We also need the search task's profile_id to scope match lookups below.
	const run = await db.query.search_task_runs.findFirst({
		where: and(eq(search_task_runs.id, runId), eq(search_task_runs.search_task_id, searchTaskId)),
		columns: { id: true },
		with: {
			search_task: {
				columns: { profile_id: true },
				with: {
					profile: { columns: { user_id: true } }
				}
			}
		}
	});

	if (!run || run.search_task.profile.user_id !== user.id) {
		throw error(404, 'Run not found');
	}
	const profileId = run.search_task.profile_id;

	// Get all items for this run with job details for completed items
	const items = await db.query.search_task_run_items.findMany({
		where: eq(search_task_run_items.run_id, runId),
		orderBy: asc(search_task_run_items.position),
		columns: {
			id: true,
			position: true,
			clickable_id: true,
			title: true,
			company: true,
			location: true,
			source_url: true,
			status: true,
			status_message: true,
			job_id: true,
			was_created: true,
			created_at: true,
			processed_at: true
		},
		with: {
			job: {
				columns: {
					id: true,
					title: true,
					company: true,
					office_location: true,
					salary_min: true,
					salary_max: true,
					salary_currency: true,
					salary_period: true,
					job_types: true,
					work_location: true,
					experience_levels: true,
					skills_required: true,
					skills_preferred: true,
					job_description: true,
					source_url: true,
					date_posted: true,
					date_created: true
				},
				with: {
					job_platform: {
						columns: { id: true, name: true, url: true }
					}
				}
			}
		}
	});

	// Attach the current profile's match (if any) to each item that has a job_id.
	// A missing match → still pending (or no matching configured), shown as "New".
	// A match with score 0 → "No Match". Score > 0 → percentage badge.
	const jobIds = items.map((i) => i.job_id).filter((id): id is number => id !== null);
	const matches =
		jobIds.length === 0
			? []
			: await db.query.job_matches.findMany({
					where: and(eq(job_matches.profile_id, profileId), inArray(job_matches.job_id, jobIds)),
					columns: { job_id: true, score: true, recommendation: true, matched_skills: true }
				});
	const matchByJobId = new Map(matches.map((m) => [m.job_id, m]));
	const itemsWithMatch = items.map((item) => ({
		...item,
		match: item.job_id ? (matchByJobId.get(item.job_id) ?? null) : null
	}));

	// Get summary stats
	const statusCounts = items.reduce(
		(acc, item) => {
			acc[item.status] = (acc[item.status] || 0) + 1;
			return acc;
		},
		{} as Record<string, number>
	);

	const newCount = items.filter((i) => i.was_created === true).length;
	const existingCount = items.filter(
		(i) => i.was_created === false && i.status === 'completed'
	).length;

	return json({
		items: itemsWithMatch,
		stats: {
			total: items.length,
			pending: statusCounts['pending'] || 0,
			processing: statusCounts['processing'] || 0,
			completed: statusCounts['completed'] || 0,
			skipped: statusCounts['skipped'] || 0,
			error: statusCounts['error'] || 0,
			new: newCount,
			existing: existingCount
		}
	});
};
