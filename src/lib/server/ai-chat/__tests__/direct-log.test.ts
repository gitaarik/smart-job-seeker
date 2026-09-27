/**
 * Acting on the direct-write gate: what gets written without a click, what is
 * left a card, and the reason each card is stored with.
 *
 * The gate's own rules are pinned in direct-writes.test.ts. This file is about
 * everything around it: the flag, the paste marks, the thread's earlier
 * entries, the burst ceiling, and writing a direct entry exactly the way the
 * Apply button would.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

let flagOn = true;
vi.mock('$lib/server/config', () => ({
	config: {
		get assistantDirectLogs() {
			return flagOn;
		}
	}
}));

/** Rows `lastThreadLogs` reads: the thread's latest entry per application. */
let threadLogs: { application: number; at: Date | null }[] = [];
const mockUpdate = vi.fn();
vi.mock('$lib/server/db', () => {
	const selectChain = {
		from: () => selectChain,
		innerJoin: () => selectChain,
		where: () => selectChain,
		groupBy: () => Promise.resolve(threadLogs)
	};
	return {
		dbDirect: {
			select: () => selectChain,
			update: (table: { name: string }) => ({
				set: (values: Record<string, unknown>) => ({
					where: (where: unknown) => {
						mockUpdate(table.name, values, where);
						return Promise.resolve();
					}
				})
			})
		}
	};
});

vi.mock('drizzle-orm', () => ({
	eq: vi.fn((_c: unknown, v: unknown) => v),
	and: vi.fn((...a: unknown[]) => a),
	isNotNull: vi.fn((c: unknown) => c),
	max: vi.fn((c: unknown) => c),
	sql: vi.fn(() => 'sql')
}));

vi.mock('$lib/server/db/schema', () => ({
	agent_message_proposals: {
		name: 'agent_message_proposals',
		id: 'amp.id',
		message_id: 'amp.message_id',
		capability: 'amp.capability',
		target: 'amp.target',
		applied_at: 'amp.applied_at'
	},
	agent_messages: { name: 'agent_messages', id: 'am.id', conversation_id: 'am.conversation_id' },
	capability_edits: { name: 'capability_edits', id: 'ce.id' }
}));

const mockRecent = vi.fn();
vi.mock('$lib/server/mcp/burst', () => ({
	recentDirectWrites: (...a: unknown[]) => mockRecent(...a)
}));
vi.mock('$lib/server/mcp/tiers', () => ({ DIRECT_WRITE_BURST: 20 }));

const mockExecute = vi.fn();
vi.mock('../capabilities', () => ({
	executeCapability: (...a: unknown[]) => mockExecute(...a)
}));

import { type DirectLogTurn, logReportedEvents } from '../direct-log';

const APPLICATION = { id: 42, label: 'Staff Engineer at Acme' };

function turn(overrides: Partial<DirectLogTurn> = {}): DirectLogTurn {
	return {
		actor: { profileId: 12, isStaff: false },
		conversationId: 7,
		message: 'he replied: they want a second round on Thursday',
		pasted: [],
		reply: 'That is good news. Thursday gives you two days to prepare.',
		proposals: [
			{
				id: 301,
				capability: 'add_activity_record',
				fields: { entry_content: 'Invited to a second round on Thursday.' },
				target: APPLICATION
			}
		],
		...overrides
	};
}

/** The dispositions stored on proposal rows, in the order they were written. */
function storedDispositions(): unknown[] {
	return mockUpdate.mock.calls
		.filter(([table]) => table === 'agent_message_proposals')
		.map(([, values]) => (values as { disposition?: unknown }).disposition);
}

beforeEach(() => {
	flagOn = true;
	threadLogs = [];
	mockUpdate.mockReset();
	mockRecent.mockReset().mockResolvedValue(0);
	mockExecute.mockReset().mockResolvedValue({
		ok: true,
		previous: {},
		editId: 900,
		created: { id: 5001, label: 'Second round invitation' }
	});
});

