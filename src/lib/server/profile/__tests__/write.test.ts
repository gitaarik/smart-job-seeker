/**
 * Tests for the one profile write path.
 *
 * The behaviours here are the ones a reader would not guess from the signature,
 * and the ones the two conventions this replaces disagreed about:
 *
 *  - a patch is partial, so an omitted field keeps its value while an explicit
 *    null clears it — collapsing those is how a save wipes what it never showed;
 *  - a date lands as the `YYYY-MM-DD` string its column holds, which is what the
 *    form actions did and the REST layer did not;
 *  - ownership is asked of a freshly-read row, not of whatever the caller
 *    claimed, and a row belonging to someone else is a distinct refusal from one
 *    that isn't there so each door can answer in its own words;
 *  - a new row's `sort` follows the section's declared placement, because that
 *    is the difference between a list that stays in date order and one that has
 *    silently switched to manual.
 *
 * Only `$lib/server/db` is mocked. Drizzle and the real schema run, so the
 * queries this layer builds are the ones a resource declaration actually
 * produces.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

interface RecordedWrite {
	table: unknown;
	values: Record<string, unknown>;
}

const state = {
	/** What a select of the resource's table returns. */
	rows: [] as Record<string, unknown>[],
	/** What `max(sort)` returns for the append placement. */
	maxSort: null as number | null,
	/** The profile row `actorForRow` looks for; null means "not this user's". */
	profileRow: null as { id: number } | null,
	inserts: [] as RecordedWrite[],
	updates: [] as RecordedWrite[],
	deletes: [] as unknown[]
};

vi.mock('$lib/server/db', () => {
	// `.where()` is awaited directly by the max-sort query and chained with
	// `.limit()` by the row read, so it has to be both a promise and an object.
	const resolvable = (rows: unknown[]) =>
		Object.assign(Promise.resolve(rows), { limit: () => Promise.resolve(rows) });

	const dbMock = {
		select: (fields?: Record<string, unknown>) => ({
			from: () => ({
				where: () => resolvable(fields && 'max' in fields ? [{ max: state.maxSort }] : state.rows)
			})
		}),
		insert: (table: unknown) => ({
			values: (values: Record<string, unknown>) => {
				state.inserts.push({ table, values });
				return { returning: () => Promise.resolve([{ id: 99, ...values }]) };
			}
		}),
		update: (table: unknown) => ({
			set: (values: Record<string, unknown>) => ({
				where: () => {
					state.updates.push({ table, values });
					return Promise.resolve(undefined);
				}
			})
		}),
		delete: (table: unknown) => ({
			where: () => {
				state.deletes.push(table);
				return Promise.resolve(undefined);
			}
		}),
		query: {
			profiles: { findFirst: () => Promise.resolve(state.profileRow) }
		}
	};

	return { db: dbMock, dbDirect: dbMock };
});

const { profiles, work_experiences } = await import('$lib/server/db/schema');
const { PROFILE_RESOURCES } = await import('../resources');
const {
	actorForRow,
	createRow,
	deleteRow,
	reorderRows,
	resetRowOrder,
	setRowTags,
	setRowVisible,
	updateRow
} = await import('../write');

const ACTOR = { profileId: 7 };

/** A stored row, with the columns this layer reads and whatever the test cares about. */
function row(fields: Record<string, unknown> = {}) {
	return { id: 42, profile_id: 7, sort: null, status: 'published', ...fields };
}

/** Writes to a section's own table, ignoring the profile touch that follows every one. */
function sectionUpdates() {
	return state.updates.filter((write) => write.table !== profiles);
}

function touchedProfile() {
	return state.updates.some((write) => write.table === profiles);
}

beforeEach(() => {
	state.rows = [];
	state.maxSort = null;
	state.profileRow = null;
	state.inserts = [];
	state.updates = [];
	state.deletes = [];
});

describe('the declaration', () => {
	it.each(Object.entries(PROFILE_RESOURCES))(
		'%s declares every required field as one it can write',
		(_name, resource) => {
			for (const field of resource.required) {
				expect(Object.keys(resource.fields)).toContain(field);
			}
		}
	);

	it.each(Object.entries(PROFILE_RESOURCES))(
		'%s accepts each of its fields through its schema',
		(_name, resource) => {
			// A field declared writable but absent from the schema is stripped
			// before it reaches the coercion — writable in name only.
			for (const field of Object.keys(resource.fields)) {
				expect(Object.keys(resource.schema.shape)).toContain(field);
			}
		}
	);

	it.each(Object.entries(PROFILE_RESOURCES))(
		'%s names a row it has not filled in',
		(_name, resource) => {
			expect(resource.rowLabel(row())).toBeTruthy();
		}
	);
});

