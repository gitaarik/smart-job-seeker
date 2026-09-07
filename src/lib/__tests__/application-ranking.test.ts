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
		status_action: null,
		status_action_date: null,
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
		status_step: 'Applied through job platform',
		status_action: 'Awaiting response',
		application_sent_date: '2026-01-05',
		last_activity: at,
		...over
	});
}

/** Ids in the order they come back, so expectations read as a sequence. */
function order(apps: Rankable[]): number[] {
	return sortApplications(apps, defaultSort, DAY).map((a) => a.id);
}

describe('applicationTier', () => {
	it('puts an open non-waiting action in the top tier', () => {
		expect(applicationTier(app({ status_action: 'Send application' }), DAY)).toBe(tiers.action);
	});

	it('treats any "Awaiting…" action as waiting, listed or not', () => {
		expect(applicationTier(app({ status_action: 'Awaiting response' }), DAY)).toBe(tiers.waiting);
		expect(applicationTier(app({ status_action: 'Awaiting signed contract' }), DAY)).toBe(
			tiers.waiting
		);
	});

	it('treats no action at all as waiting, not as needing you', () => {
		expect(applicationTier(app({ status_action: null }), DAY)).toBe(tiers.waiting);
		expect(applicationTier(app({ status_action: '' }), DAY)).toBe(tiers.waiting);
	});

	it('keeps a snoozed application parked even with an open action', () => {
		const parked = app({ status_action: 'Send application', snoozed_until: '2026-10-01' });
		expect(applicationTier(parked, DAY)).toBe(tiers.snoozed);
	});

	it('ignores an elapsed snooze', () => {
		const back = app({ status_action: 'Send application', snoozed_until: '2026-09-01' });
		expect(applicationTier(back, DAY)).toBe(tiers.action);
	});

	it('sinks a finished application whatever its stale action column says', () => {
		for (const status of ['accepted', 'rejected', 'withdrawn']) {
			const done = app({ status, status_action: 'Send application' });
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
		const applying = quietFor(8);
		const interviewing = quietFor(8, {
			status: 'interviewing',
			status_step: 'Technical interview',
			status_action: 'Awaiting result'
		});

		expect(isFollowUpDue(applying, DAY)).toBe(false);
		expect(isFollowUpDue(interviewing, DAY)).toBe(true);
	});

	it('never nudges an unsent draft', () => {
		// Nobody to follow up with. The action column is cleared so it cannot
		// reach the top tier from the other side either.
		const draft = quietFor(90, {
			status_step: 'Preparing',
			status_action: null,
			application_sent_date: null
		});

		expect(isFollowUpDue(draft, DAY)).toBe(false);
		expect(applicationTier(draft, DAY)).toBe(tiers.waiting);
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
		const yours = quietFor(90, { status_action: 'Send application' });
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
		expect(stageRank('applying', 'Resume / CV submitted')).toBeLessThan(
			stageRank('interviewing', 'Screening call')
		);
		expect(stageRank('interviewing', 'Team interview')).toBeLessThan(
			stageRank('negotiating', 'Offer received')
		);
	});

	it('refines within a phase by the step', () => {
		expect(stageRank('interviewing', 'Hiring manager call')).toBeGreaterThan(
			stageRank('interviewing', 'Screening call')
		);
	});

	it('maps the legacy statuses through the stepper phases', () => {
		expect(stageRank('sent')).toBe(stageRank('applying'));
		expect(stageRank('preparing')).toBe(stageRank('applying'));
		expect(stageRank('offered')).toBe(stageRank('negotiating'));
	});

	it('scores an unlisted step at the start of its phase, not the end', () => {
		const custom = stageRank('interviewing', 'Coffee chat with the CTO');
		expect(custom).toBe(stageRank('interviewing', 'Screening call'));
		// Inside its own phase at either end, never spilling into a neighbouring one.
		expect(custom).toBeLessThan(stageRank('interviewing', 'Team interview'));
		expect(custom).toBeGreaterThan(stageRank('applying', 'Resume / CV submitted'));
	});
});

describe('the tiers', () => {
	it('unsent draft beats idle negotiation', () => {
		// The whole reason stage is the second key and not the first: three
		// negotiations waiting on the employer need nothing today, and the draft
		// nobody has sent is the only row with work outstanding.
		const draft = app({
			status: 'applying',
			status_step: 'Preparing',
			status_action: 'Send application'
		});
		const negotiating = app({
			status: 'negotiating',
			status_step: 'Offer received',
			status_action: 'Awaiting response'
		});

		expect(order([negotiating, draft])).toEqual([draft.id, negotiating.id]);
	});

	it('orders the five tiers', () => {
		const finished = app({ status: 'rejected' });
		const snoozed = app({ status: 'interviewing', snoozed_until: '2026-10-01' });
		const waiting = quietFor(2, {
			status: 'interviewing',
			status_step: 'Screening call',
			status_action: 'Awaiting result'
		});
		const quiet = quietFor(40);
		const needsYou = app({ status: 'applying', status_action: 'Send application' });

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
		const freshInterview = quietFor(2, {
			status: 'interviewing',
			status_step: 'Screening call',
			status_action: 'Awaiting result'
		});
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
		const shortQuietInterview = quietFor(10, {
			status: 'interviewing',
			status_step: 'Technical interview',
			status_action: 'Awaiting result'
		});

		expect(order([longQuietApplication, shortQuietInterview])).toEqual([
			shortQuietInterview.id,
			longQuietApplication.id
		]);
	});

	it('keeps drafts from squatting above an interview inside the top tier', () => {
		const draft = app({
			status: 'applying',
			status_step: 'Preparing',
			status_action: 'Send application'
		});
		const interview = app({
			status: 'interviewing',
			status_step: 'Technical interview',
			status_action: 'Need to schedule'
		});

		expect(order([draft, interview])).toEqual([interview.id, draft.id]);
	});

	it('orders the top tier by action date once the stage ties, overdue first', () => {
		const soon = app({
			status: 'interviewing',
			status_step: 'Screening call',
			status_action: 'Scheduled',
			status_action_date: '2026-09-20'
		});
		const overdue = app({
			status: 'interviewing',
			status_step: 'Screening call',
			status_action: 'Scheduled',
			status_action_date: '2026-08-20'
		});
		const undated = app({
			status: 'interviewing',
			status_step: 'Screening call',
			status_action: 'Need to schedule'
		});

		expect(order([undated, soon, overdue])).toEqual([overdue.id, soon.id, undated.id]);
	});

	it('orders the waiting tier by stage, then by last activity', () => {
		// All three inside their phase windows, so none of them has crossed into
		// the quiet tier and stage still leads.
		const olderInterview = quietFor(5, {
			status: 'interviewing',
			status_step: 'Screening call',
			status_action: 'Awaiting result'
		});
		const newerInterview = quietFor(1, {
			status: 'interviewing',
			status_step: 'Screening call',
			status_action: 'Awaiting result'
		});
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
		// Past the threshold this order inverts — see the quiet-tier tests.
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
		const older = app({
			status: 'applying',
			status_action: 'Awaiting response',
			last_activity: null,
			date_created: new Date('2026-05-01')
		});
		const newer = app({
			status: 'applying',
			status_action: 'Awaiting response',
			last_activity: null,
			date_created: new Date('2026-08-01')
		});

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
		const first = app({ status: 'applying', status_action: 'Awaiting response' });
		const second = app({ status: 'applying', status_action: 'Awaiting response' });

		expect(compareApplications(first, second, DAY)).toBeGreaterThan(0);
		expect(order([first, second])).toEqual([second.id, first.id]);
	});

	it('does not reorder the input array', () => {
		const rows = [app({ status: 'rejected' }), app({ status_action: 'Send application' })];
		const before = rows.map((r) => r.id);

		sortApplications(rows, defaultSort, DAY);

		expect(rows.map((r) => r.id)).toEqual(before);
	});
});

describe('the other orders', () => {
	it('sorts by last activity, ignoring the tiers', () => {
		const finishedButRecent = app({ status: 'rejected', last_activity: new Date('2026-09-05') });
		const liveButStale = app({
			status: 'interviewing',
			status_action: 'Need to schedule',
			last_activity: new Date('2026-04-05')
		});

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
