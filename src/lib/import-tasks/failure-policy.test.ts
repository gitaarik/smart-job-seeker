import { describe, expect, it } from 'vitest';
import {
	DEFAULT_AUTH_FAILURE_THRESHOLD,
	DEFAULT_BACKOFF_HOURS,
	DEFAULT_GIVE_UP_DAYS,
	backoffNextRun,
	decideAuthBlockRemedy,
	explainAuthBlock,
	type RunOutcome
} from './failure-policy';
import { classifyLegacyErrorMessage, type FailureKind } from './failure-kinds';

/**
 * Build a run list from a compact spec, newest-first — the order the policy
 * expects. `day` counts backwards from an arbitrary fixed date so the
 * timestamps are ordered and stable.
 */
function runs(
	...specs: Array<{
		status?: string;
		kind?: FailureKind | null;
		by?: string;
	}>
): RunOutcome[] {
	const base = Date.UTC(2026, 7, 16);
	return specs.map((s, i) => ({
		status: s.status ?? 'error',
		failure_kind: s.kind ?? null,
		triggered_by: s.by ?? 'scheduler',
		started_at: new Date(base - i * 86_400_000)
	}));
}

const authFail = { status: 'error', kind: 'auth_verification' as const };
const deviceFail = { status: 'error', kind: 'device_unavailable' as const };
const ok = { status: 'success' };
/** Fixture runs start at 2026-08-16 and go backwards a day at a time. */
const NOW = new Date(Date.UTC(2026, 7, 16, 12));

/** decideAuthBlockRemedy with a fixed clock, which every case wants. */
function decide(runs: RunOutcome[], opts: Record<string, unknown> = {}) {
	return decideAuthBlockRemedy(runs, { now: NOW, ...opts });
}

