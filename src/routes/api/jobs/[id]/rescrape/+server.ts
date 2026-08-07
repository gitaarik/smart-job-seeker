/**
 * Single Job Rescrape API
 *
 * POST /api/jobs/[id]/rescrape - Queue a job for re-scraping
 * GET /api/jobs/[id]/rescrape - Check rescrape status + run history
 * DELETE /api/jobs/[id]/rescrape - Cancel a running or queued rescrape
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { eq, sql } from 'drizzle-orm';
import { jobs } from '$lib/server/db/schema';
import { parseIntParam, requireAuth } from '$lib/server/utils/api-helpers';
import {
	addRescrapeJob,
	isJobRescraping,
	removeWaitingRescrapeJob,
	removeActiveRescrapeJob
} from '$lib/server/queue/rescrape-queue';

/**
 * POST - Trigger rescrape for a job
 */
export const POST: RequestHandler = async ({ params, locals, request }) => {
	const user = requireAuth(locals);
	const jobId = parseIntParam(params.id, 'job');

	// Parse optional overrides from request body
	let overrides: {
		countryCode?: string;
		browserLanguage?: string;
		browserTimezone?: string;
		credentialId?: number;
		browserProvider?: string;
		keepMinimized?: boolean;
	} = {};
	try {
		const body = await request.json();
		if (body.countryCode) overrides.countryCode = body.countryCode;
		if (body.browserLanguage) overrides.browserLanguage = body.browserLanguage;
		if (body.browserTimezone) overrides.browserTimezone = body.browserTimezone;
		if (body.credentialId) overrides.credentialId = Number(body.credentialId);
		if (body.browserProvider) overrides.browserProvider = body.browserProvider;
		if (body.keepMinimized !== undefined) {
			overrides.keepMinimized = body.keepMinimized;
		}
	} catch {
		// No body or invalid JSON — that's fine, all fields are optional
	}

	const job = await db.query.jobs.findFirst({
		where: eq(jobs.id, jobId),
		columns: {
			id: true,
			source_url: true,
			job_platform_id: true,
			title: true,
			rescrape_status: true
		}
	});

	if (!job) {
		return json({ error: 'Job not found' }, { status: 404 });
	}

	if (!job.source_url) {
		return json({ error: 'Job has no source URL - cannot rescrape' }, { status: 400 });
	}

	if (!job.job_platform_id) {
		return json({ error: 'Job has no platform - cannot rescrape' }, { status: 400 });
	}

	// Check if already rescraping
	const alreadyRescraping = await isJobRescraping(jobId);
	if (alreadyRescraping) {
		return json({
			status: 'already_queued',
			message: 'Job is already queued for rescrape'
		});
	}

	// Update job status to queued
	await db
		.update(jobs)
		.set({
			rescrape_status: 'queued',
			rescrape_message: 'Waiting in queue...'
		})
		.where(eq(jobs.id, jobId));

	// Create rescrape run record (table may not exist yet)
	let rescrapeRunId: number | undefined;
	try {
		const result = await db.execute(sql`
      INSERT INTO rescrape_runs (job_id, status, triggered_by, started_at)
      VALUES (${jobId}, 'queued', 'user', ${new Date()})
      RETURNING id
    `);
		rescrapeRunId = (result.rows[0] as { id: number }).id;
	} catch {
		// Table may not exist yet — continue without run tracking
	}

	// Add to queue
	const queueJob = await addRescrapeJob({
		jobId: job.id,
		sourceUrl: job.source_url,
		platformId: job.job_platform_id,
		triggeredBy: 'user',
		...overrides,
		rescrapeRunId
	});

	// Update run with BullMQ job ID
	if (rescrapeRunId) {
		try {
			await db.execute(sql`
        UPDATE rescrape_runs SET bullmq_job_id = ${queueJob.id}
        WHERE id = ${rescrapeRunId}
      `);
		} catch {
			// Ignore
		}
	}

	return json({
		status: 'queued',
		message: 'Job queued for rescrape',
		queueJobId: queueJob.id,
		rescrapeRunId
	});
};

