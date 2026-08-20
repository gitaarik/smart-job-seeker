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
	marked: [{ id: 1 }] as { id: number }[],
	/** Un-reverted changes made after the one being undone. */
	newer: [] as Record<string, unknown>[]
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
				// A real drizzle builder is thenable, and the ordering check uses that:
				// it awaits `where(...)` with no limit, where the other two callers
				// paginate. So `then` here is the "everything newer than this row"
				// query and the two chains below are the reads that existed before.
				where: () => ({
					orderBy: () => ({ limit: () => Promise.resolve(state.rows) }),
					limit: () => Promise.resolve(state.rows),
					then: (resolve: (rows: Record<string, unknown>[]) => unknown) =>
						Promise.resolve(state.newer).then(resolve)
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

// The real schema, not a stub: the log resolves UI-only actions through
// `ui-actions.ts`, which reaches `PROFILE_RESOURCES` and so every table on it.
// Only the database is mocked, which is the boundary that matters here.

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
	},
	describeProposalChanges: () => [],
	describeFieldChanges: () => []
}));

const { readEditLog, recordEdit, revertEdit, supersedingChange } = await import('../edit-log');

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
	state.newer = [];
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

describe('undoing in order', () => {
	/**
	 * There is no version history here — one before-image per change — so
	 * rolling back several changes is several undos, and a before-image is only
	 * the inverse of its own write while nothing has been written on top of it.
	 *
	 *     v0 --A--> v1 --B--> v2
	 *
	 * B then A lands on v0. A then B lands on v1, which nobody ever chose, with
	 * B still reading as applied. These tests are that asymmetry made into a
	 * refusal.
	 */
	const A = {
		id: 1,
		capability: 'edit_work_experience',
		target: { id: 5 },
		fields: { 'work_experience.summary': 'v1' },
		previous: { 'work_experience.summary': 'v0' }
	};

	it('finds the later change that wrote the same field of the same row', () => {
		const B = { ...A, id: 2, fields: { 'work_experience.summary': 'v2' } };
		expect(supersedingChange(A, [B])?.id).toBe(2);
	});

	it('ignores a later change to a different row', () => {
		const other = { ...A, id: 2, target: { id: 6 } };
		expect(supersedingChange(A, [other])).toBeNull();
	});

	it('ignores a later change to a different field of the same row', () => {
		const other = { ...A, id: 2, fields: { 'work_experience.job_title': 'Lead' }, previous: {} };
		expect(supersedingChange(A, [other])).toBeNull();
	});

	it('counts a hide and a show as the same field, across two action names', () => {
		// Both write the row's tags, and neither is the other's capability — which
		// is why the rule keys on the section rather than on the verb.
		const hidden = {
			id: 1,
			capability: 'hide_work_experience',
			target: { id: 5 },
			fields: {},
			previous: { tags: null }
		};
		const shown = { ...hidden, id: 2, capability: 'show_work_experience', previous: { tags: [] } };
		expect(supersedingChange(hidden, [shown])?.id).toBe(2);
	});

	it('names the newest blocker, which is where the applicant has to start', () => {
		const B = { ...A, id: 2, fields: { 'work_experience.summary': 'v2' } };
		const C = { ...A, id: 3, fields: { 'work_experience.summary': 'v3' } };
		// Newest first, the order both callers pass them in.
		expect(supersedingChange(A, [C, B])?.id).toBe(3);
	});

	it('refuses the undo, and says which one to take back first', async () => {
		state.rows = [logRow()];
		state.newer = [{ ...logRow({ id: 2 }), fields: { 'work_experience.summary': 'newer' } }];

		const outcome = await revertEdit(1, ACTOR);

		expect(outcome).toMatchObject({ ok: false, reason: 'superseded' });
		expect('error' in outcome && outcome.error).toContain('Correct this work experience');
		// The point of the refusal: nothing is written, so the later change stands.
		expect(mockRevert).not.toHaveBeenCalled();
		expect(state.updates).toHaveLength(0);
	});

	it('allows it once the later change is out of the way', async () => {
		// `newer` is the un-reverted ones — an undone change is no longer on top.
		state.rows = [logRow()];
		state.newer = [];

		expect(await revertEdit(1, ACTOR)).toEqual({ ok: true });
		expect(mockRevert).toHaveBeenCalled();
	});

	it('marks the blocked entry in the feed rather than only on the click', async () => {
		// Newest first, as the query returns them: entry 2 is on top of entry 1.
		state.rows = [
			logRow({ id: 2, fields: { 'work_experience.summary': 'v2' } }),
			logRow({ id: 1 })
		];

		const [newer, older] = await readEditLog(12);
		expect(newer.supersededBy).toBeNull();
		expect(older.supersededBy).toBe(2);
	});

	it('does not mark one whose blocker was already undone', async () => {
		state.rows = [
			logRow({ id: 2, fields: { 'work_experience.summary': 'v2' }, reverted_at: new Date() }),
			logRow({ id: 1 })
		];

		expect((await readEditLog(12))[1].supersededBy).toBeNull();
	});
});
