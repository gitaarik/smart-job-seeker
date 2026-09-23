// --- Phase definitions ---

export const statusOptions = [
	{ value: 'applying', label: 'Applying' },
	{ value: 'interviewing', label: 'Interviewing' },
	{ value: 'negotiating', label: 'Negotiating' },
	{ value: 'accepted', label: 'Accepted' },
	{ value: 'rejected', label: 'Not Selected' },
	{ value: 'withdrawn', label: 'Discontinued' }
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
	rejected: 'Not Selected'
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

export const resultOptions = [
	{ value: 'accepted', label: 'Accepted' },
	{ value: 'rejected', label: 'Not Selected' },
	{ value: 'withdrawn', label: 'Discontinued' }
] as const;

export const finishedStatuses = ['accepted', 'rejected', 'withdrawn'];

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
 * nobody asks. Rejected and withdrawn stay out: they grow without bound and say
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

// --- Steps & actions ---

/**
 * The stages of each phase, in the order they are offered.
 *
 * Reading order only. How far along a stage is lives in `stageRanks`, because
 * those are two questions and this array used to answer both: the ranking read a
 * step's INDEX here, so every pair of labels was ordered against each other
 * whether or not anybody had decided they were. "Team interview" outranked
 * "Hiring manager call" for no reason but where the two happened to sit.
 *
 * That coupling is also what made the old `applying` list wrong. It offered
 * "Applied through job platform", "Application form completed", "E-mail sent" and
 * "Resume / CV submitted": one position wearing four hats, with identical next
 * actions, an identical effect on `application_sent_date`, and an implied ranking
 * between delivery channels that meant nothing. The quick action wrote the first
 * of them whatever had actually happened, so the column could not be trusted to
 * hold the channel even in principle.
 *
 * How an application went out is still a real question with better answers than a
 * dropdown: `jobs.job_platform_id` and `jobs.source_url` already say whether it
 * came off a board, and an activity record of type `message` holds the email
 * itself, with the person and the date on it.
 *
 * The same rule decides what does not go here. A stage is a POSITION, so
 * alternatives that share one share a rank rather than splitting into two stages,
 * and a detail about an event rather than a position belongs in a record: who
 * interviewed you, which round it was, whether an offer arrived by phone or in
 * writing. `negotiating` is where that line is easiest to cross — it is the phase
 * with the most at stake and the most tempting detail — and the five stages it has
 * are the five things that change what you can DO next: an offer exists, you have
 * countered, they have come back, someone is vetting you, there is paper to sign.
 *
 * "Background check" is in `negotiating` rather than next to "Reference check",
 * which looks inconsistent and is not. Both are vetting gates, and each is listed
 * where it usually falls: references are taken to decide whether to offer, while a
 * background check is mostly a CONDITION of an offer already made, and in the
 * Netherlands a VOG is something the applicant has to go and apply for themselves
 * after agreeing terms. Each is in the one phase it is right in more often, and a
 * run of events that goes the other way has "Custom…".
 *
 * Listing either label in both phases is what the flat `actionsByStep` and
 * `defaultActionByStep` maps cannot do: they are keyed by the label alone, so one
 * label in two phases would silently share a single action list. If that case ever
 * turns out to matter, the fix is to nest those maps by phase, not to duplicate a
 * stage under two spellings.
 */
export const stepsByPhase: Record<string, string[]> = {
	applying: ['Preparing', 'Applied'],
	interviewing: [
		'Screening call',
		'AI interview',
		'Assessment / test',
		'Coding challenge',
		'Take-home assignment',
		'Technical interview',
		'Hiring manager call',
		'Team interview',
		'Final interview',
		'Reference check'
	],
	negotiating: [
		'Offer received',
		'Counter-offer sent',
		'Revised offer received',
		'Background check',
		'Contract review'
	]
};

/**
 * How far through its phase each stage is. Higher is further; `stageRank` adds the
 * phase on top.
 *
 * Separate from `stepsByPhase` so that stages which are alternatives rather than a
 * sequence can share a number. A screening call and an AI interview are the same
 * position reached two ways; an assessment, a coding challenge and a take-home are
 * three kinds of homework; a technical interview, a hiring manager call and a team
 * interview happen in whatever order the employer runs them. Ten labels, five
 * positions.
 *
 * Nested by phase rather than one flat map, so a stage can never be scored by a
 * number belonging to a same-named stage of another phase.
 *
 * A stage with no entry scores 0, the same as the earliest stage of its phase.
 * That is deliberate for the custom labels the editor allows — see `stageRank`.
 */
export const stageRanks: Record<string, Record<string, number>> = {
	applying: { Preparing: 0, Applied: 1 },
	interviewing: {
		'Screening call': 0,
		'AI interview': 0,
		'Assessment / test': 1,
		'Coding challenge': 1,
		'Take-home assignment': 1,
		'Technical interview': 2,
		'Hiring manager call': 2,
		'Team interview': 2,
		'Final interview': 3,
		'Reference check': 4
	},
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

export const actionsByStep: Record<string, string[]> = {
	// Applying
	Preparing: [
		'Send application',
		'Tailor Resume/CV',
		'Write cover letter',
		'Answer application questions',
		'Complete platform profile'
	],
	Applied: ['Awaiting response'],
	// Interviewing
	'Screening call': ['Need to schedule', 'Scheduled', 'Need to complete', 'Awaiting result'],
	'AI interview': ['Need to complete', 'Awaiting result'],
	'Assessment / test': ['Need to complete', 'Awaiting result'],
	'Coding challenge': ['Need to complete', 'Awaiting result'],
	'Take-home assignment': ['Need to complete', 'Awaiting result'],
	'Technical interview': ['Need to schedule', 'Scheduled', 'Need to complete', 'Awaiting result'],
	'Hiring manager call': ['Need to schedule', 'Scheduled', 'Need to complete', 'Awaiting result'],
	'Team interview': ['Need to schedule', 'Scheduled', 'Need to complete', 'Awaiting result'],
	'Final interview': ['Need to schedule', 'Scheduled', 'Need to complete', 'Awaiting result'],
	'Reference check': ['Provide references', 'Awaiting result'],
	// Negotiating
	'Offer received': [
		'Reply to offer',
		'Provide references',
		'Awaiting response',
		'Awaiting contract'
	],
	'Counter-offer sent': ['Awaiting response'],
	'Revised offer received': ['Reply to offer', 'Awaiting response'],
	'Background check': ['Submit documents', 'Awaiting result', 'Awaiting contract'],
	'Contract review': ['Review terms', 'Request changes', 'Sign', 'Awaiting response']
};

/**
 * The next actions that mean the ball is in the employer's court.
 *
 * A prefix rather than a membership test, because the action vocabulary is
 * advisory: `actionsByStep` populates a dropdown that also offers "Custom…",
 * so "Awaiting signed contract" is a legitimate value nobody listed. Anything
 * starting "Awaiting" waits on someone else, by construction.
 *
 * Three places asked this question with three different answers before this
 * existed: the pipeline list's "Needs Action" group tested `!== 'Awaiting
 * response' && !== 'Awaiting result'` in SQL, and both cards testing whether to
 * draw the clock icon used `startsWith('Awaiting')`. They agreed on the two
 * listed values and disagreed on every custom one — a card could show the
 * waiting clock and still be counted as needing action.
 */
export function isWaitingAction(action: string | null | undefined): boolean {
	return !!action && action.startsWith('Awaiting');
}

/** The SQL form of `isWaitingAction`, for filtering in the database. */
export const waitingActionPattern = 'Awaiting%';

/**
 * The next actions a phase offers, whatever stage it is at.
 *
 * `actionsFor` widens a stage's own list with this one, so it is the fallback for
 * a stage with no list of its own and for a custom label. It has to be a superset
 * of every `actionsByStep` list in the phase, which is not a tidiness rule: this
 * map alone is what `STATUS_VOCABULARY` shows the assistant, so an action listed
 * only per-stage is one the editor offers and the assistant cannot propose.
 * "Answer application questions" sat in that gap.
 */
export const actionsByPhase: Record<string, string[]> = {
	applying: [
		'Send application',
		'Tailor Resume/CV',
		'Write cover letter',
		'Answer application questions',
		'Complete platform profile',
		'Awaiting response'
	],
	interviewing: [
		'Need to schedule',
		'Scheduled',
		'Need to complete',
		'Provide references',
		'Awaiting result'
	],
	negotiating: [
		'Reply to offer',
		'Provide references',
		'Submit documents',
		'Review terms',
		'Request changes',
		'Sign',
		'Awaiting response',
		'Awaiting result',
		// Waiting on a document rather than a reply, which is most of the gap between a
		// vetting gate closing and the contract landing. Not a stage: that gap changes
		// nothing you can DO, and ranking it would assert the order `stageRanks`
		// deliberately declines to assert between 'Background check' and 'Contract review'.
		'Awaiting contract'
	]
};

export const defaultStepByPhase: Record<string, string> = {
	applying: 'Preparing',
	interviewing: 'Screening call',
	negotiating: 'Offer received'
};

export const defaultActionByPhase: Record<string, string> = {
	applying: 'Send application',
	negotiating: 'Reply to offer'
};

export const defaultActionByStep: Record<string, string> = {
	Preparing: 'Send application',
	Applied: 'Awaiting response',
	'Screening call': 'Scheduled',
	'Technical interview': 'Need to schedule',
	'Hiring manager call': 'Need to schedule',
	'Team interview': 'Need to schedule',
	'Final interview': 'Need to schedule',
	'Reference check': 'Provide references',
	'Coding challenge': 'Need to complete',
	'Take-home assignment': 'Need to complete',
	'Assessment / test': 'Need to complete',
	'AI interview': 'Need to complete',
	'Offer received': 'Reply to offer',
	'Counter-offer sent': 'Awaiting response',
	'Revised offer received': 'Reply to offer',
	// The gate is usually opened by the applicant handing something over: a VOG
	// application, addresses, an employment history for the screening firm.
	'Background check': 'Submit documents',
	'Contract review': 'Review terms'
};

// --- Quick actions ---
// One-tap status transitions surfaced directly on the application page, so users
// can advance a pending application without opening the full status editor.

export type QuickStatusAction = {
	label: string;
	status: string;
	step: string | null;
	action: string | null;
	tone: 'advance' | 'positive' | 'negative';
};

export function getQuickStatusActions(status: string, step: string | null): QuickStatusAction[] {
	const phase = getStepperPhase(status);
	switch (phase) {
		case 'applying': {
			const notApplied = !step || step === 'Preparing';
			return [
				...(notApplied
					? [
							{
								label: 'Mark as applied',
								status: 'applying',
								step: 'Applied',
								action: 'Awaiting response',
								tone: 'advance' as const
							}
						]
					: []),
				{
					label: 'Heard back',
					status: 'interviewing',
					step: 'Screening call',
					action: 'Need to schedule',
					tone: 'advance'
				},
				{
					label: 'Not selected',
					status: 'rejected',
					step: null,
					action: null,
					tone: 'negative'
				}
			];
		}
		case 'interviewing':
			return [
				{
					label: 'Got an offer',
					status: 'negotiating',
					step: 'Offer received',
					action: 'Reply to offer',
					tone: 'positive'
				},
				{
					label: 'Not selected',
					status: 'rejected',
					step: null,
					action: null,
					tone: 'negative'
				}
			];
		case 'negotiating':
			return [
				{
					label: 'Accepted',
					status: 'accepted',
					step: null,
					action: null,
					tone: 'positive'
				},
				{
					label: 'Discontinued',
					status: 'withdrawn',
					step: null,
					action: null,
					tone: 'negative'
				},
				{
					label: 'Not selected',
					status: 'rejected',
					step: null,
					action: null,
					tone: 'negative'
				}
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
			return 'bg-[var(--dash-text-muted)]';
		default:
			return 'bg-[var(--dash-text-muted)]';
	}
}