describe('decideAuthBlockRemedy', () => {
	it('acts after the threshold of consecutive unattended auth failures', () => {
		const v = decide(runs(authFail, authFail, authFail));
		expect(v).toMatchObject({
			act: 'backoff',
			kind: 'auth_verification',
			streak: 3,
			retryInHours: DEFAULT_BACKOFF_HOURS,
			notify: true
		});
	});

	it('holds off one short of the threshold', () => {
		const v = decide(runs(authFail, authFail));
		expect(v).toMatchObject({ act: 'none', why: 'below-threshold', streak: 2 });
	});

	it('does nothing without any runs', () => {
		expect(decide([])).toMatchObject({ act: 'none', why: 'no-runs' });
	});

	it('honours a custom threshold', () => {
		expect(decide(runs(authFail, authFail), { threshold: 2 }).act).toBe('backoff');
		expect(decide(runs(authFail, authFail, authFail), { threshold: 4 }).act).toBe('none');
	});

	describe('a working task is never switched off', () => {
		it('stops at the most recent success', () => {
			const v = decide(runs(ok, authFail, authFail, authFail, authFail));
			expect(v).toMatchObject({ act: 'none', why: 'recovered' });
		});

		it('but an older success only marks where the streak began', () => {
			// The regression that a green unit suite missed and replaying real
			// history caught: three fresh scheduled auth failures sitting on top
			// of a working fortnight is precisely the situation this feature
			// exists for, and reading the success underneath them as "recovered"
			// made it evaluate as healthy. Dev task 66, verbatim.
			const v = decide(runs(authFail, authFail, authFail, ok, ok, ok));
			expect(v).toMatchObject({ act: 'backoff', streak: 3 });
		});

		it('counts a partial as working — the run got in, it just found nothing', () => {
			const v = decide(runs({ status: 'partial' }, authFail, authFail, authFail));
			expect(v).toMatchObject({ act: 'none', why: 'recovered' });
		});

		it('accepts a hand-triggered success as proof, same as a scheduled one', () => {
			const v = decide(runs({ status: 'success', by: 'user' }, authFail, authFail, authFail));
			expect(v).toMatchObject({ act: 'none', why: 'recovered' });
		});

		it('never fires on the alternating pattern that made this hard', () => {
			// Preview task 27, 2026-08-01..10 verbatim: the platform re-checks
			// the device every couple of days and someone clears it, so the
			// longest streak is 1. A "has it failed on auth lately" rule would
			// have switched this task off six times over.
			const v = decide(
				runs(ok, authFail, ok, authFail, ok, authFail, ok, authFail, ok, ok, ok, ok)
			);
			expect(v).toMatchObject({ act: 'none', why: 'recovered' });
			expect(DEFAULT_AUTH_FAILURE_THRESHOLD).toBeGreaterThan(1);
		});
	});

	describe('only unambiguous streaks count', () => {
		it('refuses when a non-auth cause interrupts the recent failures', () => {
			// A platform that was down is not a login problem, and "go complete
			// your login" would be the wrong instruction. It bounds the streak at
			// 2, which is below the threshold, so nothing is disabled. (An
			// offline *device* is a different kind now and deliberately does not
			// bound — see the device_unavailable cases.)
			const v = decide(
				runs(authFail, authFail, { kind: 'platform_unreachable' }, authFail, authFail, authFail)
			);
			expect(v).toMatchObject({ act: 'none', streak: 2, why: 'below-threshold' });
		});

		it('reports the interrupting cause when it leaves no streak at all', () => {
			const v = decide(runs({ kind: 'platform_unreachable' }, authFail, authFail));
			expect(v).toMatchObject({
				act: 'none',
				streak: 0,
				why: 'other-failure',
				kind: 'platform_unreachable'
			});
		});

		it('ignores a non-auth failure that has scrolled off beneath a full streak', () => {
			// Old news. The three runs since are unambiguous on their own.
			const v = decide(runs(authFail, authFail, authFail, { kind: 'platform_unreachable' }));
			expect(v).toMatchObject({ act: 'backoff', streak: 3 });
		});

		it('refuses an unclassified failure rather than assuming', () => {
			const v = decide(runs(authFail, { kind: null }, authFail, authFail));
			expect(v).toMatchObject({ act: 'none', streak: 1, why: 'below-threshold' });
		});

		it('steps over infrastructure failures without counting or clearing them', () => {
			const v = decide(runs(authFail, { kind: 'infrastructure' }, authFail, authFail));
			expect(v.act).toBe('backoff');
			expect(v.streak).toBe(3);
		});

		it('steps over cancelled and in-flight runs', () => {
			const v = decide(
				runs(
					{ status: 'queued' },
					{ status: 'cancelled' },
					authFail,
					authFail,
					{ status: 'cancelled' },
					authFail
				)
			);
			expect(v.act).toBe('backoff');
			expect(v.streak).toBe(3);
		});

		it('ignores failures a person watched happen', () => {
			// Someone sitting in front of a failing run already knows; the case
			// for switching a task off is that nobody is looking.
			const v = decide(runs({ ...authFail, by: 'user' }, { ...authFail, by: 'user' }, authFail));
			expect(v).toMatchObject({ act: 'none', streak: 1, why: 'below-threshold' });
		});
	});

	describe('which cause gets explained', () => {
		it('picks the most common kind in the streak', () => {
			const v = decide(
				runs({ kind: 'auth_captcha' }, { kind: 'auth_verification' }, { kind: 'auth_verification' })
			);
			expect(v.kind).toBe('auth_verification');
		});

		it('breaks a tie toward the most recent', () => {
			const v = decide(
				runs({ kind: 'auth_captcha' }, { kind: 'auth_verification' }, { kind: 'auth_captcha' })
			);
			expect(v.kind).toBe('auth_captcha');
		});

		it('passes over auth_unknown when anything specific is present', () => {
			// Preview task 63's streak verbatim: three device checks, one
			// unrecognised page, one emailed code. It is a device-check problem,
			// and "we could not work out why" would be a worse thing to send.
			const v = decide(
				runs(
					{ kind: 'auth_verification' },
					{ kind: 'auth_unknown' },
					{ kind: 'auth_verification' },
					{ kind: 'auth_verification' }
				)
			);
			expect(v.kind).toBe('auth_verification');
		});

		it('falls back to auth_unknown when that is all there is', () => {
			const v = decide(
				runs({ kind: 'auth_unknown' }, { kind: 'auth_unknown' }, { kind: 'auth_unknown' })
			);
			expect(v).toMatchObject({ act: 'backoff', kind: 'auth_unknown' });
		});
	});

	it('reports when the streak began, not when it was noticed', () => {
		const v = decide(runs(authFail, authFail, authFail));
		expect(v.act !== 'none' && v.since).toEqual(new Date(Date.UTC(2026, 7, 14)));
	});

	describe('notifying once per episode', () => {
		it('speaks up when nothing has been said yet', () => {
			const v = decide(runs(authFail, authFail, authFail), { notifiedAt: null });
			expect(v.act !== 'none' && v.notify).toBe(true);
		});

		it('stays quiet on later runs of the same episode', () => {
			// The stamp postdates the streak's start, so it was about this block.
			const v = decide(runs(authFail, authFail, authFail, authFail), {
				notifiedAt: new Date(Date.UTC(2026, 7, 15))
			});
			expect(v.act !== 'none' && v.notify).toBe(false);
		});

		it('speaks up again for a block that starts after the last one was announced', () => {
			// A stamp from an earlier block is stale by construction — whatever
			// streak produced it was ended by a success. Without this the second
			// time a platform challenges a device would pass in silence.
			const v = decide(runs(authFail, authFail, authFail), {
				notifiedAt: new Date(Date.UTC(2026, 6, 1))
			});
			expect(v.act !== 'none' && v.notify).toBe(true);
		});
	});

	describe('giving up', () => {
		const old = (days: number) => new Date(Date.UTC(2026, 7, 16) - days * 86_400_000);

		it('keeps retrying for as long as blocks are observed to heal', () => {
			// The longest block observed healing unattended took 16 days, so a
			// fortnight in, retrying is still the right call.
			const v = decide(
				runs(authFail, authFail, authFail).map((r, i) => ({
					...r,
					started_at: i === 2 ? old(14) : r.started_at
				}))
			);
			expect(v.act).toBe('backoff');
		});

		it('switches the task off once the block outlasts anything that heals', () => {
			const v = decide(
				runs(authFail, authFail, authFail).map((r, i) => ({
					...r,
					started_at: i === 2 ? old(DEFAULT_GIVE_UP_DAYS + 1) : r.started_at
				}))
			);
			expect(v).toMatchObject({ act: 'disable', kind: 'auth_verification' });
		});
	});

	it('arms on every auth kind and on no other kind', () => {
		const authKinds: FailureKind[] = [
			'auth_verification',
			'auth_credentials',
			'auth_captcha',
			'auth_restricted',
			'auth_terms',
			'auth_unknown'
		];
		for (const kind of authKinds) {
			expect(decide(runs({ kind }, { kind }, { kind })).act).toBe('backoff');
		}
		// Not an auth failure, but the same futility: no unattended retry can
		// bring a switched-off machine back, so it arms the same policy.
		expect(decide(runs(deviceFail, deviceFail, deviceFail)).act).toBe('backoff');
		const otherKinds: FailureKind[] = [
			'platform_unreachable',
			'automation_error',
			'interaction_failed',
			'timeout',
			'browser_disconnected',
			'access_denied',
			'llm_unavailable',
			'unknown'
		];
		for (const kind of otherKinds) {
			expect(decide(runs({ kind }, { kind }, { kind })).act).toBe('none');
		}
	});
});

