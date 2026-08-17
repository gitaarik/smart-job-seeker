/**
 * Tests for the outcome block replayed with a past assistant turn.
 *
 * What is worth pinning is the distinction the whole file exists for: a
 * proposal the user accepted and a proposal still sitting on screen must not
 * read the same, because a model that cannot tell them apart re-proposes the
 * one it already made. That is not hypothetical — it is chat 59, where a role
 * project was added, rewritten by the user, and added again.
 */

import { describe, expect, it } from 'vitest';
import { renderProposalOutcomes, type ProposalOutcome } from '../proposal-outcomes';

const ADDED: ProposalOutcome = {
	capability: 'add_work_experience_project',
	target: { id: 1, label: 'their role projects' },
	createdRow: { id: 256, label: 'High-Traffic Ticket Shop Scaling' },
	applied: true
};

const PENDING: ProposalOutcome = {
	capability: 'edit_job_details',
	target: { id: 3818, label: 'Data Engineer at Testco' },
	createdRow: null,
	applied: false
};

describe('renderProposalOutcomes', () => {
	it('says nothing for a turn that proposed nothing', () => {
		// Every user turn, and most assistant ones. An empty heading here would be
		// paid for on each of them.
		expect(renderProposalOutcomes([])).toBe('');
	});

	it('names the row an accepted add created, by id', () => {
		const block = renderProposalOutcomes([ADDED]);

		expect(block).toContain('APPLIED');
		expect(block).toContain('High-Traffic Ticket Shop Scaling');
		expect(block).toContain('target_id 256');
		// The instruction the duplicate cost. Without it the model is left matching
		// its own draft against a name in a list, which is the inference it got
		// wrong the first time.
		expect(block).toContain('never propose adding it again');
	});

	it('marks a proposal nobody has accepted as still open', () => {
		const block = renderProposalOutcomes([PENDING]);

		expect(block).toContain('NOT APPLIED');
		expect(block).toContain('Data Engineer at Testco');
		// A rewrite of something still pending replaces the card rather than
		// stacking a second one beside it.
		expect(block).toContain('replaces this one');
	});

	it('keeps one turn’s proposals apart, since each has its own decision', () => {
		const block = renderProposalOutcomes([ADDED, PENDING]);

		expect(block).toContain('APPLIED');
		expect(block).toContain('NOT APPLIED');
		expect(block.split('\n- ')).toHaveLength(3);
	});

	it('describes an applied edit without inventing a row it created', () => {
		// Only an add makes one. An edit changed something that already existed,
		// and the target it names is that thing.
		const block = renderProposalOutcomes([{ ...PENDING, applied: true }]);

		expect(block).toContain('APPLIED');
		expect(block).not.toContain('target_id');
		expect(block).toContain('propose only what should change');
	});

	it('still says an add landed when no id was recorded for it', () => {
		// Proposals applied before `created_row` existed have none, and the entry
		// is no less real for it. Branching on the id rather than on the verb put
		// exactly those into the edit wording — "propose only what should change
		// from there" — which is the opposite of what an add has to convey, and
		// chat 59's own two rows are that case.
		const block = renderProposalOutcomes([{ ...ADDED, createdRow: null }]);

		expect(block).toContain('never propose adding it again');
		expect(block).not.toContain('target_id');
	});

	it('says the ids are as-at-the-time, so a deleted row is not asserted to exist', () => {
		// The block is history; the capability blocks of the current turn are read
		// fresh and authorized. Where they disagree, they win.
		expect(renderProposalOutcomes([ADDED])).toContain('capability blocks of the current turn');
	});
});
