import type { TimeFormat } from '$lib/format-date';
import { today } from '$lib/application-records';

// --- Phase definitions ---

export const statusOptions = [
	{ value: 'applying', label: 'Applying' },
	{ value: 'interviewing', label: 'Interviewing' },
	{ value: 'negotiating', label: 'Negotiating' },
	{ value: 'accepted', label: 'Accepted' },
	{ value: 'rejected', label: 'Not selected' },
	{ value: 'withdrawn', label: 'Discontinued' },
	{ value: 'position_closed', label: 'Position closed' }
] as const;

export const statusFilters = [{ value: 'all', label: 'All' }, ...statusOptions] as const;

export const statusLabels: Record<string, string> = {
	draft: 'Draft',
	applying: 'Applying',
	preparing: 'Applying', // backward compat
	sent: 'Applying', // backward compat
	interviewing: 'Interviewing',
	negotiating: 'Negotiating',
	offered: 'Negotiating', // backward compat
	accepted: 'Accepted',
	withdrawn: 'Discontinued',
	rejected: 'Not selected',
	position_closed: 'Position closed'
};

export function getStatusLabel(status: string): string {
	return statusLabels[status] || status.charAt(0).toUpperCase() + status.slice(1);
}

// --- Stepper ---

export const stepperPhases = [
	{ value: 'applying', label: 'Applying' },
	{ value: 'interviewing', label: 'Interviewing' },
	{ value: 'negotiating', label: 'Negotiating' },
	{ value: 'result', label: 'Result' }
] as const;

/**
 * How an application can end.
 *
 * Apart from the job taken, they are told apart by who ended it. "Not
 * selected" is the employer deciding against them and "Discontinued" is the
 * applicant stopping. "Position closed" is the job going away with nobody
 * deciding about them: a posting taken down before they applied, or a role
 * cancelled or frozen. Before it existed, such an ending was filed as one of
 * the other two with a note correcting it ("on hold, not a no"), and everything
 * that reads the status rather than the note took it for a no.
 */
export const resultOptions = [
	{ value: 'accepted', label: 'Accepted' },
	{ value: 'rejected', label: 'Not selected' },
	{ value: 'withdrawn', label: 'Discontinued' },
	{ value: 'position_closed', label: 'Position closed' }
] as const;

export const finishedStatuses = ['accepted', 'rejected', 'withdrawn', 'position_closed'];

/**
 * The endings that can come before the application went out: the applicant can
 * stop before sending anything, and a posting can come down before they do.
 * Every other status past applying says it was sent. For these two only the
 * applied date does, so the status writer does not fill it in for them.
 */
export function canEndUnsent(status: string): boolean {
	return status === 'withdrawn' || status === 'position_closed';
}

/**
 * Still in play — the pipeline lists and the home dashboard.
 *
 * A status only. Whether an application is being *worked on* is a second
 * question this does not answer: see `$lib/application-snooze`, which the same
 * lists apply on top of this one.
 */
export const activeStatuses = ['applying', 'interviewing', 'negotiating'];

export function isFinishedStatus(status: string): boolean {
	return finishedStatuses.includes(status);
}

/**
 * Whether an application belongs in the comparison: the pipeline table the
 * assistant sees on every page, and the summaries that feed it.
 *
 * Everything still in play, plus what they ACCEPTED. A job they have taken is
 * not history while they are still applying elsewhere: it is the baseline every
 * other offer is weighed against, and the conditions they wrote down about it —
 * a walk-away number, say — are about exactly that. Left out as "finished", it
 * could be compared against from its own page only, which is the one page where
 * nobody asks. The other endings stay out: they grow without bound and say
 * nothing about what to do next.
 */
export function isComparedStatus(status: string): boolean {
	return !isFinishedStatus(status) || status === 'accepted';
}

export function getStepperPhase(status: string): string {
	if (finishedStatuses.includes(status)) return 'result';
	if (status === 'preparing' || status === 'sent') return 'applying';
	if (status === 'offered') return 'negotiating';
	return status;
}

// --- Stages ---

