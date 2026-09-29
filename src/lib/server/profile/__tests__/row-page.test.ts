/**
 * Tests for where one profile row opens.
 *
 * The declarations are the real ones, so these fail if a section's page moves
 * without its declaration. What a reader would not guess from the signature:
 *
 *  - a role project's page is under its role's, and only the project's row
 *    holds the role, so it is the one kind of answer that costs a read;
 *  - a child with no page of its own opens on its parent's, one or two levels up;
 *  - a section with no row pages anywhere up its chain answers without a read,
 *    because a history full of skill changes would otherwise be a query each.
 *
 * `readOwnedRow` is the ownership check, and `write.test.ts` covers it. Here it
 * is a lookup table, and a row missing from it reads as gone or someone else's.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = {
	rows: new Map<string, Record<string, unknown>>(),
	reads: [] as string[]
};

vi.mock('../write', () => ({
	readOwnedRow: (name: string, _actor: unknown, id: number) => {
		state.reads.push(`${name} ${id}`);
		return Promise.resolve(state.rows.get(`${name} ${id}`) ?? null);
	}
}));

const { rowPagePath } = await import('../row-page');

const actor = { profileId: 12 };

function row(name: string, id: number, values: Record<string, unknown>) {
	state.rows.set(`${name} ${id}`, { id, sort: null, status: null, ...values });
}

beforeEach(() => {
	state.rows.clear();
	state.reads = [];
});

describe('rowPagePath', () => {
	it('opens a role project on its own page, under the role its row names', async () => {
		row('work_experience_project', 300, { work_experience_id: 8 });

		expect(await rowPagePath('work_experience_project', actor, 300)).toBe(
			'/profile/work-experience/8/projects/300'
		);
	});

	it('answers a section with a detail page from the id alone', async () => {
		expect(await rowPagePath('work_experience', actor, 8)).toBe('/profile/work-experience/8');
		expect(await rowPagePath('side_project', actor, 40)).toBe('/profile/side-projects/40');
		expect(state.reads).toEqual([]);
	});

	it("opens a child with no page of its own on its parent's", async () => {
		row('work_experience_achievement', 1717, { work_experience_id: 8 });
		row('side_project_technology', 5, { side_project_id: 40 });

		expect(await rowPagePath('work_experience_achievement', actor, 1717)).toBe(
			'/profile/work-experience/8'
		);
		expect(await rowPagePath('side_project_technology', actor, 5)).toBe(
			'/profile/side-projects/40'
		);
	});

	it("opens a project's technology on the project's page, two levels up", async () => {
		row('work_experience_project_technology', 1172, { work_experience_project_id: 333 });
		row('work_experience_project', 333, { work_experience_id: 8 });

		expect(await rowPagePath('work_experience_project_technology', actor, 1172)).toBe(
			'/profile/work-experience/8/projects/333'
		);
	});

	it('reads nothing for a section that is only ever on its list', async () => {
		row('skill', 3003515, { category_id: 7 });

		expect(await rowPagePath('skill', actor, 3003515)).toBeNull();
		expect(await rowPagePath('language', actor, 3)).toBeNull();
		expect(state.reads).toEqual([]);
	});

	it("gives no link for a row that is gone or not this actor's", async () => {
		expect(await rowPagePath('work_experience_project', actor, 999)).toBeNull();
		expect(state.reads).toEqual(['work_experience_project 999']);
	});

	it('gives no link when the row does not name its parent', async () => {
		row('work_experience_project', 300, {});

		expect(await rowPagePath('work_experience_project', actor, 300)).toBeNull();
	});
});
