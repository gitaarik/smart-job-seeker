/**
 * The one REST door for every profile section.
 *
 * The write layer is tested on its own; what these pin is the part this file
 * adds — where the actor comes from for each verb, and what an unknown section
 * or an unowned parent answers. Those are the questions a route gets wrong in a
 * way no write-layer test can see.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = {
	/** The profile row the ownership check finds, or null for "not theirs". */
	profileRow: null as { id: number } | null,
	/** What actorForRow resolves for a row, keyed `resource:id`. */
	actors: {} as Record<string, { profileId: number } | null>,
	created: [] as { resource: string; actor: unknown; values: Record<string, unknown> }[],
	updated: [] as {
		resource: string;
		id: number;
		values: Record<string, unknown>;
		expected: Record<string, unknown> | undefined;
	}[],
	deleted: [] as { resource: string; id: number }[],
	reordered: [] as { resource: string; actor: unknown; order: number[] }[],
	/** Overrides the next write's result, for the refusal paths. */
	writeResult: null as { ok: false; reason: string; error: string } | null
};

// The real schema, since `resources.ts` reads every table off it and a stub
// would have to list all fifteen sections' tables to get past the import.
vi.mock('$lib/server/db', () => ({
	db: { query: { profiles: { findFirst: () => Promise.resolve(state.profileRow) } } },
	dbDirect: {
		query: { profiles: { findFirst: () => Promise.resolve(state.profileRow) } }
	}
}));

vi.mock('../write', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../write')>();
	return {
		...actual,
		actorForRow: (resource: string, id: number) =>
			Promise.resolve(state.actors[`${resource}:${id}`] ?? null),
		readOwnedRow: (resource: string, _actor: unknown, id: number) =>
			Promise.resolve({ id, name: 'read back' }),
		createRow: (resource: string, actor: unknown, values: Record<string, unknown>) => {
			state.created.push({ resource, actor, values });
			return Promise.resolve(state.writeResult ?? { ok: true, id: 7, row: { id: 7, ...values } });
		},
		updateRow: (
			resource: string,
			_actor: unknown,
			id: number,
			values: Record<string, unknown>,
			opts?: { expected?: Record<string, unknown> }
		) => {
			state.updated.push({ resource, id, values, expected: opts?.expected });
			return Promise.resolve(state.writeResult ?? { ok: true, previous: {} });
		},
		deleteRow: (resource: string, _actor: unknown, id: number) => {
			state.deleted.push({ resource, id });
			return Promise.resolve(state.writeResult ?? { ok: true, row: { id } });
		},
		reorderRows: (resource: string, actor: unknown, order: number[]) => {
			state.reordered.push({ resource, actor, order });
			return Promise.resolve({ ok: true });
		}
	};
});

const { createSectionRow, patchSectionRow, deleteSectionRow, reorderSectionRows, requireResource } =
	await import('../section-endpoint');

const USER = 'user-1';

/** The slice of a RequestEvent these handlers touch. */
function event(params: Record<string, string>, body?: unknown, user: string | null = USER) {
	return {
		params,
		locals: { user: user === null ? null : { id: user } },
		request: { json: () => Promise.resolve(body) }
	} as never;
}

/** Run a handler and report either its JSON or the HttpError it threw. */
async function call(run: () => Promise<Response>) {
	try {
		const response = await run();
		return { status: response.status, body: await response.json() };
	} catch (e) {
		const err = e as { status?: number; body?: { message?: string } };
		return { status: err.status ?? 500, body: { message: err.body?.message } };
	}
}

beforeEach(() => {
	state.profileRow = { id: 3 };
	state.actors = {
		'work_experience:8': { profileId: 3 },
		'work_experience_project:5': { profileId: 3 }
	};
	state.created = [];
	state.updated = [];
	state.deleted = [];
	state.reordered = [];
	state.writeResult = null;
});

describe('requireResource', () => {
	it('accepts a declared section', () => {
		expect(requireResource('work_experience_project')).toBe('work_experience_project');
	});

	it('404s an undeclared one rather than handing it to the write layer', () => {
		// A path segment is user input, and `PROFILE_RESOURCES[segment]` on an
		// unchecked one reaches the write layer as undefined and throws there,
		// about a property of undefined, a long way from the request.
		expect(() => requireResource('drop_table')).toThrow();
		expect(() => requireResource(undefined)).toThrow();
	});
});

describe('creating a row', () => {
	it('authorises a child through the parent it names', async () => {
		const result = await call(() =>
			createSectionRow(
				event({ resource: 'work_experience_project' }, { name: 'Migration', work_experience_id: 8 })
			)
		);

		expect(result.status).toBe(201);
		expect(state.created).toEqual([
			{
				resource: 'work_experience_project',
				// `source` is what puts the write in the change history — this door
				// is one of three that set it, and a door that forgets logs nothing.
				actor: { profileId: 3, source: 'ui' },
				values: { name: 'Migration', work_experience_id: 8 }
			}
		]);
	});

	it("refuses a parent that is not the caller's", async () => {
		// Owning the role is exactly what entitles you to add a project to it, so
		// this is the whole authorisation — there is no profile_id to fall back on.
		state.actors = {};

		const result = await call(() =>
			createSectionRow(
				event({ resource: 'work_experience_project' }, { name: 'Migration', work_experience_id: 8 })
			)
		);

		expect(result.status).toBe(403);
		expect(state.created).toHaveLength(0);
	});

	it('refuses a child that names no parent', async () => {
		const result = await call(() =>
			createSectionRow(event({ resource: 'work_experience_project' }, { name: 'Migration' }))
		);

		expect(result.status).toBe(400);
		expect(state.created).toHaveLength(0);
	});

	it('authorises a profile-owned section against the profile in the body', async () => {
		const result = await call(() =>
			createSectionRow(event({ resource: 'language' }, { name: 'Dutch', profile_id: 3 }))
		);

		expect(result.status).toBe(201);
		expect(state.created[0].actor).toEqual({ profileId: 3, source: 'ui' });
	});

	it("refuses a profile that is not the caller's", async () => {
		state.profileRow = null;

		const result = await call(() =>
			createSectionRow(event({ resource: 'language' }, { name: 'Dutch', profile_id: 999 }))
		);

		expect(result.status).toBe(403);
		expect(state.created).toHaveLength(0);
	});

	it('hands back the created row, not just its id', async () => {
		// A client that just turned a draft into a row needs the id to patch next,
		// and the server-side defaults to render it without a reload.
		const result = await call(() =>
			createSectionRow(
				event({ resource: 'work_experience_project' }, { name: 'Migration', work_experience_id: 8 })
			)
		);

		expect(result.body).toMatchObject({ id: 7, row: { id: 7, name: 'Migration' } });
	});
});