describe('logReportedEvents', () => {
	it('does nothing at all with the flag off', async () => {
		flagOn = false;

		expect((await logReportedEvents(turn())).size).toBe(0);
		expect(mockExecute).not.toHaveBeenCalled();
		expect(mockUpdate).not.toHaveBeenCalled();
	});

	it('leaves every other capability alone, and unrecorded', async () => {
		const outcomes = await logReportedEvents(
			turn({
				proposals: [
					{
						id: 302,
						capability: 'edit_job_details',
						fields: { salary_min: 1 },
						target: APPLICATION
					}
				]
			})
		);

		expect(outcomes.size).toBe(0);
		expect(mockUpdate).not.toHaveBeenCalled();
	});

	it('writes a reported event the way the Apply button would', async () => {
		const outcomes = await logReportedEvents(turn());

		expect(mockExecute).toHaveBeenCalledWith(
			'add_activity_record',
			APPLICATION,
			{ profileId: 12, isStaff: false },
			{ entry_content: 'Invited to a second round on Thursday.' },
			'chat'
		);
		expect(outcomes.get(301)).toMatchObject({
			disposition: 'direct',
			written: { createdRow: { id: 5001 }, editId: 900 }
		});
		const [, proposalWrite] = mockUpdate.mock.calls.find(([t]) => t === 'agent_message_proposals')!;
		expect(proposalWrite).toMatchObject({
			disposition: 'direct',
			created_row: { id: 5001, label: 'Second round invitation' },
			previous: {}
		});
		expect(proposalWrite.applied_at).toBeInstanceOf(Date);
		// The edit log's link back, which is what the receipt's Undo follows.
		expect(mockUpdate).toHaveBeenCalledWith('capability_edits', { proposal_id: 301 }, 900);
	});

	it('keeps a card, and says why, for a turn that came without paste marks', async () => {
		const outcomes = await logReportedEvents(turn({ pasted: undefined }));

		expect(outcomes.get(301)?.disposition).toBe('unmarked');
		expect(mockExecute).not.toHaveBeenCalled();
		expect(storedDispositions()).toEqual(['unmarked']);
	});

	it('keeps a card while the text is still being drafted', async () => {
		const outcomes = await logReportedEvents(turn({ message: 'make it a bit more brief' }));

		expect(outcomes.get(301)?.disposition).toBe('own_words');
		expect(mockExecute).not.toHaveBeenCalled();
		expect(storedDispositions()).toEqual(['own_words']);
	});

	it('keeps a card within half an hour of an entry from this thread on the same application', async () => {
		threadLogs = [{ application: 42, at: new Date(Date.now() - 5 * 60 * 1000) }];

		expect((await logReportedEvents(turn())).get(301)?.disposition).toBe('recent_log');
		expect(mockExecute).not.toHaveBeenCalled();
	});

	it('is not held back by an entry the thread logged on another application', async () => {
		threadLogs = [{ application: 43, at: new Date(Date.now() - 5 * 60 * 1000) }];

		expect((await logReportedEvents(turn())).get(301)?.disposition).toBe('direct');
	});

	it('writes two things reported in one message, not the first and a card', async () => {
		// Two facts are two entries by the capability's contract; the first one
		// landing is not a recent log for the second.
		const outcomes = await logReportedEvents(
			turn({
				message: 'I sent the form, and they called to book the interview',
				proposals: [
					{
						id: 301,
						capability: 'add_activity_record',
						fields: { entry_content: 'Sent the form.' },
						target: APPLICATION
					},
					{
						id: 303,
						capability: 'add_activity_record',
						fields: { entry_content: 'They called to book the interview.' },
						target: APPLICATION
					}
				]
			})
		);

		expect(outcomes.get(301)?.disposition).toBe('direct');
		expect(outcomes.get(303)?.disposition).toBe('direct');
	});

	it("counts this turn's own writes against the burst ceiling", async () => {
		mockRecent.mockResolvedValue(19);
		const outcomes = await logReportedEvents(
			turn({
				proposals: [
					{
						id: 301,
						capability: 'add_activity_record',
						fields: { entry_content: 'a' },
						target: APPLICATION
					},
					{
						id: 303,
						capability: 'add_activity_record',
						fields: { entry_content: 'b' },
						target: APPLICATION
					}
				]
			})
		);

		expect(outcomes.get(301)?.disposition).toBe('direct');
		expect(outcomes.get(303)?.disposition).toBe('burst');
	});

	it('leaves a card when the gate passes it and the write turns it down', async () => {
		mockExecute.mockResolvedValue({ ok: false, reason: 'unauthorized', error: 'No longer yours.' });

		const outcomes = await logReportedEvents(turn());

		expect(outcomes.get(301)?.disposition).toBe('refused');
		expect(storedDispositions()).toEqual(['refused']);
	});
});
