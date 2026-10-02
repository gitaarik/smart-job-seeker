import { describe, expect, it } from 'vitest';
import {
	currentRoundIndex,
	describeNextStep,
	formatRoundWhen,
	getQuickStatusActions,
	getStepperPhase,
	isComparedStatus,
	isFinishedStatus,
	nextStep,
	parseRounds,
	roundKindValues,
	roundState,
	sameRounds,
	stageLabel,
	stageRanks,
	statusOptions,
	stepsByPhase,
	type InterviewRound
} from '../application-status';

const TODAY = '2026-10-02';

function round(over: Partial<InterviewRound> = {}): InterviewRound {
	return { kind: null, date: null, time: null, with: null, ...over };
}

// The vocabulary is advisory for a person (the editor offers "Custom…") but the
// assistant is held to it: `update_application_status` refuses a stage these
// tables do not list. So anything the APP itself writes into the column has to
// be in them, or the app can reach a state its own capability would have
// rejected, and an undo of that state fails validation.
describe('the quick status actions', () => {
	const everyQuickAction = statusOptions.flatMap(({ value }) =>
		[null, ...(stepsByPhase[getStepperPhase(value)] ?? [])].flatMap((step) =>
			getQuickStatusActions(value, step).map((quick) => ({ from: `${value}/${step}`, quick }))
		)
	);

	it('cover something, since an empty sweep would pass every assertion below', () => {
		expect(everyQuickAction.length).toBeGreaterThan(0);
	});

	it('write a stage the status actually has', () => {
		for (const { from, quick } of everyQuickAction) {
			if (quick.step === null) continue;
			const steps = stepsByPhase[getStepperPhase(quick.status)] ?? [];
			expect(steps, `${from} → ${quick.label}`).toContain(quick.step);
		}
	});

	it('leave the stage off interviewing, whose position is its round, and off a finished status', () => {
		for (const { from, quick } of everyQuickAction) {
			const phase = getStepperPhase(quick.status);
			if (phase !== 'interviewing' && phase !== 'result') continue;
			expect(quick.step, `${from} → ${quick.label}`).toBeNull();
		}
	});

	it('open the editor for a new round rather than posting a blank one', () => {
		// A round is worth its date and kind. Every way into interviewing from the
		// quick row, and every way to the next round, goes through the editor.
		for (const { from, quick } of everyQuickAction) {
			if (quick.status !== 'interviewing') continue;
			expect(quick.addsRound, `${from} → ${quick.label}`).toBe(true);
		}
		expect(getQuickStatusActions('applying', 'Applied').map((q) => q.label)).toContain(
			'Invited to interview'
		);
		expect(getQuickStatusActions('interviewing', null).map((q) => q.label)).toContain('Next round');
	});
});

// A stage list keyed by label alone would let one label in two phases share a
// rank, which `stageRanks` being nested by phase is there to prevent.
describe('the stage labels', () => {
	it('name one position each, across every phase', () => {
		const seen = new Map<string, string>();
		for (const [phase, steps] of Object.entries(stepsByPhase)) {
			for (const step of steps) {
				expect(seen.get(step) ?? phase, `"${step}" is also a stage of`).toBe(phase);
				seen.set(step, phase);
			}
		}
	});

	it('are not offered for interviewing, which counts rounds instead', () => {
		expect(stepsByPhase.interviewing).toBeUndefined();
	});
});

// A stage with no rank scores 0, which is correct for a label someone typed and
// wrong for one in the list: a new stage added to the end of a phase would sort
// level with its earliest stage instead of after it.
describe('the stage ranks', () => {
	it('cover every offered stage, and nothing else', () => {
		for (const [phase, steps] of Object.entries(stepsByPhase)) {
			for (const step of steps) {
				expect(stageRanks[phase]?.[step], `${phase}/${step}`).toBeTypeOf('number');
			}
			expect(Object.keys(stageRanks[phase] ?? {}).sort()).toEqual([...steps].sort());
		}
	});

	it('rank nothing above the phases, which are 100 apart in stageRank', () => {
		for (const ranks of Object.values(stageRanks)) {
			for (const [step, rank] of Object.entries(ranks)) {
				expect(rank, step).toBeGreaterThanOrEqual(0);
				expect(rank, step).toBeLessThan(100);
			}
		}
	});
});

describe('roundState', () => {
	it('reads a round dated before today as done, and today or later as upcoming', () => {
		const rounds = [
			round({ date: '2026-10-01' }),
			round({ date: TODAY }),
			round({ date: '2026-10-08' })
		];
		expect(rounds.map((_, i) => roundState(rounds, i, TODAY))).toEqual([
			'done',
			'upcoming',
			'upcoming'
		]);
	});

	it('reads an undated last round as still to book, and an undated earlier one as done', () => {
		// Nobody writes the date of a round they have moved past, and there are no
		// planned rounds: an undated last round is an invitation not yet booked.
		const rounds = [round(), round()];
		expect(roundState(rounds, 0, TODAY)).toBe('done');
		expect(roundState(rounds, 1, TODAY)).toBe('unscheduled');
	});
});