/**
 * The stages of the phases that have them, in the order they are offered.
 *
 * Interviewing is not here. Its position is the ROUND it has reached, and a
 * round is a record of its own (`InterviewRound`, below) rather than a label
 * from a list. The list it replaced named kinds of interview and never a
 * number: "a first conversation that is not technical" had no entry, so one
 * first interview was saved with no stage at all and a second one was filed as
 * "Screening call", and the order between a technical interview, a hiring
 * manager call and a team interview had to be declared a tie, because the
 * employer decides it. A round's number is the position; its kind is detail.
 *
 * Reading order only. How far along a stage is lives in `stageRanks`, because
 * those are two questions and this array used to answer both: the ranking read
 * a step's INDEX here, so every pair of labels was ordered against each other
 * whether or not anybody had decided they were.
 *
 * The old `applying` list offered "Applied through job platform", "Application
 * form completed", "E-mail sent" and "Resume / CV submitted": one position
 * wearing four hats, with identical effects and an implied ranking between
 * delivery channels that meant nothing. How an application went out is a real
 * question with better answers than a dropdown: `jobs.job_platform_id` and
 * `jobs.source_url` say whether it came off a board, and an activity record of
 * type `message` holds the email itself, with the person and the date on it.
 *
 * The same rule decides what does not go here. A stage is a POSITION, so
 * alternatives that share one share a rank rather than splitting into two
 * stages, and a detail about an event belongs in a record: who interviewed you,
 * whether an offer arrived by phone or in writing. `negotiating` is where that
 * line is easiest to cross, and its five stages are the five things that change
 * what you can DO next: an offer exists, you have countered, they have come
 * back, someone is vetting you, there is paper to sign.
 *
 * "Background check" is a negotiating stage while the reference check is a
 * round kind, which looks inconsistent and is not. Both are vetting gates, and
 * each is listed where it usually falls: references are taken to decide whether
 * to offer, while a background check is mostly a CONDITION of an offer already
 * made, and in the Netherlands a VOG is something the applicant has to go and
 * apply for themselves after agreeing terms.
 */
export const stepsByPhase: Record<string, string[]> = {
	applying: ['Preparing', 'Applied'],
	negotiating: [
		'Offer received',
		'Counter-offer sent',
		'Revised offer received',
		'Background check',
		'Contract review'
	]
};

/**
 * How far through its phase each stage is. Higher is further; `stageRank` adds
 * the phase on top, and in interviewing the round number takes this one's place.
 *
 * Nested by phase rather than one flat map, so a stage can never be scored by a
 * number belonging to a same-named stage of another phase.
 *
 * A stage with no entry scores 0, the same as the earliest stage of its phase.
 * That is deliberate for the custom labels the editor allows: see `stageRank`.
 */
export const stageRanks: Record<string, Record<string, number>> = {
	applying: { Preparing: 0, Applied: 1 },
	negotiating: {
		'Offer received': 0,
		'Counter-offer sent': 1,
		'Revised offer received': 2,
		// Level with the contract on purpose: some employers check before they send
		// paper and some send paper conditional on the check, so claiming an order
		// between the two would assert something only the employer knows.
		'Background check': 3,
		'Contract review': 3
	}
};

export const defaultStepByPhase: Record<string, string> = {
	applying: 'Preparing',
	negotiating: 'Offer received'
};

// --- Interview rounds ---

/**
 * One round of an interview process: a conversation, an assignment, a check.
 *
 * Stored as a list on the application (`applications.interview_rounds`) and
 * always written whole. Every field is optional, because a round is worth
 * recording the moment you are invited to it, before anyone has said when it is
 * or what it will be. Its NUMBER is its position in the list, and whether it is
 * behind you, booked or still to arrange is worked out from its date by
 * `roundState`, never stored: a state someone has to move by hand after every
 * interview is the one that goes stale.
 */
export interface InterviewRound {
	/** From `roundKinds`, or the applicant's own words. Null when nobody has said. */
	kind: string | null;
	/** The day it is booked for, `YYYY-MM-DD`. Null until it is. */
	date: string | null;
	/** The time that day, `HH:MM` on the applicant's own clock. */
	time: string | null;
	/** Who it is with, as they would write it: "Anna (CTO)". */
	with: string | null;
}

