/**
 * When something last actually happened on an application.
 *
 * ## Why this is not a column
 *
 * `applications.date_updated` looks like the answer and is not. It moves on
 * every write to the row: generating a cover letter, editing a salary
 * expectation, snoozing, retitling a note. So an application the employer went
 * silent on five weeks ago reads as fresh the moment you open it and change
 * anything, and the one signal worth having — "nothing has happened here since
 * I applied" — is the one it destroys.
 *
 * `ai-chat/application-pipeline.ts` already worked around this for its own
 * `daysInStage` (`status_action_date ?? date_updated ?? date_created`, with a
 * comment saying why). This derives the real thing once, for everyone.
 *
 * ## What counts as activity
 *
 * The later of when a thing happened and when it was written down, over four
 * sources:
 *
 *  - `application_status_log` — a move through the pipeline;
 *  - `application_records` — an email, an interview recap, an upload, taking
 *    `event_date` and `date_created` both;
 *  - `application_notes` — the jsonb array on the row itself;
 *  - `application_sent_date` — for hand-created rows that have neither of the
 *    first two.
 *
 * Recording an old event counts, which is deliberate: activity here means any
 * evidence of motion from either side, and pasting three weeks of a thread into
 * an application is you working on it. Only the fallback is the row's own
 * `date_created`, which is the floor rather than a source.
 *
 * ## Cost
 *
 * Two grouped aggregates, over the ids the caller already has. A profile's
 * applications number in the tens and both tables are indexed on the
 * application, so this is cheap enough to run on every list load; there is
 * nothing to cache and therefore nothing to invalidate.
 */

import { inArray, max } from 'drizzle-orm';
import { dbDirect as db } from '$lib/server/db';
import { application_records, application_status_log } from '$lib/server/db/schema';

/**
 * The columns this reads off the row itself. Loose on purpose: a caller with a
 * narrow column selection loses precision, not the call.
 */
export interface ActivitySource {
	id: number;
	date_created?: Date | null;
	application_sent_date?: string | null;
	application_notes?: Array<{ created_at?: string | null }> | null;
}

export type WithLastActivity<T> = T & { last_activity: Date | null };

/** `YYYY-MM-DD` or a timestamp as epoch millis, or null when it is neither. */
function ms(value: Date | string | null | undefined): number | null {
	if (!value) return null;
	const t = value instanceof Date ? value.getTime() : new Date(value).getTime();
	return Number.isNaN(t) ? null : t;
}

function latest(...values: (Date | string | null | undefined)[]): number | null {
	let best: number | null = null;
	for (const value of values) {
		const t = ms(value);
		if (t !== null && (best === null || t > best)) best = t;
	}
	return best;
}

/**
 * Attach `last_activity` to each row.
 *
 * Never later than now: a future `event_date` is a scheduled interview logged
 * ahead of time (or a mistyped year), and either way "last activity" cannot
 * have happened yet. Without the clamp a typo pins an application to the top of
 * the list permanently.
 *
 * Returns a new array; the input rows are not mutated.
 */
export async function attachLastActivity<T extends ActivitySource>(
	rows: T[]
): Promise<WithLastActivity<T>[]> {
	if (rows.length === 0) return [];

	const ids = rows.map((r) => r.id);

	// `max()` over the column rather than raw SQL, so each aggregate comes back
	// through that column's own decoder: a Date for the timestamps, a
	// `YYYY-MM-DD` string for `event_date`. Casting to text by hand here would
	// hand `new Date()` a format it parses inconsistently.
	//
	// Two maxes on the records table rather than one `greatest(...)`: max is
	// associative, so the larger of the two column maxima IS the maximum of the
	// per-row larger value, and this way neither column needs a cast to compare
	// a date against a timestamptz.
	const [moves, records] = await Promise.all([
		db
			.select({
				application: application_status_log.application,
				moved: max(application_status_log.date_created)
			})
			.from(application_status_log)
			.where(inArray(application_status_log.application, ids))
			.groupBy(application_status_log.application),
		db
			.select({
				application: application_records.application_id,
				happened: max(application_records.event_date),
				recorded: max(application_records.date_created)
			})
			.from(application_records)
			.where(inArray(application_records.application_id, ids))
			.groupBy(application_records.application_id)
	]);

	const movedBy = new Map(moves.map((m) => [m.application, m.moved]));
	const recordedBy = new Map(records.map((r) => [r.application, r]));

	const now = Date.now();

	return rows.map((row) => {
		const record = recordedBy.get(row.id);
		const noteTimes = (row.application_notes ?? []).map((n) => n?.created_at);

		const at = latest(
			movedBy.get(row.id),
			record?.happened,
			record?.recorded,
			row.application_sent_date,
			...noteTimes,
			row.date_created
		);

		return { ...row, last_activity: at === null ? null : new Date(Math.min(at, now)) };
	});
}
