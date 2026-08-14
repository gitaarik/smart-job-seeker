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
	updates: [] as {
		resource: string;
		actor: unknown;
		id: number;
		values: Record<string, unknown>;
	}[],
	updateResult: { ok: true } as { ok: boolean; error?: string; reason?: string }
};

vi.mock('$lib/server/profile/write', async (importOriginal) => {
	// validatePatch is real — the point of the capability's validate() is that it
	// is the write layer's rule, not a second copy of it.
	const actual = await importOriginal<typeof import('$lib/server/profile/write')>();
	return {
		validatePatch: actual.validatePatch,
		readOwnedRow: () => Promise.resolve(state.row),
		updateRow: (resource: string, actor: unknown, id: number, values: Record<string, unknown>) => {
			state.updates.push({ resource, actor, id, values });
			return Promise.resolve(state.updateResult);
		}
	};
});

const { PROFILE_CAPABILITIES, PROFILE_CAPABILITY_NAMES, resourceForCapability } =
	await import('../profile-capabilities');
const { PROFILE_RESOURCES } = await import('$lib/server/profile/resources');

const ACTOR = { profileId: 12, isStaff: false };
const TARGET = { id: 5, label: 'Engineer at Acme' };

const workExperience = PROFILE_CAPABILITIES.edit_work_experience;

beforeEach(() => {
	state.row = { id: 5, profile_id: 12, sort: null, status: 'published' };
	state.updates = [];
	state.updateResult = { ok: true };
});

describe('the generated set', () => {
	it('covers every declared section', () => {
		expect(PROFILE_CAPABILITY_NAMES).toHaveLength(Object.keys(PROFILE_RESOURCES).length);
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

	it('gives no two capabilities a field name in common', () => {
		// The proposal schema merges every live capability's field names into one
		// flat enum. Three sections carry `summary` and four carry `name`; the
		// prefix is what stops those being one name with four meanings.
		const seen = new Set<string>();
		for (const capability of PROFILE_CAPABILITY_NAMES) {
			for (const field of Object.keys(PROFILE_CAPABILITIES[capability].fields)) {
				expect(seen.has(field), field).toBe(false);
				seen.add(field);
			}
		}
	});

	it.each(PROFILE_CAPABILITY_NAMES)('%s tells the model about the prefix', (capability) => {
		const resource = resourceForCapability(capability);
		expect(PROFILE_CAPABILITIES[capability].contract).toContain(`"${resource}."`);
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
