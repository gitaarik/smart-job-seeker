/**
 * Tests for what the auth-block applier actually writes.
 *
 * The decision is tested next door in `$lib/import-tasks/failure-policy`; this
 * covers the layer under it, which is where the mistakes that matter live: the
 * guards that decide a task is even eligible, the exact columns written for a
 * backoff versus a switch-off, and the two places where writing the wrong
 * thing would quietly override a human — `user_paused_at`, which must never be
 * touched, and the re-activation, which must never win against it.
 *
 * Only the DB and the notification sink are faked. The policy underneath runs
 * for real, so a test here can't pass by agreeing with a stub.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

interface FakeState {
	task: Record<string, unknown> | undefined;
	runs: Record<string, unknown>[];
	relay: { full_address: string } | null;
	profile: { user_id: string } | null;
	/** What `.returning()` yields — empty models a WHERE that matched nothing. */
	updateReturns: { id: number }[];
	updates: Record<string, unknown>[];
}

const state: FakeState = {
	task: undefined,
	runs: [],
	relay: null,
	profile: { user_id: 'user-1' },
	updateReturns: [{ id: 1 }],
	updates: []
};

const createNotification = vi.fn();

vi.mock('$lib/server/notifications', () => ({
	createNotification: (...args: unknown[]) => createNotification(...args)
}));

vi.mock('$lib/server/db', () => {
	// `await db.update(x).set(y).where(z)` and
	// `await db.update(x).set(y).where(z).returning(w)` are both used, so the
	// where() result has to be thenable *and* carry returning().
	const whereResult = {
		returning: () => Promise.resolve(state.updateReturns),
		then: (resolve: (v: unknown) => void) => resolve(state.updateReturns)
	};
	return {
		dbDirect: {
			query: {
				search_tasks: { findFirst: () => Promise.resolve(state.task) },
				search_task_runs: { findMany: () => Promise.resolve(state.runs) },
				verification_email_addresses: { findFirst: () => Promise.resolve(state.relay) },
				profiles: { findFirst: () => Promise.resolve(state.profile) }
			},
			update: () => ({
				set: (values: Record<string, unknown>) => {
					state.updates.push(values);
					return { where: () => whereResult };
				}
			})
		}
	};
});

const { clearAuthBlock, evaluateAuthBlock } = await import('./auth-block');

const NOW = new Date(Date.UTC(2026, 7, 16, 12));
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

/** A healthy, scheduled, LinkedIn task with nothing wrong with it. */
function activeTask(over: Record<string, unknown> = {}) {
	return {
		id: 42,
		is_active: true,
		schedule_interval_hours: 24,
		next_scheduled_run: new Date(Date.UTC(2026, 7, 17, 9)),
		auth_block_kind: null,
		auth_block_notified_at: null,
		auto_disabled_at: null,
		profile_id: 7,
		search_term: 'Senior TypeScript',
		note: null,
		job_platform: { name: 'LinkedIn' },
		...over
	};
}

function authFailures(count: number, oldestDaysAgo = count) {
	return Array.from({ length: count }, (_, i) => ({
		status: 'error',
		failure_kind: 'auth_verification',
		triggered_by: 'scheduler',
		started_at: daysAgo(oldestDaysAgo - (count - 1 - i))
	}));
}

beforeEach(() => {
	state.task = activeTask();
	state.runs = [];
	state.relay = null;
	state.profile = { user_id: 'user-1' };
	state.updateReturns = [{ id: 42 }];
	state.updates = [];
	createNotification.mockClear();
});

describe('evaluateAuthBlock — eligibility', () => {
	beforeEach(() => {
		state.runs = authFailures(3);
	});

	it('acts on an active, scheduled, blocked task', async () => {
		expect(await evaluateAuthBlock(42, { now: NOW })).toMatchObject({ act: 'backoff' });
	});

	it('ignores a task that no longer exists', async () => {
		state.task = undefined;
		expect(await evaluateAuthBlock(42, { now: NOW })).toBeNull();
		expect(state.updates).toHaveLength(0);
	});

	it('ignores an inactive task — it costs nothing and is not running', async () => {
		state.task = activeTask({ is_active: false });
		expect(await evaluateAuthBlock(42, { now: NOW })).toBeNull();
	});

	it('ignores an unscheduled task — a human is right there watching it fail', async () => {
		state.task = activeTask({ schedule_interval_hours: null });
		expect(await evaluateAuthBlock(42, { now: NOW })).toBeNull();
	});

	it('does not re-fire on a task it has already switched off', async () => {
		state.task = activeTask({ auto_disabled_at: daysAgo(1) });
		expect(await evaluateAuthBlock(42, { now: NOW })).toBeNull();
		expect(state.updates).toHaveLength(0);
	});
});

