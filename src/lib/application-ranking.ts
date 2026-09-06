/**
 * The order applications come back in, for every list that shows more than one.
 *
 * ## Why "newest first" was the wrong default
 *
 * The pipeline list ordered by `date_created` and the home dashboard by
 * `date_updated`, which are both facts about the ROW rather than about the
 * application. Insertion order says nothing once there are more than a handful,
 * and the AI pipeline context had already invented a third order of its own.
 * Three answers to "which of these matters most" is two too many, so the rule
 * lives here and the readers call it.
 *
 * ## The rule
 *
 * Applications sort into four tiers, and the tier is the primary key:
 *
 *  0. **Needs you** — a next action that is not a waiting one.
 *  1. **In play** — still live, waiting on the employer.
 *  2. **Snoozed** — deliberately parked.
 *  3. **Finished** — accepted, not selected, discontinued.
 *
 * Stage is the *second* key, not the first, and that is the one deliberate
 * departure from "furthest along on top". A `negotiating` application sitting
 * on "Awaiting response" needs nothing from you today; an unsent draft on
 * "Send application" is the least progressed row in the list and the only one
 * with a deadline. Sorting on stage alone puts the first three above the last
 * one, which is exactly backwards for a list you work from.
 *
 * Sorting stage descending *inside* each tier is what keeps that from becoming
 * the opposite failure: half-started drafts do not squat above an interview,
 * because within "needs you" the interview outranks them. Net order is
 * negotiating-with-action, interviewing-with-action, applying-with-action,
 * then the same three waiting on the employer.
 *
 * ## Why `last_activity` is not `date_updated`
 *
 * The within-tier tie-break is when something last *happened*, which
 * `applications.date_updated` does not record: it moves when you generate a
 * cover letter, edit salary expectations, snooze, or retitle a note. An
 * application the employer went silent on five weeks ago looks fresh under it
 * the moment you open the thing. `$lib/server/applications/activity` derives
 * the real value from the timeline, the activity records and the notes; this
 * module takes it as given and falls back to `date_created`.
 *
 * Everything here is pure and client-safe, so the same order can be applied
 * after an optimistic update without a round trip.
 */

import { today } from '$lib/application-records';
import { isSnoozed, type Snoozable } from '$lib/application-snooze';
import {
	finishedStatuses,
	getStepperPhase,
	isWaitingAction,
	stepsByPhase
} from '$lib/application-status';

/**
 * What ranking reads. Every field but `id` and `status` is optional, so a
 * caller selecting a narrow column set still gets a usable (if coarser) order
 * rather than a type error.
 */
export interface Rankable extends Snoozable {
	id: number;
	status: string;
	status_step?: string | null;
	status_action?: string | null;
	status_action_date?: string | null;
	/** From `attachLastActivity`. Falls back to `date_created` when absent. */
	last_activity?: Date | string | null;
	date_created?: Date | string | null;
}

/** The four bands, in the order they appear. Exported for tests and labels. */
export const tiers = {
	action: 0,
	waiting: 1,
	snoozed: 2,
	finished: 3
} as const;

export type Tier = (typeof tiers)[keyof typeof tiers];

/**
 * Which band an application falls in.
 *
 * Checked in this order on purpose: a snoozed application with an open action
 * is still parked, and a finished one is finished whatever its stale action
 * column still says. Both would otherwise be promoted to the top by a leftover
 * value nobody cleared.
 *
 * No action at all reads as "waiting" rather than "needs you". An application
 * nobody has given a next action is not evidence of work outstanding, and the
 * top band is only worth having while everything in it is really actionable.
 */
export function applicationTier(app: Rankable, on: string = today()): Tier {
	if (finishedStatuses.includes(app.status)) return tiers.finished;
	if (isSnoozed(app, on)) return tiers.snoozed;
	if (app.status_action && !isWaitingAction(app.status_action)) return tiers.action;
	return tiers.waiting;
}

const phaseRank: Record<string, number> = {
	applying: 1,
	interviewing: 2,
	negotiating: 3,
	result: 4
};

/**
 * How far along an application is. Higher is further.
 *
 * The phase carries the coarse position and `stepsByPhase` refines it, so a
 * "Hiring manager call" sorts above a "Screening call" without the two phases
 * ever being able to interleave. Legacy statuses (`preparing`, `sent`,
 * `offered`, `draft`) go through `getStepperPhase` rather than a second switch
 * that would have to be kept in step with it.
 *
 * A step the vocabulary does not list scores 0 — the start of its phase. The
 * step list is advisory (the editor offers "Custom…"), and an unknown label
 * carries no information about progression, so it must not be read as either
 * end of one.
 */
