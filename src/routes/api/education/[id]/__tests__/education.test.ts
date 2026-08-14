/**
 * Tests for PATCH /api/education/[id].
 *
 * The route is now a thin door onto the shared profile write layer, so what is
 * worth testing here is the door: that it authenticates, that it translates a
 * user into the profile actor the layer authorizes against, and that a refusal
 * comes back as the status this endpoint has always answered with.
 *
 * One assertion changed rather than moved. This route used to wrap date fields
 * in `new Date()` while the education form wrote the `YYYY-MM-DD` string that a
 * Drizzle `date()` column actually holds — the driver then serialized the Date
 * in the server's local timezone, so the stored day could land one out either
 * side of UTC depending on which door the edit came through. Both doors now
 * write the string.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = {
	/** The education row a select returns, or none. */
	rows: [] as Record<string, unknown>[],
	/** The profile row the ownership lookup finds, or null when it isn't the user's. */
	profileRow: null as { id: number } | null,
	updates: [] as { table: unknown; values: Record<string, unknown> }[]
};

vi.mock('$lib/server/db', () => {
	const resolvable = (rows: unknown[]) =>
		Object.assign(Promise.resolve(rows), { limit: () => Promise.resolve(rows) });

	const dbMock = {
		select: () => ({ from: () => ({ where: () => resolvable(state.rows) }) }),
		update: (table: unknown) => ({
			set: (values: Record<string, unknown>) => ({
				where: () => {
					state.updates.push({ table, values });
					return Promise.resolve(undefined);
				}
			})
		}),
		query: {
			profiles: { findFirst: () => Promise.resolve(state.profileRow) }
		}
	};

	return { db: dbMock, dbDirect: dbMock };
});

const { education, profiles } = await import('$lib/server/db/schema');
const { PATCH } = await import('../+server');

/** The education row, owned by profile 7, unless a test says otherwise. */
function ownedRow(fields: Record<string, unknown> = {}) {
	return { id: 1, profile_id: 7, sort: 0, status: 'published', ...fields };
}

/** Put the caller in possession of the row: it exists, and its profile is theirs. */
function owns(fields: Record<string, unknown> = {}) {
	state.rows = [ownedRow(fields)];
	state.profileRow = { id: 7 };
}

function written() {
	return state.updates.find((write) => write.table === education)?.values;
}

function createEvent(
	body: unknown,
	opts: { user?: { id: string } | null; params?: Record<string, string> } = {}
) {
	return {
		params: opts.params ?? { id: '1' },
		locals: { user: opts.user === undefined ? { id: 'user-1' } : opts.user, session: null },
		request: new Request('http://localhost/api/education/1', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		})
	} as never;
}

describe('PATCH /api/education/[id]', () => {
	beforeEach(() => {
		state.rows = [];
		state.profileRow = null;
		state.updates = [];
	});

	it('rejects unauthenticated', async () => {
		await expect(PATCH(createEvent({}, { user: null }))).rejects.toMatchObject({ status: 401 });
	});

	it('rejects invalid ID', async () => {
		await expect(PATCH(createEvent({}, { params: { id: 'abc' } }))).rejects.toMatchObject({
			status: 400
		});
	});

	it("rejects when the user doesn't own the education record", async () => {
		state.rows = [ownedRow()];
		state.profileRow = null;
		await expect(PATCH(createEvent({ institution: 'MIT' }))).rejects.toMatchObject({ status: 403 });
	});

	it('answers the same way when the record is not there at all', async () => {
		// Deliberately indistinguishable: a caller who does not own a row learns
		// nothing about whether it exists.
		state.rows = [];
		await expect(PATCH(createEvent({ institution: 'MIT' }))).rejects.toMatchObject({ status: 403 });
	});

	it('rejects empty institution', async () => {
		owns();
		await expect(PATCH(createEvent({ institution: '' }))).rejects.toMatchObject({ status: 400 });
		expect(written()).toBeUndefined();
	});

	it('updates education with valid data', async () => {
		owns();
		const res = await PATCH(
			createEvent({ institution: 'MIT', area: 'Computer Science', graduation_year: '2020' })
		);

		expect((await res.json()).success).toBe(true);
		expect(written()).toMatchObject({
			institution: 'MIT',
			area: 'Computer Science',
			// A year arrives as the string a number input posts and is stored as one.
			graduation_year: 2020
		});
	});

	it('stores dates as the strings their columns hold', async () => {
		owns();
		await PATCH(createEvent({ start_date: '2016-09-01', end_date: '2020-06-15' }));

		expect(written()).toMatchObject({
			start_date: '2016-09-01',
			end_date: '2020-06-15'
		});
	});

	it('refuses a date it cannot read rather than clearing the column', async () => {
		owns({ start_date: '2016-09-01' });
		await expect(PATCH(createEvent({ start_date: 'autumn 2016' }))).rejects.toMatchObject({
			status: 400
		});
		expect(written()).toBeUndefined();
	});

	it('only updates allowed fields', async () => {
		owns();
		await PATCH(createEvent({ institution: 'MIT', profile_id: 999, user_id: 'hacker' }));

		const values = written();
		expect(values).toMatchObject({ institution: 'MIT' });
		expect(values).not.toHaveProperty('profile_id');
		expect(values).not.toHaveProperty('user_id');
	});

	it('touches the parent profile, so the matcher stops scoring a stale snapshot', async () => {
		owns();
		await PATCH(createEvent({ institution: 'MIT' }));
		expect(state.updates.some((write) => write.table === profiles)).toBe(true);
	});
});
