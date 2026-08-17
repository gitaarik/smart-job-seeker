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
	/**
	 * Rows for a named section, for the capabilities that read two of them. A
	 * parent-owned section reads its own rows and its parent's, and one `rows`
	 * for both would answer "which groups exist" with the list of skills.
	 */
	rowsByResource: {} as Record<string, Record<string, unknown>[]>,
	updates: [] as {
		resource: string;
		actor: unknown;
		id: number;
		values: Record<string, unknown>;
	}[],
	creates: [] as { resource: string; actor: unknown; values: Record<string, unknown> }[],
	visibility: [] as { resource: string; actor: unknown; id: number; visible: boolean }[],
	tagWrites: [] as { resource: string; actor: unknown; id: number; tags: string[] | null }[],
	updateResult: { ok: true } as { ok: boolean; error?: string; reason?: string }
};

vi.mock('$lib/server/profile/write', async (importOriginal) => {
	// validatePatch is real — the point of the capability's validate() is that it
	// is the write layer's rule, not a second copy of it.
	const actual = await importOriginal<typeof import('$lib/server/profile/write')>();
	return {
		validatePatch: actual.validatePatch,
		readOwnedRow: () => Promise.resolve(state.row),
		readOwnedRows: (resource: string) =>
			Promise.resolve(state.rowsByResource[resource] ?? state.rows),
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
		},
		setRowTags: (resource: string, actor: unknown, id: number, tags: string[] | null) => {
			state.tagWrites.push({ resource, actor, id, tags });
			return Promise.resolve(state.updateResult);
		}
	};
});

const { PROFILE_CAPABILITIES, PROFILE_CAPABILITY_NAMES, resourceForCapability } =
	await import('../profile-capabilities');
const { HIDEABLE_RESOURCES, PROFILE_RESOURCES } = await import('$lib/server/profile/resources');
type ProfileResourceName = keyof typeof PROFILE_RESOURCES;

const ACTOR = { profileId: 12, isStaff: false };
const TARGET = { id: 5, label: 'Engineer at Acme' };

const workExperience = PROFILE_CAPABILITIES.edit_work_experience;

beforeEach(() => {
	state.row = { id: 5, profile_id: 12, sort: null, status: 'published' };
	state.rows = [];
	state.rowsByResource = {};
	state.updates = [];
	state.creates = [];
	state.visibility = [];
	state.tagWrites = [];
	state.updateResult = { ok: true };
});

