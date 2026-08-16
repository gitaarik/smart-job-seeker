#!/usr/bin/env node
/**
 * Dev-only: trigger a scrape run for a given task ID without going through
 * the auth/credit-checked API. Mirrors the logic of POST /api/import-tasks/[id]/run.
 *
 * Usage (from cloud/):
 *   npm run trigger-run -- <task-id>
 *
 * Skips ownership and credit checks, so do not expose this on a public host.
 */

import { eq } from 'drizzle-orm';
import { dbDirect as db } from '$lib/server/db';
import { search_tasks, search_task_runs } from '$lib/server/db/schema';
import { addScrapeJob, getActiveJobForSearch } from '$lib/server/queue/scraper-queue';

async function main() {
	const arg = process.argv[2];
	const taskId = arg ? parseInt(arg, 10) : NaN;
	if (!Number.isFinite(taskId)) {
		console.error('Usage: npm run trigger-run -- <task-id>');
		process.exit(1);
	}

	const searchTask = await db.query.search_tasks.findFirst({
		where: eq(search_tasks.id, taskId),
		with: { job_platform: { columns: { search_page_url: true } } }
	});
	if (!searchTask) {
		console.error(`Task ${taskId} not found`);
		process.exit(1);
	}
	if (!searchTask.platform_id) {
		console.error(`Task ${taskId} has no platform configured`);
		process.exit(1);
	}

	// Same fallback the scheduler applies (worker.ts runSchedulerCycle). Tasks
	// created under the dynamic form-fill flow have no `search_url` at all —
	// the scraper drives the platform's search page instead — so passing the
	// column raw sent `null` down to `page.goto()` and killed the run in five
	// seconds with "url: expected string, got object". That is every task on
	// the current flow, i.e. this script was broken for exactly the tasks
	// anyone would want to debug.
	const effectiveSearchUrl = searchTask.search_url || searchTask.job_platform?.search_page_url;
	if (!effectiveSearchUrl) {
		console.error(
			`Task ${taskId} has no search_url, and its platform has no search_page_url — ` +
				`nothing to navigate to`
		);
		process.exit(1);
	}

	const activeJob = await getActiveJobForSearch(taskId);
	if (activeJob) {
		console.error(`Task ${taskId} already has an active job: ${activeJob.id}`);
		process.exit(1);
	}

	const [run] = await db
		.insert(search_task_runs)
		.values({
			search_task_id: taskId,
			status: 'queued',
			triggered_by: 'user',
			settings: {
				max_jobs: searchTask.max_jobs,
				skip_existing: searchTask.skip_existing,
				skip_first: searchTask.skip_first,
				stop_after_duplicates:
					((searchTask as Record<string, unknown>).stop_after_duplicates as number | null) ?? null,
				browser_provider: searchTask.browser_provider
			}
		})
		.returning();

	await db
		.update(search_tasks)
		.set({
			status: 'queued',
			status_message: 'Manual trigger via trigger-run script',
			date_updated: new Date()
		})
		.where(eq(search_tasks.id, taskId));

	let effectiveProvider = searchTask.browser_provider;
	if (!effectiveProvider) {
		const serverDefault = process.env.SJS_BROWSER_PROVIDER || 'local';
		if (serverDefault === 'goLogin') effectiveProvider = 'hosted';
	}

	const job = await addScrapeJob({
		searchTaskId: taskId,
		runId: run.id,
		searchUrl: effectiveSearchUrl,
		platformId: String(searchTask.platform_id),
		triggeredBy: 'user',
		browserProvider: effectiveProvider,
		...(searchTask.search_term ? { searchTerm: searchTask.search_term } : {})
	});

	await db
		.update(search_task_runs)
		.set({ bullmq_job_id: job.id })
		.where(eq(search_task_runs.id, run.id));

	console.log(
		`Queued run ${run.id} for task ${taskId} (BullMQ job ${job.id}, provider=${effectiveProvider || 'default'})`
	);
	process.exit(0);
}

main().catch((err) => {
	console.error('trigger-run failed:', err);
	process.exit(1);
});
