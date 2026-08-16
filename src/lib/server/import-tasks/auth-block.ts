/**
 * Act on a scheduled import task that can't get past the platform's login,
 * and tell the user what would fix it.
 *
 * The decision lives in `$lib/import-tasks/failure-policy` (pure, unit-tested,
 * and the place to read for *why* this backs off rather than switching tasks
 * off); this file is only the orchestration around it — read the run history, apply the
 * verdict, send the notification. It runs inside the worker/scraper process,
 * so it takes `dbDirect` like the rest of the scraper-facing helpers.
 *
 * Two entry points, and they are a matched pair:
 *
 * - {@link evaluateAuthBlock} after a run fails, which may space out the
 *   retries, notify, or eventually switch the task off.
 * - {@link clearAuthBlock} after a run succeeds, which undoes all of it.
 *
 * The second is what makes the first safe. The instruction sent is "run it
 * once yourself and complete the check"; a manual run works on a backed-off or
 * switched-off task, so when that run succeeds everything resets and the user
 * never has to remember a second step. Nothing we changed stays changed once
 * the evidence for changing it is gone.
 */

import { dbDirect as db } from '$lib/server/db';
import { and, desc, eq, isNull } from 'drizzle-orm';
import {
	profiles,
	search_task_runs,
	search_tasks,
	verification_email_addresses
} from '$lib/server/db/schema';
import { createNotification } from '$lib/server/notifications';
import { toFailureKind, type FailureKind } from '$lib/import-tasks/failure-kinds';
import {
	backoffNextRun,
	decideAuthBlockRemedy,
	explainAuthBlock,
	type AuthBlockRemedy,
	type RemedyOptions,
	type RunOutcome
} from '$lib/import-tasks/failure-policy';

/**
 * How many recent runs to hand the policy. It walks newest-first and stops at
 * the first success, so this only needs to cover the longest streak worth
 * distinguishing — but it is generous, because cancelled runs, in-flight runs
 * and infrastructure failures are stepped over without ending the walk, and a
 * short window could hide the success that would have bounded the streak.
 */
const RUN_LOOKBACK = 20;

export interface AuthBlockOutcome {
	taskId: number;
	act: 'backoff' | 'disable';
	kind: FailureKind;
	streak: number;
	since: Date;
	notified: boolean;
	/** Only for 'backoff' — when the task will next try. */
	nextRun?: Date;
}

/**
 * Consider acting after one of a task's runs failed.
 *
 * Returns the outcome when it did something, `null` in every other case
 * (including all the "not applicable" ones) — callers treat this as
 * best-effort housekeeping, not as a step that can fail a run.
 */
export async function evaluateAuthBlock(
	searchTaskId: number,
	opts: RemedyOptions = {}
): Promise<AuthBlockOutcome | null> {
	const task = await db.query.search_tasks.findFirst({
		where: eq(search_tasks.id, searchTaskId),
		columns: {
			id: true,
			is_active: true,
			schedule_interval_hours: true,
			next_scheduled_run: true,
			auth_block_notified_at: true,
			auto_disabled_at: true,
			profile_id: true,
			search_term: true,
			note: true
		},
		with: { job_platform: { columns: { name: true } } }
	});

	// Only ever fires for a task that is currently running itself on a
	// schedule: an inactive task costs nothing, and a task with no schedule
	// only runs when a human asks it to — and a human watching a run fail does
	// not need us to reschedule anything or write them a note about it.
	if (!task) return null;
	if (!task.is_active) return null;
	if (task.schedule_interval_hours == null) return null;
	if (task.auto_disabled_at != null) return null;

	const now = opts.now ?? new Date();
	const remedy = await remedyForTask(searchTaskId, {
		...opts,
		now,
		notifiedAt: opts.notifiedAt ?? task.auth_block_notified_at
	});
	if (remedy.act === 'none') return null;

	const platform = task.job_platform?.name ?? 'the platform';
	const taskLabel = task.note?.trim() || task.search_term?.trim() || null;
	const relayAddress =
		remedy.kind === 'auth_verification' ? await relayAddressFor(task.profile_id) : null;
	const explanation = explainAuthBlock(remedy.kind, {
		platform,
		taskLabel,
		relayAddress,
		disabled: remedy.act === 'disable',
		retryInHours: remedy.act === 'backoff' ? remedy.retryInHours : undefined
	});

	const update: Record<string, unknown> = {
		auth_block_kind: remedy.kind,
		status_message: explanation.statusMessage.slice(0, 255),
		date_updated: now
	};
	if (remedy.notify) update.auth_block_notified_at = now;

	let nextRun: Date | undefined;
	if (remedy.act === 'disable') {
		// Note what is *not* set: `user_paused_at`. That column means the user
		// made a deliberate choice, and the auto-import reconciler reads it as
		// hands-off. Writing it here would let an automatic pause masquerade as
		// a human one and permanently block the reconciler.
		update.is_active = false;
		update.auto_disabled_at = now;
	} else {
		nextRun = backoffNextRun(task.next_scheduled_run, now, remedy.retryInHours);
		// The user's `schedule_interval_hours` is deliberately left alone —
		// only the next occurrence moves. A successful run therefore restores
		// the normal cadence with nothing to undo, because the scheduler
		// recomputes from the interval every time it enqueues.
		update.next_scheduled_run = nextRun;
	}

	await db.update(search_tasks).set(update).where(eq(search_tasks.id, searchTaskId));

	if (remedy.notify) {
		const userId = await userIdForProfile(task.profile_id);
		if (userId) {
			await createNotification({
				userId,
				type: remedy.act === 'disable' ? 'import_task_auto_disabled' : 'import_task_auth_blocked',
				title: explanation.title.slice(0, 200),
				message: explanation.message,
				link: `/jobs/import/tasks/${searchTaskId}`
			});
		}
	}

	return {
		taskId: searchTaskId,
		act: remedy.act,
		kind: remedy.kind,
		streak: remedy.streak,
		since: remedy.since,
		notified: remedy.notify,
		nextRun
	};
}

