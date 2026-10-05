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
 * Applications sort into five tiers, and the tier is the primary key:
 *
 *  0. **Needs you** — a next step that is yours (`nextStep`): send it, book
 *     the round, prepare for the one that is booked, reply to the offer.
 *  1. **Gone quiet** — waiting on the employer, past the point where silence
 *     stops being normal. See `isFollowUpDue`.
 *  2. **In play** — still live, waiting on the employer, within the window.
 *  3. **Snoozed** — deliberately parked.
 *  4. **Finished** — accepted, not selected, discontinued, position closed.
 *
 * The quiet tier is what stops a stale application from simply sinking. Sorting
 * silence to the bottom is right while nothing is owed — but past a threshold
 * the silence IS the thing to act on, so it crosses over into work and the
 * ordering inverts with it: newest-activity-first below, longest-quiet-first
 * above.
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
 * because within "needs you" the interview outranks them, and a third round
 * outranks a first. Net order is negotiating, interviewing and applying with a
 * step of yours open, then the same three waiting on the employer.
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
	currentRoundIndex,
	finishedStatuses,
	getStepperPhase,
	nextStep,
	stageRanks,
	type InterviewRound
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
	/** Where an interview process stands; see `nextStep` and `stageRank`. */
	interview_rounds?: readonly InterviewRound[] | null;
	/** Read only to tell an unsent draft from something actually out there. */
	application_sent_date?: string | null;
	/** From `attachLastActivity`. Falls back to `date_created` when absent. */
	last_activity?: Date | string | null;
	date_created?: Date | string | null;
}

/** The five bands, in the order they appear. Exported for tests and labels. */
export const tiers = {
	action: 0,
	followUp: 1,
	waiting: 2,
	snoozed: 3,
	finished: 4
} as const;

export type Tier = (typeof tiers)[keyof typeof tiers];

/**
 * Which band an application falls in.
 *
 * Checked in this order on purpose: a snoozed application with a step of yours
 * open is still parked, and a finished one is finished whatever its stage says.
 *
 * No next step at all (a stage `nextStep` does not know) reads as "waiting"
 * rather than "needs you". An unknown stage is not evidence of work
 * outstanding, and the top band is only worth having while everything in it is
 * really actionable.
 */
export function applicationTier(app: Rankable, on: string = today()): Tier {
	if (finishedStatuses.includes(app.status)) return tiers.finished;
	if (isSnoozed(app, on)) return tiers.snoozed;
	if (isYourMove(app, on)) return tiers.action;
	if (isFollowUpDue(app, on)) return tiers.followUp;
	return tiers.waiting;
}

/**
 * How long silence stays normal, per phase, in days since the last activity.
 *
 * Per phase because the expectations genuinely differ: a fortnight of nothing
 * after sending an application is ordinary, a week of nothing after an
 * interview is worth a polite chase, and an offer conversation going quiet for
 * five days is worth chasing because offers carry deadlines the applicant
 * usually cannot see.
 *
 * Rounded numbers rather than tuned ones — this decides when a badge appears,
 * and being a day or two out costs nothing. `result` has no entry on purpose:
 * a finished application has nobody left to chase.
 */
export const followUpAfterDays: Record<string, number> = {
	applying: 14,
	interviewing: 7,
	negotiating: 5
};

const DAY_MS = 86_400_000;

/**
 * Whole days of silence, counting from the last activity to `on`.
 *
 * Both ends are floored to a UTC day so the answer is a count of days rather
 * than of 24-hour periods: something that happened late yesterday is 1 day
 * quiet this morning, not 0.
 *
 * Null when there is nothing to count from, which is not the same as 0 — the
 * callers must not read "no idea" as "just now".
 */
export function daysQuiet(app: Rankable, on: string = today()): number | null {
	const at = ms(app.last_activity) ?? ms(app.date_created);
	const until = ms(on);
	if (at === null || until === null) return null;
	return Math.round((until - Math.floor(at / DAY_MS) * DAY_MS) / DAY_MS);
}

/**
 * Has this application actually gone out?
 *
 * A follow-up needs someone to follow up WITH, so an unsent draft never earns
 * one however long it has sat there. That case is already covered from the
 * other side (a draft's next step is "Send application", which is yours and
 * lands it in the top tier), and this is the guard behind that one: an
 * application nobody has sent must never be told to chase an employer who has
 * never heard from it.
 *
 * `application_sent_date` is filled by `writeApplicationStatus` the first time
 * an application leaves the Preparing stage; the step is checked too because
 * rows created before that behaviour existed have a null date and are out
 * there all the same.
 */
