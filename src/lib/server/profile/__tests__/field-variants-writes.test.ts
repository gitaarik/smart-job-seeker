/**
 * The functions that read and write a version's wordings against the database.
 *
 * `field-variants.test.ts` covers the rule — which of several decisions stands.
 * This covers the assembly around it: which rows a write replaces, what "use my
 * own value" has to store on a version that inherits a pick, and that a
 * document which uses no wordings pays one query for finding that out.
 *
 * The database is a stand-in that hands back canned rows per table and records
 * what is written. It reads one thing out of a WHERE clause: which of the
 * profile's versions a query for override rows asked about, since "the rows of
 * the versions this one builds on" is the question the write turns on.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';

const dialect = new PgDialect();

interface Write {
	table: unknown;
	values?: unknown;
	where?: SQL;
}

const { tables, versions, selects, inserts, deletes, dbMock } = vi.hoisted(() => {
	/** Canned rows per table object. */
	const tables = new Map<unknown, Record<string, unknown>[]>();
	/** What `db.query.profile_versions.findMany` answers. */
	const versions: { id: number; extension_links: { extended_id: number | null }[] }[] = [];
	const selects: unknown[] = [];
	const inserts: Write[] = [];
	const deletes: Write[] = [];

	const dbMock = {
		query: {
			profile_versions: { findMany: vi.fn(async () => versions) }
		},
		select: () => {
			let table: unknown;
			let where: SQL | undefined;
			const builder = {
				from(t: unknown) {
					table = t;
					selects.push(t);
					return builder;
				},
				innerJoin: () => builder,
				where(w: SQL) {
					where = w;
					return builder;
				},
				orderBy: () => builder,
				limit: () => builder,
				then(resolve: (rows: unknown[]) => unknown, reject: (err: unknown) => unknown) {
					return Promise.resolve(tables.get(table) ?? [])
						.then((rows) => filterByVersion(rows, where))
						.then(resolve, reject);
				}
			};
			return builder;
		},
		insert: (table: unknown) => ({
			values: (values: unknown) => {
				inserts.push({ table, values });
				const rows = () =>
					Promise.resolve(
						(Array.isArray(values) ? values : [values]).map((v, i) => ({ id: 900 + i, ...v }))
					);
				return Object.assign(rows(), { returning: rows });
			}
		}),
		delete: (table: unknown) => ({
			where: (where: SQL) => {
				deletes.push({ table, where });
				return Promise.resolve();
			}
		})
	};

	/**
	 * Rows of the versions the WHERE names. A query that names none of the
	 * profile's versions — the one that asks for every decision on any of them —
	 * gets every row.
	 */
	let render: ((query: SQL) => { params: unknown[] }) | null = null;
	function filterByVersion(rows: Record<string, unknown>[], where: SQL | undefined) {
		if (!where || !render || !rows.some((r) => 'version_id' in r)) return rows;
		const known = new Set(versions.map((v) => v.id));
		const asked = new Set(
			render(where).params.filter((p): p is number => typeof p === 'number' && known.has(p))
		);
		return asked.size === 0 ? rows : rows.filter((r) => asked.has(r.version_id as number));
	}

	return {
		tables,
		versions,
		selects,
		inserts,
		deletes,
		dbMock: Object.assign(dbMock, {
			useRenderer: (fn: (query: SQL) => { params: unknown[] }) => {
				render = fn;
			}
		})
	};
});

vi.mock('$lib/server/db', () => ({ db: dbMock, dbDirect: dbMock }));

import { profile_field_variants, profile_version_overrides } from '$lib/server/db/schema';
import { variantTargetKey } from '$lib/field-variants';
import {
	createFieldVariant,
	loadFieldVariants,
	NO_FIELD_VARIANTS,
	setVersionWording
} from '../field-variants';

dbMock.useRenderer((query) => dialect.sqlToQuery(query));

const PROFILE_ID = 1;
const JOB = 30;
const LIBRARY = 20;

/** A stored wording of a role's position. */
const ofRole = (id: number, roleId: number, value = `value ${id}`) => ({
	id,
	profile_id: PROFILE_ID,
	work_experience_id: roleId,
	field: 'position',
	label: `wording ${id}`,
	value,
	note: null,
	sort: id
});
/** A stored wording of the profile's own title. */
const ofTitle = (id: number, value = `value ${id}`) => ({
	id,
	profile_id: PROFILE_ID,
	work_experience_id: null,
	field: 'title',
	label: `wording ${id}`,
	value,
	note: null,
	sort: id
});

let nextRowId = 100;
const pick = (
	versionId: number,
	variantId: number,
	action: 'include' | 'exclude' = 'include',
	source: 'user' | 'ai' = 'user'
) => ({
	id: nextRowId++,
	version_id: versionId,
	entity_id: variantId,
	action,
	source,
	reason: null
});