describe('explainAuthBlock', () => {
	const ctx = { platform: 'LinkedIn', taskLabel: 'Senior TypeScript' };

	describe('device_unavailable', () => {
		it('does not tell the user their login is broken', () => {
			// The whole point of the kind. Every other case here is a login
			// problem, and sending someone to fix a login when their NAS is off
			// is the mis-telling this replaced — for months these runs reported
			// "Could not connect to platform", which blames the job site.
			const e = explainAuthBlock('device_unavailable', ctx);
			expect(e.title).not.toMatch(/log ?in/i);
			expect(e.message).not.toMatch(/complete the check|password/i);
			expect(e.message).toMatch(/your own machine/i);
		});

		it('names the device when one is known, and stays useful when not', () => {
			const named = explainAuthBlock('device_unavailable', {
				...ctx,
				deviceLabel: 'Lightpunks NAS'
			});
			expect(named.message).toContain('Lightpunks NAS');

			const unnamed = explainAuthBlock('device_unavailable', ctx);
			expect(unnamed.message).toContain('the device it scrapes with');
		});

		it('says nothing is lost while it retries, and what changes when it stops', () => {
			const backing_off = explainAuthBlock('device_unavailable', { ...ctx, retryInHours: 72 });
			expect(backing_off.message).toMatch(/every 3 days/);
			expect(backing_off.statusMessage).toMatch(/^Retrying less often/);

			const off = explainAuthBlock('device_unavailable', { ...ctx, disabled: true });
			expect(off.message).toMatch(/switch the task back on/i);
			expect(off.statusMessage).toMatch(/^Switched off/);
		});
	});

	it('names the task in the title, not just the platform', () => {
		// Titles used to carry the platform alone, so several blocked tasks on
		// one platform produced byte-identical notifications and the only thing
		// telling them apart sat in the body.
		const a = explainAuthBlock('auth_verification', ctx);
		const b = explainAuthBlock('auth_verification', { ...ctx, taskLabel: 'Rust, Berlin' });
		expect(a.title).toContain('LinkedIn');
		expect(a.title).toContain('Senior TypeScript');
		expect(a.title).not.toBe(b.title);
		expect(a.message).toContain('Senior TypeScript');
	});

	it('keeps the reason visible when the task name is enormous', () => {
		// search_term and note are 500-char columns and the title is 200, so an
		// untruncated label would push the part that says what went wrong off
		// the end of the notification.
		const e = explainAuthBlock('auth_verification', {
			...ctx,
			taskLabel: 'Senior '.repeat(60).trim()
		});
		expect(e.title.length).toBeLessThanOrEqual(200);
		expect(e.title).toContain('needs confirming');
		expect(e.title).toContain('LinkedIn');
	});

	it('survives a task with no label, capitalised where the sentence starts', () => {
		const backoff = explainAuthBlock('auth_verification', { ...ctx, taskLabel: null });
		expect(backoff.message.startsWith('Your LinkedIn import')).toBe(true);
		const off = explainAuthBlock('auth_verification', {
			...ctx,
			taskLabel: null,
			disabled: true
		});
		expect(off.message).toContain('Switched off your LinkedIn import');
	});

	it('leaves the remedy to the paragraph that knows it', () => {
		// The opening is shared, so it must not name a fix. Saying "until
		// someone confirms the login" there contradicted the credentials case,
		// where the fix is a password and there is nothing to confirm.
		const e = explainAuthBlock('auth_credentials', ctx);
		expect(e.message).toContain('until the login is sorted out');
		expect(e.message).not.toContain('confirms the login');
	});

	it('offers the relay only where forwarding mail is actually the fix', () => {
		const relayAddress = 'verify-1c36b3b0@smartjobseeker.com';
		expect(explainAuthBlock('auth_verification', { ...ctx, relayAddress }).message).toContain(
			relayAddress
		);
		expect(explainAuthBlock('auth_captcha', { ...ctx, relayAddress }).message).not.toContain(
			relayAddress
		);
	});

	it('tells the credentials case to change a password, not to run anything', () => {
		const e = explainAuthBlock('auth_credentials', ctx);
		expect(e.message).toContain('password');
		expect(e.message).toContain('no manual run needed');
	});

	it('tells the passkey case the fix is on the platform, and that the password is fine', () => {
		// The failure looks exactly like a rejected password from the platform's
		// side — the form submits empty because the browser's own passkey dialog
		// took the keystrokes — so this has to say outright that the stored
		// password is not the problem, or the user changes a working one.
		const e = explainAuthBlock('auth_passkey', ctx);
		expect(e.message).toContain('passkey');
		expect(e.message).toContain('the stored one is fine, leave it alone');
		expect(e.message).toContain('remove the passkeys registered on your LinkedIn account');
		// The shared "complete the check" instruction belongs to the challenge
		// kinds; there is no challenge here, only a dialog to dismiss.
		expect(e.message).toContain('dismiss the passkey dialog');
		expect(e.message).not.toContain('complete the check');
	});

	it('keeps every status message inside the 255-char column', () => {
		const kinds: FailureKind[] = [
			'auth_verification',
			'auth_credentials',
			'auth_captcha',
			'auth_restricted',
			'auth_terms',
			'auth_passkey',
			'auth_unknown'
		];
		for (const kind of kinds) {
			const e = explainAuthBlock(kind, {
				platform: 'A'.repeat(80),
				taskLabel: 'B'.repeat(80)
			});
			expect(e.statusMessage.length).toBeLessThanOrEqual(255);
			expect(e.title.length).toBeLessThanOrEqual(200);
		}
	});
});

