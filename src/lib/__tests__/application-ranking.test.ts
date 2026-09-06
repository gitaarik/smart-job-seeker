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
	defaultSort,
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
		last_activity: null,
		date_created: new Date('2026-01-01'),
		...over
	};
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

	it('orders the four tiers', () => {
		const finished = app({ status: 'rejected' });
		const snoozed = app({ status: 'interviewing', snoozed_until: '2026-10-01' });
		const waiting = app({ status: 'interviewing', status_action: 'Awaiting result' });
		const needsYou = app({ status: 'applying', status_action: 'Send application' });

		expect(order([finished, snoozed, waiting, needsYou])).toEqual([
			needsYou.id,
			waiting.id,
			snoozed.id,
			finished.id
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
		const staleInterview = app({
			status: 'interviewing',
			status_action: 'Awaiting result',
			last_activity: new Date('2026-07-01')
		});
		const freshInterview = app({
			status: 'interviewing',
			status_action: 'Awaiting result',
			last_activity: new Date('2026-09-04')
		});
		const freshApplying = app({
			status: 'applying',
			status_action: 'Awaiting response',
			last_activity: new Date('2026-09-05')
		});

		expect(order([staleInterview, freshApplying, freshInterview])).toEqual([
			freshInterview.id,
			staleInterview.id,
			freshApplying.id
		]);
	});

	it('sends the long-silent application to the bottom of its stage', () => {
		// Rik's case: applied weeks ago, nothing since.
		const silent = app({
			status: 'applying',
			status_action: 'Awaiting response',
			last_activity: new Date('2026-07-15')
		});
		const replied = app({
			status: 'applying',
			status_action: 'Awaiting response',
			last_activity: new Date('2026-09-05')
		});

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
		const a = app({ status_action: 'Awaiting response', last_activity: '2026-09-05' });
		const b = app({ status_action: 'Awaiting response', last_activity: '2026-06-05' });

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