/** The job's version builds on the library version; the library version on nothing. */
function jobBuildsOnLibrary() {
	versions.push(
		{ id: JOB, extension_links: [{ extended_id: LIBRARY }] },
		{ id: LIBRARY, extension_links: [] }
	);
}

const setRole9 = (versionId: number, variantId: number | null) =>
	setVersionWording({
		profileId: PROFILE_ID,
		versionId,
		entity: 'work_experience',
		entityId: 9,
		field: 'position',
		variantId
	});

/** The numbers a delete's WHERE names: the version, and the wordings cleared on it. */
const deletedIds = (write: Write) =>
	dialect.sqlToQuery(write.where as SQL).params.filter((p) => typeof p === 'number');

beforeEach(() => {
	tables.clear();
	versions.length = 0;
	selects.length = 0;
	inserts.length = 0;
	deletes.length = 0;
	dbMock.query.profile_versions.findMany.mockClear();
});

describe('setVersionWording', () => {
	it('refuses a wording that belongs to another field, and writes nothing', async () => {
		// The id is the client's. A title's wording picked for a role would print
		// as that role's position.
		tables.set(profile_field_variants, [ofRole(1, 9), ofTitle(2)]);
		expect(await setRole9(JOB, 2)).toBe(false);
		// Another role's is another field too.
		tables.set(profile_field_variants, [ofRole(1, 9), ofRole(3, 10)]);
		expect(await setRole9(JOB, 3)).toBe(false);
		expect(inserts).toEqual([]);
		expect(deletes).toEqual([]);
	});

	it('replaces what the version said about the field rather than adding to it', async () => {
		tables.set(profile_field_variants, [ofRole(1, 9), ofRole(2, 9), ofRole(3, 10)]);
		expect(await setRole9(JOB, 2)).toBe(true);

		// This version's rows for BOTH of the role's wordings are cleared, and not
		// the other role's: a field holds one value, and the unique key is per
		// wording, so without the clear two picks for one title would coexist.
		expect(deletes).toHaveLength(1);
		expect(deletes[0].table).toBe(profile_version_overrides);
		expect(deletedIds(deletes[0])).toEqual([JOB, 1, 2]);

		expect(inserts).toHaveLength(1);
		expect(inserts[0].values).toMatchObject({
			version_id: JOB,
			entity_type: 'profile_field_variant',
			entity_id: 2,
			action: 'include',
			// The applicant's own, so a regeneration leaves it standing.
			source: 'user',
			reason: 'you chose this position for this version'
		});
	});

	it('stores nothing for "my own value" on a version that builds on nothing', async () => {
		tables.set(profile_field_variants, [ofRole(1, 9)]);
		versions.push({ id: LIBRARY, extension_links: [] });
		expect(await setRole9(LIBRARY, null)).toBe(true);
		// The absence of a pick has always meant the profile's own value.
		expect(deletes).toHaveLength(1);
		expect(inserts).toEqual([]);
	});

	it('takes an inherited pick back off for "my own value"', async () => {
		// Saying nothing would inherit the library version's wording, so the job's
		// version has to say "not that one here".
		tables.set(profile_field_variants, [ofRole(1, 9), ofRole(2, 9)]);
		tables.set(profile_version_overrides, [pick(LIBRARY, 2)]);
		jobBuildsOnLibrary();

		expect(await setRole9(JOB, null)).toBe(true);
		expect(inserts).toHaveLength(1);
		expect(inserts[0].values).toEqual([
			expect.objectContaining({
				version_id: JOB,
				entity_id: 2,
				action: 'exclude',
				source: 'user',
				reason: 'you chose your own position for this version'
			})
		]);
	});

	it('leaves the base’s picks for other fields inherited', async () => {
		// The base picks a wording for ANOTHER role. Choosing this role's own
		// title must not take that one off as well.
		tables.set(profile_field_variants, [ofRole(1, 9), ofRole(3, 10)]);
		tables.set(profile_version_overrides, [pick(LIBRARY, 3)]);
		jobBuildsOnLibrary();

		expect(await setRole9(JOB, null)).toBe(true);
		expect(inserts).toEqual([]);
	});

	it('does not count the version’s own old rows as inherited', async () => {
		// The job's version had picked wording 1 itself. Going back to the
		// profile's value clears that row; nothing above picks anything, so there
		// is nothing to take back off.
		tables.set(profile_field_variants, [ofRole(1, 9)]);
		tables.set(profile_version_overrides, [pick(JOB, 1)]);
		jobBuildsOnLibrary();

		expect(await setRole9(JOB, null)).toBe(true);
		expect(inserts).toEqual([]);
	});
});

