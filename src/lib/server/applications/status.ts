/**
 * Where an application stands, and the one write that moves it.
 *
 * ## Why this is a module rather than a form action
 *
 * A status change is three columns and a timeline row, and the two have to
 * happen together: `applications.status` is what the pipeline reads, and
 * `application_status_log` is what the activity tab reads. A writer that
 * updates one and not the other produces a record whose "now" and whose
 * "history" disagree, which is invisible on both pages, because each shows
 * only its own half.
 *
 * There were two such writers before this: the application page's
 * `?/updateStatus`, which is the full editor, and the pipeline list's, which
 * sets a bare status and which nothing in the UI currently posts to. They had
 * already drifted while nobody was looking (the list writer left the stage
 * behind on a status change and never set the applied date the editor sets),
 * and adding a third writer for the assistant would have made it three, one of
 * them writing into a history that is read back as evidence.
 *
 * So the rules live here, once: what a change does to the stage and the
 * interview rounds, when the applied date fills itself in, and what the
 * timeline row says.
 *
 * ## The vocabulary is advisory, and stays that way
 *
 * `stepsByPhase` populates the editor's stage dropdown and `roundKinds` its
 * round kinds, and both also offer "Custom…". A stage or a kind is therefore a
 * label rather than an enum, and this module does not enforce one:
 * `applicationStatusError` checks the *status*, which really is closed.
 *
 * The assistant is held to the lists anyway (see `update_application_status`),
 * but that is a rule about what a model may invent, not about what the column
 * may hold. A person typing "Coffee chat with the CTO" into their own tracker
 * is not a data error.
 */

import { db } from '$lib/server/db';
import { and, desc, eq } from 'drizzle-orm';
import { application_status_log, applications } from '$lib/server/db/schema';
import {
	blankRound,
	currentRoundIndex,
	getStatusLabel,
	getStepperPhase,
	roundLabel,
	roundState,
	stageLabel,
	statusOptions,
	stepsByPhase,
	type InterviewRound,
	type NextStep,
	type StatusFacts
} from '$lib/application-status';
import { today } from '$lib/application-records';

/**
 * The statuses anything may set.
 *
 * `statusLabels` knows four more (`draft`, `preparing`, `sent`, `offered`),
 * which are read-side only: three are renames that predate the current phases
 * and `draft` is the column default that nothing creates any more (both
 * application-creation paths insert `applying`). They still render, because old
 * rows hold them; nothing should write another.
 */
export const settableStatuses: string[] = statusOptions.map((option) => option.value);

/**
 * The statuses the applicant knows by another name, for text a model reads:
 * `rejected reads "Not selected" and withdrawn reads "Discontinued"`.
 *
 * The labels are deliberate. "Rejected" is the word "Not selected" exists to
 * avoid, and a model repeats whatever a tool shows it: while the tools showed
 * only the stored value, the assistant called applications "rejected" to an
 * applicant whose every page said "Not selected".
 */
export const RELABELLED_STATUSES = statusOptions
	.filter((option) => option.label.toLowerCase() !== option.value)
	.map((option) => `${option.value} reads "${option.label}"`)
	.join(' and ');

/**
 * One status for a model to read: the value the tools take, and the label the
 * applicant sees wherever the two differ. `rejected (the applicant sees "Not
 * selected")`, but plain `interviewing`.
 */
export function statusForModel(status: string): string {
	const label = getStatusLabel(status);
	return label.toLowerCase() === status ? status : `${status} (the applicant sees "${label}")`;
}

/** The stage labels the editor offers for a status. Empty for interviewing and once finished. */
export function stepsFor(status: string): string[] {
	return stepsByPhase[getStepperPhase(status)] ?? [];
}

/**
 * The columns the stage and the next step are worked out from, for a query
 * that only needs those. `stageLabel` and `nextStep` take the row it returns.
 */
export const STAGE_COLUMNS = {
	status: true,
	status_step: true,
	interview_rounds: true,
	application_sent_date: true
} as const;

/**
 * The stage a new activity entry is filed under: where the application is
 * today, as the timeline would name it ("Round 2 · Technical").
 */
export function entryStage(app: StatusFacts): string | null {
	return stageLabel(app, today());
}

/**
 * Every round, one per line, for a model to read: what it is, when, with whom,
 * and where it stands today. Empty when there are none.
 *
 * Dates as stored (`2026-10-08 15:30`), not as the cards write them, because a
 * model has to send them back in that form.
 */
