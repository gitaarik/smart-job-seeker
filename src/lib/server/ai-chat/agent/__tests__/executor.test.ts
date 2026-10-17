/**
 * What the agent's tool calls do (planning/ASSISTANT-AGENT.md, Phase 2): a
 * read through the MCP read tools for the turn's actor, a write held to the
 * proposal checks and answered with the receipt, the memo, the cut, and the
 * scrub for an anonymous application. The registry is real, with one
 * capability's row read stubbed; the MCP read tool is stubbed whole, since
 * what it does is call.test.ts.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ToolCall } from '$lib/server/llm';

const mockReadTool = vi.fn();
vi.mock('$lib/server/mcp/call', () => ({
	readTool: (...args: unknown[]) => mockReadTool(...args)
}));

import { CAPABILITIES } from '$lib/server/ai-chat/capabilities';
import { candidateFromCall, PROPOSAL_RECEIPT, scrubIdentity, TurnExecutor } from '../executor';

const actor = { profileId: 12, isStaff: false };
const job = {
	capability: 'edit_job_details' as const,
	targets: [{ id: 100, label: 'Data Engineer at Acme' }],
	current: { title: 'Data Engineer', salary_min: 5, salary_max: 9 }
};
const call = (name: string, args: Record<string, unknown>, id = 'c1'): ToolCall => ({
	id,
	name,
	args
});
const answer = (text: string, isError = false) => ({
	content: [{ type: 'text' as const, text }],
	isError
});

beforeEach(() => {
	vi.clearAllMocks();
	mockReadTool.mockResolvedValue(answer('Job 100:\n\ntitle: Data Engineer'));
});

describe('a read', () => {
	it('runs the MCP read tool for this profile, as a propose actor reading documents', async () => {
		const executor = new TurnExecutor({ actor, live: [job] });
		const done = await executor.execute(call('read_job', { job_id: 100 }));

		expect(mockReadTool).toHaveBeenCalledWith(
			'read_job',
			{ job_id: 100 },
			{ profileId: 12, scope: 'propose', readScope: 'documents', sliceChars: 6000 }
		);
		expect(done).toMatchObject({
			kind: 'read',
			content: 'Job 100:\n\ntitle: Data Engineer',
			isError: false,
			chars: 'Job 100:\n\ntitle: Data Engineer'.length,
			cut: false,
			fromMemo: false
		});
		expect(executor.proposals).toEqual([]);
	});

	it("hands the tool's refusal back as the result, marked as one", async () => {
		mockReadTool.mockResolvedValueOnce(answer('There is no job 7 in this applicant’s jobs.', true));
		const done = await new TurnExecutor({ actor, live: [] }).execute(
			call('read_job', { job_id: 7 })
		);
		expect(done.isError).toBe(true);
		expect(done.content).toContain('no job 7');
	});

	it('cuts a whole read longer than the slice, and says so', async () => {
		mockReadTool.mockResolvedValueOnce(answer('x'.repeat(200)));
		const done = await new TurnExecutor({ actor, live: [], sliceChars: 50 }).execute(
			call('list_jobs', {})
		);
		expect(done.content.startsWith('x'.repeat(50) + '\n\n[Cut at 50 of 200 characters.')).toBe(
			true
		);
		expect(done.content).not.toContain('x'.repeat(51));
		expect(done).toMatchObject({ chars: 200, cut: true });
	});

	it('leaves a sliced read whole: it is a slice already and says where to continue', async () => {
		mockReadTool.mockResolvedValueOnce(answer('y'.repeat(200)));
		const done = await new TurnExecutor({ actor, live: [], sliceChars: 50 }).execute(
			call('read_activity_entry', { application_id: 1, entry_id: 2 })
		);
		expect(mockReadTool.mock.calls[0][2]).toMatchObject({ sliceChars: 50 });
		expect(done).toMatchObject({ content: 'y'.repeat(200), chars: 200, cut: false });
	});

	it('answers the same call again from the memo, whatever order its arguments came in', async () => {
		const executor = new TurnExecutor({ actor, live: [] });
		const first = await executor.execute(call('read_text', { kind: 'letter', text_id: 3 }, 'a'));
		const again = await executor.execute(call('read_text', { text_id: 3, kind: 'letter' }, 'b'));

		expect(mockReadTool).toHaveBeenCalledTimes(1);
		expect(again).toMatchObject({ content: first.content, fromMemo: true, call: { id: 'b' } });
	});
});

describe('a write', () => {
	it('becomes the proposal the route stores today, and the model gets the receipt', async () => {
		const executor = new TurnExecutor({ actor, live: [job] });
		const done = await executor.execute(
			call('edit_job_details', { job_id: 100, salary_min: '6', rationale: 'You asked.' })
		);

		expect(mockReadTool).not.toHaveBeenCalled();
		expect(done).toMatchObject({ kind: 'propose', content: PROPOSAL_RECEIPT, isError: false });
		// Exactly what readProposal gives the route: the field coerced to the
		// capability's kind, the before-image narrowed to it, the authorized row.
		expect(done.proposal).toEqual({
			capability: 'edit_job_details',
			rationale: 'You asked.',
			fields: { salary_min: 6 },
			previous: { salary_min: 5 },
			target: { id: 100, label: 'Data Engineer at Acme' }
		});
		expect(executor.proposals).toEqual([done.proposal]);
	});

	it('refuses a row that is not on this page, with the reason, and keeps nothing', async () => {
		const executor = new TurnExecutor({ actor, live: [job] });
		const done = await executor.execute(
			call('edit_job_details', { job_id: 999, salary_min: 6, rationale: 'r' })
		);
		expect(done).toMatchObject({
			kind: 'propose',
			isError: true,
			content: "Not recorded: it named one that isn't on this page. Nothing has changed.",
			drop: { what: CAPABILITIES.edit_job_details.title }
		});
		expect(done.proposal).toBeUndefined();
		expect(executor.proposals).toEqual([]);
	});

	it('refuses a capability the page did not make live', async () => {
		const done = await new TurnExecutor({ actor, live: [] }).execute(
			call('edit_job_details', { job_id: 100, salary_min: 6, rationale: 'r' })
		);
		expect(done.content).toBe(
			"Not recorded: that isn't something you can change from this page. Nothing has changed."
		);
		expect(done.isError).toBe(true);
	});

	it('keeps one proposal for the same call made twice', async () => {
		const executor = new TurnExecutor({ actor, live: [job] });
		const args = { job_id: 100, salary_min: 6, rationale: 'r' };
		await executor.execute(call('edit_job_details', args, 'a'));
		const again = await executor.execute(call('edit_job_details', args, 'b'));
		expect(again).toMatchObject({ content: PROPOSAL_RECEIPT, fromMemo: true });
		expect(executor.proposals).toHaveLength(1);
	});
});

describe('candidateFromCall', () => {
	it('splits the row id and the rationale off the fields, and drops a profile_id', () => {
		expect(
			candidateFromCall(
				call('edit_language', {
					entry_id: 9,
					profile_id: 12,
					'language.name': 'Dutch',
					'language.proficiency': 'C1',
					rationale: 'Spelled as the CV spells it.'
				})
			)
		).toEqual({
			capability: 'edit_language',
			target_id: 9,
			rationale: 'Spelled as the CV spells it.',
			changes: [
				{ field: 'language.name', value: 'Dutch' },
				{ field: 'language.proficiency', value: 'C1' }
			]
		});
	});

	it('names the row by the argument the MCP tool uses for it', () => {
		expect(
			candidateFromCall(call('edit_job_details', { job_id: 100, title: 'x', rationale: 'r' }))
		).toMatchObject({ target_id: 100, changes: [{ field: 'title', value: 'x' }] });
		expect(
			candidateFromCall(
				call('add_activity_record', { application_id: 44, entry_content: 'Sent.', rationale: 'r' })
			)
		).toMatchObject({ target_id: 44, changes: [{ field: 'entry_content', value: 'Sent.' }] });
	});
});

describe('an anonymous application', () => {
	const identity = { name: 'Rik Wanders', companyName: 'Lightpunks', linkMarks: ['gitaarik'] };

	it('refuses read_profile_section without calling it', async () => {
		const done = await new TurnExecutor({ actor, live: [], identity }).execute(
			call('read_profile_section', { section: 'work_experience' })
		);
		expect(mockReadTool).not.toHaveBeenCalled();
		expect(done.isError).toBe(true);
		expect(done.content).toContain('anonymous');
	});

	it('scrubs the identity out of every other read', async () => {
		mockReadTool.mockResolvedValueOnce(
			answer(
				'Contact Rik Wanders (Lightpunks) at https://github.com/gitaarik or https://example.com'
			)
		);
		const done = await new TurnExecutor({ actor, live: [], identity }).execute(
			call('read_job', { job_id: 100 })
		);
		expect(done.content).toBe(
			'Contact the applicant (their own business) at [a link to the applicant] or https://example.com'
		);
	});

	it('leaves text alone when the identity has nothing in it', () => {
		expect(scrubIdentity('As is.', { name: null, companyName: null, linkMarks: [] })).toBe(
			'As is.'
		);
	});
});
