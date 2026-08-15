/**
 * Tests for the generated profile capabilities.
 *
 * What is worth pinning is the part a reader would not guess from "generated
 * from the declaration":
 *
 *  - the wire name carries the section, and only the column reaches the write
 *    layer — a field naming another section is a name that fails rather than a
 *    value that lands somewhere plausible;
 *  - a column marked `notForAssistant` is absent from the contract, the schema
 *    and the write, because its wrong value is silent rather than loud;
 *  - a row is read against the actor, never by id alone, since unlike a job a
 *    profile row is not readable by whoever asks;
 *  - a section's capability resolves only on its own page.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = {
	/** What readOwnedRow returns; null means gone, or not this actor's. */
	row: null as Record<string, unknown> | null,
	/** What readOwnedRows returns — every row of the section this actor owns. */
	rows: [] as Record<string, unknown>[],
	updates: [] as {
		resource: string;
		actor: unknown;
		id: number;
		values: Record<string, unknown>;
	}[],
	creates: [] as { resource: string; actor: unknown; values: Record<string, unknown> }[],
	visibility: [] as { resource: string; actor: unknown; id: number; visible: boolean }[],
	updateResult: { ok: true } as { ok: boolean; error?: string; reason?: string }
};

vi.mock('$lib/server/profile/write', async (importOriginal) => {
	// validatePatch is real — the point of the capability's validate() is that it
	// is the write layer's rule, not a second copy of it.
	const actual = await importOriginal<typeof import('$lib/server/profile/write')>();
	return {
		validatePatch: actual.validatePatch,
		readOwnedRow: () => Promise.resolve(state.row),
		readOwnedRows: () => Promise.resolve(state.rows),
		updateRow: (resource: string, actor: unknown, id: number, values: Record<string, unknown>) => {
			state.updates.push({ resource, actor, id, values });
			return Promise.resolve(state.updateResult);
		},
		createRow: (resource: string, actor: unknown, values: Record<string, unknown>) => {
			state.creates.push({ resource, actor, values });
			return Promise.resolve(state.updateResult.ok ? { ok: true, id: 99 } : state.updateResult);
		},
		setRowVisible: (resource: string, actor: unknown, id: number, visible: boolean) => {
			state.visibility.push({ resource, actor, id, visible });
			return Promise.resolve(state.updateResult);
		}
	};
});

const { PROFILE_CAPABILITIES, PROFILE_CAPABILITY_NAMES, resourceForCapability } =
	await import('../profile-capabilities');
const { PROFILE_RESOURCES } = await import('$lib/server/profile/resources');
type ProfileResourceName = keyof typeof PROFILE_RESOURCES;

const ACTOR = { profileId: 12, isStaff: false };
const TARGET = { id: 5, label: 'Engineer at Acme' };

const workExperience = PROFILE_CAPABILITIES.edit_work_experience;

beforeEach(() => {
	state.row = { id: 5, profile_id: 12, sort: null, status: 'published' };
	state.rows = [];
	state.updates = [];
	state.creates = [];
	state.visibility = [];
	state.updateResult = { ok: true };
});

describe('the generated set', () => {
	it('covers every declared section with every verb', () => {
		expect(PROFILE_CAPABILITY_NAMES).toHaveLength(Object.keys(PROFILE_RESOURCES).length * 3);
	});

	it.each(Object.keys(PROFILE_RESOURCES))('%s can be edited, added to and hidden', (resource) => {
		for (const verb of ['edit', 'add', 'hide']) {
			expect(PROFILE_CAPABILITIES[`${verb}_${resource}` as never]).toBeDefined();
		}
	});

	it.each(PROFILE_CAPABILITY_NAMES)('%s names its section back', (capability) => {
		expect(PROFILE_RESOURCES[resourceForCapability(capability)]).toBeDefined();
	});

	it.each(PROFILE_CAPABILITY_NAMES)('%s prefixes every field with its section', (capability) => {
		const resource = resourceForCapability(capability);
		for (const field of Object.keys(PROFILE_CAPABILITIES[capability].fields)) {
			expect(field.startsWith(`${resource}.`)).toBe(true);
		}
	});

	it('gives no two SECTIONS a field name in common', () => {
		// The proposal schema merges every live capability's field names into one
		// flat enum. Three sections carry `summary` and four carry `name`; the
		// prefix is what stops those being one name with four meanings.
		//
		// Verbs over the same section share names on purpose — `add_language` and
		// `edit_language` mean the same column by `language.name` — so the check
		// is per section, not per capability.
		const owner = new Map<string, ProfileResourceName>();
		for (const capability of PROFILE_CAPABILITY_NAMES) {
			const resource = resourceForCapability(capability);
			for (const field of Object.keys(PROFILE_CAPABILITIES[capability].fields)) {
				const seen = owner.get(field);
				expect(seen === undefined || seen === resource, `${field}: ${seen} vs ${resource}`).toBe(
					true
				);
				owner.set(field, resource);
			}
		}
	});

	it.each(PROFILE_CAPABILITY_NAMES)('%s tells the model about the prefix', (capability) => {
		// Except the fieldless verb, which has no names to explain. Hiding says
		// everything it has to say by naming a row.
		const def = PROFILE_CAPABILITIES[capability];
		if (Object.keys(def.fields).length === 0) return;
		expect(def.contract).toContain(`"${resourceForCapability(capability)}."`);
	});

	it.each(PROFILE_CAPABILITY_NAMES)('%s leaves no placeholder in its contract', (capability) => {
		expect(PROFILE_CAPABILITIES[capability].contract).not.toContain('${');
	});
});

