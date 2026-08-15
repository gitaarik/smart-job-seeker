/**
 * Tests for the approval path.
 *
 * A request is the one thing in this system that sits between an agent asking
 * and a write happening, so the two failure modes that matter are: two people
 * (or two tabs) approving the same one, and an approval that fails leaving a
 * change the applicant believes they made.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = {
	/** What the conditional claim returns. Empty means someone got there first. */
	claimed: [] as Record<string, unknown>[],
	updates: [] as Record<string, unknown>[],
	inserts: [] as Record<string, unknown>[]
};

vi.mock('$lib/server/db', () => {
	const dbMock = {
		insert: () => ({
			values: (values: Record<string, unknown>) => {
				state.inserts.push(values);
				return { returning: () => Promise.resolve([{ id: 101 }]) };
			}
		}),
		select: () => ({
			from: () => ({
				where: () => ({ orderBy: () => ({ limit: () => Promise.resolve([]) }) })
			})
		}),
		update: () => ({
			set: (values: Record<string, unknown>) => ({
				where: () => {
					state.updates.push(values);
					return {
						returning: () => Promise.resolve(state.claimed),
						// The `set edit_id` call awaits the builder directly.
						then: (resolve: (v: unknown) => void) => resolve(undefined)
					};
				}
			})
		})
	};
	return { db: dbMock, dbDirect: dbMock };
});

vi.mock('$lib/server/db/schema', () => ({
	capability_requests: {
		id: 'id',
		profile_id: 'profile_id',
		status: 'status',
		edit_id: 'edit_id',
		date_created: 'date_created'
	}
}));

const executeCapability = vi.fn();

vi.mock('$lib/server/ai-chat/capabilities', () => ({
	CAPABILITIES: {
		edit_work_experience: { title: 'Correct this work experience' }
	},
	executeCapability: (...args: unknown[]) => executeCapability(...args)
}));

const { approveRequest, rejectRequest, requestPath } = await import('../requests');

const ACTOR = { profileId: 12, isStaff: false };

function pendingRow(overrides: Record<string, unknown> = {}) {
	return {
		id: 101,
		profile_id: 12,
		source: 'mcp',
		mcp_key_id: 3,
		capability: 'edit_work_experience',
		target: { id: 5, label: 'Engineer at Acme' },
		fields: { 'work_experience.summary': 'new' },
		previous: { 'work_experience.summary': 'old' },
		rationale: 'It reads better.',
		status: 'pending',
		decided_at: null,
		edit_id: null,
		date_created: new Date('2026-08-15T10:00:00Z'),
		...overrides
	};
}

beforeEach(() => {
	vi.clearAllMocks();
	state.claimed = [pendingRow()];
	state.updates = [];
	state.inserts = [];
	executeCapability.mockResolvedValue({ ok: true, previous: {}, editId: 55 });
});

describe('approveRequest', () => {
	it('writes through the ordinary capability path', async () => {
		// Not a second write path. Approving re-authorizes, re-validates and lands
		// in the edit log, so the result is undoable like everything else.
		const outcome = await approveRequest(101, ACTOR);

		expect(outcome).toEqual({ ok: true, editId: 55 });
		expect(executeCapability).toHaveBeenCalledWith(
			'edit_work_experience',
			{ id: 5, label: 'Engineer at Acme' },
			ACTOR,
			{ 'work_experience.summary': 'new' },
			'mcp'
		);
	});

	it('records which edit it produced', async () => {
		await approveRequest(101, ACTOR);
		expect(state.updates.some((u) => u.edit_id === 55)).toBe(true);
	});

	it('lets only one of two simultaneous approvals through', async () => {
		// The status moves first and conditionally, before anything is written —
		// the alternative is two writes both reported as successes.
		state.claimed = [];

		const outcome = await approveRequest(101, ACTOR);

		expect(outcome).toMatchObject({ ok: false, reason: 'already_decided' });
		expect(executeCapability).not.toHaveBeenCalled();
	});

	it('says nothing about a request belonging to another profile', async () => {
		// Scoped in the same statement that claims it, so "not yours" and "not
		// there" are one answer.
		state.claimed = [];
		expect(await approveRequest(999, ACTOR)).toMatchObject({ ok: false });
	});

	it('puts the request back when the write refuses', async () => {
		// Otherwise the applicant has approved a change that did not happen and
		// can no longer approve it — which reads from the feed as though it went
		// through.
		executeCapability.mockResolvedValue({
			ok: false,
			reason: 'unauthorized',
			error: 'You can no longer make this change.'
		});

		const outcome = await approveRequest(101, ACTOR);

		expect(outcome).toMatchObject({ ok: false, reason: 'failed' });
		expect(state.updates.some((u) => u.status === 'pending')).toBe(true);
	});

	it('refuses a capability the registry no longer has', async () => {
		state.claimed = [pendingRow({ capability: 'hide_language' })];

		const outcome = await approveRequest(101, ACTOR);

		expect(outcome).toMatchObject({ ok: false, reason: 'failed' });
		expect(state.updates.some((u) => u.status === 'pending')).toBe(true);
	});
});

describe('rejectRequest', () => {
	it('decides without writing anything', async () => {
		expect(await rejectRequest(101, ACTOR)).toEqual({ ok: true, editId: null });
		expect(executeCapability).not.toHaveBeenCalled();
	});

	it('refuses one that was already decided', async () => {
		state.claimed = [];
		expect(await rejectRequest(101, ACTOR)).toMatchObject({ ok: false });
	});
});

describe('requestPath', () => {
	it('deep-links to the request itself, not just the page', async () => {
		// The link goes into an agent's transcript, and "go and find it" is worse
		// than no link when the feed is months long.
		expect(requestPath(101)).toBe('/data/ai-changes#request-101');
	});
});