describe('the generated set', () => {
	it('covers every declared section, with the verbs that section has', () => {
		// Not sections x 3. `hide` is not universal — see HIDEABLE_RESOURCES:
		// languages, references, certificates and highlights are rendered on a
		// document with no filter between them and the page, so there is nothing
		// to write that would take one off. Asserting the product was what let the
		// first version ship a hide that changed nothing.
		expect(PROFILE_CAPABILITY_NAMES).toHaveLength(
			Object.keys(PROFILE_RESOURCES).length * 2 + HIDEABLE_RESOURCES.length
		);
	});

	it.each(Object.keys(PROFILE_RESOURCES))('%s can be edited and added to', (resource) => {
		for (const verb of ['edit', 'add']) {
			expect(PROFILE_CAPABILITIES[`${verb}_${resource}` as never]).toBeDefined();
		}
	});

	it.each(Object.keys(PROFILE_RESOURCES))('%s can be hidden only if it can be', (resource) => {
		const hideable = (HIDEABLE_RESOURCES as readonly string[]).includes(resource);
		expect(PROFILE_CAPABILITIES[`hide_${resource}` as never] !== undefined).toBe(hideable);
	});

	it('offers hide only where the row carries the tags that hiding writes', () => {
		// The other half of the declaration. HIDEABLE_RESOURCES is declared rather
		// than derived, because a `tags` column is necessary and not sufficient —
		// the renderers have to consult it too, and for highlights they don't. But
		// a name here WITHOUT the column would be a capability writing to nothing,
		// which is the failure being fixed, so that half is checked.
		for (const name of HIDEABLE_RESOURCES) {
			expect(PROFILE_RESOURCES[name].fields.tags, name).toBeDefined();
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
	// Work experience rather than a language, because a language cannot be
	// hidden: nothing filters it on a document. See HIDEABLE_RESOURCES.
	const hide = PROFILE_CAPABILITIES.hide_work_experience;

	it('carries no fields — naming the row is the whole proposal', () => {
		expect(Object.keys(hide.fields)).toEqual([]);
	});

	it('targets rows the same way editing does', async () => {
		state.row = { id: 5, profile_id: 12, position: 'Engineer', name: 'Acme' };
		expect(
			await hide.resolve({ type: 'profile_section', resource: 'work_experience', id: 5 }, ACTOR)
		).toEqual({ id: 5, label: 'Engineer at Acme' });

		state.rows = [{ id: 1, profile_id: 12, position: 'Engineer', name: 'Acme' }];
		expect(await hide.resolveMany?.(null, ACTOR)).toEqual([{ id: 1, label: 'Engineer at Acme' }]);
	});

	it('shows the person what hiding it would take off', async () => {
		// A card saying only the row's name asks someone to accept the removal of
		// something they cannot see.
		state.row = { id: 5, profile_id: 12, position: 'Engineer', name: 'Acme', location: 'Berlin' };

		const rendered = hide.renderState?.(await hide.current({ id: 5, label: 'Acme' }, ACTOR));

		expect(rendered).toContain('Acme');
		expect(rendered).toContain('Berlin');
	});

	it('says it is reversible and where to reverse it', () => {
		expect(hide.contract).toContain('NOT deleted');
		expect(hide.contract).toContain('Work experience page');
	});

	it('says not to propose it unasked', () => {
		expect(hide.contract).toContain('asked for it');
	});

	it('hides rather than deletes', async () => {
		await hide.apply({ id: 5, label: 'Acme' }, {}, {}, ACTOR);

		expect(state.visibility[0]).toMatchObject({
			resource: 'work_experience',
			actor: { profileId: 12 },
			id: 5,
			visible: false
		});
		// Nothing destroyed: the row is still there, off the documents.
		expect(state.updates).toHaveLength(0);
	});

	it('throws when the write refuses, like the other verbs', async () => {
		state.updateResult = { ok: false, reason: 'not_found', error: 'Role not found' };
		await expect(hide.apply({ id: 5, label: 'x' }, {}, {}, ACTOR)).rejects.toThrow(
			/refused at write time/
		);
	});

	it('records the tags it is about to overwrite, not the empty field set', async () => {
		// The default before-image is "the old values of the fields being
		// written", and this capability writes none — so without its own
		// beforeImage the log records {} and there is nothing for an undo to put
		// back.
		state.row = { id: 5, profile_id: 12, position: 'Engineer', name: 'Acme', tags: ['senior'] };

		expect(await hide.beforeImage?.({ id: 5, label: 'Acme' }, {}, ACTOR)).toEqual({
			tags: ['senior']
		});
	});

	it('undoes by restoring the exact tag array', async () => {
		// Exact, not "un-hide": setProfileOnly lifts BOTH base exclusions, so a
		// derived restore would also drop a `!resume` the applicant set by hand.
		await hide.revert?.({ id: 5, label: 'Acme' }, { tags: ['senior'] }, ACTOR);

		expect(state.tagWrites[0]).toMatchObject({
			resource: 'work_experience',
			id: 5,
			tags: ['senior']
		});
	});
});

/**
 * Skills, the one section whose rows hang off another row.
 *
 * The generator gives them one extra field — the group, by name — and one extra
 * rule: the name has to be one of the groups the applicant actually has. Both
 * halves matter. Without the field the model cannot say where a new skill goes;
 * without the rule it can say anything, and the refusal lands at apply time,
 * after the user has clicked Apply on a card that looked fine.
 */
describe('a section owned through its parent', () => {
	const add = PROFILE_CAPABILITIES.add_skill;
	const edit = PROFILE_CAPABILITIES.edit_skill;

	const GROUPS = [
		{ id: 1, name: 'Backend' },
		{ id: 2, name: 'Frontend' }
	];

	beforeEach(() => {
		state.rowsByResource = {
			skill_category: GROUPS,
			skill: [
				{ id: 5, name: 'PostgreSQL', category: 'Backend' },
				{ id: 6, name: 'Svelte', category: 'Frontend' }
			]
		};
	});

	it('offers the group as a field, namespaced like every other', () => {
		expect(Object.keys(add.fields)).toContain('skill.category');
		expect(Object.keys(edit.fields)).toContain('skill.category');
	});

	it('lists the groups and what is already in each', async () => {
		const current = await add.current({ id: 12, label: 'their skills' }, ACTOR);
		const state_ = add.renderState?.(current) ?? '';

		expect(state_).toContain('Backend: PostgreSQL');
		expect(state_).toContain('Frontend: Svelte');
	});

	it('says a group is empty rather than leaving it out', async () => {
		// A group missing from the list reads as a group that does not exist, and
		// the model then proposes creating one that is sitting there empty.
		state.rowsByResource.skill = [{ id: 5, name: 'PostgreSQL', category: 'Backend' }];

		const current = await add.current({ id: 12, label: 'their skills' }, ACTOR);

		expect(add.renderState?.(current)).toContain('Frontend: (empty)');
	});

	it('refuses a group they do not have, and names the ones they do', async () => {
		const current = await add.current({ id: 12, label: 'their skills' }, ACTOR);
		const result = add.validate({ 'skill.name': 'Redis', 'skill.category': 'Databases' }, current);

		expect(result.ok).toBe(false);
		expect((result as { error: string }).error).toContain('Backend');
	});

	it('accepts a group named in the wrong case', async () => {
		// People do not capitalise their own headings consistently, and a refusal
		// over it would be about nothing.
		const current = await add.current({ id: 12, label: 'their skills' }, ACTOR);

		expect(add.validate({ 'skill.name': 'Redis', 'skill.category': 'backend' }, current)).toEqual({
			ok: true
		});
	});

	it('refuses an add with no group at all', async () => {
		const current = await add.current({ id: 12, label: 'their skills' }, ACTOR);

		expect(add.validate({ 'skill.name': 'Redis' }, current).ok).toBe(false);
	});

	it('passes the group to the write layer as a field, not as an id', async () => {
		// The name is what the model can produce; resolving it against the
		// applicant's own groups is the write layer's job, and is where the
		// ownership check on the parent lives.
		await add.apply(
			{ id: 12, label: 'their skills' },
			{ 'skill.name': 'Redis', 'skill.category': 'Backend' },
			{},
			ACTOR
		);

		expect(state.creates[0]).toMatchObject({
			resource: 'skill',
			values: { name: 'Redis', category: 'Backend' }
		});
	});

	it('shows the group a skill is in, and the ones it could move to', async () => {
		state.row = { id: 5, name: 'PostgreSQL', category: 'Backend' };

		const current = await edit.current({ id: 5, label: 'PostgreSQL — Backend' }, ACTOR);

		expect(current['skill.category']).toBe('Backend');
		expect(current.parents).toEqual(['Backend', 'Frontend']);
	});

	it('does not count the groups among what hiding takes off', async () => {
		// `parents` rides along in `current` for validate's sake, and hide renders
		// `current` as "what hiding this would take off" — so without excluding it
		// the card offered to remove the list of the applicant's own headings.
		state.row = { id: 5, name: 'PostgreSQL', category: 'Backend' };
		const hide = PROFILE_CAPABILITIES.hide_skill;
		const current = await hide.current({ id: 5, label: 'PostgreSQL — Backend' }, ACTOR);

		expect(hide.renderState?.(current)).not.toContain('parents');
	});

	it('does not offer the groups as something to edit', async () => {
		// `parents` rides along in `current` so validate can check a name without
		// a database. Rendered as a value it would read as a field holding a list.
		state.row = { id: 5, name: 'PostgreSQL', category: 'Backend' };
		const current = await edit.current({ id: 5, label: 'PostgreSQL — Backend' }, ACTOR);

		const rendered = edit.renderState?.(current) ?? '';
		expect(rendered).not.toContain('- parents:');
		// Named without a noun: `label` is singular, and six sections have a parent
		// now, so "one of these groups" was both wrong for five of them and the
		// source of "skill categorys" when it was made plural.
		expect(rendered).toContain('What it can be filed under');
		expect(rendered).toContain('- Backend');
	});
});

/**
 * A child collection on the page of the row it hangs off.
 *
 * The behaviour this pins is the one that makes those sections usable at all:
 * /profile/work-experience/8 is not a page about projects, so a project
 * capability resolves no single row from it — and if the fallback were "every
 * project on the profile" the model would be choosing between twelve roles'
 * worth of them while looking at one job. Narrowing is what makes the offer the
 * page's own.
 */
describe('a child collection reached from its parent’s page', () => {
	const ROLE = { type: 'profile_section' as const, resource: 'work_experience' as const, id: 8 };

	beforeEach(() => {
		state.rowsByResource = {
			work_experience: [
				{ id: 8, position: 'Senior Engineer', name: 'Chipta' },
				{ id: 9, position: 'Engineer', name: 'Tender-it' }
			],
			work_experience_project: [
				{
					id: 1,
					work_experience_id: 8,
					name: 'The migration',
					work_experience: 'Senior Engineer at Chipta'
				},
				{
					id: 2,
					work_experience_id: 9,
					name: 'Other thing',
					work_experience: 'Engineer at Tender-it'
				}
			],
			work_experience_project_technology: [
				{ id: 5, work_experience_project_id: 1, name: 'Django' },
				{ id: 6, work_experience_project_id: 2, name: 'Rails' }
			]
		};
	});

	it('offers only the projects of the role the page is about', async () => {
		const targets = await PROFILE_CAPABILITIES.edit_work_experience_project.resolveMany?.(
			ROLE,
			ACTOR
		);

		expect(targets).toEqual([
			{ id: 1, label: 'The migration — Senior Engineer at Chipta', match: 'The migration' }
		]);
	});

	it('narrows a grandchild through the level in between', async () => {
		// The page names a role; the technology hangs off a project. Neither of
		// those is the other, and the only thing connecting them is the project's
		// own parent — so this walks down rather than filtering on a column the
		// row does not have.
		const targets =
			await PROFILE_CAPABILITIES.edit_work_experience_project_technology.resolveMany?.(ROLE, ACTOR);

		expect(targets?.map((t) => t.id)).toEqual([5]);
	});

	it('offers every row when the page is about nothing in particular', async () => {
		const targets = await PROFILE_CAPABILITIES.edit_work_experience_project.resolveMany?.(
			null,
			ACTOR
		);

		expect(targets?.map((t) => t.id)).toEqual([1, 2]);
	});

	it('offers every row when the page is about an unrelated section', async () => {
		const targets = await PROFILE_CAPABILITIES.edit_work_experience_project.resolveMany?.(
			{ type: 'profile_section', resource: 'education', id: 4 },
			ACTOR
		);

		expect(targets?.map((t) => t.id)).toEqual([1, 2]);
	});

	it('keeps the add verb live on the parent’s page', async () => {
		// "Add a project to this role" is the request the page exists for. The
		// guard that drops a capability whose section the page is not about would
		// otherwise take it out, since the page is about the ROLE.
		const target = await PROFILE_CAPABILITIES.add_work_experience_project.resolve(ROLE, ACTOR);

		expect(target).toEqual({ id: 12, label: 'their role projects' });
	});

	it('offers only the page’s row as somewhere to file a new one', async () => {
		// Both the correctness and the cost. A page about one role listing all
		// eight as places to put a new project invites the wrong one, and the
		// inventory it prints under them was the single most expensive block on
		// that page — every role's projects, to answer a question about this role.
		const current = await PROFILE_CAPABILITIES.add_work_experience_project.current(
			{ id: 12, label: 'their role projects' },
			ACTOR,
			ROLE
		);

		expect(current.parents).toEqual(['Senior Engineer at Chipta']);
		expect(current.existingByGroup).toEqual({
			'Senior Engineer at Chipta': ['The migration']
		});
	});

	it('offers every parent when nothing says which page', async () => {
		// The apply paths pass no entity on purpose: a proposal is applied from a
		// card, long after any page, and narrowing there would refuse a parent the
		// proposal was validly filed under.
		const current = await PROFILE_CAPABILITIES.add_work_experience_project.current(
			{ id: 12, label: 'their role projects' },
			ACTOR
		);

		expect(current.parents).toEqual(['Senior Engineer at Chipta', 'Engineer at Tender-it']);
	});

	it('still drops the add verb on a page about something else', async () => {
		expect(
			await PROFILE_CAPABILITIES.add_work_experience_project.resolve(
				{ type: 'profile_section', resource: 'education', id: 4 },
				ACTOR
			)
		).toBeNull();
	});
});

/**
 * Undoing a change recorded by either writer.
 *
 * Two things write history under the same action name. A capability records
 * what the model proposed, so its keys are namespaced (`language.name`);
 * `write.ts` records the columns it wrote (`name`). Both are the same change and
 * both come back through here, and the strict wire-name mapping applied to the
 * second resolved every key to null — leaving an empty patch, which `updateRow`
 * wrote successfully and the history then marked as undone.
 */
describe('reverting from the change history', () => {
	const edit = PROFILE_CAPABILITIES.edit_language;
	const TARGET = { id: 5, label: 'Dutch' };

	beforeEach(() => {
		state.updates = [];
		state.updateResult = { ok: true };
	});

	it('puts back a before-image a capability recorded', async () => {
		await edit.revert?.(TARGET, { 'language.proficiency': 'basic' }, ACTOR);

		expect(state.updates).toEqual([
			expect.objectContaining({ resource: 'language', id: 5, values: { proficiency: 'basic' } })
		]);
	});

	it('puts back a before-image the write layer recorded', async () => {
		await edit.revert?.(TARGET, { proficiency: 'basic' }, ACTOR);

		expect(state.updates).toEqual([
			expect.objectContaining({ resource: 'language', id: 5, values: { proficiency: 'basic' } })
		]);
	});

	it('still refuses a field belonging to another section', async () => {
		// The leniency is for a stored before-image, not for a name that says it
		// means something else. This one does, and it is dropped — leaving nothing
		// to write, which is refused rather than reported as undone.
		await expect(
			edit.revert?.(TARGET, { 'work_experience.summary': 'nope' }, ACTOR)
		).rejects.toThrow(/recorded no fields/);
		expect(state.updates).toHaveLength(0);
	});

	it('refuses an empty before-image instead of writing nothing successfully', async () => {
		await expect(edit.revert?.(TARGET, {}, ACTOR)).rejects.toThrow(/recorded no fields/);
		expect(state.updates).toHaveLength(0);
	});
});