/**
 * Undo everything an auth block caused, after one of the task's runs
 * succeeded: clear the notification stamp so a future block speaks up again,
 * and switch the task back on if it was us who switched it off.
 *
 * The re-activation is guarded on `user_paused_at IS NULL` so it can only ever
 * undo our own decision. If the user has since paused the task by hand, their
 * choice wins and a successful manual run must not quietly override it.
 *
 * Returns true if a switched-off task was re-activated.
 */
export async function clearAuthBlock(searchTaskId: number): Promise<boolean> {
	const task = await db.query.search_tasks.findFirst({
		where: eq(search_tasks.id, searchTaskId),
		columns: {
			id: true,
			auth_block_kind: true,
			auth_block_notified_at: true,
			auto_disabled_at: true,
			profile_id: true
		},
		with: { job_platform: { columns: { name: true } } }
	});
	if (!task) return false;
	if (!task.auth_block_kind && !task.auth_block_notified_at && !task.auto_disabled_at) {
		return false;
	}

	if (!task.auto_disabled_at) {
		// Backed off but never switched off: the schedule needs no repair (the
		// scheduler recomputes it from the interval on the next enqueue), so
		// only the block state has to go.
		await db
			.update(search_tasks)
			.set({ auth_block_kind: null, auth_block_notified_at: null })
			.where(eq(search_tasks.id, searchTaskId));
		return false;
	}

	const updated = await db
		.update(search_tasks)
		.set({
			is_active: true,
			auth_block_kind: null,
			auth_block_notified_at: null,
			auto_disabled_at: null,
			date_updated: new Date()
		})
		.where(and(eq(search_tasks.id, searchTaskId), isNull(search_tasks.user_paused_at)))
		.returning({ id: search_tasks.id });

	if (updated.length === 0) return false;

	const userId = await userIdForProfile(task.profile_id);
	if (userId) {
		const platform = task.job_platform?.name ?? 'the platform';
		await createNotification({
			userId,
			type: 'import_task_reactivated',
			title: `${platform} import is running again`,
			message:
				`The login worked this time, so the import task has been switched back on and ` +
				`will resume its normal schedule. Nothing else to do.`,
			link: `/jobs/import/tasks/${searchTaskId}`
		});
	}
	return true;
}

/** Run the policy against a task's recent history without applying anything. */
async function remedyForTask(
	searchTaskId: number,
	opts: RemedyOptions = {}
): Promise<AuthBlockRemedy> {
	const rows = await db.query.search_task_runs.findMany({
		where: eq(search_task_runs.search_task_id, searchTaskId),
		columns: { status: true, failure_kind: true, triggered_by: true, started_at: true },
		orderBy: desc(search_task_runs.started_at),
		limit: RUN_LOOKBACK
	});

	const runs: RunOutcome[] = rows.map((r) => ({
		status: r.status,
		failure_kind: toFailureKind(r.failure_kind),
		triggered_by: r.triggered_by,
		started_at: r.started_at
	}));
	return decideAuthBlockRemedy(runs, opts);
}

/** The profile's verification-relay address, if one is provisioned and live. */
async function relayAddressFor(profileId: number): Promise<string | null> {
	const row = await db.query.verification_email_addresses.findFirst({
		where: and(
			eq(verification_email_addresses.profile_id, profileId),
			eq(verification_email_addresses.is_active, true)
		),
		columns: { full_address: true }
	});
	return row?.full_address ?? null;
}

async function userIdForProfile(profileId: number): Promise<string | null> {
	const profile = await db.query.profiles.findFirst({
		where: eq(profiles.id, profileId),
		columns: { user_id: true }
	});
	return profile?.user_id ?? null;
}
