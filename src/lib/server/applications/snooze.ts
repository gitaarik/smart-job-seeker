/**
 * The one write that pauses an application, and the one that brings it back.
 *
 * Separate from `writeApplicationStatus` on purpose. That writer moves the
 * pipeline and records a row in `application_status_log`, which the activity
 * tab reads back as evidence of what the employer did. A snooze is a note to
 * self about this week's workload — it did not happen to the application, and
 * writing it into that log would put the applicant's own scheduling into a
 * history that is read as the employer's. Nothing is logged here for the same
 * reason: the pause is visible on the card while it lasts, and says nothing
 * once it has elapsed.
 *
 * See `$lib/application-snooze` for why this is a date beside the status rather
 * than a status of its own.
 */

import { db } from '$lib/server/db';
import { and, eq } from 'drizzle-orm';
import { applications } from '$lib/server/db/schema';

export interface SnoozeChange {
	/** The day it comes back, or null to resume it now. */
	until: string | null;
	/** One line on why. Ignored when resuming — a reason without a pause is noise. */
	reason?: string | null;
}

/**
 * Pause an application until a day, or resume it.
 *
 * Scoped by profile in the statement that writes, like the rest of the
 * application write layer: a caller that forgot to authorize cannot reach
 * another applicant's row through this. Returns false when the id is not
 * theirs, which is the same answer as "no such row".
 */
export async function writeApplicationSnooze(
	applicationId: number,
	profileId: number,
	next: SnoozeChange
): Promise<boolean> {
	const reason = next.until ? next.reason?.trim().slice(0, 255) || null : null;

	const [row] = await db
		.update(applications)
		.set({
			snoozed_until: next.until,
			snooze_reason: reason,
			date_updated: new Date()
		})
		.where(and(eq(applications.id, applicationId), eq(applications.profile_id, profileId)))
		.returning({ id: applications.id });

	return !!row;
}
