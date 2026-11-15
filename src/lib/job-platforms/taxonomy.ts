/**
 * The `status` and `type` vocabularies for job_platforms.
 *
 * Neither is enforced by the schema — both columns are plain varchars — so
 * this list is the admin UI's, not a constraint. It lives outside
 * `$lib/server` because the forms that render it are components.
 *
 * `status` is the one that does something: the suggestion flow, the jobs page
 * and the add-task query all filter on `published`, and everything else reads
 * as "not published". `paused` goes further: its tasks stop running, scheduled
 * or by hand, and the task page says why (`computeImportTaskBlockers`). It is
 * for a board we have stopped reading, such as Dribbble, whose terms forbid
 * scraping (2026-11-14). `type` is descriptive only; nothing in the app
 * branches on it.
 *
 * A row carrying a value that is not here keeps it — see `withCurrent`. The
 * alternative is a select that silently rewrites data it did not understand.
 */

export const PLATFORM_STATUSES = ['draft', 'published', 'paused'] as const;

/** A platform whose tasks no longer run; see the note above. */
export const PLATFORM_PAUSED = 'paused';

export const PLATFORM_TYPES = [
	'agencies',
	'job_boards',
	'midlance_platforms',
	'open_marketplaces',
	'vetted_platforms'
] as const;

/** The options plus `current`, when `current` is set and not already one of
 *  them. Keeps a legacy or hand-set value selectable instead of dropping it. */
export function withCurrent(options: readonly string[], current: string | null): string[] {
	if (!current || options.includes(current)) return [...options];
	return [...options, current];
}
