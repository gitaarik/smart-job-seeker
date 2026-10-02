/**
 * Tests for the order the pipeline lists put applications in.
 *
 * The one that matters most is `unsent draft beats idle negotiation`: it is the
 * deliberate departure from "furthest along on top", and it is the case that
 * makes the tiers worth having rather than a plain stage sort. If that test
 * ever has to be changed to make something else pass, the something else is
 * wrong.
 */
import { describe, expect, it } from 'vitest';
import type { InterviewRound } from '$lib/application-status';
import {
	applicationTier,
	compareApplications,
	daysQuiet,
	defaultSort,
	followUpAfterDays,
	isFollowUpDue,
	isSortKey,
	sortApplications,
	stageRank,
	tiers,
	type Rankable
} from '$lib/application-ranking';

const DAY = '2026-09-06';

let nextId = 1;

function app(over: Partial<Rankable> = {}): Rankable {
	return {
		id: nextId++,
		status: 'applying',
		status_step: null,
		interview_rounds: null,
		snoozed_until: null,
		application_sent_date: null,
		last_activity: null,
		date_created: new Date('2026-01-01'),
		...over
	};
}

/** A sent application whose last activity was `days` before DAY. */
function quietFor(days: number, over: Partial<Rankable> = {}): Rankable {
	const at = new Date(Date.parse(`${DAY}T00:00:00Z`) - days * 86_400_000);
	return app({
		status: 'applying',
		status_step: 'Applied',
		application_sent_date: '2026-01-05',
		last_activity: at,
		...over
	});
}

function round(over: Partial<InterviewRound> = {}): InterviewRound {
	return { kind: null, date: null, time: null, with: null, ...over };
}

/** In interviewing, at round `n` (1-based), which is behind them: waiting on the result. */
function interviewed(n = 1): Partial<Rankable> {
	return {
		status: 'interviewing',
		interview_rounds: Array.from({ length: n }, (_, i) => round({ date: `2026-08-0${i + 1}` }))
	};
}

/** In interviewing, with round 1 booked on `date` (at `time`), still ahead of DAY. */
function booked(date: string, time: string | null = null): Partial<Rankable> {
	return { status: 'interviewing', interview_rounds: [round({ date, time })] };
}

/** In interviewing, invited to round 1 and not yet booked. */
const invited: Partial<Rankable> = { status: 'interviewing', interview_rounds: [round()] };

/** Ids in the order they come back, so expectations read as a sequence. */
function order(apps: Rankable[]): number[] {
	return sortApplications(apps, defaultSort, DAY).map((a) => a.id);
}

describe('applicationTier', () => {
	it('puts a next step of yours in the top tier', () => {
		expect(applicationTier(app({ status_step: 'Preparing' }), DAY)).toBe(tiers.action);
		expect(applicationTier(app(invited), DAY)).toBe(tiers.action);
		expect(applicationTier(app(booked('2026-09-10')), DAY)).toBe(tiers.action);
	});

	// Each with something from yesterday, so none of them has gone quiet: that is
	// the tier a waiting application crosses into, and these are about the line
	// between yours and theirs.
	it('treats a step that waits on the employer as waiting', () => {
		expect(applicationTier(quietFor(1), DAY)).toBe(tiers.waiting);
		expect(applicationTier(quietFor(1, interviewed(2)), DAY)).toBe(tiers.waiting);
		expect(
			applicationTier(
				quietFor(1, { status: 'negotiating', status_step: 'Counter-offer sent' }),
				DAY
			)
		).toBe(tiers.waiting);
	});

	it('treats a stage it does not know as waiting, not as needing you', () => {
		const custom = quietFor(1, { status: 'negotiating', status_step: 'Coffee with the CEO' });
		expect(applicationTier(custom, DAY)).toBe(tiers.waiting);
	});

	it('moves an interview from your move to theirs the day after it, on its own', () => {
		const interview = app({ ...booked('2026-09-08'), last_activity: '2026-09-05' });
		expect(applicationTier(interview, '2026-09-08')).toBe(tiers.action);
		expect(applicationTier(interview, '2026-09-09')).toBe(tiers.waiting);
	});

	it('keeps a snoozed application parked even with a step of yours open', () => {
		const parked = app({ status_step: 'Preparing', snoozed_until: '2026-10-01' });
		expect(applicationTier(parked, DAY)).toBe(tiers.snoozed);
	});

	it('ignores an elapsed snooze', () => {
		const back = app({ status_step: 'Preparing', snoozed_until: '2026-09-01' });
		expect(applicationTier(back, DAY)).toBe(tiers.action);
	});

	it('sinks a finished application whatever its stage still says', () => {
		for (const status of ['accepted', 'rejected', 'withdrawn']) {
			const done = app({ status, status_step: 'Preparing', interview_rounds: [round()] });
			expect(applicationTier(done, DAY)).toBe(tiers.finished);
		}
	});
});