/**
 * The kinds a round is offered as. Detail, not position: the kind says what to
 * prepare for, the number says how far along it is.
 *
 * "Intro" is the one the old stage list lacked: the first conversation with a
 * team lead, a hiring manager or a founder, about background and motivation,
 * with nothing technical in it. "Final" is the one with an effect: after it the
 * track shows an offer next rather than another round.
 *
 * A person may type their own. The assistant is held to these, for the reason
 * it was held to the stage list: a model asked for "a sensible kind" produces a
 * new label every time.
 */
export const roundKinds = [
	{ value: 'Intro', hint: 'Getting to know each other: background, motivation, the role' },
	{ value: 'Screening', hint: 'A recruiter, HR or automated check before the real rounds' },
	{ value: 'Technical', hint: 'A technical interview, live coding or a system design' },
	{ value: 'Assignment', hint: 'A take-home, case study, coding challenge or test' },
	{ value: 'Team', hint: 'Meeting the people you would work with' },
	{ value: 'Final', hint: 'The last round before a decision' },
	{ value: 'References', hint: 'They call your references' }
] as const;

export const roundKindValues: string[] = roundKinds.map((kind) => kind.value);

/** The kind after which the next step is an offer rather than another round. */
export const FINAL_ROUND_KIND = 'Final';

/** More than any process runs. Only there so that a posted list is bounded. */
export const MAX_ROUNDS = 20;

const MAX_KIND_CHARS = 60;
const MAX_WITH_CHARS = 200;

export function blankRound(): InterviewRound {
	return { kind: null, date: null, time: null, with: null };
}

export type RoundState = 'unscheduled' | 'upcoming' | 'done';

/**
 * Where one round stands on the day `on` (`YYYY-MM-DD`), today by default.
 *
 * - `upcoming`: dated today or later. The day itself counts, so an interview
 *   this afternoon still reads as booked this morning; the next day it is done.
 * - `done`: dated before today, or undated with another round after it, which
 *   means it was moved past without anyone writing its date down.
 * - `unscheduled`: undated and the last round. Rounds are added as they come,
 *   never planned ahead, so an undated last round is one you have been invited
 *   to and not yet booked.
 */
export function roundState(
	rounds: readonly InterviewRound[],
	index: number,
	on: string = today()
): RoundState {
	const { date } = rounds[index];
	if (date) return date < on ? 'done' : 'upcoming';
	return index === rounds.length - 1 ? 'unscheduled' : 'done';
}

/**
 * Which round the application is at: the first that is not done, or the last
 * when they all are. -1 when there are none.
 *
 * The first open one rather than simply the last, because employers book two
 * rounds at once ("the technical on Tuesday, the team on Thursday"), and the
 * nearer one is the one to prepare for and the one the next step should name.
 */
export function currentRoundIndex(rounds: readonly InterviewRound[], on: string = today()): number {
	if (rounds.length === 0) return -1;
	const open = rounds.findIndex((_, i) => roundState(rounds, i, on) !== 'done');
	return open === -1 ? rounds.length - 1 : open;
}

/** "Round 2 · Technical", or "Round 2" when its kind was never said. `index` is 0-based. */
export function roundLabel(round: InterviewRound, index: number): string {
	return round.kind ? `Round ${index + 1} · ${round.kind}` : `Round ${index + 1}`;
}

const DATE_SHAPE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_SHAPE = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Read a posted or proposed list into rounds, or say why it is not one.
 *
 * The gate every writer passes, the editor and the assistant alike, so a round
 * in the column always has its four fields and each holds what its name says.
 * A blank string becomes null, because an emptied input means "not said". A
 * time typed as `9:30` is stored as `09:30`, which is what a time input posts
 * and what sorts.
 */