describe('fields kept from the assistant', () => {
	it('omits them from the schema', () => {
		// tags are version slugs: a slug matching no version drops the item from
		// every document rather than erroring, so the applicant finds out from a
		// resume that is missing a job.
		expect(Object.keys(workExperience.fields)).not.toContain('work_experience.tags');
	});

	it('says so in the contract instead of staying silent', () => {
		expect(workExperience.contract).toContain('"tags"');
		expect(workExperience.contract).toContain('cannot change');
	});

	it('warns against routing round the exclusion', () => {
		expect(workExperience.contract).toContain('another field');
	});

	it('drops the value even when a model sends it anyway', async () => {
		await workExperience.apply(
			TARGET,
			{ 'work_experience.tags': ['senior-cv'], 'work_experience.summary': 'Rewritten' },
			{},
			ACTOR
		);
		expect(state.updates[0].values).toEqual({ summary: 'Rewritten' });
	});
});

describe('resolve', () => {
	it('resolves the row the page is about', async () => {
		state.row = { id: 5, profile_id: 12, position: 'Engineer', name: 'Acme' };

		const target = await workExperience.resolve(
			{ type: 'profile_section', resource: 'work_experience', id: 5 },
			ACTOR
		);

		expect(target).toEqual({ id: 5, label: 'Engineer at Acme' });
	});

	it('does not resolve on another section’s page', async () => {
		expect(
			await workExperience.resolve({ type: 'profile_section', resource: 'education', id: 5 }, ACTOR)
		).toBeNull();
	});

	it('does not resolve on a job or application page', async () => {
		expect(await workExperience.resolve({ type: 'job', id: 5 }, ACTOR)).toBeNull();
		expect(await workExperience.resolve({ type: 'application', id: 5 }, ACTOR)).toBeNull();
		expect(await workExperience.resolve(null, ACTOR)).toBeNull();
	});

	it('does not resolve a row that is gone or not theirs', async () => {
		state.row = null;
		expect(
			await workExperience.resolve(
				{ type: 'profile_section', resource: 'work_experience', id: 5 },
				ACTOR
			)
		).toBeNull();
	});
});

describe('authorize', () => {
	it('refuses once the row stops being readable', async () => {
		state.row = null;
		expect(await workExperience.authorize(TARGET, ACTOR)).toBe(false);
	});

	it('allows a row the actor still owns', async () => {
		expect(await workExperience.authorize(TARGET, ACTOR)).toBe(true);
	});
});

describe('current', () => {
	it('returns the row under namespaced keys', async () => {
		state.row = { id: 5, profile_id: 12, summary: 'Built things', position: 'Engineer' };

		const current = await workExperience.current(TARGET, ACTOR);

		expect(current['work_experience.summary']).toBe('Built things');
		expect(current['work_experience.position']).toBe('Engineer');
	});

	it('reads a missing row as every field unset rather than throwing', async () => {
		state.row = null;
		const current = await workExperience.current(TARGET, ACTOR);
		expect(current['work_experience.summary']).toBeNull();
	});

	it('offers no key for a field kept from the assistant', async () => {
		state.row = { id: 5, profile_id: 12, tags: ['senior-cv'] };
		expect(await workExperience.current(TARGET, ACTOR)).not.toHaveProperty('work_experience.tags');
	});
});

