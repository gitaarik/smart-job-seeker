/**
 * Drop scraper run telemetry past the retention window.
 *
 * A scrape run writes a log line per action plus, when the task has debug
 * screenshots enabled, a PNG per line. Nothing ever deleted either, so both
 * grow without bound — on dev `scraper_logs` reached 159k rows / 62 MB with
 * 58% of it older than a month, and the screenshot volume reached 407 MB of
 * which 359 MB had not been touched in 30 days.
 *
 * Unlike `ai_chats` (see ../ai-chats/retention.ts) there is nothing worth
 * keeping in an old row, so this deletes outright rather than tombstoning: the
 * only readers are the staff debug view and the per-run log view, both of which
 * look at recent runs. The owning `search_task_runs` row is deliberately left
 * alone, so the runs list and its stats survive while the detail goes empty.
 *
 * The screenshot sweep is part of the same job on purpose. `scraper_logs
 * .screenshot_path` is the only pointer to a file on disk, so deleting rows
 * first and cleaning files later would leave permanently unreachable garbage.
 * It sweeps by directory mtime rather than by joining the rows it just deleted,
 * which additionally collects directories whose run was cascade-deleted long
 * ago — those are already unreachable from the database.
 *
 * Deletion is NOT reversible. Idempotent — a repeat pass finds nothing.
 *
 * NOTE: like the ai_chats prune this reclaims space *for reuse by Postgres*;
 * the table file only shrinks on a rewrite, and VACUUM FULL takes an ACCESS
 * EXCLUSIVE lock, so it never runs on a schedule. `scripts/prune-scraper-logs.ts
 * --vacuum` does that by hand during maintenance.
 */

import { and, inArray, lt, sql } from 'drizzle-orm';
import { dbDirect as db } from '$lib/server/db';
import { scraper_log_steps, scraper_logs } from '$lib/server/db/schema';
import { readdir, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';

export interface ScraperLogRetentionResult {
	logsDeleted: number;
	stepsDeleted: number;
	/** True when the batch limit was hit, so rows older than the window remain. */
	moreRemaining: boolean;
}

export interface ScraperLogRetentionOptions {
	/** Log rows older than this are deleted. */
	days: number;
	/**
	 * Cap on log rows per pass, so a first run against a large backlog does not
	 * issue one enormous DELETE. The caller's schedule catches up over
	 * subsequent passes.
	 */
	limit?: number;
}

export interface ScreenshotSweepResult {
	dirsRemoved: number;
	filesRemoved: number;
	bytesFreed: number;
}

export interface ScreenshotSweepOptions {
	/** Run directories untouched for this long are removed. */
	days: number;
	/** Filesystem root, overridable for tests. */
	root?: string;
}

export const DEFAULT_RETENTION_DAYS = 30;
export const DEFAULT_BATCH_LIMIT = 20_000;
/** Mirrors the mount in docker-compose.yml (app and worker both see it). */
export const SCREENSHOTS_ROOT = '/data/scraper-screenshots';

export async function pruneScraperLogs(
	opts: ScraperLogRetentionOptions
): Promise<ScraperLogRetentionResult> {
	const limit = opts.limit ?? DEFAULT_BATCH_LIMIT;
	const cutoff = new Date(Date.now() - opts.days * 24 * 60 * 60 * 1000);

	// Select the batch by primary key first, then delete those ids. Postgres has
	// no DELETE ... LIMIT, and this keeps the row set stable and index-driven.
	const batch = await db
		.select({ id: scraper_logs.id })
		.from(scraper_logs)
		.where(lt(scraper_logs.timestamp, cutoff))
		.limit(limit);

	let logsDeleted = 0;
	if (batch.length > 0) {
		const ids = batch.map((r) => r.id);
		const res = await db.delete(scraper_logs).where(inArray(scraper_logs.id, ids));
		logsDeleted = res.rowCount ?? ids.length;
	}

	// Steps are a handful of rows per run, so they need no batching. Only drop
	// ones nothing still points at: `scraper_logs.step_id` is ON DELETE SET NULL,
	// so removing a step that still owns surviving lines would silently flatten
	// them out of the run tree instead of leaving them alone. On a batched first
	// pass this simply defers to the next one.
	const stepRes = await db.delete(scraper_log_steps).where(
		and(
			lt(scraper_log_steps.started_at, cutoff),
			sql`NOT EXISTS (
      SELECT 1 FROM scraper_logs sl WHERE sl.step_id = scraper_log_steps.id
    )`
		)
	);

	return {
		logsDeleted,
		stepsDeleted: stepRes.rowCount ?? 0,
		moreRemaining: batch.length === limit
	};
}

/**
 * Remove debug screenshot directories no longer within the retention window.
 *
 * Layout is `<root>/<task_id>/<run_id>/<file>.png`. A run directory goes when
 * its newest file is older than the cutoff — a directory still being written to
 * by a live run always has a fresh file in it, so an active run can never be
 * caught by a window measured in days.
 */
export async function pruneScraperScreenshots(
	opts: ScreenshotSweepOptions
): Promise<ScreenshotSweepResult> {
	const root = opts.root ?? SCREENSHOTS_ROOT;
	const cutoff = Date.now() - opts.days * 24 * 60 * 60 * 1000;
	const result: ScreenshotSweepResult = {
		dirsRemoved: 0,
		filesRemoved: 0,
		bytesFreed: 0
	};

	const taskDirs = await readdirOrEmpty(root);
	for (const taskDir of taskDirs) {
		const taskPath = join(root, taskDir);
		const runDirs = await readdirOrEmpty(taskPath);

		for (const runDir of runDirs) {
			const runPath = join(taskPath, runDir);
			const files = await readdirOrEmpty(runPath);

			let newest = 0;
			let bytes = 0;
			let counted = 0;
			for (const file of files) {
				const info = await statOrNull(join(runPath, file));
				if (!info) continue;
				newest = Math.max(newest, info.mtimeMs);
				bytes += info.size;
				counted++;
			}

			// An empty directory has newest = 0, which is older than any cutoff, so
			// leftovers from a partially-swept run get collected too.
			if (newest >= cutoff) continue;

			await rm(runPath, { recursive: true, force: true });
			result.dirsRemoved++;
			result.filesRemoved += counted;
			result.bytesFreed += bytes;
		}

		// Drop the task directory once its last run is gone.
		const remaining = await readdirOrEmpty(taskPath);
		if (remaining.length === 0) {
			await rm(taskPath, { recursive: true, force: true });
		}
	}

	return result;
}

/** A missing or unreadable directory is nothing to sweep, not an error. */
async function readdirOrEmpty(path: string): Promise<string[]> {
	try {
		return await readdir(path);
	} catch {
		return [];
	}
}

async function statOrNull(path: string) {
	try {
		return await stat(path);
	} catch {
		return null;
	}
}
