/**
 * Tests for `reorder_<section>`, the verb that puts a section in a new order.
 *
 * What is worth pinning is the part a reader would not guess from "reorder a
 * list": that it is never offered in the chat, that it takes whole groups and
 * says which entries a partial one left out, that the card can name the rows
 * from what the request stored, and that its undo is the same write as a
 * person's reorder of the same list.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = {
	rows: {} as Record<string, Record<string, unknown>[]>,
	reordered: [] as { resource: string; actor: unknown; order: number[] }[],
	result: { ok: true } as { ok: boolean; error?: string }
};

vi.mock('$lib/server/profile/write', () => ({
	readOwnedRows: (resource: string) => Promise.resolve(state.rows[resource] ?? []),
	reorderRows: (resource: string, actor: unknown, order: number[]) => {
		state.reordered.push({ resource, actor, order });
		return Promise.resolve(state.result);
	}
}));

const { REORDER_CAPABILITIES, REORDER_CAPABILITY_NAMES, isReorderCapability } =
	await import('../reorder-capabilities');
const { PROFILE_RESOURCE_NAMES } = await import('$lib/server/profile/resources');
const { verbsFor } = await import('../profile-capabilities');

const ACTOR = { profileId: 12, isStaff: false };
const SECTION = { id: 12, label: 'Skills' };
const skills = REORDER_CAPABILITIES.reorder_skill;
const languages = REORDER_CAPABILITIES.reorder_language;

/** Two groups, read in the order the section sorts them. */
const SKILLS = [
	{ id: 1, name: 'Python', category: 'Backend', category_id: 100 },
	{ id: 2, name: 'Django', category: 'Backend', category_id: 100 },
	{ id: 3, name: 'FastAPI', category: 'Backend', category_id: 100 },
	{ id: 4, name: 'Docker', category: 'DevOps', category_id: 200 },
	{ id: 5, name: 'Linux', category: 'DevOps', category_id: 200 }
];

beforeEach(() => {
	state.rows = {
		skill: SKILLS,
		language: [
			{ id: 7, name: 'Dutch' },
			{ id: 8, name: 'English' }
		]
	};
	state.reordered = [];
	state.result = { ok: true };
});

async function validate(
	def: typeof skills,
	order: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
	const current = await def.current(SECTION, ACTOR);
	return def.validate({ [Object.keys(def.fields)[0]]: order }, current);
}

describe('where it is offered', () => {
	it('exists for every section', () => {
		expect(REORDER_CAPABILITY_NAMES).toHaveLength(PROFILE_RESOURCE_NAMES.length);
		for (const name of PROFILE_RESOURCE_NAMES) {
			expect(isReorderCapability(`reorder_${name}`), name).toBe(true);
		}
	});

	it('is never one of the verbs a chat page grants', () => {
		// Every chat scope is built from `verbsFor`, so this is the whole of the
		// guarantee: a person in the app drags, and the chat's block has no room.
		const granted = PROFILE_RESOURCE_NAMES.flatMap(verbsFor) as string[];
		expect(granted.filter((c) => c.startsWith('reorder_'))).toEqual([]);
	});

	it('targets the section as a whole, on this profile only', async () => {
		expect(skills.singleton).toBe(true);
		expect(await skills.resolve(null, ACTOR)).toEqual(SECTION);
		expect(await skills.authorize(SECTION, ACTOR)).toBe(true);
		expect(await skills.authorize({ id: 13, label: 'Skills' }, ACTOR)).toBe(false);
	});

	it('names the section the way a person’s reorder of it is titled', () => {
		expect(skills.title).toBe('Reorder skills');
		expect(REORDER_CAPABILITIES.reorder_work_experience_achievement.title).toBe(
			'Reorder role achievements'
		);
	});
});