/**
 * GET - Check rescrape status + run history
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	const user = requireAuth(locals);
	const jobId = parseIntParam(params.id, 'job');

	const job = await db.query.jobs.findFirst({
		where: eq(jobs.id, jobId),
		columns: {
			id: true,
			rescrape_status: true,
			rescrape_message: true,
			rescrape_live_url: true,
			date_updated: true
		}
	});

	if (!job) {
		return json({ error: 'Job not found' }, { status: 404 });
	}

	// Fetch run history (last 10 runs) - table may not exist
	let history: {
		id: number;
		status: string;
		started_at: string;
		finished_at: string | null;
		message: string | null;
	}[] = [];
	try {
		const result = await db.execute(sql`
      SELECT id, status, started_at, finished_at, message
      FROM rescrape_runs
      WHERE job_id = ${jobId}
      ORDER BY started_at DESC
      LIMIT 10
    `);
		history = (
			result.rows as {
				id: number;
				status: string;
				started_at: Date | null;
				finished_at: Date | null;
				message: string | null;
			}[]
		).map((r) => ({
			id: r.id,
			status: r.status ?? 'unknown',
			started_at: r.started_at ? new Date(r.started_at).toISOString() : new Date().toISOString(),
			finished_at: r.finished_at ? new Date(r.finished_at).toISOString() : null,
			message: r.message
		}));
	} catch {
		// Table may not exist yet
	}

	return json({
		status: job.rescrape_status || 'idle',
		message: job.rescrape_message || null,
		liveUrl: job.rescrape_live_url || null,
		lastUpdated: job.date_updated,
		history
	});
};

/**
 * DELETE - Cancel a running or queued rescrape
 */
export const DELETE: RequestHandler = async ({ params, locals }) => {
	requireAuth(locals);
	const jobId = parseIntParam(params.id, 'job');

	// Try to remove from queue if still waiting
	const removed = await removeWaitingRescrapeJob(jobId);
	if (removed) {
		// Find the queued run and mark as cancelled
		try {
			const queuedResult = await db.execute(sql`
        SELECT id FROM rescrape_runs
        WHERE job_id = ${jobId} AND status = 'queued'
        ORDER BY started_at DESC
        LIMIT 1
      `);
			const queuedRun = queuedResult.rows[0] as { id: number } | undefined;
			if (queuedRun) {
				await db.execute(sql`
          UPDATE rescrape_runs
          SET status = 'cancelled', message = 'Cancelled before start', finished_at = ${new Date()}
          WHERE id = ${queuedRun.id}
        `);
			}
		} catch {
			// rescrape_runs table may not exist
		}

		await db
			.update(jobs)
			.set({
				rescrape_status: 'idle',
				rescrape_message: null,
				rescrape_live_url: null
			})
			.where(eq(jobs.id, jobId));

		console.log(`[API] Removed queued rescrape for job ${jobId}`);
		return json({ status: 'removed_from_queue' });
	}

	// Check if actively scraping
	const job = await db.query.jobs.findFirst({
		where: eq(jobs.id, jobId),
		columns: { rescrape_status: true }
	});

	if (!job || !['queued', 'scraping'].includes(job.rescrape_status || '')) {
		return json({ status: 'not_found' });
	}

	// Mark as cancelled in the database
	await db
		.update(jobs)
		.set({
			rescrape_status: 'cancelled',
			rescrape_message: 'Cancelled by user',
			rescrape_live_url: null
		})
		.where(eq(jobs.id, jobId));

	// Update the rescrape run record
	try {
		const activeResult = await db.execute(sql`
      SELECT id FROM rescrape_runs
      WHERE job_id = ${jobId} AND status IN ('queued', 'scraping')
      ORDER BY started_at DESC
      LIMIT 1
    `);
		const activeRun = activeResult.rows[0] as { id: number } | undefined;
		if (activeRun) {
			await db.execute(sql`
        UPDATE rescrape_runs
        SET status = 'cancelled', message = 'Cancelled by user', finished_at = ${new Date()}
        WHERE id = ${activeRun.id}
      `);
		}
	} catch {
		// rescrape_runs table may not exist
	}

	// Force-fail the BullMQ job (best-effort)
	await removeActiveRescrapeJob(jobId);

	console.log(`[API] Cancelled rescrape for job ${jobId}`);
	return json({ status: 'cancelled' });
};