export function parseRounds(
	value: unknown
): { ok: true; rounds: InterviewRound[] } | { ok: false; error: string } {
	if (!Array.isArray(value)) return { ok: false, error: 'The rounds must be a list.' };
	if (value.length > MAX_ROUNDS) return { ok: false, error: `At most ${MAX_ROUNDS} rounds.` };

	const rounds: InterviewRound[] = [];
	for (const [i, raw] of value.entries()) {
		const which = `Round ${i + 1}`;
		if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
			return { ok: false, error: `${which} is not a round.` };
		}
		const text = (field: keyof InterviewRound): string | null => {
			const v = (raw as Record<string, unknown>)[field];
			if (v === null || v === undefined) return null;
			const s = String(v).trim();
			return s === '' ? null : s;
		};

		const kind = text('kind');
		const date = text('date');
		const who = text('with');
		let time = text('time');
		if (time && /^\d:\d{2}$/.test(time)) time = `0${time}`;

		if (kind && kind.length > MAX_KIND_CHARS) {
			return { ok: false, error: `${which}: a kind is at most ${MAX_KIND_CHARS} characters.` };
		}
		if (date && (!DATE_SHAPE.test(date) || Number.isNaN(Date.parse(date)))) {
			return { ok: false, error: `${which}: "${date}" is not a YYYY-MM-DD date.` };
		}
		if (time && !TIME_SHAPE.test(time)) {
			return { ok: false, error: `${which}: "${time}" is not an HH:MM time.` };
		}
		if (who && who.length > MAX_WITH_CHARS) {
			return { ok: false, error: `${which}: "with" is at most ${MAX_WITH_CHARS} characters.` };
		}
		rounds.push({ kind, date, time, with: who });
	}
	return { ok: true, rounds };
}

/**
 * Whether two lists hold the same rounds, field by field. Not `JSON.stringify`
 * on the lists themselves: a list read back from jsonb has its keys in jsonb's
 * order, not the order they were written in, so the same rounds would compare
 * unequal.
 */
export function sameRounds(a: readonly InterviewRound[], b: readonly InterviewRound[]): boolean {
	const fields = (rounds: readonly InterviewRound[]) =>
		JSON.stringify(rounds.map((r) => [r.kind, r.date, r.time, r.with]));
	return fields(a) === fields(b);
}

// --- Stage and next step ---

/**
 * What the stage and the next step are worked out from. Loose on purpose, like
 * `Rankable`: a caller with a narrow column selection gets a coarser answer
 * rather than a type error.
 */
export interface StatusFacts {
	status: string;
	status_step?: string | null;
	interview_rounds?: readonly InterviewRound[] | null;
	application_sent_date?: string | null;
}

/**
 * The line under the status: "Applied", "Round 2 · Technical", "Offer received".
 * Null for a finished application and for a stage nobody set.
 */
export function stageLabel(app: StatusFacts, on: string = today()): string | null {
	const phase = getStepperPhase(app.status);
	if (phase === 'result') return null;
	if (phase === 'interviewing') {
		const rounds = app.interview_rounds ?? [];
		const index = currentRoundIndex(rounds, on);
		return index === -1 ? null : roundLabel(rounds[index], index);
	}
	return app.status_step || null;
}

/**
 * What happens next on an application, and whose move it is.
 *
 * Worked out rather than stored. The `status_action` column this replaced held
 * two kinds of value in practice: the default for its stage ("Send
 * application" under Preparing, "Awaiting response" under Applied), which the
 * stage already says, and interview dates moved along by hand (Need to
 * schedule, Scheduled, Awaiting result), which a round's own date says better,
 * and without anyone having to come back after the interview to flip it. Its
 * one load-bearing job, telling the ranking whose move it is, is this one's.
 */
export interface NextStep {
	/** In the words the cards show: "Send application", "Awaiting result". */
	label: string;
	/** True when the move is the employer's: nothing to do but wait, or chase. */
	waiting: boolean;
	/** When it is booked, for a scheduled round. `YYYY-MM-DD`. */
	date: string | null;
	/** At what time, `HH:MM`, when that is known. */
	time: string | null;
}

const yours = (label: string): NextStep => ({ label, waiting: false, date: null, time: null });
const theirs = (label: string): NextStep => ({ label, waiting: true, date: null, time: null });