export function describeRoundsForModel(rounds: readonly InterviewRound[], on = today()): string {
	const current = currentRoundIndex(rounds, on);
	return rounds
		.map((round, i) => {
			const when = round.date
				? `${round.date}${round.time ? ` ${round.time}` : ''}`
				: 'no date yet';
			const state = { unscheduled: 'not booked yet', upcoming: 'booked', done: 'behind them' }[
				roundState(rounds, i, on)
			];
			return (
				`round ${i + 1}: ${round.kind ?? 'kind not said'}, ${when}` +
				`${round.with ? `, with ${round.with}` : ''} (${state}${i === current ? ', current' : ''})`
			);
		})
		.join('\n');
}

/** The next step for a model: "Scheduled for 2026-10-08 15:30 (their move: no)". */
export function describeNextStepForModel(next: NextStep | null): string {
	if (!next) return 'none worked out';
	const when = next.date ? ` for ${next.date}${next.time ? ` ${next.time}` : ''}` : '';
	return `${next.label}${when} (${next.waiting ? 'waiting on the employer' : 'the applicant’s move'})`;
}

/** What a caller wants the application to say now. Absent is not "unchanged"; see `writeApplicationStatus`. */
export interface StatusChange {
	status: string;
	/** The stage, for applying and negotiating. Dropped for interviewing and once finished. */
	step: string | null;
	/**
	 * The interview rounds, whole. Optional only so that a caller with nothing
	 * to say about them (a quick action, the list's bare status) keeps the ones
	 * there; see `settleStatusChange` for what a status does to them.
	 */
	rounds?: InterviewRound[];
	/** The note that goes on the timeline row, not on the application. */
	description: string | null;
}

/** The state a change settles into, once the rules below have been applied. */
export interface SettledStatus {
	status: string;
	step: string | null;
	rounds: InterviewRound[];
}

/**
 * What a status does to the stage and the rounds, for every writer.
 *
 * - A stage belongs to applying and negotiating. Interviewing's position is its
 *   round, and a finished application has none, so the stage goes for both:
 *   "Offer received" kept under "Not selected" describes an application nobody
 *   has.
 * - Rounds are kept through negotiating and past the end, because "Not selected
 *   after round 2" is the history of this application. They are cleared by a
 *   move back to applying, since an application that has not been interviewed
 *   has no rounds.
 * - Interviewing always has at least one round: being moved there means being
 *   invited to one, booked or not.
 */
export function settleStatusChange(
	next: Pick<StatusChange, 'status' | 'step'> & { rounds: InterviewRound[] }
): SettledStatus {
	const phase = getStepperPhase(next.status);
	const step = phase === 'applying' || phase === 'negotiating' ? next.step : null;
	let rounds = phase === 'applying' ? [] : next.rounds;
	if (phase === 'interviewing' && rounds.length === 0) rounds = [blankRound()];
	return { status: next.status, step, rounds };
}

/**
 * Whether two states differ in anything the timeline records: the status, the
 * stage, or a round's kind, date or time. Who a round is with is detail kept on
 * the round, and correcting a name is not an event.
 */
export function isLoggedChange(a: SettledStatus, b: SettledStatus): boolean {
	const shape = (rounds: InterviewRound[]) =>
		JSON.stringify(rounds.map((r) => [r.kind, r.date, r.time]));
	return a.status !== b.status || a.step !== b.step || shape(a.rounds) !== shape(b.rounds);
}

/**
 * What a timeline row records about a state: its stage, and for interviewing
 * the latest round and the day it is booked for.
 *
 * The latest round rather than the current one, because the row records what
 * was just said: two rounds booked at once are written as the second, which is
 * the one that was added. A reschedule is a row with the same label and a new
 * date, which is how it is told apart from the row before it.
 */
function timelineEntry(state: SettledStatus): { step: string | null; date: string | null } {
	if (getStepperPhase(state.status) !== 'interviewing') return { step: state.step, date: null };
	const last = state.rounds.length - 1;
	return last === -1
		? { step: null, date: null }
		: { step: roundLabel(state.rounds[last], last), date: state.rounds[last].date };
}

export interface StatusWriteResult {
	/** What it said before, for a caller that has to describe the move. */
	from: string;
	/** The timeline row this produced or rewrote, or null when the change was not one it records. */
	logId: number | null;
	/** True when the creation entry was rewritten instead of a row being added. */
	replaced: boolean;
	/** Set when this write filled in the applied date as a side effect. */
	appliedDateSet: string | null;
}

/**
 * Why this status cannot be written, or null when it can.
 *
 * Only the status: see the note at the top of this file on why the stage and
 * the round kinds are not checked here.
 */
