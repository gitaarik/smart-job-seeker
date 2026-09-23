import { describe, expect, it } from 'vitest';
import {
	actionsByPhase,
	actionsByStep,
	defaultActionByStep,
	getQuickStatusActions,
	getStepperPhase,
	isComparedStatus,
	isFinishedStatus,
	stageRanks,
	statusOptions,
	stepsByPhase
} from '../application-status';

// The vocabulary is advisory for a person — the editor offers "Custom…" — but
// the assistant is held to it: `update_application_status` refuses a stage or a
// next action that these tables do not list. So anything the APP itself writes
// into the column has to be in them, or the app can reach a state its own
// capability would have rejected, and an undo of that state fails validation.
describe('the quick status actions', () => {
	const everyQuickAction = statusOptions.flatMap(({ value }) =>
		[null, ...(stepsByPhase[getStepperPhase(value)] ?? [])].flatMap((step) =>
			getQuickStatusActions(value, step).map((quick) => ({ from: `${value}/${step}`, quick }))
		)
	);

	it('cover something — an empty sweep would pass every assertion below', () => {
		expect(everyQuickAction.length).toBeGreaterThan(0);
	});

	it('write a stage the status actually has', () => {
		for (const { from, quick } of everyQuickAction) {
			if (quick.step === null) continue;
			const steps = stepsByPhase[getStepperPhase(quick.status)] ?? [];
			expect(steps, `${from} → ${quick.label}`).toContain(quick.step);
		}
	});

	it('write a next action that stage offers', () => {
		for (const { from, quick } of everyQuickAction) {
			if (quick.action === null) continue;
			const offered = [
				...(quick.step ? (actionsByStep[quick.step] ?? []) : []),
				...(actionsByPhase[getStepperPhase(quick.status)] ?? [])
			];
			expect(offered, `${from} → ${quick.label}`).toContain(quick.action);
		}
	});

	it('leave both off a status that finishes the application', () => {
		// A finished application has no stage, and the capability rejects one sent
		// with it. `stepsByPhase` has no `result` key, so a quick action that set a
		// step here would also be unlisted by the test above rather than caught.
		for (const { from, quick } of everyQuickAction) {
			if (getStepperPhase(quick.status) !== 'result') continue;
			expect({ from, ...quick }).toMatchObject({ step: null, action: null });
		}
	});
});

// Picking a stage in the editor fills the next action from `defaultActionByStep`,
// falling back to the phase default — which `interviewing` does not have, so a
// stage missing an entry here silently offers no next action at all. An
// application with no next action is read as waiting on the employer
// (`applicationTier`), so the cost is a stage that quietly drops out of the
// "needs you" band.
describe('the default next action per stage', () => {
	it('exists for every stage, and is one that stage offers', () => {
		for (const [phase, steps] of Object.entries(stepsByPhase)) {
			for (const step of steps) {
				const fallback = defaultActionByStep[step];
				expect(fallback, `${phase}/${step}`).toBeTruthy();
				expect(actionsByStep[step] ?? [], `${phase}/${step}`).toContain(fallback);
			}
		}
	});
});

// `actionsByStep` and `defaultActionByStep` are keyed by the label alone, with no
// phase, so the same label in two phases would silently share one action list.
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
});

// A stage with no rank scores 0, which is correct for a label someone typed and
// wrong for one in the list: a new stage added to the end of a phase would sort
// level with its earliest stage instead of after it, which is invisible until a
// pipeline is long enough to notice the row in the wrong place.
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

// `actionsFor` unions a stage's list with its phase's, so the editor offers both
// and the capability accepts both. `STATUS_VOCABULARY` shows the assistant only
// the phase list, so an action that lives only on a stage is one the app offers
// and the assistant is refused for proposing. That gap held "Answer application
// questions", which the timeline shows people do pick.
describe('the phase action lists', () => {
	it('contain every action their own stages offer', () => {
		for (const [phase, steps] of Object.entries(stepsByPhase)) {
			const phaseActions = actionsByPhase[phase] ?? [];
			for (const step of steps) {
				for (const action of actionsByStep[step] ?? []) {
					expect(phaseActions, `${phase}/${step} offers "${action}"`).toContain(action);
				}
			}
		}
	});
});

// The comparison the assistant reads on every page — and the summaries that feed
// it — keeps what is in play and what they accepted. A job they have taken is the
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