/**
 * Negotiating's stages already say whose move it is; this says it in words. A
 * stage not listed (a custom one) has no next step, which the ranking reads as
 * waiting: an unknown stage is not evidence of work outstanding.
 */
const negotiatingNext: Record<string, NextStep> = {
	'Offer received': yours('Reply to offer'),
	'Counter-offer sent': theirs('Awaiting response'),
	'Revised offer received': yours('Reply to offer'),
	'Background check': theirs('Awaiting result'),
	'Contract review': yours('Review the contract')
};

export function nextStep(app: StatusFacts, on: string = today()): NextStep | null {
	switch (getStepperPhase(app.status)) {
		case 'applying':
			return isSentStage(app) ? theirs('Awaiting response') : yours('Send application');
		case 'interviewing': {
			const rounds = app.interview_rounds ?? [];
			const index = currentRoundIndex(rounds, on);
			if (index === -1) return yours('Schedule round 1');
			const round = rounds[index];
			switch (roundState(rounds, index, on)) {
				case 'unscheduled':
					return yours(`Schedule round ${index + 1}`);
				case 'upcoming':
					return { label: 'Scheduled', waiting: false, date: round.date, time: round.time };
				default:
					return theirs('Awaiting result');
			}
		}
		case 'negotiating':
			return negotiatingNext[app.status_step ?? ''] ?? null;
		default:
			return null;
	}
}

/**
 * Whether an application still in `applying` has gone out, going by its stage.
 *
 * The stage first: "Preparing" is the applicant saying it has not, whatever an
 * applied date left behind by an earlier move says. Any other stage (Applied,
 * or one of the delivery channels older rows still hold) says it has. With no
 * stage at all, the applied date decides.
 */
function isSentStage(app: StatusFacts): boolean {
	if (app.status_step === 'Preparing') return false;
	if (app.status_step) return true;
	return !!app.application_sent_date;
}

/**
 * "Thu, Oct 8", and ", 15:30" after it when the time is known. No year: a
 * booked round is days away, not years.
 *
 * Formatted in UTC because `YYYY-MM-DD` parses as UTC midnight, and the same
 * instant formatted west of Greenwich is the day before.
 */
export function formatRoundWhen(
	date: string | null,
	time: string | null,
	timeFormat: TimeFormat = '24h'
): string {
	if (!date) return '';
	const day = new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', {
		weekday: 'short',
		month: 'short',
		day: 'numeric',
		timeZone: 'UTC'
	});
	return time ? `${day}, ${formatClock(time, timeFormat)}` : day;
}

/** A stored `HH:MM` on the applicant's clock, as 15:30 or 3:30 PM. */
function formatClock(time: string, timeFormat: TimeFormat): string {
	if (timeFormat === '24h') return time;
	const [hours, minutes] = time.split(':').map(Number);
	return `${hours % 12 || 12}:${String(minutes).padStart(2, '0')} ${hours < 12 ? 'AM' : 'PM'}`;
}

/** The next step as one line: "Scheduled for Thu, Oct 8, 15:30", or just its label. */
export function describeNextStep(next: NextStep, timeFormat: TimeFormat = '24h'): string {
	return next.date
		? `${next.label} for ${formatRoundWhen(next.date, next.time, timeFormat)}`
		: next.label;
}

// --- Quick actions ---
// One-tap status transitions surfaced directly on the application page, so users
// can advance a pending application without opening the full status editor.

export type QuickStatusAction = {
	label: string;
	status: string;
	step: string | null;
	tone: 'advance' | 'positive' | 'negative';
	/**
	 * Opens the editor with a new round to fill in, instead of posting. A round
	 * is worth its date and its kind, which one tap cannot say, and a tap that
	 * wrote a blank round would leave "Schedule round 2" behind for the applicant
	 * to come back and fill in anyway.
	 */
	addsRound?: boolean;
};

