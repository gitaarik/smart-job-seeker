/**
 * Pure decision logic for a scheduled import task whose runs keep failing at
 * the platform's login.
 *
 * The problem, measured rather than imagined: on preview, tasks 27, 43 and 63
 * failed their scheduled run every single day from 2026-08-11 to 2026-08-16 —
 * six runs each, all of them "Platform login failed — Email verification
 * required" or "— security-question" — while staying `is_active` with a 24h
 * schedule and telling nobody. A failing auth run averages 24.7 minutes
 * against 14.3 for a successful one (the login loop pauses up to three times
 * for an intervention that, on a scheduled run, nobody is there to answer),
 * and per-provider queue concurrency is 1, so those three tasks alone spent
 * over an hour a day standing in front of every other task to accomplish
 * nothing.
 *
 * ## Why this backs off instead of switching the task off
 *
 * The obvious remedy is to disable the task and ask the user to complete the
 * login once. Replaying real history says that would be wrong. Every
 * multi-run auth block in preview's 301 runs ended on a **scheduled** success
 * — no human touched it. The platform re-checks a device, refuses for
 * somewhere between two days and a fortnight, and then simply stops refusing:
 *
 *     27  2026-07-24 … 07-27   4 failed runs, then 07-28 succeeded, unattended
 *     63  2026-07-24 … 07-27   4 failed runs, then 07-28 succeeded, unattended
 *     27  2026-05-27 … 05-28   2 failed runs, then 05-29 succeeded, unattended
 *
 * A disable-and-wait-for-the-user policy backtested against that history
 * pauses task 27 on 2026-05-13 and, because nobody ever runs it by hand,
 * costs 50 scheduled runs that would have worked. That is a silently dead job
 * search — a far worse outcome than the wasted queue time it was trying to
 * save.
 *
 * So the remedy is graduated, and the two useful halves are separated:
 *
 * - **Tell the user**, once per episode. This is the valuable part and the
 *   part originally asked for: a login that needs confirming will keep needing
 *   it, and completing it once by hand is the only thing that actually fixes
 *   it rather than waiting it out.
 * - **Stop hammering the queue** by spacing the retries out, while still
 *   retrying — because the block usually lifts by itself and a task retrying
 *   every third day costs almost nothing.
 * - **Give up eventually**, but on a horizon far past anything observed
 *   healing (see {@link DEFAULT_GIVE_UP_DAYS}), so "switched off" means
 *   genuinely stuck rather than briefly challenged.
 *
 * No DB or LLM imports: everything here is a deterministic function of its
 * inputs, and the orchestration lives in `$lib/server/import-tasks/auth-block`.
 */

import { isAuthSetupFailure, isInfrastructureFailure, type FailureKind } from './failure-kinds';

/**
 * How many consecutive unattended auth failures before we act at all.
 *
 * Three, because the pattern this must not fire on is a task that alternates.
 * Preview task 27 before its current streak reads success, error, success,
 * error, success, error — the longest streak in that stretch is 1, so a
 * threshold of 2 would have fired on a task that was working fine.
 */
export const DEFAULT_AUTH_FAILURE_THRESHOLD = 3;

/**
 * Minimum spacing between retries once a task is known to be auth-blocked.
 *
 * 72h by backtest: it removes the large majority of the wasted runs while
 * still catching a self-healing block within a couple of days of it lifting.
 * Weekly saves marginally more and consistently loses several extra days of a
 * working task, which is the wrong trade.
 */
export const DEFAULT_BACKOFF_HOURS = 72;

/**
 * How long a continuous auth block runs before the task is switched off for
 * real.
 *
 * 30 days, which is roughly twice the longest block observed to heal on its
 * own: preview task 27 was noticed on 2026-05-13 and came back unattended on
 * 05-29, sixteen days later. An earlier draft used 21 days on a worse reading
 * of the data and left five days of margin — the backtest at weekly retry
 * spacing then switched that task off on 06-05, four days before it would have
 * recovered, costing 50 subsequent scheduled runs. The horizon has to clear
 * the worst self-heal by a wide margin or it is just the disable-forever
 * policy with extra steps.
 *
 * By a month the user has had a notification sitting there for four weeks and
 * the backoff has already cut the cost to a run every third day, so there is
 * no hurry — this exists to stop a genuinely dead task retrying until the heat
 * death of the universe, not to be part of normal operation. It fires on
 * nothing in the current history.
 */