describe('what it accepts', () => {
	it('takes one whole group in a new order and leaves the others alone', async () => {
		expect(await validate(skills, [3, 1, 2])).toEqual({ ok: true });
	});

	it('refuses part of a group, and names what it left out', async () => {
		// The rows left out would keep sort numbers counted against the old list
		// and land between the new ones.
		const result = await validate(skills, [3, 1]);

		expect(result.ok).toBe(false);
		expect(result.ok || result.error).toContain('every entry of each skill category');
		expect(result.ok || result.error).toContain('2 (Django — Backend)');
	});

	it('refuses an id that is not in the section on this profile', async () => {
		const result = await validate(skills, [3, 1, 2, 999]);
		expect(result.ok || result.error).toContain('no entry 999');
	});

	it('refuses an id listed twice', async () => {
		const result = await validate(skills, [3, 1, 2, 1]);
		expect(result.ok || result.error).toContain('listed twice');
	});

	it('refuses the order the group is already in', async () => {
		// One group sent back as it stands, which MCP's own unchanged-check cannot
		// see, since it compares against the whole section.
		const result = await validate(skills, [4, 5]);
		expect(result.ok || result.error).toContain('already in that order');
	});

	it('refuses an empty order', async () => {
		expect((await validate(skills, [])).ok).toBe(false);
		expect((await validate(skills, null)).ok).toBe(false);
	});

	it('wants every entry of a section the profile owns directly', async () => {
		// No parent to group by: the section is the group.
		expect(await validate(languages, [8, 7])).toEqual({ ok: true });

		const partial = await validate(languages, [8]);
		expect(partial.ok || partial.error).toContain('List every entry');
	});
});

describe('the request and its card', () => {
	it('records the order the listed rows were in, with their names', async () => {
		const current = await skills.current(SECTION, ACTOR);
		const previous = await skills.beforeImage?.(SECTION, current, ACTOR, {
			'skill.order': [3, 1, 2]
		});

		expect(previous).toEqual({
			order: [1, 2, 3],
			names: { 1: 'Python', 2: 'Django', 3: 'FastAPI' }
		});
	});

	it('shows the order by name, before and after', () => {
		// Rendered from a stored request with no database to ask: the names come
		// from what beforeImage kept. Ids alone would ask somebody to approve an
		// order nobody showed them.
		const changes = skills.describeChanges?.(
			{ 'skill.order': [3, 1, 2] },
			{ order: [1, 2, 3], names: { 1: 'Python', 2: 'Django', 3: 'FastAPI' } }
		);

		expect(changes).toEqual([
			{
				field: 'skill.order',
				label: 'Order',
				from: 'Python, Django, FastAPI',
				to: 'FastAPI, Python, Django'
			}
		]);
	});
});

describe('writing and undoing', () => {
	it('writes through the same call a person’s reorder uses', async () => {
		await skills.apply(SECTION, { 'skill.order': [3, 1, 2] }, {}, ACTOR);

		expect(state.reordered).toEqual([
			{ resource: 'skill', actor: { profileId: 12 }, order: [3, 1, 2] }
		]);
	});

	it('throws when the write refuses, like the other verbs', async () => {
		state.result = { ok: false, error: 'Access denied' };
		await expect(skills.apply(SECTION, { 'skill.order': [3, 1, 2] }, {}, ACTOR)).rejects.toThrow(
			/reorder_skill refused at write time: Access denied/
		);
	});

	it('undoes by writing the recorded order back', async () => {
		// The same shape a person's reorder is logged with, so this is the undo for
		// theirs too.
		await skills.revert?.(SECTION, { order: [1, 2, 3] }, ACTOR);

		expect(state.reordered).toEqual([
			{ resource: 'skill', actor: { profileId: 12 }, order: [1, 2, 3] }
		]);
	});

	it('refuses an order it never recorded, rather than reporting a no-op as undone', async () => {
		await expect(skills.revert?.(SECTION, {}, ACTOR)).rejects.toThrow(/not recorded/);
		expect(state.reordered).toHaveLength(0);
	});

	it('reports a refused undo as a thrown error, so the log does not mark it undone', async () => {
		state.result = { ok: false, error: 'Access denied' };
		await expect(skills.revert?.(SECTION, { order: [1, 2, 3] }, ACTOR)).rejects.toThrow(
			/could not be undone: Access denied/
		);
	});
});