export function getQuickStatusActions(status: string, step: string | null): QuickStatusAction[] {
	const notSelected: QuickStatusAction = {
		label: 'Not selected',
		status: 'rejected',
		step: null,
		tone: 'negative'
	};

	switch (getStepperPhase(status)) {
		case 'applying': {
			const notApplied = !step || step === 'Preparing';
			return [
				...(notApplied
					? [
							{
								label: 'Mark as applied',
								status: 'applying',
								step: 'Applied',
								tone: 'advance' as const
							}
						]
					: []),
				{
					label: 'Invited to interview',
					status: 'interviewing',
					step: null,
					tone: 'advance',
					addsRound: true
				},
				// Only before it went out: a posting that is gone by then is the usual
				// way this ends, and one taken down after they applied ends nothing,
				// since employers often stop taking applications and keep going
				// through the ones they have.
				...(notApplied
					? [
							{
								label: 'Position closed',
								status: 'position_closed',
								step: null,
								tone: 'negative' as const
							}
						]
					: []),
				notSelected
			];
		}
		case 'interviewing':
			return [
				{
					label: 'Next round',
					status: 'interviewing',
					step: null,
					tone: 'advance',
					addsRound: true
				},
				{ label: 'Got an offer', status: 'negotiating', step: 'Offer received', tone: 'positive' },
				notSelected
			];
		case 'negotiating':
			return [
				{ label: 'Accepted', status: 'accepted', step: null, tone: 'positive' },
				{ label: 'Discontinued', status: 'withdrawn', step: null, tone: 'negative' },
				notSelected
			];
		default:
			return [];
	}
}

// --- Status colors ---

export function getStatusColor(status: string): string {
	switch (status) {
		case 'draft':
			return 'bg-[var(--dash-info-light)] text-[var(--dash-info)]';
		case 'applying':
		case 'preparing': // backward compat
		case 'sent': // backward compat
			return 'bg-[var(--dash-info-light)] text-[var(--dash-info)]';
		case 'seen':
			return 'bg-[var(--dash-purple-light)] text-[var(--dash-purple)]';
		case 'interviewing':
			return 'bg-[var(--dash-warning-light)] text-[var(--dash-warning)]';
		case 'negotiating':
		case 'offered':
			return 'bg-[var(--dash-success-light)] text-[var(--dash-success)]';
		case 'accepted':
			return 'bg-green-100 text-green-700';
		case 'rejected':
		case 'withdrawn':
		case 'position_closed':
			return 'bg-[var(--dash-bg)] text-[var(--dash-text-muted)]';
		default:
			return 'bg-[var(--dash-bg)] text-[var(--dash-text-muted)]';
	}
}

export function getStatusDotColor(status: string): string {
	switch (status) {
		case 'draft':
			return 'text-[var(--dash-info)]';
		case 'applying':
		case 'preparing': // backward compat
		case 'sent': // backward compat
			return 'text-[var(--dash-info)]';
		case 'seen':
			return 'text-[var(--dash-purple)]';
		case 'interviewing':
			return 'text-[var(--dash-warning)]';
		case 'negotiating':
		case 'offered':
			return 'text-[var(--dash-success)]';
		case 'accepted':
			return 'text-green-700';
		case 'rejected':
		case 'withdrawn':
		case 'position_closed':
			return 'text-[var(--dash-text-muted)]';
		default:
			return 'text-[var(--dash-text-muted)]';
	}
}

export function getStatusBgColor(status: string): string {
	switch (status) {
		case 'draft':
			return 'bg-[var(--dash-info)]';
		case 'applying':
		case 'preparing': // backward compat
		case 'sent': // backward compat
			return 'bg-[var(--dash-info)]';
		case 'seen':
			return 'bg-[var(--dash-purple)]';
		case 'interviewing':
			return 'bg-[var(--dash-warning)]';
		case 'negotiating':
		case 'offered':
			return 'bg-[var(--dash-success)]';
		case 'accepted':
			return 'bg-green-600';
		case 'rejected':
		case 'withdrawn':
		case 'position_closed':
			return 'bg-[var(--dash-text-muted)]';
		default:
			return 'bg-[var(--dash-text-muted)]';
	}
}
