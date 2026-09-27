/**
 * Tests for the proposal-undo endpoint: the receipt's Undo for an entry the
 * assistant logged without a click.
 *
 * What this route owns is finding the proposal through the caller's own
 * conversation and the edit that applied it. Whether the undo is allowed is
 * `revertEdit`'s question, tested in ai-chat/__tests__/edit-log.test.ts; here it
 * only has to be asked with the right actor, and its answer passed on.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

/** What each select in turn returns: the proposal row, then the edit row. */
let results: unknown[][] = [];

vi.mock('$lib/server/db', () => {
	const selectChain = {
		from: () => selectChain,
		innerJoin: () => selectChain,
		where: () => selectChain,
		orderBy: () => selectChain,
		limit: () => Promise.resolve(results.shift() ?? [])
	};
	return { dbDirect: { select: () => selectChain } };
});

vi.mock('drizzle-orm', () => ({
	eq: vi.fn((_c: unknown, v: unknown) => v),
	and: vi.fn((...a: unknown[]) => a),
	desc: vi.fn((c: unknown) => c)
}));

vi.mock('$lib/server/db/schema', () => ({
	agent_conversations: { id: 'ac.id', user_id: 'ac.user_id' },
	agent_messages: {
		id: 'am.id',
		conversation_id: 'am.conversation_id',
		profile_id: 'am.profile_id'
	},
	agent_message_proposals: {
		id: 'amp.id',
		message_id: 'amp.message_id',
		applied_at: 'amp.applied_at'
	},
	capability_edits: { id: 'ce.id', proposal_id: 'ce.proposal_id', profile_id: 'ce.profile_id' }
}));

const mockRevert = vi.fn();
vi.mock('$lib/server/ai-chat/edit-log', () => ({
	revertEdit: (...a: unknown[]) => mockRevert(...a)
}));

vi.mock('$lib/server/utils/api-helpers', () => ({
	requireAuth: () => ({ id: 'user-1' })
}));

import { POST } from '../+server';

function event(id = '77') {
	return { locals: {}, params: { id } } as never;
}

async function call(id?: string) {
	const res = await POST(event(id));
	return { status: res.status, body: await res.json() };
}

const APPLIED = { profile_id: 12, applied_at: new Date('2026-09-27T09:00:00Z') };

beforeEach(() => {
	results = [];
	mockRevert.mockReset();
	mockRevert.mockResolvedValue({ ok: true });
});

describe('POST /api/ai/agent/proposals/:id/undo', () => {
	it('refuses an id that is not a number', async () => {
		expect((await call('abc')).status).toBe(400);
	});

	it("reads a proposal outside the caller's conversations as absent", async () => {
		results = [[]];
		expect(await call()).toMatchObject({ status: 404, body: { success: false } });
		expect(mockRevert).not.toHaveBeenCalled();
	});

	it('refuses a proposal that was never applied', async () => {
		results = [[{ profile_id: 12, applied_at: null }]];
		expect((await call()).status).toBe(409);
		expect(mockRevert).not.toHaveBeenCalled();
	});

	it('refuses when no change in the log came from it', async () => {
		results = [[APPLIED], []];
		expect((await call()).status).toBe(409);
		expect(mockRevert).not.toHaveBeenCalled();
	});

	it("undoes the proposal's change as the thread's profile", async () => {
		results = [[APPLIED], [{ id: 501 }]];

		const { status, body } = await call();

		expect(status).toBe(200);
		expect(body.success).toBe(true);
		expect(typeof body.undone_at).toBe('string');
		expect(mockRevert).toHaveBeenCalledWith(501, { profileId: 12, isStaff: false });
	});

	it('passes a refusal on in the words revertEdit gave it', async () => {
		results = [[APPLIED], [{ id: 501 }]];
		mockRevert.mockResolvedValue({
			ok: false,
			reason: 'failed',
			error: 'This entry has been edited since it was logged.'
		});

		expect(await call()).toMatchObject({
			status: 409,
			body: {
				success: false,
				reason: 'failed',
				message: 'This entry has been edited since it was logged.'
			}
		});
	});

	it('answers 404 when the change can no longer be reached', async () => {
		results = [[APPLIED], [{ id: 501 }]];
		mockRevert.mockResolvedValue({ ok: false, reason: 'not_found', error: 'Gone.' });

		expect((await call()).status).toBe(404);
	});
});