describe('classifyLegacyErrorMessage', () => {
	// The left-hand strings are copied out of preview and dev, not invented.
	const cases: Array<[string, FailureKind | null]> = [
		['Platform login failed — Email verification required — check your email', 'auth_verification'],
		['Platform login failed — security-question', 'auth_verification'],
		['Platform login failed — No password field found', 'auth_unknown'],
		[
			'Platform login failed — Automation error during login (not a credentials/page issue): Proxy timeout',
			'automation_error'
		],
		['Login failed — Invalid password', 'auth_credentials'],
		['Could not connect to platform', 'platform_unreachable'],
		// Tunnel failures, which the live classifier used to file under
		// platform_unreachable because the sentence contains "connection".
		['Tunnel connection timeout — device not connected (waited 120000ms)', 'device_unavailable'],
		['Tunnel device connection is not open', 'device_unavailable'],
		['Desktop scraper timed out after 1200000ms (likely a dead tunnel)', 'device_unavailable'],
		['Could not fill the search form', 'interaction_failed'],
		['An unexpected error occurred', 'unknown'],
		['Request timed out', 'timeout'],
		['Local browser disconnected', 'browser_disconnected'],
		['Worker shutdown - job interrupted', 'infrastructure'],
		['Worker restarted', 'infrastructure'],
		['Stuck in queue (no worker pickup)', 'infrastructure'],
		// Were null until the live classifier grew a branch for them; they are
		// the automation library throwing, not an unrecognised failure.
		['uncaught: Assertion error', 'automation_error'],
		['Patchright CDP assertion: Assertion error', 'automation_error'],
		[null as unknown as string, null]
	];

	for (const [message, expected] of cases) {
		it(`${message ?? '(null)'} → ${expected ?? 'null'}`, () => {
			expect(classifyLegacyErrorMessage(message)).toBe(expected);
		});
	}

	it('leaves an unrecognised message unclassified rather than guessing', () => {
		// A guessed `unknown` would be indistinguishable from a real one and
		// would count as a streak-breaking failure on a task, which is a
		// decision it has no business making.
		expect(classifyLegacyErrorMessage('Something nobody has seen before')).toBeNull();
	});
});

