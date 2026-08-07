/**
 * Per-device / per-sharee scrape rate budget.
 *
 * Footprint guard for shared devices: when one residential device (IP) serves
 * many users, naive fan-out multiplies the scrape footprint and gets the device
 * flagged by job boards. This caps it at enqueue time:
 *
 *   - Device guard (protects the IP, applies to everyone using the device):
 *       · minimum spacing between runs on the device
 *       · a daily run ceiling for the device
 *   - Per-sharee cap (fairness + limits borrowed-account footprint): a daily
 *       run cap for a non-owner sharee on a device shared with them.
 *
 * The owner running their own device is subject to the device guard but not the
 * per-sharee cap.
 *
 * Runs carry the resolved device on `search_task_runs.api_key_id` (set at
 * enqueue), so the per-device count is exact regardless of whether the task
 * pinned a device or used the preferred-device fallback. The per-sharee count
 * joins run → task → profile to attribute the run to its triggering user (only
 * the profile owner can run a task, so that user is the sharee).
 */

import { db } from '$lib/server/db';
import { and, desc, eq, gt } from 'drizzle-orm';
import { profiles, search_task_runs, search_tasks } from '$lib/server/db/schema';

const DAY_MS = 24 * 60 * 60 * 1000;

// Starting defaults — tune from telemetry once real devices serve real sharees.
export const DEVICE_MIN_RUN_SPACING_MS = 3 * 60 * 1000; // ≥3 min between runs
export const DEVICE_MAX_RUNS_PER_DAY = 40; // footprint ceiling per device/IP
export const SHAREE_MAX_RUNS_PER_DAY = 10; // per non-owner sharee on a device

export interface RateBudgetResult {
	allowed: boolean;
	error?: string;
}

/**
 * Check whether a scrape run may be enqueued on `apiKeyId` by `requesterId`.
 * `isShared` is true when the requester is a sharee (not the device owner).
 */
export async function checkDeviceRateBudget(params: {
	apiKeyId: number;
	requesterId: string;
	isShared: boolean;
}): Promise<RateBudgetResult> {
	const since = new Date(Date.now() - DAY_MS);

	// All runs on this device in the last 24h, newest first — gives both the
	// device-level count and the most-recent run (for spacing) in one query.
	// Exact: api_key_id is recorded on every run at enqueue.
	const deviceRuns = await db
		.select({ started_at: search_task_runs.started_at })
		.from(search_task_runs)
		.where(
			and(eq(search_task_runs.api_key_id, params.apiKeyId), gt(search_task_runs.started_at, since))
		)
		.orderBy(desc(search_task_runs.started_at));

	if (deviceRuns.length >= DEVICE_MAX_RUNS_PER_DAY) {
		return {
			allowed: false,
			error: `This device has hit its daily scrape limit (${DEVICE_MAX_RUNS_PER_DAY}/day). Try again later.`
		};
	}

	const lastRunAt = deviceRuns[0]?.started_at;
	if (lastRunAt && Date.now() - new Date(lastRunAt).getTime() < DEVICE_MIN_RUN_SPACING_MS) {
		return {
			allowed: false,
			error: 'This device ran a scrape moments ago. Please wait a few minutes between runs.'
		};
	}

	// Per-sharee daily cap — only for non-owners.
	if (params.isShared) {
		const shareeRuns = await db
			.select({ id: search_task_runs.id })
			.from(search_task_runs)
			.innerJoin(search_tasks, eq(search_task_runs.search_task_id, search_tasks.id))
			.innerJoin(profiles, eq(search_tasks.profile_id, profiles.id))
			.where(
				and(
					eq(search_task_runs.api_key_id, params.apiKeyId),
					eq(profiles.user_id, params.requesterId),
					gt(search_task_runs.started_at, since)
				)
			);

		if (shareeRuns.length >= SHAREE_MAX_RUNS_PER_DAY) {
			return {
				allowed: false,
				error: `You've reached your daily limit on this shared device (${SHAREE_MAX_RUNS_PER_DAY}/day). Try again tomorrow, or connect your own device.`
			};
		}
	}

	return { allowed: true };
}