describe('createFieldVariant', () => {
	it('files a role’s wording under the role, after the ones it already has', async () => {
		tables.set(profile_field_variants, [ofRole(1, 9), ofRole(4, 9), ofTitle(2)]);
		const created = await createFieldVariant({
			profileId: PROFILE_ID,
			entity: 'work_experience',
			entityId: 9,
			field: 'position',
			label: '  Politie ',
			value: ' Senior Python Engineer ',
			note: 'roles like Senior Python Developer'
		});
		expect(inserts[0].values).toMatchObject({
			profile_id: PROFILE_ID,
			work_experience_id: 9,
			field: 'position',
			label: 'Politie',
			value: 'Senior Python Engineer',
			note: 'roles like Senior Python Developer',
			// The role's own two are sorted 1 and 4; the title's 2 is not counted.
			sort: 5
		});
		expect(created).toMatchObject({ entity: 'work_experience', entity_id: 9 });
	});

	it('files a wording of the profile’s own field under no role', async () => {
		const created = await createFieldVariant({
			profileId: PROFILE_ID,
			entity: 'profile',
			entityId: PROFILE_ID,
			field: 'title',
			label: '',
			value: 'Senior Python Engineer'
		});
		expect(inserts[0].values).toMatchObject({
			work_experience_id: null,
			// An unnamed wording still needs something to be listed by.
			label: 'Alternative',
			note: null,
			sort: 0
		});
		expect(created).toMatchObject({ entity: 'profile', entity_id: PROFILE_ID });
	});
});

describe('loadFieldVariants', () => {
	it('costs no query without a version', async () => {
		expect(await loadFieldVariants(PROFILE_ID, null)).toBe(NO_FIELD_VARIANTS);
		expect(selects).toEqual([]);
	});

	it('stops after one query for a profile whose versions pick no wording', async () => {
		// Every document render comes through here. Walking the chain first would
		// charge each of them a second query to learn there is nothing to apply.
		jobBuildsOnLibrary();
		expect(await loadFieldVariants(PROFILE_ID, JOB)).toBe(NO_FIELD_VARIANTS);
		expect(selects).toEqual([profile_version_overrides]);
		expect(dbMock.query.profile_versions.findMany).not.toHaveBeenCalled();
	});

	it('gives a job’s version the wording its library version picked', async () => {
		tables.set(profile_field_variants, [ofRole(1, 9, 'Senior Python Engineer')]);
		tables.set(profile_version_overrides, [pick(LIBRARY, 1)]);
		jobBuildsOnLibrary();

		const loaded = await loadFieldVariants(PROFILE_ID, JOB);
		expect(loaded.isEmpty).toBe(false);
		expect(loaded.value('work_experience', 9, 'position', 'Lead Engineer')).toBe(
			'Senior Python Engineer'
		);
		// Another role, and the profile's own fields, keep what they had.
		expect(loaded.value('work_experience', 10, 'position', 'Lead Engineer')).toBe('Lead Engineer');
		expect(loaded.value('profile', PROFILE_ID, 'title', 'Engineer')).toBe('Engineer');
		expect([...loaded.picked.keys()]).toEqual([variantTargetKey('work_experience', 9, 'position')]);
	});

	it('lets the job’s own pick outrank the inherited one', async () => {
		tables.set(profile_field_variants, [
			ofRole(1, 9, 'from the library'),
			ofRole(2, 9, 'for this job')
		]);
		tables.set(profile_version_overrides, [pick(LIBRARY, 1), pick(JOB, 2)]);
		jobBuildsOnLibrary();

		const loaded = await loadFieldVariants(PROFILE_ID, JOB);
		expect(loaded.value('work_experience', 9, 'position', 'own')).toBe('for this job');
	});

	it('ignores a version that is not on this one’s chain', async () => {
		// Another job's version picked a wording. It is the same profile's, and
		// the first query sees its row; it must not reach this document.
		tables.set(profile_field_variants, [ofRole(1, 9)]);
		tables.set(profile_version_overrides, [pick(31, 1)]);
		versions.push({ id: JOB, extension_links: [] }, { id: 31, extension_links: [] });

		expect(await loadFieldVariants(PROFILE_ID, JOB)).toBe(NO_FIELD_VARIANTS);
	});

	it('prints the wording’s own translation, not the field’s', async () => {
		tables.set(profile_field_variants, [ofRole(1, 9, 'Senior Python Engineer')]);
		tables.set(profile_version_overrides, [pick(JOB, 1)]);
		versions.push({ id: JOB, extension_links: [] });

		const translator = {
			locale: 'nl',
			isBase: false,
			t: (entity: string, id: number | string, field: string, base: string | null) =>
				entity === 'profile_field_variant' && id === 1 && field === 'value' ? 'NL titel' : base
		};
		const loaded = await loadFieldVariants(PROFILE_ID, JOB, translator);
		expect(loaded.value('work_experience', 9, 'position', 'Hoofdontwikkelaar')).toBe('NL titel');
	});
});