export const DEFAULT_GIVE_UP_DAYS = 30;

/** The run fields the policy looks at. Deliberately a structural type so
 *  callers can pass a Drizzle row, a test fixture, or a backtest record. */
export interface RunOutcome {
	status: string;
	failure_kind: FailureKind | null;
	/** 'scheduler' | 'user' | … — only unattended failures count toward a streak. */
	triggered_by: string | null;
	started_at: Date;
}

export interface RemedyOptions {
	/** Consecutive unattended auth failures before acting. */
	threshold?: number;
	/** Minimum hours between retries while blocked. */
	backoffHours?: number;
	/** Days of continuous block before switching the task off. */
	giveUpDays?: number;
	/** When the user was last told about *this* episode, from the task row.
	 *  Anything predating the episode's start counts as not yet told. */
	notifiedAt?: Date | null;
	/** Injectable clock for tests. */
	now?: Date;
}

export type AuthBlockRemedy =
	| {
			/** Nothing to do. `why` names the rule that stopped it, for logging. */
			act: 'none';
			kind: FailureKind | null;
			streak: number;
			why: 'no-runs' | 'recovered' | 'other-failure' | 'below-threshold';
	  }
	| {
			/** Keep retrying, but not this often — and say something if we haven't. */
			act: 'backoff';
			kind: FailureKind;
			streak: number;
			since: Date;
			days: number;
			retryInHours: number;
			notify: boolean;
	  }
	| {
			/** Blocked long past anything that heals. Switch it off. */
			act: 'disable';
			kind: FailureKind;
			streak: number;
			since: Date;
			days: number;
			notify: boolean;
	  };

/**
 * Decide what to do about a task's recent run history.
 *
 * `runs` must be newest-first. Walking backwards from the present, each run is
 * folded into the streak or **bounds** it — and bounding it ends the walk,
 * rather than the enquiry. That distinction is the whole correctness of this
 * function: a success is where the streak *starts*, not a veto over it. An
 * earlier version returned "recovered" on any success it ever reached, so a
 * task with three fresh auth failures sitting on top of a green fortnight
 * evaluated as healthy — which is every task this exists for. It went
 * unnoticed through a green unit suite and was caught by replaying real
 * history (dev task 66, three scheduled verification failures over four days
 * with successes below them).
 *
 * - **success / partial** — the task worked here, so the streak above it is
 *   complete. Stop and judge what was collected. Holds regardless of who
 *   triggered the run: a person proving by hand that the login works is
 *   exactly as good as a schedule proving it.
 * - **cancelled, still-running, and infrastructure failures** — carry no
 *   information about the task's health (a worker restart is our fault, a
 *   cancel is a human changing their mind), so they are stepped over without
 *   counting or bounding.
 * - **user-triggered failures** — skipped too. Someone watching a run fail in
 *   front of them already knows; the case for acting is that it is failing
 *   where nobody is looking.
 * - **any other scheduled failure** — a different cause with a different
 *   remedy (an offline tunnel is not a login problem), so it bounds the streak
 *   too. A non-auth failure *inside* the recent run of failures therefore
 *   holds the count below the threshold and nothing happens; one that has
 *   already scrolled off beneath a complete streak is simply old news.
 */
export function decideAuthBlockRemedy(
	runs: readonly RunOutcome[],
	opts: RemedyOptions = {}
): AuthBlockRemedy {
	const threshold = opts.threshold ?? DEFAULT_AUTH_FAILURE_THRESHOLD;
	const backoffHours = opts.backoffHours ?? DEFAULT_BACKOFF_HOURS;
	const giveUpDays = opts.giveUpDays ?? DEFAULT_GIVE_UP_DAYS;
	const now = opts.now ?? new Date();

	const streak: RunOutcome[] = [];
	// What ended the walk, used only to explain an empty streak.
	let bound: 'no-runs' | 'recovered' | 'other-failure' = 'no-runs';
	let boundingKind: FailureKind | null = null;

	for (const run of runs) {
		if (run.status === 'success' || run.status === 'partial') {
			bound = 'recovered';
			break;
		}
		if (run.status !== 'error') continue; // cancelled / queued / running / blocked
		if (isInfrastructureFailure(run.failure_kind)) continue;
		if (run.triggered_by === 'user') continue;

		if (!isAuthSetupFailure(run.failure_kind)) {
			bound = 'other-failure';
			boundingKind = run.failure_kind;
			break;
		}
		streak.push(run);
	}

	if (streak.length === 0) {
		return { act: 'none', kind: boundingKind, streak: 0, why: bound };
	}
	const kind = dominantKind(streak);
	if (streak.length < threshold) {
		return { act: 'none', kind, streak: streak.length, why: 'below-threshold' };
	}

	const since = streak[streak.length - 1].started_at;
	const days = (now.getTime() - since.getTime()) / 86_400_000;
	// Told already iff the notification postdates the start of *this* episode.
	// A stamp from an earlier block is stale by construction — the streak that
	// produced it was ended by the success that ended it.
	const notify = !(opts.notifiedAt != null && opts.notifiedAt >= since);

	if (days >= giveUpDays) {
		return { act: 'disable', kind, streak: streak.length, since, days, notify };
	}
	return {
		act: 'backoff',
		kind,
		streak: streak.length,
		since,
		days,
		retryInHours: backoffHours,
		notify
	};
}

