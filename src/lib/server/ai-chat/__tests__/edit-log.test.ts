/**
 * Tests for the edit log and undo.
 *
 * What matters here is not that a row goes in and comes out. It is the three
 * things a record of writes has to get right to be worth having:
 *
 *  - a log row **authorizes nothing**. Undo re-asks the capability's own
 *    `authorize` against a fresh read, because the window this feed spans is
 *    months, and rights are lost inside it;
 *  - two clicks on the same Undo must not both count;
 *  - a capability the registry no longer has still describes what it did. That
 *    is not hypothetical — `hide_language` existed for a day.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = {
	rows: [] as Record<string, unknown>[],
	inserts: [] as Record<string, unknown>[],
	updates: [] as Record<string, unknown>[],
	/** What the conditional "mark reverted" update returns; empty means someone got there first. */
	marked: [{ id: 1 }] as { id: number }[]
};

vi.mock('$lib/server/db', () => {
	const dbMock = {
		insert: () => ({
			values: (values: Record<string, unknown>) => {
				state.inserts.push(values);
				// The new row's id comes back, because it is the handle an undo is
				// addressed by: an MCP tool result carries it into the transcript the
				// user is actually reading at the time.
				return { returning: () => Promise.resolve([{ id: 77 }]) };
			}
		}),
		select: () => ({
			from: () => ({
				where: () => ({
					orderBy: () => ({ limit: () => Promise.resolve(state.rows) }),
					limit: () => Promise.resolve(state.rows)
				})
			})
		}),
		update: () => ({
			set: (values: Record<string, unknown>) => ({
				where: () => {
					state.updates.push(values);
					return { returning: () => Promise.resolve(state.marked) };
				}
			})
		})
	};
	return { db: dbMock, dbDirect: dbMock };
});

vi.mock('$lib/server/db/schema', () => ({
	capability_edits: {
		id: 'capability_edits.id',
		profile_id: 'capability_edits.profile_id',
		date_created: 'capability_edits.date_created',
		reverted_at: 'capability_edits.reverted_at'
	}
}));

const mockAuthorize = vi.fn();
const mockRevert = vi.fn();

vi.mock('../capabilities', () => ({
	CAPABILITIES: {
		edit_work_experience: {
			title: 'Correct this work experience',
			authorize: (...a: unknown[]) => mockAuthorize(...a),
			revert: (...a: unknown[]) => mockRevert(...a)
		},
		// The verb with no undo, and the reason: the row is on its own page with a
		// delete control, and the registry deliberately has no delete.
		add_language: { title: 'Add a language', authorize: () => Promise.resolve(true) }
	}
}));

const { readEditLog, recordEdit, revertEdit } = await import('../edit-log');

const ACTOR = { profileId: 12, isStaff: false };

function logRow(fields: Record<string, unknown> = {}) {
	return {
		id: 1,
		profile_id: 12,
		source: 'chat',
		capability: 'edit_work_experience',
		target: { id: 5, label: 'Engineer at Acme' },
		fields: { 'work_experience.summary': 'new' },
		previous: { 'work_experience.summary': 'old' },
		reverted_at: null,
		date_created: new Date('2026-08-15T10:00:00Z'),
		...fields
	};
}

beforeEach(() => {
	vi.clearAllMocks();
	state.rows = [];
	state.inserts = [];
	state.updates = [];
	state.marked = [{ id: 1 }];
	mockAuthorize.mockResolvedValue(true);
	mockRevert.mockResolvedValue(undefined);
});

describe('recordEdit', () => {
	it('stores the surface alongside the change', async () => {
		// The column exists because the chat is about to stop being the only
		// writer, and an MCP write is the one nobody watches happen.
		const id = await recordEdit({
			profileId: 12,
			source: 'mcp',
			capability: 'edit_work_experience',
			target: { id: 5, label: 'Engineer at Acme' },
			fields: { 'work_experience.summary': 'new' },
			previous: { 'work_experience.summary': 'old' }
		});

		expect(state.inserts[0]).toMatchObject({
			profile_id: 12,
			source: 'mcp',
			capability: 'edit_work_experience',
			previous: { 'work_experience.summary': 'old' }
		});
		expect(id).toBe(77);
	});
});

