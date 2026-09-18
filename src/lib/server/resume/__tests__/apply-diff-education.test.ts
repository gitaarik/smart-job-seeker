/**
 * How an education match key resolves to a row, on both the modify and the
 * remove path.
 *
 * The key is `institution|||area`, and the remove path used to read only the
 * first half and delete by that predicate — so removing one of two degrees from
 * the same university deleted both, silently, in the middle of an import the
 * applicant had just approved. Nothing raised: the diff said "removed: BSc",
 * the apply said nothing, and the MSc was gone.
 *
 * The queries are asserted as rendered SQL rather than through a fake table.
 * That is deliberate: what went wrong was the WHERE clause, so a mock that
 * interpreted the clause its own way would be marking its own homework.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';

const dialect = new PgDialect();

interface Rendered {
	sql: string;
	params: unknown[];
}

const state = {
	/** Rendered `where` of every education lookup, in order. */
	lookups: [] as Rendered[],
	/** Rendered `where` of every delete, with the table it was issued against. */
	deletes: [] as { table: unknown; where: Rendered }[],
	/** What a lookup finds. null stands for "no such row". */
	educationRow: { id: 42 } as { id: number } | null
};

function render(where: unknown): Rendered {
	const query = dialect.sqlToQuery(where as SQL);
	return { sql: query.sql, params: query.params };
}

vi.mock('$lib/server/db', () => {
	const dbMock = {
		query: {
			profiles: { findFirst: () => Promise.resolve({ id: 1 }) },
			education: {
				findFirst: ({ where }: { where: unknown }) => {
					state.lookups.push(render(where));
					return Promise.resolve(state.educationRow);
				}
			}
		},
		update: () => ({ set: () => ({ where: () => Promise.resolve(undefined) }) }),
		delete: (table: unknown) => ({
			where: (where: unknown) => {
				state.deletes.push({ table, where: render(where) });
				return Promise.resolve(undefined);
			}
		})
	};
	return { db: dbMock, dbDirect: dbMock };
});

const { education } = await import('$lib/server/db/schema');
const { applyDiffToProfile } = await import('../apply-diff');

/** Apply an education-only payload as profile 1's owner. */
function apply(education: {
	modified?: { matchKey: string; fields: Record<string, unknown> }[];
	removed?: string[];
}) {
	return applyDiffToProfile(1, 'user-1', {
		education: education as never
	});
}

beforeEach(() => {
	state.lookups = [];
	state.deletes = [];
	state.educationRow = { id: 42 };
});

describe('removing one education', () => {
	it('narrows the lookup by area, not by institution alone', async () => {
		await apply({ removed: ['Utrecht University|||Computer Science'] });

		expect(state.lookups).toHaveLength(1);
		expect(state.lookups[0].params).toEqual([1, 'Utrecht University', 'Computer Science']);
	});

	it('deletes the one row it found, by id', async () => {
		await apply({ removed: ['Utrecht University|||Computer Science'] });

		expect(state.deletes).toHaveLength(1);
		expect(state.deletes[0].table).toBe(education);
		expect(state.deletes[0].where.params).toEqual([42]);
		// The shape of the old bug: a delete whose WHERE names the institution
		// matches every degree taken there.
		expect(state.deletes[0].where.sql).not.toContain('institution');
	});

	it('deletes nothing when no row answers to the key', async () => {
		state.educationRow = null;

		await apply({ removed: ['Somewhere Else|||Physics'] });

		expect(state.deletes).toEqual([]);
	});

	it('matches a missing area rather than ignoring the half that says so', async () => {
		// `${e.area ?? ''}` writes an absent area as an empty half, and the column
		// holds null. Dropping the condition would match any area at all.
		await apply({ removed: ['Utrecht University|||'] });

		expect(state.lookups[0].sql).toContain('is null');
		expect(state.lookups[0].params).toEqual([1, 'Utrecht University', '']);
	});
});

describe('modifying one education', () => {
	it('asks the same question the removal does', async () => {
		await apply({ modified: [{ matchKey: 'Utrecht University|||', fields: { area: 'CS' } }] });
		await apply({ removed: ['Utrecht University|||'] });

		expect(state.lookups).toHaveLength(2);
		expect(state.lookups[0]).toEqual(state.lookups[1]);
	});
});