describe('evaluateAuthBlock — backing off', () => {
	beforeEach(() => {
		state.runs = authFailures(3);
	});

	it('records the kind and spaces out the next run, leaving the task on', async () => {
		const out = await evaluateAuthBlock(42, { now: NOW });
		expect(out).toMatchObject({ act: 'backoff', kind: 'auth_verification', notified: true });
		const [update] = state.updates;
		expect(update.auth_block_kind).toBe('auth_verification');
		expect(update.auth_block_notified_at).toEqual(NOW);
		expect(update.is_active).toBeUndefined();
		expect(update.auto_disabled_at).toBeUndefined();
		expect((update.next_scheduled_run as Date).getTime()).toBeGreaterThanOrEqual(
			NOW.getTime() + 72 * 3_600_000
		);
	});

	it('never writes user_paused_at — that column means a human decided', async () => {
		// The reconciler reads user_paused_at as hands-off, so setting it here
		// would let an automatic pause masquerade as a deliberate one and
		// permanently block promotion.
		await evaluateAuthBlock(42, { now: NOW });
		expect(state.updates[0]).not.toHaveProperty('user_paused_at');
	});

	it('keeps the status message inside the column', async () => {
		await evaluateAuthBlock(42, { now: NOW });
		expect((state.updates[0].status_message as string).length).toBeLessThanOrEqual(255);
	});

	it('notifies once, then stays quiet for the rest of the episode', async () => {
		await evaluateAuthBlock(42, { now: NOW });
		expect(createNotification).toHaveBeenCalledTimes(1);
		expect(createNotification.mock.calls[0][0]).toMatchObject({
			userId: 'user-1',
			type: 'import_task_auth_blocked',
			link: '/jobs/import/tasks/42'
		});

		createNotification.mockClear();
		state.task = activeTask({ auth_block_notified_at: daysAgo(1) });
		const second = await evaluateAuthBlock(42, { now: NOW });
		expect(second).toMatchObject({ act: 'backoff', notified: false });
		expect(createNotification).not.toHaveBeenCalled();
	});

	it('speaks up again for a block that began after the last notification', async () => {
		state.task = activeTask({ auth_block_notified_at: daysAgo(90) });
		const out = await evaluateAuthBlock(42, { now: NOW });
		expect(out).toMatchObject({ notified: true });
		expect(createNotification).toHaveBeenCalledTimes(1);
	});

	it('offers the relay address only where forwarding mail is the fix', async () => {
		state.relay = { full_address: 'verify-abc@smartjobseeker.com' };
		await evaluateAuthBlock(42, { now: NOW });
		expect(createNotification.mock.calls[0][0].message).toContain('verify-abc@smartjobseeker.com');

		createNotification.mockClear();
		state.updates = [];
		state.task = activeTask();
		state.runs = authFailures(3).map((r) => ({ ...r, failure_kind: 'auth_captcha' }));
		await evaluateAuthBlock(42, { now: NOW });
		expect(createNotification.mock.calls[0][0].message).not.toContain('verify-abc');
	});

	it('survives a profile with no user rather than throwing mid-run', async () => {
		// This runs inside a finished scrape's housekeeping; an orphaned profile
		// must not turn a completed run into a failed one.
		state.profile = null;
		expect(await evaluateAuthBlock(42, { now: NOW })).toMatchObject({ act: 'backoff' });
		expect(createNotification).not.toHaveBeenCalled();
	});
});

describe('evaluateAuthBlock — giving up', () => {
	it('switches the task off once the block outlasts anything that heals', async () => {
		state.runs = authFailures(3, 40);
		const out = await evaluateAuthBlock(42, { now: NOW });
		expect(out).toMatchObject({ act: 'disable', kind: 'auth_verification' });
		const [update] = state.updates;
		expect(update.is_active).toBe(false);
		expect(update.auto_disabled_at).toEqual(NOW);
		expect(update.auth_block_kind).toBe('auth_verification');
		expect(update).not.toHaveProperty('user_paused_at');
		expect(update.next_scheduled_run).toBeUndefined();
		expect(createNotification.mock.calls[0][0].type).toBe('import_task_auto_disabled');
	});
});

describe('clearAuthBlock', () => {
	it('does nothing for a task that was never blocked', async () => {
		expect(await clearAuthBlock(42)).toBe(false);
		expect(state.updates).toHaveLength(0);
		expect(createNotification).not.toHaveBeenCalled();
	});

	it('drops the block state after a backoff, without a second notification', async () => {
		// Nothing to repair: the scheduler recomputes next_scheduled_run from
		// the interval on its next enqueue, so only the block state has to go.
		state.task = activeTask({
			auth_block_kind: 'auth_verification',
			auth_block_notified_at: daysAgo(2)
		});
		expect(await clearAuthBlock(42)).toBe(false);
		expect(state.updates[0]).toEqual({ auth_block_kind: null, auth_block_notified_at: null });
		expect(createNotification).not.toHaveBeenCalled();
	});

	it('switches a switched-off task back on and says so', async () => {
		state.task = activeTask({
			is_active: false,
			auth_block_kind: 'auth_verification',
			auto_disabled_at: daysAgo(3)
		});
		expect(await clearAuthBlock(42)).toBe(true);
		expect(state.updates[0]).toMatchObject({
			is_active: true,
			auth_block_kind: null,
			auth_block_notified_at: null,
			auto_disabled_at: null
		});
		expect(createNotification.mock.calls[0][0].type).toBe('import_task_reactivated');
	});

	it('leaves a task the user paused alone', async () => {
		// The update is guarded on user_paused_at IS NULL, so it matches
		// nothing; a successful manual run must not undo a deliberate pause.
		state.task = activeTask({
			is_active: false,
			auth_block_kind: 'auth_verification',
			auto_disabled_at: daysAgo(3)
		});
		state.updateReturns = [];
		expect(await clearAuthBlock(42)).toBe(false);
		expect(createNotification).not.toHaveBeenCalled();
	});
});