describe('isFollowUpDue', () => {
	it('stays quiet inside the phase window and fires once past it', () => {
		expect(isFollowUpDue(quietFor(followUpAfterDays.applying - 1), DAY)).toBe(false);
		expect(isFollowUpDue(quietFor(followUpAfterDays.applying), DAY)).toBe(true);
	});

	it('gives each phase its own patience', () => {
		// 8 days of silence: ordinary after applying, overdue after an interview.
		expect(isFollowUpDue(quietFor(8), DAY)).toBe(false);
		expect(isFollowUpDue(quietFor(8, interviewed()), DAY)).toBe(true);
	});

	it('never nudges an unsent draft, which is in the top tier instead', () => {
		// Nobody to follow up with: the draft's next step is to send it.
		const draft = quietFor(90, { status_step: 'Preparing', application_sent_date: null });

		expect(isFollowUpDue(draft, DAY)).toBe(false);
		expect(applicationTier(draft, DAY)).toBe(tiers.action);
	});

	it('treats an old row with no applied date as sent once it is past Preparing', () => {
		const legacy = quietFor(30, { application_sent_date: null });
		expect(isFollowUpDue(legacy, DAY)).toBe(true);
	});

	it('does not argue with a snooze', () => {
		const parked = quietFor(90, { snoozed_until: '2026-12-01' });
		expect(isFollowUpDue(parked, DAY)).toBe(false);
		expect(applicationTier(parked, DAY)).toBe(tiers.snoozed);
	});

	it('does not nudge something that is already your move', () => {
		const yours = quietFor(90, invited);
		expect(isFollowUpDue(yours, DAY)).toBe(false);
		expect(applicationTier(yours, DAY)).toBe(tiers.action);
	});

	it('does not nudge a finished application', () => {
		expect(isFollowUpDue(quietFor(90, { status: 'rejected' }), DAY)).toBe(false);
	});
});

describe('daysQuiet', () => {
	it('counts whole days, not 24-hour periods', () => {
		const lateYesterday = app({ last_activity: '2026-09-05T23:30:00Z' });
		expect(daysQuiet(lateYesterday, DAY)).toBe(1);
	});

	it('falls back to the creation date', () => {
		expect(daysQuiet(app({ last_activity: null, date_created: new Date(DAY) }), DAY)).toBe(0);
	});

	it('answers null rather than 0 when there is nothing to count from', () => {
		expect(daysQuiet(app({ last_activity: null, date_created: null }), DAY)).toBeNull();
	});
});