describe('createRow', () => {
	it('refuses a create missing a required field', async () => {
		const result = await createRow('language', ACTOR, { proficiency: 'native' });
		expect(result).toMatchObject({ ok: false, reason: 'invalid' });
		expect(state.inserts).toHaveLength(0);
	});

	it('refuses a required field that is present but blank', async () => {
		const result = await createRow('language', ACTOR, { name: '   ' });
		expect(result).toMatchObject({ ok: false, reason: 'invalid' });
	});

	it('writes the row against the actor’s profile, never a claimed one', async () => {
		await createRow('language', { profileId: 7 }, { name: 'Dutch', profile_id: 999 });
		expect(state.inserts[0].values).toMatchObject({ profile_id: 7 });
	});

	it('appends after the last row where the section is hand-ordered', async () => {
		state.maxSort = 4;
		await createRow('language', ACTOR, { name: 'Dutch' });
		expect(state.inserts[0].values).toMatchObject({ sort: 5 });
	});

	it('starts an empty hand-ordered section at zero', async () => {
		state.maxSort = null;
		await createRow('language', ACTOR, { name: 'Dutch' });
		expect(state.inserts[0].values).toMatchObject({ sort: 0 });
	});

	it('leaves sort null where the section defaults to date order', async () => {
		// Creating a work experience must not be what flips the list to manual.
		await createRow('work_experience', ACTOR, { name: 'Acme', position: 'Engineer' });
		expect(state.inserts[0].values).toMatchObject({ sort: null });
	});

	it('applies the section’s insert defaults', async () => {
		await createRow('highlight', ACTOR, { text: 'Ships things' });
		expect(state.inserts[0].values).toMatchObject({ type: 'highlight' });
	});

	it('stores a date as the string its column holds', async () => {
		await createRow('certificate', ACTOR, { name: 'AWS', date: '2020-05-15' });
		expect(state.inserts[0].values.date).toBe('2020-05-15');
	});

	it('fills the columns the database refuses null for, even unmentioned ones', async () => {
		// work_experiences.location/description/summary are NOT NULL with no
		// default, so a create that omits them has to supply something. The old
		// create form wrote '' into all three; leaving them out raises a
		// constraint violation on a perfectly ordinary new role.
		await createRow('work_experience', ACTOR, { name: 'Acme', position: 'Engineer' });

		expect(state.inserts[0].values).toMatchObject({
			location: '',
			description: '',
			summary: ''
		});
	});

	it('leaves nullable columns out rather than blanking them', async () => {
		await createRow('work_experience', ACTOR, { name: 'Acme', position: 'Engineer' });
		expect(state.inserts[0].values).not.toHaveProperty('website');
	});

	it('touches the profile', async () => {
		await createRow('language', ACTOR, { name: 'Dutch' });
		expect(touchedProfile()).toBe(true);
	});
});