/**
 * Which of the streak's kinds to explain to the user.
 *
 * Most frequent wins, ties go to the most recent. `auth_unknown` is passed
 * over whenever any specific kind is present in the streak: it is the "login
 * failed, page not recognised" bucket, so it carries no advice, and a streak
 * that is four device-checks and one unrecognised page is a device-check
 * problem. Real data needs this — task 63's streak was
 * security-question, no-password-field, security-question, email-verification,
 * security-question.
 */
function dominantKind(streak: readonly RunOutcome[]): FailureKind {
	const kinds = streak.map((r) => r.failure_kind).filter((k): k is FailureKind => k != null);
	const specific = kinds.filter((k) => k !== 'auth_unknown');
	const pool = specific.length > 0 ? specific : kinds;

	const counts = new Map<FailureKind, number>();
	for (const k of pool) counts.set(k, (counts.get(k) ?? 0) + 1);

	let best = pool[0];
	for (const k of pool) {
		// `pool` is newest-first, so a strict `>` keeps the earliest-seen
		// (= most recent) kind on a tie.
		if ((counts.get(k) ?? 0) > (counts.get(best) ?? 0)) best = k;
	}
	return best;
}

/**
 * When the next retry should happen, keeping the user's time of day.
 *
 * The scheduler has already stamped `next_scheduled_run` at the task's
 * preferred hour, so pushing it forward in whole days keeps that hour without
 * this module needing to know anything about timezones. Falls back to a plain
 * offset when there is no stamp to advance.
 */
export function backoffNextRun(
	currentNext: Date | null | undefined,
	now: Date,
	retryHours: number
): Date {
	const earliest = new Date(now.getTime() + retryHours * 3_600_000);
	if (!currentNext) return earliest;
	const out = new Date(currentNext);
	while (out < earliest) out.setUTCDate(out.getUTCDate() + 1);
	return out;
}

// ============================================================================
// User-facing explanation
// ============================================================================

export interface ExplainContext {
	/** Platform display name, e.g. "LinkedIn". */
	platform: string;
	/** What the task searches for, for telling several tasks apart. */
	taskLabel: string | null;
	/** The profile's verification-relay address, when one is provisioned.
	 *  Offered only for the emailed-code case, where it is an actual fix. */
	relayAddress?: string | null;
	/** True once the task has actually been switched off, which changes both
	 *  what happened and what the user has to do about it. */
	disabled?: boolean;
	/** Hours between retries while it stays blocked. */
	retryInHours?: number;
}

export interface Explanation {
	title: string;
	message: string;
	/** Short form for `search_tasks.status_message` (255 char column). */
	statusMessage: string;
}

/**
 * Turn a remedy into something worth reading.
 *
 * Each kind gets its own advice because the remedies genuinely differ, and a
 * generic "check your login" would be worse than the error message the user
 * is already not reading. The emailed-code case additionally mentions the
 * verification relay when the profile has an address, because forwarding the
 * mail there fixes the problem with no manual run at all — and four of the six
 * active relay addresses on preview have never received a single email, so
 * "provisioned" plainly hasn't meant "used".
 *
 * The backoff wording has a job beyond politeness: it has to stop the user
 * concluding the import is broken and deleting it. So it says plainly that
 * retries continue, and that doing the one-time login is what stops this
 * recurring — both true, and neither visible from the error message alone.
 */
