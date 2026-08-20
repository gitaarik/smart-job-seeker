/**
 * Tests for the parent list a tool description carries.
 *
 * Every parent-owned field's contract ends by telling the caller to name one
 * "exactly as one of the groups listed below". The chat surface earns that
 * sentence — it prints the contract next to a rendered state block. This server
 * printed the contract alone, so the sentence pointed at nothing and the only
 * way to learn a usable name was to guess one and read the refusal.
 *
 * What is asserted here is not that SOME list appears. It is that the list is
 * the labels `parentNames` produces, which is what the write path matches
 * against — see the round-trip in `profile/__tests__/write.test.ts`.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = {
	rowsByTable: new Map<unknown, Record<string, unknown>[]>()
};

vi.mock('$lib/server/db', () => {
	const resolvable = (rows: unknown[]) =>
		Object.assign(Promise.resolve(rows), {
			limit: () => Promise.resolve(rows),
			orderBy: () => Promise.resolve(rows)
		});

	const rowsFor = (table: unknown) => state.rowsByTable.get(table) ?? [];

	const dbMock = {
		select: () => {
			let primary: unknown = null;
			let joined: unknown = null;

			const rows = () => {
				if (!joined) return rowsFor(primary);
				const foreignKeys = (row: Record<string, unknown>) =>
					Object.entries(row)
						.filter(([key]) => key.endsWith('_id') && key !== 'profile_id')
						.map(([, value]) => value);

				return rowsFor(primary).map((row) => ({
					row,
					parent: rowsFor(joined).find((p) => foreignKeys(row).includes(p.id)) ?? null
				}));
			};

			const chain = {
				from: (table: unknown) => {
					primary = table;
					return chain;
				},
				innerJoin: (table: unknown) => {
					joined = table;
					return chain;
				},
				where: () => resolvable(rows())
			};

			return chain;
		}
	};

	return { db: dbMock, dbDirect: dbMock };
});

const { tech_skill_categories } = await import('$lib/server/db/schema');
const { toolsFor } = await import('../tools');

const ACTOR = { profileId: 7 };

/** The real shape: two groups sharing a heading, told apart by their notes. */
const GROUPS = [
	{ id: 1, profile_id: 7, name: 'Backend', note: 'Python / Django', sort: 0, status: 'published' },
	{
		id: 2,
		profile_id: 7,
		name: 'Backend',
		note: 'TypeScript / React',
		sort: 1,
		status: 'published'
	}
];

async function describedBy(name: string, actor?: { profileId: number }) {
	const tools = await toolsFor('write', 'documents', actor);
	return tools.find((tool) => tool.name === name)?.description ?? '';
}

beforeEach(() => {
	state.rowsByTable = new Map([[tech_skill_categories, GROUPS]]);
});

describe('the list a contract promises', () => {
	it('prints the labels the write path matches, not the bare headings', async () => {
		const description = await describedBy('add_skill', ACTOR);

		// Both, and by label: two groups called "Backend" are indistinguishable by
		// name, which is the case the note exists for and the case a caller cannot
		// resolve without being shown it.
		expect(description).toContain('Backend (Python / Django)');
		expect(description).toContain('Backend (TypeScript / React)');
	});

	it('gives an edit the same list as an add', async () => {
		// An edit moves a row between groups, so it names one exactly as an add
		// does. Only the add contract mentions duplicates; both need the names.
		expect(await describedBy('edit_skill', ACTOR)).toContain('Backend (Python / Django)');
	});

	it('says so plainly when there is nothing to file under', async () => {
		state.rowsByTable = new Map();

		const description = await describedBy('add_skill', ACTOR);

		expect(description).toContain('no skill category to file one under yet');
		expect(description).not.toContain('Backend');
	});

	it('leaves a hide alone', async () => {
		// A hide names a row by `entry_id` and carries no fields, so it has no
		// parent to resolve and a list of them would be a block it cannot use.
		expect(await describedBy('hide_skill', ACTOR)).not.toContain('Backend (Python / Django)');
	});

	it('leaves a section that has no parent alone', async () => {
		expect(await describedBy('add_side_project', ACTOR)).not.toContain('Backend (Python / Django)');
	});

	it('reads no rows when asked for the shape alone', async () => {
		// `toolsFor` without an actor is what a caller asking "what does this
		// server offer" gets. It must not need a profile to answer, so the tools
		// come back without the lists rather than not at all.
		expect(await describedBy('add_skill')).not.toContain('Backend (Python / Django)');
	});
});