describe('patching a row', () => {
	it('writes through the row it names', async () => {
		const result = await call(() =>
			patchSectionRow(
				event({ resource: 'work_experience_project', id: '5' }, { end_date: '2024-06-30' })
			)
		);

		expect(result.status).toBe(200);
		expect(state.updated).toEqual([
			{
				resource: 'work_experience_project',
				id: 5,
				values: { end_date: '2024-06-30' },
				expected: undefined
			}
		]);
	});

	it('reads the row back, so a derived value does not need a reload', async () => {
		const result = await call(() =>
			patchSectionRow(event({ resource: 'work_experience_project', id: '5' }, { name: 'x' }))
		);
		expect(result.body).toMatchObject({ row: { id: 5 } });
	});

	it('refuses a row that is not the caller’s, without saying whether it exists', async () => {
		const result = await call(() =>
			patchSectionRow(event({ resource: 'work_experience_project', id: '404' }, { name: 'x' }))
		);

		expect(result.status).toBe(403);
		expect(result.body.message).toBe('Access denied');
		expect(state.updated).toHaveLength(0);
	});

	it('turns an invalid patch into a 400 with the reason', async () => {
		state.writeResult = { ok: false, reason: 'invalid', error: 'Project name is required' };

		const result = await call(() =>
			patchSectionRow(event({ resource: 'work_experience_project', id: '5' }, { name: ' ' }))
		);

		expect(result.status).toBe(400);
		expect(result.body.message).toBe('Project name is required');
	});

	it('takes the baseline out of the patch rather than writing it as a field', async () => {
		// `expected` travels in the body because a PATCH has nowhere else to put it,
		// and the row has no such column. A door that forwarded it whole would try
		// to write it — or, since the schema strips unknown keys, would drop it
		// silently and leave the write unconditional, which is the failure this
		// mechanism exists to close wearing the mechanism's own clothes.
		await call(() =>
			patchSectionRow(
				event(
					{ resource: 'work_experience_project', id: '5' },
					{ name: 'Migration II', expected: { name: 'Migration' } }
				)
			)
		);

		expect(state.updated).toEqual([
			{
				resource: 'work_experience_project',
				id: 5,
				values: { name: 'Migration II' },
				expected: { name: 'Migration' }
			}
		]);
	});

	it('answers a row that moved underneath with 409 and says so', async () => {
		// Not 400: the input was correct when the page drew it. What changed is the
		// row, and the only thing the user can do about it is reload.
		state.writeResult = {
			ok: false,
			reason: 'conflict',
			error: 'Summary changed somewhere else since this was loaded.'
		};

		const result = await call(() =>
			patchSectionRow(event({ resource: 'work_experience_project', id: '5' }, { name: 'x' }))
		);

		expect(result.status).toBe(409);
		expect(result.body.message).toContain('changed somewhere else');
	});

	it('rejects an unusable id before authorising anything', async () => {
		const result = await call(() =>
			patchSectionRow(event({ resource: 'work_experience_project', id: 'abc' }, { name: 'x' }))
		);
		expect(result.status).toBe(400);
	});
});

describe('deleting a row', () => {
	it('deletes the row it names', async () => {
		const result = await call(() =>
			deleteSectionRow(event({ resource: 'work_experience_project', id: '5' }))
		);

		expect(result.status).toBe(200);
		expect(state.deleted).toEqual([{ resource: 'work_experience_project', id: 5 }]);
	});

	it('refuses one that is not the caller’s', async () => {
		const result = await call(() =>
			deleteSectionRow(event({ resource: 'work_experience_project', id: '404' }))
		);

		expect(result.status).toBe(403);
		expect(state.deleted).toHaveLength(0);
	});
});

describe('reordering', () => {
	it('reorders against the profile in the body', async () => {
		const result = await call(() =>
			reorderSectionRows(
				event({ resource: 'work_experience_project' }, { profile_id: 3, order: [2, 1] })
			)
		);

		expect(result.status).toBe(200);
		expect(state.reordered).toEqual([
			{ resource: 'work_experience_project', actor: { profileId: 3, source: 'ui' }, order: [2, 1] }
		]);
	});

	it("refuses a profile that is not the caller's", async () => {
		state.profileRow = null;

		const result = await call(() =>
			reorderSectionRows(
				event({ resource: 'work_experience_project' }, { profile_id: 999, order: [2, 1] })
			)
		);

		expect(result.status).toBe(403);
		expect(state.reordered).toHaveLength(0);
	});

	it('refuses a body that is not an order', async () => {
		const result = await call(() =>
			reorderSectionRows(event({ resource: 'work_experience_project' }, { order: ['a'] }))
		);

		expect(result.status).toBe(400);
		expect(state.reordered).toHaveLength(0);
	});
});
