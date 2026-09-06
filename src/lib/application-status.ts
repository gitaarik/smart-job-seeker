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

export function getStepperPhase(status: string): string {
	if (finishedStatuses.includes(status)) return 'result';
	if (status === 'preparing' || status === 'sent') return 'applying';
	if (status === 'offered') return 'negotiating';
	return status;
}

// --- Steps & actions ---

export const stepsByPhase: Record<string, string[]> = {
	applying: [
		'Preparing',
		'Applied through job platform',
		'Application form completed',
		'E-mail sent',
		'Resume / CV submitted'
	],
	interviewing: [
		'Screening call',
		'AI interview',
		'Assessment / test',
		'Coding challenge',
		'Take-home assignment',
		'Technical interview',
		'Hiring manager call',
		'Team interview'
	],
	negotiating: ['Offer received', 'Counter-offer sent']
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
	'Applied through job platform': ['Awaiting response'],
	'Application form completed': ['Awaiting response'],
	'E-mail sent': ['Awaiting response'],
	'Resume / CV submitted': ['Awaiting response'],
	// Interviewing
	'Screening call': ['Need to schedule', 'Scheduled', 'Need to complete', 'Awaiting result'],
	'AI interview': ['Need to complete', 'Awaiting result'],
	'Assessment / test': ['Need to complete', 'Awaiting result'],
	'Coding challenge': ['Need to complete', 'Awaiting result'],
	'Take-home assignment': ['Need to complete', 'Awaiting result'],
	'Technical interview': ['Need to schedule', 'Scheduled', 'Need to complete', 'Awaiting result'],
	'Hiring manager call': ['Need to schedule', 'Scheduled', 'Need to complete', 'Awaiting result'],
	'Team interview': ['Need to schedule', 'Scheduled', 'Need to complete', 'Awaiting result'],
	// Negotiating
	'Offer received': ['Respond', 'Provide references', 'Awaiting response'],
	'Counter-offer sent': ['Awaiting response']
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

export const actionsByPhase: Record<string, string[]> = {
	applying: [
		'Send application',
		'Tailor Resume/CV',
		'Write cover letter',
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
	negotiating: ['Respond', 'Provide references', 'Awaiting response']
};

export const defaultStepByPhase: Record<string, string> = {
	applying: 'Preparing',
	interviewing: 'Screening call',
	negotiating: 'Offer received'
};

export const defaultActionByPhase: Record<string, string> = {
	applying: 'Send application',
	negotiating: 'Respond'
};

export const defaultActionByStep: Record<string, string> = {
	Preparing: 'Send application',
	'Applied through job platform': 'Awaiting response',
	'Application form completed': 'Awaiting response',
	'E-mail sent': 'Awaiting response',
	'Resume / CV submitted': 'Awaiting response',
	'Screening call': 'Scheduled',
	'Technical interview': 'Need to schedule',
	'Hiring manager call': 'Need to schedule',
	'Team interview': 'Need to schedule',
	'Coding challenge': 'Need to complete',
	'Take-home assignment': 'Need to complete',
	'Assessment / test': 'Need to complete',
	'AI interview': 'Need to complete',
	'Offer received': 'Respond',
	'Counter-offer sent': 'Awaiting response'
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
								step: 'Applied through job platform',
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
					action: 'Respond',
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