export function stageRank(status: string, step?: string | null): number {
	const phase = getStepperPhase(status);
	const known = step ? (stepsByPhase[phase] ?? []).indexOf(step) : -1;
	return (phaseRank[phase] ?? 0) * 100 + Math.max(known, 0);
}

/**
 * A date column as milliseconds, or null.
 *
 * `YYYY-MM-DD` parses as UTC midnight, which is what the Drizzle `date()`
 * columns mean; a full timestamp parses as itself. NaN is returned as null so
 * an unparseable value sorts as "unknown" rather than poisoning a comparison.
 */
function ms(value: Date | string | null | undefined): number | null {
	if (!value) return null;
	const t = value instanceof Date ? value.getTime() : new Date(value).getTime();
	return Number.isNaN(t) ? null : t;
}

function activityMs(app: Rankable): number {
	return ms(app.last_activity) ?? ms(app.date_created) ?? 0;
}

/** Most recent first. */
function byActivity(a: Rankable, b: Rankable): number {
	return activityMs(b) - activityMs(a);
}

/**
 * Soonest first, undated last.
 *
 * Overdue dates are the smallest values, so they lead without a special case:
 * an interview you were meant to schedule last week outranks one due tomorrow.
 */
function byActionDate(a: Rankable, b: Rankable): number {
	const x = a.status_action_date;
	const y = b.status_action_date;
	if (!x && !y) return 0;
	if (!x) return 1;
	if (!y) return -1;
	return x < y ? -1 : x > y ? 1 : 0;
}

/** Soonest back first. */
function bySnoozeEnd(a: Rankable, b: Rankable): number {
	const x = a.snoozed_until ?? '';
	const y = b.snoozed_until ?? '';
	return x < y ? -1 : x > y ? 1 : 0;
}

/**
 * The full comparator.
 *
 * Every branch ends on `b.id - a.id` so the order is total: two rows that tie
 * on everything still come back in the same sequence on the next load, which a
 * list with a stable scroll position needs and `Array.sort` does not promise
 * for equal elements across engines.
 */
export function compareApplications(a: Rankable, b: Rankable, on: string = today()): number {
	const tier = applicationTier(a, on) - applicationTier(b, on);
	if (tier !== 0) return tier;

	const byStage = stageRank(b.status, b.status_step) - stageRank(a.status, a.status_step);

	switch (applicationTier(a, on)) {
		case tiers.action:
			return byStage || byActionDate(a, b) || byActivity(a, b) || b.id - a.id;
		case tiers.waiting:
			return byStage || byActivity(a, b) || b.id - a.id;
		case tiers.snoozed:
			return bySnoozeEnd(a, b) || b.id - a.id;
		default:
			return byActivity(a, b) || b.id - a.id;
	}
}

/**
 * The orders the list offers.
 *
 * Deliberately short. A smart default that cannot be turned off is a default
 * nobody trusts, but every extra option is another order to keep working, so
 * this is the rule plus the two single-column views it is built out of.
 */
export const sortOptions = [
	{ value: 'smart', label: 'Smart' },
	{ value: 'activity', label: 'Last activity' },
	{ value: 'created', label: 'Newest' }
] as const;

export type SortKey = (typeof sortOptions)[number]['value'];

export const defaultSort: SortKey = 'smart';

/** Whether a URL parameter names an order, so the route can fall back cleanly. */
export function isSortKey(value: string | null | undefined): value is SortKey {
	return !!value && sortOptions.some((o) => o.value === value);
}

/** Sorted copy. The input is never reordered in place. */
export function sortApplications<T extends Rankable>(
	apps: T[],
	sort: SortKey = defaultSort,
	on: string = today()
): T[] {
	const copy = [...apps];
	switch (sort) {
		case 'activity':
			return copy.sort((a, b) => byActivity(a, b) || b.id - a.id);
		case 'created':
			return copy.sort(
				(a, b) => (ms(b.date_created) ?? 0) - (ms(a.date_created) ?? 0) || b.id - a.id
			);
		default:
			return copy.sort((a, b) => compareApplications(a, b, on));
	}
}