describe('updateRow', () => {
	it('refuses a row that is not there', async () => {
		state.rows = [];
		const result = await updateRow('language', ACTOR, 42, { name: 'Dutch' });
		expect(result).toMatchObject({ ok: false, reason: 'not_found' });
	});

	it('refuses a row belonging to another profile', async () => {
		state.rows = [row({ profile_id: 8 })];
		const result = await updateRow('language', ACTOR, 42, { name: 'Dutch' });
		expect(result).toMatchObject({ ok: false, reason: 'unauthorized' });
		expect(sectionUpdates()).toHaveLength(0);
	});

	it('writes only the fields it was given', async () => {
		state.rows = [row({ name: 'Dutch', proficiency: 'native', language_code: 'nl' })];
		await updateRow('language', ACTOR, 42, { proficiency: 'fluent' });

		const written = sectionUpdates()[0].values;
		expect(written).toMatchObject({ proficiency: 'fluent' });
		expect(written).not.toHaveProperty('name');
		expect(written).not.toHaveProperty('language_code');
	});

	it('clears a field it was given as null', async () => {
		state.rows = [row({ name: 'Dutch', language_code: 'nl' })];
		await updateRow('language', ACTOR, 42, { language_code: null });
		expect(sectionUpdates()[0].values).toMatchObject({ language_code: null });
	});

	it('refuses to clear a required field', async () => {
		state.rows = [row({ name: 'Dutch' })];
		const result = await updateRow('language', ACTOR, 42, { name: '' });
		expect(result).toMatchObject({ ok: false, reason: 'invalid' });
		expect(sectionUpdates()).toHaveLength(0);
	});

	it('allows an update that simply omits a required field', async () => {
		state.rows = [row({ name: 'Dutch' })];
		const result = await updateRow('language', ACTOR, 42, { proficiency: 'fluent' });
		expect(result.ok).toBe(true);
	});

	it('returns what the written fields held before', async () => {
		state.rows = [row({ name: 'Dutch', proficiency: 'native' })];
		const result = await updateRow('language', ACTOR, 42, { proficiency: 'fluent' });

		// Only the written fields, so it pairs one-for-one with the patch.
		expect(result).toMatchObject({ ok: true, previous: { proficiency: 'native' } });
		expect((result as { previous: Record<string, unknown> }).previous).not.toHaveProperty('name');
	});

	it('reports a missing value as null in the before-image', async () => {
		state.rows = [row({ name: 'Dutch', proficiency: undefined })];
		const result = await updateRow('language', ACTOR, 42, { proficiency: 'fluent' });
		expect(result).toMatchObject({ previous: { proficiency: null } });
	});

	it('does not write, or touch the profile, for a patch with nothing in it', async () => {
		// A no-op save that moves the profile's clock tells the matcher and the
		// tailored-document notice that something changed when nothing did.
		state.rows = [row({ name: 'Dutch' })];
		const result = await updateRow('language', ACTOR, 42, {});

		expect(result).toMatchObject({ ok: true, previous: {} });
		expect(state.updates).toHaveLength(0);
	});

	it('ignores a field the resource has not declared', async () => {
		state.rows = [row({ name: 'Dutch' })];
		await updateRow('language', ACTOR, 42, { name: 'Nederlands', profile_id: 999 });
		expect(sectionUpdates()[0].values).not.toHaveProperty('profile_id');
	});

	it('keeps a date a string rather than a Date', async () => {
		state.rows = [row({ start_date: null })];
		await updateRow('work_experience', ACTOR, 42, { start_date: '2020-05-15' });
		expect(sectionUpdates()[0].values.start_date).toBe('2020-05-15');
	});

	it('refuses a date it cannot read instead of clearing the column', async () => {
		state.rows = [row({ start_date: '2020-05-15' })];
		const result = await updateRow('work_experience', ACTOR, 42, { start_date: 'last spring' });
		expect(result).toMatchObject({ ok: false, reason: 'invalid' });
		expect(sectionUpdates()).toHaveLength(0);
	});

	it('touches the profile after a real write', async () => {
		state.rows = [row({ name: 'Dutch' })];
		await updateRow('language', ACTOR, 42, { name: 'Nederlands' });
		expect(touchedProfile()).toBe(true);
	});
});

describe('deleteRow', () => {
	it('refuses a row belonging to another profile', async () => {
		state.rows = [row({ profile_id: 8 })];
		const result = await deleteRow('language', ACTOR, 42);
		expect(result).toMatchObject({ ok: false, reason: 'unauthorized' });
		expect(state.deletes).toHaveLength(0);
	});

	it('deletes an owned row and touches the profile', async () => {
		state.rows = [row({ name: 'Dutch' })];
		const result = await deleteRow('language', ACTOR, 42);
		expect(result.ok).toBe(true);
		expect(state.deletes).toHaveLength(1);
		expect(touchedProfile()).toBe(true);
	});
});

describe('reorderRows', () => {
	it('numbers the rows in the order given', async () => {
		await reorderRows('language', ACTOR, [5, 3, 9]);
		expect(sectionUpdates().map((write) => write.values.sort)).toEqual([0, 1, 2]);
	});

	it('touches the profile, which the API endpoints never used to', async () => {
		await reorderRows('language', ACTOR, [5, 3]);
		expect(touchedProfile()).toBe(true);
	});
});

describe('resetRowOrder', () => {
	it('clears the manual order so the list falls back to its declared ordering', async () => {
		await resetRowOrder('work_experience', ACTOR);
		expect(sectionUpdates()[0]).toMatchObject({
			table: work_experiences,
			values: { sort: null }
		});
	});
});