export function applicationStatusError(status: unknown): string | null {
	if (typeof status !== 'string' || status.trim() === '') {
		return `A status is required, one of: ${settableStatuses.join(', ')}.`;
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
 * that left the previous stage in place would say "Offer received" under "Not
 * selected", so a caller changing only the status passes `step: null` and means
 * it. The rounds are the exception, and only by omission: a caller that sends
 * none keeps the ones there, because a quick "Got an offer" has nothing to say
 * about the interviews that led to it.
 *
 * A timeline row is written for every change the timeline records (see
 * `isLoggedChange`), or whenever there is a note. Changing only who a round is
 * with updates the row and writes none.
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
		 * event. Every other caller leaves it off: a change made days later is a
		 * real event, and one that has to survive an undo needs a row of its own to
		 * take back.
		 */
		collapseInitialEntry?: boolean;
	} = {}
): Promise<StatusWriteResult | null> {
	const existing = await db.query.applications.findFirst({
		where: and(eq(applications.id, applicationId), eq(applications.profile_id, profileId)),
		columns: {
			id: true,
			status: true,
			status_step: true,
			interview_rounds: true,
			application_sent_date: true
		}
	});
	if (!existing) return null;

	const before: SettledStatus = {
		status: existing.status,
		step: existing.status_step,
		rounds: existing.interview_rounds ?? []
	};
	const after = settleStatusChange({
		status: next.status,
		step: next.step,
		rounds: next.rounds ?? before.rounds
	});

	const now = new Date();
	const statusChanged = after.status !== before.status;

	// Past "Preparing", or out of the applying phase altogether, means it went
	// out, and an application whose date nobody filled in reads as never sent
	// on every list that sorts by it. Only ever fills a blank: a date the
	// applicant typed is theirs, and a later stage change is not evidence it was
	// wrong.
	//
	// `today()` rather than the Date: the column is a Drizzle `date()` in string
	// mode, so a Date object is serialized by the driver in the server's local
	// timezone and can land a day either side of the one meant.
	const appliedDateSet =
		!existing.application_sent_date &&
		((after.status === 'applying' && !!after.step && after.step !== 'Preparing') ||
			(after.status !== 'applying' && after.status !== 'draft'))
			? today()
			: null;

	await db
		.update(applications)
		.set({
			status: after.status,
			status_step: after.step,
			interview_rounds: after.rounds,
			...(appliedDateSet ? { application_sent_date: appliedDateSet } : {}),
			date_updated: now
		})
		.where(and(eq(applications.id, applicationId), eq(applications.profile_id, profileId)));

	if (!isLoggedChange(before, after) && !next.description) {
		return { from: existing.status, logId: null, replaced: false, appliedDateSet };
	}

	const entry = timelineEntry(after);

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
					step: entry.step,
					action: null,
					action_date: entry.date,
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
			to_status: after.status,
			step: entry.step,
			action_date: entry.date,
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
 * Where it does NOT, because something changed the status again afterwards,
 * deleting would be a lie about somebody else's edit, so the move back is
 * appended as the event it has become. The activity tab reads this log as
 * evidence about the employer, and both branches keep it saying only things
 * that happened: a stage entered by mistake and taken back leaves nothing
 * behind, and a stage that was genuinely lived through and then reversed shows
 * both moves.
 *
 * A change the timeline never recorded (who a round was with) is put back
 * without touching it, since there is no row of its own to take back and the
 * newest row belongs to something earlier.
 *
 * `before.rounds` is absent in a before-image recorded before interview rounds
 * existed. The rounds there now are kept then, rather than read as "none".
 */
export async function revertApplicationStatus(
	applicationId: number,
	profileId: number,
	before: StatusChange
): Promise<boolean> {
	const existing = await db.query.applications.findFirst({
		where: and(eq(applications.id, applicationId), eq(applications.profile_id, profileId)),
		columns: { id: true, status: true, status_step: true, interview_rounds: true }
	});
	if (!existing) return false;

	const now: SettledStatus = {
		status: existing.status,
		step: existing.status_step,
		rounds: existing.interview_rounds ?? []
	};
	const target = settleStatusChange({
		status: before.status,
		step: before.step,
		rounds: before.rounds ?? now.rounds
	});

	const restore = () =>
		db
			.update(applications)
			.set({
				status: target.status,
				status_step: target.step,
				interview_rounds: target.rounds,
				date_updated: new Date()
			})
			.where(and(eq(applications.id, applicationId), eq(applications.profile_id, profileId)));

	if (!isLoggedChange(now, target)) {
		await restore();
		return true;
	}

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
		newest.from_status === target.status &&
		newest.to_status === existing.status &&
		newest.from_status !== null;

	if (ours) {
		await restore();
		await db.delete(application_status_log).where(eq(application_status_log.id, newest.id));
		return true;
	}

	return !!(await writeApplicationStatus(applicationId, profileId, {
		...target,
		description: null
	}));
}