describe('renderState', () => {
	it('shows a long text as a length, not as itself', () => {
		// The texts already reach the model through the profile source; printing
		// them again spends the budget twice to say the same thing.
		const rendered = workExperience.renderState?.({
			'work_experience.summary': 'x'.repeat(500)
		});
		expect(rendered).toContain('500 characters');
		expect(rendered).not.toContain('x'.repeat(500));
	});

	it('shows a short value in full, so the model can diff it', () => {
		expect(workExperience.renderState?.({ 'work_experience.position': 'Engineer' })).toContain(
			'Engineer'
		);
	});

	it('says when a field is unset rather than showing an empty line', () => {
		expect(workExperience.renderState?.({ 'work_experience.position': null })).toContain(
			'(not set)'
		);
	});
});

describe('validate', () => {
	it('refuses to clear a field the section requires', async () => {
		expect(workExperience.validate({ 'work_experience.name': null }, {})).toMatchObject({
			ok: false
		});
	});

	it('accepts a patch that simply omits the required fields', () => {
		expect(workExperience.validate({ 'work_experience.summary': 'Rewritten' }, {})).toEqual({
			ok: true
		});
	});

	it('enforces a declared vocabulary', () => {
		const language = PROFILE_CAPABILITIES.edit_language;
		expect(language.validate({ 'language.proficiency': 'perfect' }, {})).toMatchObject({
			ok: false
		});
		expect(language.validate({ 'language.proficiency': 'fluent' }, {})).toEqual({ ok: true });
	});
});

describe('apply', () => {
	it('writes column names, not wire names', async () => {
		await workExperience.apply(TARGET, { 'work_experience.summary': 'Rewritten' }, {}, ACTOR);
		expect(state.updates[0]).toMatchObject({
			resource: 'work_experience',
			id: 5,
			values: { summary: 'Rewritten' }
		});
	});

	it('writes against the actor, so the write layer authorizes the same profile', async () => {
		await workExperience.apply(TARGET, { 'work_experience.summary': 'x' }, {}, ACTOR);
		expect(state.updates[0].actor).toEqual({ profileId: 12 });
	});

	it('ignores a field belonging to another section', async () => {
		await workExperience.apply(
			TARGET,
			{ 'education.summary': 'Wrong section', 'work_experience.summary': 'Right one' },
			{},
			ACTOR
		);
		expect(state.updates[0].values).toEqual({ summary: 'Right one' });
	});

	it('throws when the write refuses, because authorize and validate just passed', async () => {
		// A refusal here is a race — the row deleted, the profile switched —
		// not a bad proposal, and swallowing it would report success for a write
		// that never happened.
		state.updateResult = { ok: false, reason: 'not_found', error: 'Work experience not found' };

		await expect(
			workExperience.apply(TARGET, { 'work_experience.summary': 'x' }, {}, ACTOR)
		).rejects.toThrow(/refused at write time/);
	});
});

describe('resolveMany', () => {
	it('offers every row of the section, labelled', async () => {
		state.rows = [
			{ id: 1, profile_id: 12, name: 'Dutch' },
			{ id: 2, profile_id: 12, name: 'German' }
		];

		const targets = await PROFILE_CAPABILITIES.edit_language.resolveMany?.(null, ACTOR);

		expect(targets).toEqual([
			{ id: 1, label: 'Dutch' },
			{ id: 2, label: 'German' }
		]);
	});

	it('offers nothing when the section is empty', async () => {
		state.rows = [];
		expect(await PROFILE_CAPABILITIES.edit_language.resolveMany?.(null, ACTOR)).toEqual([]);
	});

	it.each(PROFILE_CAPABILITY_NAMES)('%s offers a list only if it acts on a row', (capability) => {
		// The row-acting verbs need it: without it they are only ever live where
		// the URL names a target, which would leave four sections unreachable for
		// good. `add` must NOT have it — it resolves the profile, and offering a
		// list of rows to pick from would be asking which existing entry to create.
		const offersList = typeof PROFILE_CAPABILITIES[capability].resolveMany === 'function';
		expect(offersList).toBe(!capability.startsWith('add_'));
	});
});