describe('backoffNextRun', () => {
	const now = new Date(Date.UTC(2026, 7, 16, 20, 0));

	it('keeps the task’s time of day by advancing whole days', () => {
		// The scheduler already stamped next_scheduled_run at the user's
		// preferred hour; moving it in day steps preserves that without this
		// module knowing anything about timezones.
		const next = new Date(Date.UTC(2026, 7, 17, 9, 0));
		const out = backoffNextRun(next, now, 72);
		expect(out.toISOString()).toBe('2026-08-20T09:00:00.000Z');
	});

	it('lands at or beyond the requested delay, never before', () => {
		const next = new Date(Date.UTC(2026, 7, 17, 9, 0));
		for (const hours of [24, 48, 72, 168]) {
			const out = backoffNextRun(next, now, hours);
			expect(out.getTime()).toBeGreaterThanOrEqual(now.getTime() + hours * 3_600_000);
			expect(out.getUTCHours()).toBe(9);
		}
	});

	it('leaves an already-distant stamp alone', () => {
		const far = new Date(Date.UTC(2026, 8, 1, 9, 0));
		expect(backoffNextRun(far, now, 72)).toEqual(far);
	});

	it('falls back to a plain offset with nothing to advance', () => {
		expect(backoffNextRun(null, now, 72).toISOString()).toBe('2026-08-19T20:00:00.000Z');
	});
});