describe('readEditLog', () => {
	it('names the change the way the capability names itself', async () => {
		state.rows = [logRow()];
		expect((await readEditLog(12))[0].title).toBe('Correct this work experience');
	});

	it('offers undo only where the capability has one', async () => {
		state.rows = [logRow(), logRow({ id: 2, capability: 'add_language' })];

		const entries = await readEditLog(12);
		expect(entries[0].revertible).toBe(true);
		expect(entries[1].revertible).toBe(false);
	});

	it('does not offer undo twice', async () => {
		state.rows = [logRow({ reverted_at: new Date() })];
		expect((await readEditLog(12))[0].revertible).toBe(false);
	});

	it('still describes a change whose capability is gone', async () => {
		// `hide_language` was in the registry for a day before it turned out
		// nothing filters a language on a document. The history of what it did
		// outlives it, and a feed that crashed on it would be worse than one that
		// prints the raw name.
		state.rows = [logRow({ capability: 'hide_language' })];

		const [entry] = await readEditLog(12);
		expect(entry.title).toBe('hide_language');
		expect(entry.revertible).toBe(false);
	});
});

describe('revertEdit', () => {
	it('writes the before-image back through the capability', async () => {
		state.rows = [logRow()];

		expect(await revertEdit(1, ACTOR)).toEqual({ ok: true });
		expect(mockRevert).toHaveBeenCalledWith(
			{ id: 5, label: 'Engineer at Acme' },
			{ 'work_experience.summary': 'old' },
			ACTOR
		);
		expect(state.updates[0]).toHaveProperty('reverted_at');
	});

	it('re-asks the capability whether the actor may still write there', async () => {
		// A log row is a record, not a licence. Months can pass between the change
		// and the undo.
		state.rows = [logRow()];
		mockAuthorize.mockResolvedValue(false);

		expect(await revertEdit(1, ACTOR)).toMatchObject({ ok: false, reason: 'not_found' });
		expect(mockRevert).not.toHaveBeenCalled();
	});

	it('refuses a change that has no undo', async () => {
		state.rows = [logRow({ capability: 'add_language' })];

		expect(await revertEdit(1, ACTOR)).toMatchObject({ ok: false, reason: 'not_revertible' });
	});

	it('refuses one already undone', async () => {
		state.rows = [logRow({ reverted_at: new Date() })];

		expect(await revertEdit(1, ACTOR)).toMatchObject({ ok: false, reason: 'already_reverted' });
		expect(mockRevert).not.toHaveBeenCalled();
	});

	it('lets only one of two simultaneous clicks count', async () => {
		// Both pass the read, both write the same before-image — harmless, it is
		// the same value twice — but the marking update is conditional on still being
		// un-reverted, so the loser is told so rather than reporting success.
		state.rows = [logRow()];
		state.marked = [];

		expect(await revertEdit(1, ACTOR)).toMatchObject({ ok: false, reason: 'already_reverted' });
	});

	it('says nothing about a row that is not this profile’s', async () => {
		// Scoped in the same query that finds it, so "not yours" and "not there"
		// are one answer.
		state.rows = [];

		expect(await revertEdit(99, ACTOR)).toMatchObject({ ok: false, reason: 'not_found' });
	});

	it('reports a failed undo rather than marking it done', async () => {
		state.rows = [logRow()];
		mockRevert.mockRejectedValue(new Error('Role not found'));

		expect(await revertEdit(1, ACTOR)).toMatchObject({ ok: false, reason: 'failed' });
		expect(state.updates).toHaveLength(0);
	});
});
