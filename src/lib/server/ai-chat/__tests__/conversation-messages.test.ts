/**
 * Unit tests for replaying a version trail as chat turns. Pure logic over the
 * turn list — the DB read is a thin wrapper and is covered by the shape of the
 * rows these tests feed in.
 */
import { describe, expect, it } from 'vitest';

import { HISTORY_TOKEN_BUDGET, turnsToMessages, type VersionTurn } from '../conversation-messages';

/** A version row with only the fields a given turn actually carries. */
function turn(t: Partial<VersionTurn>): VersionTurn {
	return {
		user_request: null,
		ai_feedback: null,
		content: null,
		source: 'ai_revision',
		...t
	};
}

describe('turnsToMessages', () => {
	it('replays a thread as alternating user/assistant turns', async () => {
		const messages = await turnsToMessages(
			[
				turn({
					source: 'ai_generation',
					ai_feedback: 'Led with your AI work.',
					content: 'Draft one.'
				}),
				turn({
					user_request: 'Make it shorter.',
					ai_feedback: 'Trimmed it.',
					content: 'Draft two.'
				})
			],
			{ noun: 'letter' }
		);

		expect(messages.map((m) => m.role)).toEqual(['user', 'assistant', 'user', 'assistant']);
		// The opening "generate" click carried no message of its own, so the thread
		// would otherwise start on an assistant turn.
		expect(messages[0].content).toBe('Write the first draft of the letter.');
		expect(messages[2].content).toBe('Make it shorter.');
		expect(messages[3].content).toContain('Trimmed it.');
		expect(messages[3].content).toContain('Draft two.');
	});

	it('marks an advice turn as not having changed the text', async () => {
		// The regression this module exists for: advice the applicant agreed to,
		// which never reached a draft, must not read as already applied.
		const messages = await turnsToMessages(
			[
				turn({
					source: 'ai_advice',
					user_request: 'Should I lead with the intro?',
					ai_feedback: 'Yes — the intro seeds every follow-up question.'
				})
			],
			{ noun: 'letter' }
		);

		expect(messages).toHaveLength(2);
		expect(messages[1].content).toContain('the intro seeds every follow-up question');
		expect(messages[1].content).toContain('Advice only');
		expect(messages[1].content).toContain('still needs to be applied');
	});

	it('points at the current draft instead of quoting it a second time', async () => {
		const current = 'The letter as it stands.';
		const messages = await turnsToMessages(
			[
				turn({
					user_request: 'Rewrite it.',
					ai_feedback: 'Done.',
					content: current
				})
			],
			{ noun: 'letter', currentContent: current }
		);

		expect(messages[1].content).not.toContain(current);
		expect(messages[1].content).toContain('shown in full above');
	});

	it('still quotes superseded drafts, so earlier wording can be restored', async () => {
		const messages = await turnsToMessages(
			[
				turn({
					user_request: 'Add the Chipta migration.',
					ai_feedback: 'Added.',
					content: 'Older draft, with Chipta.'
				}),
				turn({
					user_request: 'Shorter.',
					ai_feedback: 'Trimmed.',
					content: 'Current draft.'
				})
			],
			{ noun: 'letter', currentContent: 'Current draft.' }
		);

		expect(messages[1].content).toContain('Older draft, with Chipta.');
		expect(messages[3].content).toContain('shown in full above');
	});

	it('replays a version the applicant wrote themselves as their own turn', async () => {
		const messages = await turnsToMessages(
			[turn({ source: 'manual_edit', content: 'My own wording.' })],
			{ noun: 'answer' }
		);

		expect(messages).toHaveLength(1);
		expect(messages[0].role).toBe('user');
		expect(messages[0].content).toContain('I wrote this version of the answer');
		expect(messages[0].content).toContain('My own wording.');
	});

	it('merges consecutive same-role turns', async () => {
		// "Delete response, keep my message" leaves a user turn with no reply; the
		// next message would otherwise arrive as a second user turn in a row.
		const messages = await turnsToMessages(
			[turn({ user_request: 'First ask.' }), turn({ user_request: 'Second ask.' })],
			{ noun: 'letter' }
		);

		expect(messages).toHaveLength(1);
		expect(messages[0].role).toBe('user');
		expect(messages[0].content).toContain('First ask.');
		expect(messages[0].content).toContain('Second ask.');
	});

	it("uses the entity's own noun", async () => {
		const messages = await turnsToMessages(
			[
				turn({
					source: 'ai_advice',
					user_request: 'Thoughts?',
					ai_feedback: 'Some.'
				})
			],
			{ noun: 'sheet' }
		);

		expect(messages[1].content).toContain('I did not change the sheet');
	});

	it('drops the oldest turns when the thread exceeds its token budget', async () => {
		// ~4 chars/token, so this alone is twice the whole thread's budget.
		const big = 'x'.repeat(HISTORY_TOKEN_BUDGET * 4 * 2);
		const messages = await turnsToMessages(
			[
				turn({
					user_request: 'Oldest ask.',
					ai_feedback: 'Old reply.',
					content: big
				}),
				turn({ user_request: 'Newest ask.', ai_feedback: 'New reply.' })
			],
			{ noun: 'letter' }
		);

		const joined = messages.map((m) => m.content).join('\n');
		expect(joined).toContain('Newest ask.');
		expect(joined).not.toContain('Oldest ask.');
	});

	it('opens on a user turn so it can follow a system message', async () => {
		// ~4 chars/token, so this alone is twice the whole thread's budget.
		const big = 'x'.repeat(HISTORY_TOKEN_BUDGET * 4 * 2);
		const messages = await turnsToMessages(
			[
				turn({
					source: 'ai_generation',
					ai_feedback: 'Opening note.',
					content: big
				}),
				turn({ user_request: 'Now change it.', ai_feedback: 'Changed.' })
			],
			{ noun: 'letter' }
		);

		expect(messages[0].role).toBe('user');
	});

	it('returns nothing for an empty trail', async () => {
		expect(await turnsToMessages([], { noun: 'letter' })).toEqual([]);
	});
});