describe('stageRank', () => {
	it('orders the phases without letting them interleave', () => {
		// The last step of a phase still sits below the first step of the next.
		expect(stageRank(app({ status_step: 'Applied' }), DAY)).toBeLessThan(
			stageRank(app(invited), DAY)
		);
		expect(stageRank(app(interviewed(5)), DAY)).toBeLessThan(
			stageRank(app({ status: 'negotiating', status_step: 'Offer received' }), DAY)
		);
	});

	it('refines interviewing by the round reached, so a third interview outranks a first', () => {
		expect(stageRank(app(interviewed(3)), DAY)).toBeGreaterThan(
			stageRank(app(interviewed(1)), DAY)
		);
	});

	it('counts the round the application is at, not every round booked', () => {
		// Two rounds booked at once: the application is at the first of them.
		const twoBooked = app({
			status: 'interviewing',
			interview_rounds: [
				round({ date: '2026-08-01' }),
				round({ date: '2026-09-08' }),
				round({ date: '2026-09-10' })
			]
		});
		expect(stageRank(twoBooked, DAY)).toBe(stageRank(app(interviewed(2)), DAY));
	});

	it('refines the other phases by the stage', () => {
		expect(
			stageRank(app({ status: 'negotiating', status_step: 'Contract review' }), DAY)
		).toBeGreaterThan(
			stageRank(app({ status: 'negotiating', status_step: 'Offer received' }), DAY)
		);
	});

	it('maps the legacy statuses through the stepper phases', () => {
		expect(stageRank(app({ status: 'sent' }), DAY)).toBe(
			stageRank(app({ status: 'applying' }), DAY)
		);
		expect(stageRank(app({ status: 'preparing' }), DAY)).toBe(
			stageRank(app({ status: 'applying' }), DAY)
		);
		expect(stageRank(app({ status: 'offered' }), DAY)).toBe(
			stageRank(app({ status: 'negotiating' }), DAY)
		);
	});

	it('scores an unlisted step at the start of its phase, not the end', () => {
		const custom = stageRank(
			app({ status: 'negotiating', status_step: 'Coffee with the CEO' }),
			DAY
		);
		expect(custom).toBe(
			stageRank(app({ status: 'negotiating', status_step: 'Offer received' }), DAY)
		);
		// Inside its own phase at either end, never spilling into a neighbouring one.
		expect(custom).toBeLessThan(
			stageRank(app({ status: 'negotiating', status_step: 'Counter-offer sent' }), DAY)
		);
		expect(custom).toBeGreaterThan(stageRank(app(interviewed(9)), DAY));
	});
});

describe('the tiers', () => {
	it('unsent draft beats idle negotiation', () => {
		// The whole reason stage is the second key and not the first: a negotiation
		// waiting on the employer needs nothing today, and the draft nobody has
		// sent is the only row with work outstanding.
		const draft = app({ status: 'applying', status_step: 'Preparing' });
		const negotiating = app({ status: 'negotiating', status_step: 'Counter-offer sent' });

		expect(order([negotiating, draft])).toEqual([draft.id, negotiating.id]);
	});

	it('orders the five tiers', () => {
		const finished = app({ status: 'rejected' });
		const snoozed = app({ ...invited, snoozed_until: '2026-10-01' });
		const waiting = quietFor(2, interviewed());
		const quiet = quietFor(40);
		const needsYou = app({ status: 'applying', status_step: 'Preparing' });

		expect(order([finished, snoozed, waiting, quiet, needsYou])).toEqual([
			needsYou.id,
			quiet.id,
			waiting.id,
			snoozed.id,
			finished.id
		]);
	});

	it('lifts a stale application above a fresher one further along', () => {
		// The inversion the quiet tier exists for. Under a plain stage sort the
		// interview wins; but it is two days into a normal wait and needs nothing,
		// while the application has heard nothing for six weeks.
		const freshInterview = quietFor(2, interviewed());
		const staleApplication = quietFor(42);

		expect(order([freshInterview, staleApplication])).toEqual([
			staleApplication.id,
			freshInterview.id
		]);
	});

	it('orders the quiet tier longest-silent first, inverting the waiting tier', () => {
		const quieter = quietFor(60);
		const quiet = quietFor(20);

		expect(order([quiet, quieter])).toEqual([quieter.id, quiet.id]);

		// The same two facts, one side of the threshold down, come back the other
		// way round: nothing is owed, so recent activity leads.
		const recent = quietFor(3);
		const older = quietFor(10);
		expect(order([older, recent])).toEqual([recent.id, older.id]);
	});

	it('still ranks stage above silence inside the quiet tier', () => {
		const longQuietApplication = quietFor(60);
		const shortQuietInterview = quietFor(10, interviewed());

		expect(order([longQuietApplication, shortQuietInterview])).toEqual([
			shortQuietInterview.id,
			longQuietApplication.id
		]);
	});

	it('keeps drafts from squatting above an interview inside the top tier', () => {
		const draft = app({ status: 'applying', status_step: 'Preparing' });
		const interview = app(invited);

		expect(order([draft, interview])).toEqual([interview.id, draft.id]);
	});

	it('orders the top tier by booking once the stage ties, soonest first', () => {
		const later = app(booked('2026-09-20'));
		const sooner = app(booked('2026-09-08', '14:00'));
		const soonest = app(booked('2026-09-08', '09:30'));
		const unbooked = app(invited);

		expect(order([unbooked, later, sooner, soonest])).toEqual([
			soonest.id,
			sooner.id,
			later.id,
			unbooked.id
		]);
	});

	it('orders the waiting tier by stage, then by last activity', () => {
		// All three inside their phase windows, so none of them has crossed into
		// the quiet tier and stage still leads.
		const olderInterview = quietFor(5, interviewed());
		const newerInterview = quietFor(1, interviewed());
		const newerApplying = quietFor(1);

		expect(order([olderInterview, newerApplying, newerInterview])).toEqual([
			newerInterview.id,
			olderInterview.id,
			newerApplying.id
		]);
	});

	it('sinks the quieter of two applications while nothing is owed', () => {
		// Rik's case, on the near side of the threshold: nothing has happened on
		// either, neither is overdue a nudge yet, so the staler one goes down.
		// Past the threshold this order inverts; see the quiet-tier tests.
		const silent = quietFor(10);
		const replied = quietFor(1);

		expect(order([silent, replied])).toEqual([replied.id, silent.id]);
	});

	it('brings the soonest-returning snooze back first', () => {
		const later = app({ status: 'applying', snoozed_until: '2026-12-01' });
		const sooner = app({ status: 'applying', snoozed_until: '2026-09-10' });

		expect(order([later, sooner])).toEqual([sooner.id, later.id]);
	});

	it('orders finished applications by last activity alone', () => {
		const old = app({ status: 'rejected', last_activity: new Date('2026-03-01') });
		const recent = app({ status: 'accepted', last_activity: new Date('2026-09-01') });

		expect(order([old, recent])).toEqual([recent.id, old.id]);
	});
});

