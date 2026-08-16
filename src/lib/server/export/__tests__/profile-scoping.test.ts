/**
 * Every export query must be scoped to the profile being exported.
 *
 * The concern this pins down is old: exporting one profile on a database that
 * also holds another must not carry the other's rows out. Reading the code in
 * 2026-08 found no leak — `buildProfileExport` roots everything in a single
 * `profiles.findFirst` and reaches the rest through relations, and every
 * standalone query filters on `profile_id` — so this is a regression test, not
 * a bug fix. It exists because the next `findMany` added here is the one that
 * forgets, and nothing else in the suite would notice.
 *
 * What it can and cannot prove: with the DB mocked, this asserts the code
 * *asks* for one profile's rows. It cannot prove Postgres honours the filter —
 * only an integration test against a real database could, and oss has no
 * harness for that today. The failure mode it actually catches is a query
 * shipped with no `where` at all, or one scoped to the wrong id.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

/** Every query the export layer issues, in order, with its options. */
type RecordedQuery = { table: string; options: Record<string, unknown> | undefined };
const queries: RecordedQuery[] = [];

/** A findFirst/findMany pair that records what it was asked for. */
function recorder(table: string, result: unknown) {
	return {
		findFirst: (options?: Record<string, unknown>) => {
			queries.push({ table, options });
			return Promise.resolve(result);
		},
		findMany: (options?: Record<string, unknown>) => {
			queries.push({ table, options });
			return Promise.resolve([]);
		}
	};
}

const PROFILE_ID = 7;
const OTHER_PROFILE_ID = 99;

vi.mock('$lib/server/db', () => {
	const tables = [
		'profiles',
		'project_stories',
		'cheat_sheets',
		'applications',
		'profile_document_projects',
		'resume_templates',
		'profile_translations',
		'files'
	];
	const query: Record<string, unknown> = {};
	for (const t of tables) {
		query[t] = recorder(t, t === 'profiles' ? { id: 7, name: 'Test' } : undefined);
	}
	return { dbDirect: { query } };
});

// `eq` and friends are recorded as plain markers so a where clause can be read
// back and checked, rather than being an opaque SQL object.
// Only the comparison helpers are replaced — `schema.ts` needs the rest of the
// module (pgTable, relations, column builders) to load at all.
vi.mock('drizzle-orm', async (importOriginal) => {
	const actual = await importOriginal<typeof import('drizzle-orm')>();
	return {
		...actual,
		eq: (col: unknown, val: unknown) => ({ op: 'eq', col, val }),
		and: (...parts: unknown[]) => ({ op: 'and', parts }),
		inArray: (col: unknown, vals: unknown) => ({ op: 'inArray', col, vals })
	};
});

import { buildDocumentExport } from '../export-documents';
import { buildTemplateExport } from '../export-templates';
import { buildTranslationExport, emptyTranslationIndexMaps } from '../export-translations';

/** Pull every literal value out of a where clause, however it is nested. */
function valuesIn(clause: unknown): unknown[] {
	if (!clause || typeof clause !== 'object') return [];
	const node = clause as Record<string, unknown>;
	if (node.op === 'and') return (node.parts as unknown[]).flatMap(valuesIn);
	if (node.op === 'eq') return [node.val];
	if (node.op === 'inArray') return Array.isArray(node.vals) ? node.vals : [node.vals];
	return [];
}

/**
 * The builders that query a table directly, rather than reaching it through the
 * profile row's relations. These are the whole risk surface: a relational
 * `with` inherits its parent's scope and cannot leak, but one of these
 * forgetting its `where` would export everybody's rows.
 *
 * Driven one builder at a time on purpose. Going through `buildFullExport`
 * looked tidier and was worthless: it awaits `buildProfileExport` first, which
 * throws against a mocked database, so the standalone queries never ran and the
 * assertions passed over a single row. A test that cannot fail is worse than no
 * test — this list is the fix, and it is why each case asserts it saw a query.
 */
const STANDALONE_BUILDERS: { name: string; run: (profileId: number) => Promise<unknown> }[] = [
	{
		name: 'buildDocumentExport',
		run: (id) =>
			buildDocumentExport(id, {
				workExperienceIndexById: new Map(),
				workExperienceProjectIndexById: new Map(),
				sideProjectIndexById: new Map()
			})
	},
	{ name: 'buildTemplateExport', run: (id) => buildTemplateExport(id, false) },
	{
		name: 'buildTranslationExport',
		run: (id) => buildTranslationExport(id, emptyTranslationIndexMaps(id))
	}
];

describe('export queries are profile-scoped', () => {
	beforeEach(() => {
		queries.length = 0;
		vi.clearAllMocks();
	});

	it.each(STANDALONE_BUILDERS)('$name scopes every query it issues', async ({ run }) => {
		await run(PROFILE_ID);

		// Guard against the vacuous pass described above: if the builder issued no
		// query at all, the loop below proves nothing.
		expect(
			queries.length,
			'builder issued no query — the assertions below are vacuous'
		).toBeGreaterThan(0);

		for (const q of queries) {
			expect(q.options, `${q.table} was queried with no options at all`).toBeDefined();
			expect(q.options!.where, `${q.table} was queried with no where clause`).toBeDefined();
		}
	});

	it.each(STANDALONE_BUILDERS)('$name asks only for the requested profile', async ({ run }) => {
		await run(PROFILE_ID);

		expect(queries.length).toBeGreaterThan(0);

		for (const q of queries) {
			const values = valuesIn(q.options?.where);
			expect(
				values.includes(OTHER_PROFILE_ID),
				`${q.table} referenced profile ${OTHER_PROFILE_ID}`
			).toBe(false);
		}

		// At least one query named the profile we asked for, so a refactor that
		// stops threading the id through cannot pass quietly.
		const named = queries.some((q) => valuesIn(q.options?.where).includes(PROFILE_ID));
		expect(named, 'no query referenced the requested profile id').toBe(true);
	});
});
