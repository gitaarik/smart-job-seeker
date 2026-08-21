/**
 * Where an application stands, and the one write that moves it.
 *
 * ## Why this is a module rather than a form action
 *
 * A status change is four columns and a timeline row, and the two have to
 * happen together: `applications.status` is what the pipeline reads, and
 * `application_status_log` is what the activity tab reads. A writer that
 * updates one and not the other produces a record whose "now" and whose
 * "history" disagree — which is invisible on both pages, because each shows
 * only its own half.
 *
 * There were two such writers before this: the application page's
 * `?/updateStatus`, which is the full editor, and the pipeline list's, which
 * sets a bare status and which nothing in the UI currently posts to. They had
 * already drifted while nobody was looking — the list writer left `status_step`
 * and `status_action` behind on a status change, so an application moved to
 * "interviewing" through it would keep "Preparing / Send application" under
 * that, and it never set the applied date the editor sets. Adding a third
 * writer for the assistant would have made it three, one of them writing into
 * a history that is read back as evidence.
 *
 * So the rules live here, once: what a change does to the step and the action,
 * when the applied date fills itself in, and what the timeline row says.
 *
 * ## The vocabulary is advisory, and stays that way
 *
 * `stepsByPhase` and `actionsByStep` populate the editor's dropdowns, which
 * also offer "Custom…". A step is therefore a label rather than an enum, and
 * this module does not enforce one — `applicationStatusError` checks the
 * *status*, which really is closed, and leaves the two labels alone.
 *
 * The assistant is held to the list anyway (see `update_application_status`),
 * but that is a rule about what a model may invent, not about what the column
 * may hold. A person typing "Coffee chat with the CTO" into their own tracker
 * is not a data error.
 */

import { db } from '$lib/server/db';
import { and, desc, eq } from 'drizzle-orm';
import { application_status_log, applications } from '$lib/server/db/schema';
import {
	actionsByPhase,
	actionsByStep,
	getStepperPhase,
	statusOptions,
	stepsByPhase
} from '$lib/application-status';
import { today } from '$lib/application-records';

/**
 * The statuses anything may set.
 *
 * `statusLabels` knows four more — `draft`, `preparing`, `sent`, `offered` —
 * which are read-side only: three are renames that predate the current phases
 * and `draft` is the column default that nothing creates any more (both
 * application-creation paths insert `applying`). They still render, because old
 * rows hold them; nothing should write another.
 */
export const settableStatuses: string[] = statusOptions.map((option) => option.value);

/** The stage labels the editor offers for a status. Empty once it is finished. */
export function stepsFor(status: string): string[] {
	return stepsByPhase[getStepperPhase(status)] ?? [];
}

/**
 * The next-action labels the editor offers for a status and stage.
 *
 * The step's own list where it has one, widened with the phase's — the editor
 * falls back to the phase list for a step it has no entry for, and a caller
 * checking a value against only one of the two would refuse what the dropdown
 * would have offered.
 */
export function actionsFor(status: string, step: string | null): string[] {
	const phase = getStepperPhase(status);
	return [
		...new Set([...(step ? (actionsByStep[step] ?? []) : []), ...(actionsByPhase[phase] ?? [])])
	];
}

/** What a caller wants the application to say now. Absent is not "unchanged" — see `writeApplicationStatus`. */
export interface StatusChange {
	status: string;
	step: string | null;
	action: string | null;
	/** When the action is due or scheduled. `YYYY-MM-DD`. */
	actionDate: string | null;
	/** The note that goes on the timeline row, not on the application. */
	description: string | null;
}

export interface StatusWriteResult {
	/** What it said before, for a caller that has to describe the move. */
	from: string;
	/** The timeline row this produced, or the one it rewrote. */
	logId: number;
	/** True when the creation entry was rewritten instead of a row being added. */
	replaced: boolean;
	/** Set when this write filled in the applied date as a side effect. */
	appliedDateSet: string | null;
}

/**
 * Why this status cannot be written, or null when it can.
 *
 * Only the status: see the note at the top of this file on why the step and the
 * action are not checked here.
 */
export function applicationStatusError(status: unknown): string | null {
	if (typeof status !== 'string' || status.trim() === '') {
		return `A status is required — one of: ${settableStatuses.join(', ')}.`;
	}
	if (!settableStatuses.includes(status)) {
		return `"${status}" is not a status. Use one of: ${settableStatuses.join(', ')}.`;
	}
	return null;
}

/**
 * Move an application to a new status, and record the move.
 *
 * `next` is the whole of the new state rather than a patch: a status change
 * that left the previous stage in place would say "Offer received" under
 * "Not selected", so a caller changing only the status passes `step: null` and
 * means it. That is also what the editor posts — it clears both when the phase
 * changes and the user picks nothing.
 *
 * Scoped by profile in the same statement that writes, like the rest of the
 * application write layer: a caller that authorized already loses nothing, and
 * one that forgot cannot reach another applicant's row through this. Returns
 * null when the id is not theirs, which is the same answer as "no such row".
 */