function hasBeenSent(app: Rankable): boolean {
	if (app.application_sent_date) return true;
	if (getStepperPhase(app.status) !== 'applying') return true;
	return !!app.status_step && app.status_step !== 'Preparing';
}

/**
 * Is this application overdue a nudge?
 *
 * True only for something live, sent, not parked, and waiting on the employer:
 * an application with work outstanding on your side is not stalled, it is
 * yours to move, and a snooze is the applicant saying "not now" in as many
 * words — turning that into a badge would be arguing with them.
 *
 * Exported because the card needs the same answer the ranking used. Derived,
 * like the next step it sits beside: it needs no migration and no job to run,
 * and it clears itself the moment anything happens, including the follow-up
 * itself being recorded.
 */
export function isFollowUpDue(app: Rankable, on: string = today()): boolean {
	if (finishedStatuses.includes(app.status)) return false;
	if (isSnoozed(app, on)) return false;
	if (isYourMove(app, on)) return false;
	if (!hasBeenSent(app)) return false;

	const after = followUpAfterDays[getStepperPhase(app.status)];
	if (after === undefined) return false;

	const quiet = daysQuiet(app, on);
	return quiet !== null && quiet >= after;
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
 * The phase carries the coarse position and the stage refines it, so the two
 * phases can never interleave. Legacy statuses (`preparing`, `sent`, `offered`,
 * `draft`) go through `getStepperPhase` rather than a second switch that would
 * have to be kept in step with it.
 *
 * In interviewing the refinement is the round reached, which is the first time
 * this can say that a third interview is further along than a first: the stage
 * labels it replaced named kinds of interview, and a technical interview, a
 * hiring manager call and a team interview had to share a rank because the
 * employer decides their order. Elsewhere it is a lookup in `stageRanks`
 * rather than the step's position in `stepsByPhase`, so the dropdown can be
 * reordered without silently reordering the pipeline.
 *
 * A step the vocabulary does not list scores 0, the start of its phase. The
 * step list is advisory (the editor offers "Custom…"), and an unknown label
 * carries no information about progression, so it must not be read as either
 * end of one.
 */
export function stageRank(app: Rankable, on: string = today()): number {
	const phase = getStepperPhase(app.status);
	const within =
		phase === 'interviewing'
			? Math.min(currentRoundIndex(app.interview_rounds ?? [], on) + 1, 99)
			: app.status_step
				? (stageRanks[phase]?.[app.status_step] ?? 0)
				: 0;
	return (phaseRank[phase] ?? 0) * 100 + within;
}

/** Whether the next step is the applicant's. See `nextStep`. */
function isYourMove(app: Rankable, on: string): boolean {
	const next = nextStep(app, on);
	return !!next && !next.waiting;
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
 * Longest quiet first — the inverse of `byActivity`, and deliberately so.
 *
 * Below the threshold, silence means nothing is happening and the row sinks.
 * Above it, the silence is the reason the row is actionable at all, so more of
 * it means more urgency. The same fact reads in opposite directions on either
 * side of the line, which is the point of having the line.
 */
function byQuietest(a: Rankable, b: Rankable): number {
	return activityMs(a) - activityMs(b);
}

/**
 * Soonest booked first, unbooked last: the interview on Monday above the one
 * on Thursday, and both above the application still to send.
 *
 * The time breaks a tie inside a day. An undated time sorts as the start of
 * the day, which is the cautious reading.
 */
function byBooking(a: Rankable, b: Rankable, on: string): number {
	const at = (app: Rankable) => {
		const next = nextStep(app, on);
		return next?.date ? `${next.date} ${next.time ?? '00:00'}` : null;
	};
	const x = at(a);
	const y = at(b);
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

	const byStage = stageRank(b, on) - stageRank(a, on);

	switch (applicationTier(a, on)) {
		case tiers.action:
			return byStage || byBooking(a, b, on) || byActivity(a, b) || b.id - a.id;
		case tiers.followUp:
			return byStage || byQuietest(a, b) || b.id - a.id;
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