describe('currentRoundIndex', () => {
	it('is the first round not yet done, so two rounds booked at once name the nearer', () => {
		const rounds = [
			round({ kind: 'Intro', date: '2026-09-20' }),
			round({ kind: 'Technical', date: '2026-10-06' }),
			round({ kind: 'Team', date: '2026-10-08' })
		];
		expect(currentRoundIndex(rounds, TODAY)).toBe(1);
	});

	it('is the last round once they are all behind you', () => {
		const rounds = [round({ date: '2026-09-20' }), round({ date: '2026-09-28' })];
		expect(currentRoundIndex(rounds, TODAY)).toBe(1);
	});

	it('is -1 without rounds', () => {
		expect(currentRoundIndex([], TODAY)).toBe(-1);
	});
});

describe('stageLabel', () => {
	it('names the current round in interviewing, with its kind when it has one', () => {
		const rounds = [round({ kind: 'Intro', date: '2026-09-20' }), round({ date: '2026-10-06' })];
		expect(stageLabel({ status: 'interviewing', interview_rounds: rounds }, TODAY)).toBe('Round 2');
		expect(stageLabel({ status: 'interviewing', interview_rounds: rounds }, '2026-09-19')).toBe(
			'Round 1 · Intro'
		);
	});

	it('is the stage itself elsewhere, and nothing once the application is finished', () => {
		expect(stageLabel({ status: 'applying', status_step: 'Applied' }, TODAY)).toBe('Applied');
		expect(stageLabel({ status: 'negotiating', status_step: 'Contract review' }, TODAY)).toBe(
			'Contract review'
		);
		expect(
			stageLabel(
				{ status: 'rejected', status_step: 'Offer received', interview_rounds: [round()] },
				TODAY
			)
		).toBeNull();
	});
});

describe('nextStep', () => {
	it('asks you to send an application still in Preparing, whatever an old applied date says', () => {
		const draft = {
			status: 'applying',
			status_step: 'Preparing',
			application_sent_date: '2026-08-04'
		};
		expect(nextStep(draft, TODAY)).toMatchObject({ label: 'Send application', waiting: false });
	});

	it('waits on the employer once the application is out, including under the old channel stages', () => {
		for (const status_step of ['Applied', 'Applied through job platform', 'E-mail sent']) {
			expect(nextStep({ status: 'applying', status_step }, TODAY), status_step).toMatchObject({
				label: 'Awaiting response',
				waiting: true
			});
		}
	});

	it('goes by the applied date when no stage was set', () => {
		expect(
			nextStep({ status: 'applying', application_sent_date: '2026-09-01' }, TODAY)?.waiting
		).toBe(true);
		expect(nextStep({ status: 'applying' }, TODAY)?.waiting).toBe(false);
	});

	it('asks you to book a round you were invited to', () => {
		const rounds = [round({ kind: 'Intro', date: '2026-09-20' }), round({ kind: 'Technical' })];
		expect(nextStep({ status: 'interviewing', interview_rounds: rounds }, TODAY)).toMatchObject({
			label: 'Schedule round 2',
			waiting: false
		});
		expect(nextStep({ status: 'interviewing', interview_rounds: [] }, TODAY)?.label).toBe(
			'Schedule round 1'
		);
	});

	it('names a booked round with its date and time, as your next thing', () => {
		const rounds = [round({ kind: 'Intro', date: '2026-10-08', time: '15:30' })];
		expect(nextStep({ status: 'interviewing', interview_rounds: rounds }, TODAY)).toEqual({
			label: 'Scheduled',
			waiting: false,
			date: '2026-10-08',
			time: '15:30'
		});
	});

	it('waits for the result the day after the interview, without anyone moving it', () => {
		// The edit people skipped: Scheduled to Awaiting result, by hand, after
		// every interview. The same stored round reads both ways depending on the day.
		const app = { status: 'interviewing', interview_rounds: [round({ date: '2026-10-08' })] };
		expect(nextStep(app, '2026-10-08')?.waiting).toBe(false);
		expect(nextStep(app, '2026-10-09')).toMatchObject({ label: 'Awaiting result', waiting: true });
	});

	it('says whose move it is at each negotiating stage', () => {
		const at = (status_step: string) => nextStep({ status: 'negotiating', status_step }, TODAY);
		expect(at('Offer received')).toMatchObject({ label: 'Reply to offer', waiting: false });
		expect(at('Counter-offer sent')).toMatchObject({ waiting: true });
		expect(at('Revised offer received')).toMatchObject({ waiting: false });
		expect(at('Background check')).toMatchObject({ waiting: true });
		expect(at('Contract review')).toMatchObject({ label: 'Review the contract', waiting: false });
	});

	it('has no next step for a stage it does not know, or once the application is finished', () => {
		expect(
			nextStep({ status: 'negotiating', status_step: 'Coffee with the CEO' }, TODAY)
		).toBeNull();
		for (const status of ['accepted', 'rejected', 'withdrawn']) {
			expect(nextStep({ status }, TODAY), status).toBeNull();
		}
	});

	it('covers every negotiating stage the editor offers', () => {
		for (const status_step of stepsByPhase.negotiating) {
			expect(nextStep({ status: 'negotiating', status_step }, TODAY), status_step).not.toBeNull();
		}
	});
});