describe('actorForRow', () => {
	it('refuses a row that is not there', async () => {
		state.rows = [];
		expect(await actorForRow('language', 42, 'user-1')).toBeNull();
	});

	it('refuses a row whose profile is not the user’s', async () => {
		state.rows = [row({ profile_id: 7 })];
		state.profileRow = null;
		expect(await actorForRow('language', 42, 'someone-else')).toBeNull();
	});

	it('answers with the row’s profile, not one the caller named', async () => {
		state.rows = [row({ profile_id: 7 })];
		state.profileRow = { id: 7 };
		expect(await actorForRow('language', 42, 'user-1')).toEqual({ profileId: 7 });
	});
});

/**
 * Hiding an entry, which shipped once as a write that changed nothing.
 *
 * The first version set `status` to `'draft'` on the stated grounds that
 * documents render only `'published'`. They do not: `status` defaults to
 * `'draft'` on every section table, the resume importer writes `'draft'` for
 * every row it creates, and nothing filters a section row on it anywhere. So
 * the assistant reported the entry hidden and it went on printing.
 *
 * There were no tests over `setRowVisible` at all, which is the other half of
 * how that shipped. These are them.
 */
describe('setRowVisible', () => {
	it('writes the tags documents actually filter on, and not status', async () => {
		state.rows = [row({ tags: null })];

		const result = await setRowVisible('work_experience', ACTOR, 42, false);

		expect(result.ok).toBe(true);
		expect(sectionUpdates()[0].values).toMatchObject({ tags: ['!resume', '!cv'] });
		expect(sectionUpdates()[0].values).not.toHaveProperty('status');
	});

	it('leaves a per-version tag alone', async () => {
		// The applicant said "this one is for my senior versions". Hiding it from
		// the base templates is not a reason to forget that.
		state.rows = [row({ tags: ['senior'] })];

		await setRowVisible('work_experience', ACTOR, 42, false);

		expect(sectionUpdates()[0].values.tags).toEqual(['!resume', '!cv', 'senior']);
	});

	it('reports what it was, from the tags rather than from status', async () => {
		state.rows = [row({ tags: ['!resume', '!cv'], status: 'published' })];

		const result = await setRowVisible('work_experience', ACTOR, 42, false);

		// 'published' status and already hidden: the two disagree, and the tags win.
		expect(result).toMatchObject({ ok: true, wasVisible: false });
	});

	it('writes nothing when it is already where it is being put', async () => {
		// A no-op that bumps date_updated lies to the matcher and to the
		// tailored-document notice — see updateRow.
		state.rows = [row({ tags: ['!resume', '!cv'] })];

		await setRowVisible('work_experience', ACTOR, 42, false);

		expect(sectionUpdates()).toHaveLength(0);
		expect(touchedProfile()).toBe(false);
	});

	it('un-hides by lifting the base-template exclusions', async () => {
		state.rows = [row({ tags: ['!resume', '!cv', 'senior'] })];

		await setRowVisible('work_experience', ACTOR, 42, true);

		expect(sectionUpdates()[0].values.tags).toEqual(['senior']);
	});

	it('normalises an empty tag list to null', async () => {
		state.rows = [row({ tags: ['!resume', '!cv'] })];

		await setRowVisible('work_experience', ACTOR, 42, true);

		expect(sectionUpdates()[0].values.tags).toBeNull();
	});

	it('refuses a section that has no way to be hidden', async () => {
		// Languages, references, certificates and highlights are rendered with no
		// filter between them and the page. Writing anything here would be the
		// original bug again, one layer down.
		state.rows = [row()];

		const result = await setRowVisible('language', ACTOR, 42, false);

		expect(result).toMatchObject({ ok: false, reason: 'invalid' });
		expect(sectionUpdates()).toHaveLength(0);
	});
});

describe('setRowTags', () => {
	it('restores the exact array, rather than deriving one', async () => {
		// The undo counterpart. setProfileOnly(tags, false) lifts BOTH base
		// exclusions, so a derived restore would drop a `!resume` the applicant
		// set by hand along with the one the assistant wrote.
		state.rows = [row({ tags: ['!resume', '!cv'] })];

		await setRowTags('work_experience', ACTOR, 42, ['!resume', 'senior']);

		expect(sectionUpdates()[0].values.tags).toEqual(['!resume', 'senior']);
	});

	it('refuses a section that carries no document tags', async () => {
		state.rows = [row()];
		expect(await setRowTags('certificate', ACTOR, 42, ['x'])).toMatchObject({
			ok: false,
			reason: 'invalid'
		});
	});
});