describe('adding an entry', () => {
	const add = PROFILE_CAPABILITIES.add_language;

	it('targets the profile, because there is no row yet', async () => {
		expect(await add.resolve(null, ACTOR)).toEqual({ id: 12, label: 'their languages' });
	});

	it('is live on the section’s own pages and nowhere else', async () => {
		// "Add another role" means the same thing from the list and from one entry,
		// so both resolve. Another section's page must not.
		expect(
			await add.resolve({ type: 'profile_section', resource: 'language', id: 5 }, ACTOR)
		).toMatchObject({ id: 12 });
		expect(
			await add.resolve({ type: 'profile_section', resource: 'education', id: 5 }, ACTOR)
		).toBeNull();
	});

	it('authorizes only the actor’s own profile', async () => {
		expect(await add.authorize({ id: 12, label: 'x' }, ACTOR)).toBe(true);
		expect(await add.authorize({ id: 99, label: 'x' }, ACTOR)).toBe(false);
	});

	it('shows what is already there, so it does not propose a duplicate', async () => {
		state.rows = [
			{ id: 1, profile_id: 12, name: 'Dutch' },
			{ id: 2, profile_id: 12, name: 'German' }
		];

		const current = await add.current({ id: 12, label: 'x' }, ACTOR);
		const rendered = add.renderState?.(current);

		expect(rendered).toContain('Dutch');
		expect(rendered).toContain('German');
		expect(rendered).toContain('do not propose a duplicate');
	});

	it('says so plainly when the section is empty', async () => {
		state.rows = [];
		const current = await add.current({ id: 12, label: 'x' }, ACTOR);
		expect(add.renderState?.(current)).toContain('no languages yet');
	});

	it('refuses a create missing a required field', () => {
		// Unlike an edit, where an omitted required field just means "not
		// mentioned", a create with no name has nothing to show in the list.
		expect(add.validate({ 'language.proficiency': 'fluent' }, {})).toMatchObject({ ok: false });
	});

	it('accepts a create that has them', () => {
		expect(add.validate({ 'language.name': 'Spanish' }, {})).toEqual({ ok: true });
	});

	it('writes column names against the actor', async () => {
		await add.apply(
			{ id: 12, label: 'x' },
			{ 'language.name': 'Spanish', 'language.proficiency': 'basic' },
			{},
			ACTOR
		);

		expect(state.creates[0]).toMatchObject({
			resource: 'language',
			actor: { profileId: 12 },
			values: { name: 'Spanish', proficiency: 'basic' }
		});
	});
});

describe('hiding an entry', () => {
	const hide = PROFILE_CAPABILITIES.hide_language;

	it('carries no fields — naming the row is the whole proposal', () => {
		expect(Object.keys(hide.fields)).toEqual([]);
	});

	it('targets rows the same way editing does', async () => {
		state.row = { id: 5, profile_id: 12, name: 'Dutch' };
		expect(
			await hide.resolve({ type: 'profile_section', resource: 'language', id: 5 }, ACTOR)
		).toEqual({ id: 5, label: 'Dutch' });

		state.rows = [{ id: 1, profile_id: 12, name: 'Dutch' }];
		expect(await hide.resolveMany?.(null, ACTOR)).toEqual([{ id: 1, label: 'Dutch' }]);
	});

	it('shows the person what hiding it would take off', async () => {
		// A card saying only "Spanish" asks someone to accept the removal of
		// something they cannot see.
		state.row = { id: 5, profile_id: 12, name: 'Spanish', proficiency: 'basic' };

		const rendered = hide.renderState?.(await hide.current({ id: 5, label: 'Spanish' }, ACTOR));

		expect(rendered).toContain('Spanish');
		expect(rendered).toContain('basic');
	});

	it('says it is reversible and where to reverse it', () => {
		expect(hide.contract).toContain('NOT deleted');
		expect(hide.contract).toContain('Languages page');
	});

	it('says not to propose it unasked', () => {
		expect(hide.contract).toContain('asked for it');
	});

	it('hides rather than deletes', async () => {
		await hide.apply({ id: 5, label: 'Spanish' }, {}, {}, ACTOR);

		expect(state.visibility[0]).toMatchObject({
			resource: 'language',
			actor: { profileId: 12 },
			id: 5,
			visible: false
		});
		// Nothing destroyed: the row is still there, off the documents.
		expect(state.updates).toHaveLength(0);
	});

	it('throws when the write refuses, like the other verbs', async () => {
		state.updateResult = { ok: false, reason: 'not_found', error: 'Language not found' };
		await expect(hide.apply({ id: 5, label: 'x' }, {}, {}, ACTOR)).rejects.toThrow(
			/refused at write time/
		);
	});
});