describe('parseRounds', () => {
	it('keeps the four fields, turns blanks into null and pads a short time', () => {
		const parsed = parseRounds([
			{ kind: ' Intro ', date: '2026-10-08', time: '9:30', with: 'Anna (CTO)' },
			{ kind: '', date: '', time: null }
		]);
		expect(parsed).toEqual({
			ok: true,
			rounds: [
				{ kind: 'Intro', date: '2026-10-08', time: '09:30', with: 'Anna (CTO)' },
				{ kind: null, date: null, time: null, with: null }
			]
		});
	});

	it('refuses what is not a list of rounds, or a date or time it cannot read', () => {
		expect(parseRounds('Intro').ok).toBe(false);
		expect(parseRounds([null]).ok).toBe(false);
		expect(parseRounds([{ date: '8 October' }]).ok).toBe(false);
		expect(parseRounds([{ time: '25:00' }]).ok).toBe(false);
		expect(parseRounds(Array.from({ length: 21 }, () => ({}))).ok).toBe(false);
	});

	it('accepts a kind of their own, since only the assistant is held to the list', () => {
		expect(roundKindValues).not.toContain('Coffee with the CTO');
		expect(parseRounds([{ kind: 'Coffee with the CTO' }])).toMatchObject({ ok: true });
	});
});

describe('sameRounds', () => {
	it('compares field by field, whatever order the keys came back in', () => {
		// jsonb hands keys back in its own order, not the order they were written.
		const fromDatabase = JSON.parse(
			'[{"date":"2026-10-08","kind":"Intro","time":null,"with":null}]'
		);
		expect(sameRounds(fromDatabase, [round({ kind: 'Intro', date: '2026-10-08' })])).toBe(true);
		expect(sameRounds(fromDatabase, [round({ kind: 'Intro', date: '2026-10-09' })])).toBe(false);
		expect(sameRounds(fromDatabase, [])).toBe(false);
	});
});

describe('formatRoundWhen and describeNextStep', () => {
	it('write the day without a year, and the time on the applicant’s clock', () => {
		expect(formatRoundWhen('2026-10-08', '15:30')).toBe('Thu, Oct 8, 15:30');
		expect(formatRoundWhen('2026-10-08', '15:30', '12h')).toBe('Thu, Oct 8, 3:30 PM');
		expect(formatRoundWhen('2026-10-08', '00:05', '12h')).toBe('Thu, Oct 8, 12:05 AM');
		expect(formatRoundWhen('2026-10-08', null)).toBe('Thu, Oct 8');
		expect(formatRoundWhen(null, '15:30')).toBe('');
	});

	it('put the booking after the label, and leave a label without one alone', () => {
		const booked = { label: 'Scheduled', waiting: false, date: '2026-10-08', time: '15:30' };
		expect(describeNextStep(booked)).toBe('Scheduled for Thu, Oct 8, 15:30');
		expect(
			describeNextStep({ label: 'Awaiting result', waiting: true, date: null, time: null })
		).toBe('Awaiting result');
	});
});

// The comparison the assistant reads on every page, and the summaries that feed
// it, keeps what is in play and what they accepted. A job they have taken is the
// baseline for every other offer, so leaving it out as "finished" hid the terms
// they had set against it everywhere but its own page.
describe('the compared statuses', () => {
	it('keep every status still in play', () => {
		for (const { value } of statusOptions) {
			if (!isFinishedStatus(value)) expect(isComparedStatus(value), value).toBe(true);
		}
	});

	it('keep an accepted application, and leave out the rest of the finished ones', () => {
		expect(isComparedStatus('accepted')).toBe(true);
		expect(isComparedStatus('rejected')).toBe(false);
		expect(isComparedStatus('withdrawn')).toBe(false);
	});
});
