/**
 * Pausing an application without pretending it went anywhere.
 *
 * ## Why this is a date and not a status
 *
 * `status` is a position in a pipeline: it drives the stepper, and moving it
 * deliberately clears `status_step` and `status_action` (see
 * `$lib/server/applications/status`). So a "postponed" status would have to
 * throw away the stage and the next action of the application being paused —
 * exactly the two things you need to pick it up again — and would then need a
 * `previous_status` column to put them back. Needing that column is the tell:
 * "where does this stand with the employer" and "am I working on this right
 * now" are different questions, and only the first one is a status.
 *
 * The pipeline list already separates the two: `group=active` filters on the
 * status, `group=action` filters on `status_action` and skips the waiting ones.
 * A snooze belongs on that second axis.
 *
 * ## Why a date and not a flag
 *
 * A boolean pause is where applications go to die quietly — nothing ever brings
 * them back, which is what `withdrawn` is already for. `snoozed_until` is the
 * day it returns to the active lists, so the filter is a date comparison and
 * the application resurfaces on its own with no job to run and nothing to
 * clear. An elapsed snooze is left in the column on purpose: it is a true
 * record that this was paused once, and it stops matching by itself.
 */

import { today } from '$lib/application-records';

/** The columns this module reads. Anything holding both can be tested for. */
export interface Snoozable {
	snoozed_until?: string | null;
	snooze_reason?: string | null;
}

/** How far ahead a snooze may be set. Past this it is a typo, not a plan. */
const MAX_SNOOZE_DAYS = 365 * 5;

const DAY_MS = 86_400_000;

/**
 * `YYYY-MM-DD` as UTC milliseconds, or null when it is not a real day.
 *
 * UTC rather than local: the column is a Drizzle `date()` in string mode, so
 * these strings never carry a time and parsing them in the server's timezone
 * would shift the boundary by a day for anyone east or west of it.
 *
 * The round-trip check is what rejects `2026-02-31`, which `Date.UTC` would
 * otherwise roll forward into March without complaint.
 */
function dayMs(day: string): number | null {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
	const [y, m, d] = day.split('-').map(Number);
	const ms = Date.UTC(y, m - 1, d);
	return new Date(ms).toISOString().slice(0, 10) === day ? ms : null;
}

/** Whole days from `from` to `until`. Negative when `until` is in the past. */
export function daysUntil(until: string, from: string = today()): number | null {
	const a = dayMs(until);
	const b = dayMs(from);
	if (a === null || b === null) return null;
	return Math.round((a - b) / DAY_MS);
}

/**
 * Is this application paused as of `on`?
 *
 * `snoozed_until` is the day it comes back, so it is still snoozed strictly
 * before that: a snooze until tomorrow is active today, and one until today has
 * elapsed. String comparison is exact for `YYYY-MM-DD` and needs no parsing.
 */
export function isSnoozed(app: Snoozable, on: string = today()): boolean {
	return !!app.snoozed_until && app.snoozed_until > on;
}

/** The day a snooze of `days` from `from` ends. */
export function snoozeUntil(days: number, from: string = today()): string {
	const base = dayMs(from) ?? dayMs(today())!;
	return new Date(base + days * DAY_MS).toISOString().slice(0, 10);
}

/** The durations the picker offers. "Custom…" is a date input, not an entry here. */
export const snoozePresets = [
	{ value: 'week', label: '1 week', days: 7 },
	{ value: 'fortnight', label: '2 weeks', days: 14 },
	{ value: 'month', label: '1 month', days: 30 },
	{ value: 'quarter', label: '3 months', days: 90 }
] as const;

/**
 * Why this snooze cannot be written, or null when it can.
 *
 * A date in the past is refused rather than silently treated as "not snoozed":
 * the two look identical afterwards, and one of them is a typo the applicant
 * would want to hear about.
 */
export function snoozeError(until: unknown, on: string = today()): string | null {
	if (typeof until !== 'string' || dayMs(until) === null) {
		return 'A snooze needs a date, written as YYYY-MM-DD.';
	}
	if (until <= on) {
		return 'A snooze has to end in the future — pick a later date.';
	}
	const days = daysUntil(until, on);
	if (days !== null && days > MAX_SNOOZE_DAYS) {
		return 'That is more than five years out. Discontinue it instead.';
	}
	return null;
}

/**
 * When it comes back, in words, for the badge on the card.
 *
 * Day counts rather than a formatted date: this reads next to the date itself
 * everywhere it is used, so its job is the distance, and phrasing it in days
 * keeps it free of locale and month names.
 */
export function describeSnooze(until: string, on: string = today()): string {
	const days = daysUntil(until, on);
	if (days === null || days <= 0) return 'back now';
	if (days === 1) return 'back tomorrow';
	if (days < 14) return `back in ${days} days`;
	if (days < 60) return `back in ${Math.round(days / 7)} weeks`;
	return `back in ${Math.round(days / 30)} months`;
}