export function explainAuthBlock(kind: FailureKind, ctx: ExplainContext): Explanation {
	// Sentence-initial when there is no task name to lead with, so the opening
	// doesn't read as "your LinkedIn import hasn't been able to…".
	const what = ctx.taskLabel
		? `“${ctx.taskLabel}” on ${ctx.platform}`
		: `Your ${ctx.platform} import`;
	const everyN =
		ctx.retryInHours && ctx.retryInHours % 24 === 0
			? `every ${ctx.retryInHours / 24} days`
			: 'less often';

	// Deliberately vague about the remedy — each kind's own paragraph names it,
	// and an opening that says "until someone confirms the login" would
	// contradict the credentials case, where the fix is a password and no
	// manual run at all.
	const opening = ctx.disabled
		? `Switched off ${ctx.taskLabel ? what : `your ${ctx.platform} import`}. It has been ` +
			`unable to log in for weeks, so it has stopped retrying — switch it back on once ` +
			`the login is sorted out.`
		: `${what} hasn't been able to log in for its last few scheduled runs. It will keep ` +
			`trying ${everyN} instead of daily, so nothing is lost — but it will keep failing ` +
			`until the login is sorted out.`;

	// "Run it once" is the whole instruction on purpose: a manual run works on
	// a paused *or* backed-off task, and a successful one clears the block
	// state by itself, so there is no second step to remember.
	const oneTimeRun =
		`Open the task and hit Run now, then complete the check in the browser window. ` +
		`${ctx.platform} remembers the device afterwards, so the scheduled runs go back to ` +
		`working on their own.`;

	const short = (blocked: string) =>
		ctx.disabled ? `Switched off — ${blocked}` : `Retrying less often — ${blocked}`;

	switch (kind) {
		case 'auth_verification': {
			const relay = ctx.relayAddress
				? ` If the check is a code sent by email, you can also forward ${ctx.platform}'s ` +
					`emails to ${ctx.relayAddress} and future runs will read the code themselves.`
				: '';
			return {
				title: `${ctx.platform} import can't log in — needs confirming`,
				message:
					`${opening}\n\n` +
					`${ctx.platform} is asking for an extra confirmation at login — an emailed code, ` +
					`a 2FA token, or a "is this really you?" device check — and a scheduled run has ` +
					`nobody to answer it.\n\n${oneTimeRun}${relay}`,
				statusMessage: short('login needs a one-time confirmation')
			};
		}
		case 'auth_credentials':
			return {
				title: `${ctx.platform} import can't log in — password rejected`,
				message:
					`${opening}\n\n` +
					`${ctx.platform} rejected the saved password. Update the stored credentials for ` +
					`this platform — no manual run needed for this one, the next scheduled run will ` +
					`pick up the new password.`,
				statusMessage: short('saved password was rejected')
			};
		case 'auth_captcha':
			return {
				title: `${ctx.platform} import can't log in — CAPTCHA at login`,
				message:
					`${opening}\n\n` +
					`${ctx.platform} is putting a CAPTCHA in front of the login and an unattended run ` +
					`can't solve one.\n\n${oneTimeRun}`,
				statusMessage: short('CAPTCHA blocking the login')
			};
		case 'auth_restricted':
			return {
				title: `${ctx.platform} import can't log in — account restricted`,
				message:
					`${opening}\n\n` +
					`${ctx.platform} says the account is restricted or flagged for unusual activity. ` +
					`That has to be sorted out with ${ctx.platform} directly — sign in there and ` +
					`follow whatever it asks for.`,
				statusMessage: short('platform account is restricted')
			};
		case 'auth_terms':
			return {
				title: `${ctx.platform} import can't log in — terms need accepting`,
				message:
					`${opening}\n\n` +
					`${ctx.platform} wants updated terms accepted before it will let anyone in.\n\n` +
					`${oneTimeRun}`,
				statusMessage: short('platform terms need accepting')
			};
		case 'auth_unknown':
		default:
			return {
				title: `${ctx.platform} import can't log in`,
				message:
					`${opening}\n\n` +
					`The login isn't going through and we couldn't work out why from the page. ` +
					`Run it once yourself and watch what ${ctx.platform} asks for — that will usually ` +
					`make it obvious, and it's worth telling us about if it isn't.`,
				statusMessage: short('repeated login failures')
			};
	}
}