export async function writeApplicationStatus(
	applicationId: number,
	profileId: number,
	next: StatusChange,
	opts: {
		/**
		 * Rewrite the creation entry instead of adding a row, when it is still the
		 * only one and the status itself has not moved.
		 *
		 * The editor sets this: someone correcting the stage they chose a minute
		 * ago on the New Application form is fixing that entry, not making a second
		 * event. Every other caller leaves it off — a change made days later is a
		 * real event, and one that has to survive an undo needs a row of its own to
		 * take back.
		 */
		collapseInitialEntry?: boolean;
	} = {}
): Promise<StatusWriteResult | null> {
	const existing = await db.query.applications.findFirst({
		where: and(eq(applications.id, applicationId), eq(applications.profile_id, profileId)),
		columns: { id: true, status: true, application_sent_date: true }
	});
	if (!existing) return null;

	const now = new Date();
	const statusChanged = next.status !== existing.status;

	// Past "Preparing", or out of the applying phase altogether, means it went
	// out — and an application whose date nobody filled in reads as never sent
	// on every list that sorts by it. Only ever fills a blank: a date the
	// applicant typed is theirs, and a later stage change is not evidence it was
	// wrong.
	//
	// `today()` rather than the Date: the column is a Drizzle `date()` in string
	// mode, so a Date object is serialized by the driver in the server's local
	// timezone and can land a day either side of the one meant.
	const appliedDateSet =
		!existing.application_sent_date &&
		((next.status === 'applying' && !!next.step && next.step !== 'Preparing') ||
			(next.status !== 'applying' && next.status !== 'draft'))
			? today()
			: null;

	await db
		.update(applications)
		.set({
			status: next.status,
			status_step: next.step,
			status_action: next.action,
			status_action_date: next.actionDate,
			...(appliedDateSet ? { application_sent_date: appliedDateSet } : {}),
			date_updated: now
		})
		.where(and(eq(applications.id, applicationId), eq(applications.profile_id, profileId)));

	if (opts.collapseInitialEntry && !statusChanged) {
		const entries = await db.query.application_status_log.findMany({
			where: eq(application_status_log.application, applicationId),
			columns: { id: true, from_status: true },
			orderBy: [desc(application_status_log.id)]
		});

		const initial = entries.length === 1 && entries[0].from_status === null ? entries[0] : null;
		if (initial) {
			await db
				.update(application_status_log)
				.set({
					step: next.step,
					action: next.action,
					action_date: next.actionDate,
					description: next.description,
					date_created: now
				})
				.where(eq(application_status_log.id, initial.id));

			return { from: existing.status, logId: initial.id, replaced: true, appliedDateSet };
		}
	}

	const [logged] = await db
		.insert(application_status_log)
		.values({
			application: applicationId,
			date_created: now,
			from_status: existing.status,
			to_status: next.status,
			step: next.step,
			action: next.action,
			action_date: next.actionDate,
			description: next.description
		})
		.returning({ id: application_status_log.id });

	return { from: existing.status, logId: logged.id, replaced: false, appliedDateSet };
}

/**
 * Put an application back to a status it held before, for an undo.
 *
 * Not `writeApplicationStatus` with the old values, because that would append a
 * second timeline row and the point of an undo is that the first one should not
 * be there. Where the newest row still describes exactly the move being taken
 * back, it is deleted; the columns go back and the history reads as though the
 * change was never made.
 *
 * Where it does NOT — because something changed the status again afterwards —
 * deleting would be a lie about somebody else's edit, so the move back is
 * appended as the event it has become. The activity tab reads this log as
 * evidence about the employer, and both branches keep it saying only things
 * that happened: a stage entered by mistake and taken back leaves nothing
 * behind, and a stage that was genuinely lived through and then reversed shows
 * both moves.
 */
export async function revertApplicationStatus(
	applicationId: number,
	profileId: number,
	before: StatusChange
): Promise<boolean> {
	const existing = await db.query.applications.findFirst({
		where: and(eq(applications.id, applicationId), eq(applications.profile_id, profileId)),
		columns: { id: true, status: true }
	});
	if (!existing) return false;

	const [newest] = await db
		.select({
			id: application_status_log.id,
			from_status: application_status_log.from_status,
			to_status: application_status_log.to_status
		})
		.from(application_status_log)
		.where(eq(application_status_log.application, applicationId))
		.orderBy(desc(application_status_log.id))
		.limit(1);

	// The creation entry is never deleted: every application has one, and
	// `collapseInitialEntry` rewrites it rather than adding a second.
	const ours =
		!!newest &&
		newest.from_status === before.status &&
		newest.to_status === existing.status &&
		newest.from_status !== null;

	if (ours) {
		await db
			.update(applications)
			.set({
				status: before.status,
				status_step: before.step,
				status_action: before.action,
				status_action_date: before.actionDate,
				date_updated: new Date()
			})
			.where(and(eq(applications.id, applicationId), eq(applications.profile_id, profileId)));

		await db.delete(application_status_log).where(eq(application_status_log.id, newest.id));
		return true;
	}

	return !!(await writeApplicationStatus(applicationId, profileId, before));
}