describe('last activity', () => {
	it('falls back to the creation date when nothing has been derived', () => {
		// Two unsent drafts: the same tier and stage, so activity decides.
		const older = app({ last_activity: null, date_created: new Date('2026-05-01') });
		const newer = app({ last_activity: null, date_created: new Date('2026-08-01') });

		expect(order([older, newer])).toEqual([newer.id, older.id]);
	});

	it('accepts a date string as well as a Date', () => {
		const a = quietFor(1, { last_activity: '2026-09-05' });
		const b = quietFor(3, { last_activity: '2026-09-03' });

		expect(order([b, a])).toEqual([a.id, b.id]);
	});
});

describe('stability', () => {
	it('breaks a total tie deterministically, newest id first', () => {
		const first = app({ status_step: 'Applied' });
		const second = app({ status_step: 'Applied' });

		expect(compareApplications(first, second, DAY)).toBeGreaterThan(0);
		expect(order([first, second])).toEqual([second.id, first.id]);
	});

	it('does not reorder the input array', () => {
		const rows = [app({ status: 'rejected' }), app({ status_step: 'Preparing' })];
		const before = rows.map((r) => r.id);

		sortApplications(rows, defaultSort, DAY);

		expect(rows.map((r) => r.id)).toEqual(before);
	});
});

describe('the other orders', () => {
	it('sorts by last activity, ignoring the tiers', () => {
		const finishedButRecent = app({ status: 'rejected', last_activity: new Date('2026-09-05') });
		const liveButStale = app({ ...invited, last_activity: new Date('2026-04-05') });

		const ids = sortApplications([liveButStale, finishedButRecent], 'activity', DAY).map(
			(a) => a.id
		);
		expect(ids).toEqual([finishedButRecent.id, liveButStale.id]);
	});

	it('sorts by creation date, newest first', () => {
		const old = app({ date_created: new Date('2026-01-01') });
		const recent = app({ date_created: new Date('2026-09-01') });

		const ids = sortApplications([old, recent], 'created', DAY).map((a) => a.id);
		expect(ids).toEqual([recent.id, old.id]);
	});

	it('recognises only the orders it offers', () => {
		expect(isSortKey('smart')).toBe(true);
		expect(isSortKey('activity')).toBe(true);
		expect(isSortKey('created')).toBe(true);
		expect(isSortKey('date_updated')).toBe(false);
		expect(isSortKey(null)).toBe(false);
	});
});
