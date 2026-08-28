/**
 * Per-template field overrides: the resolver's precedence and the tree walk.
 *
 * Two things are pinned here that nothing else would catch. The walk is driven
 * by OVERRIDABLE_FIELDS, so a field registered there but not reachable by the
 * walk is a control the editor happily shows and the document silently ignores.
 * And the composition with translations is a rule, not an accident: an override
 * is a force, so it has to survive being applied to an already-translated tree
 * — the one ordering that keeps a forced title from reverting to a translation
 * of the value it replaced.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isOverridable, OVERRIDABLE_FIELDS } from '$lib/template-overrides';

const state = vi.hoisted(() => ({ rows: [] as Record<string, unknown>[] }));

// Both modules import the db; only loadTemplateOverrides queries it.
vi.mock('$lib/server/db', () => ({
	db: {},
	dbDirect: {
		select: () => ({ from: () => ({ where: () => Promise.resolve(state.rows) }) })
	}
}));

const { applyTemplateOverrides, loadTemplateOverrides, NO_TEMPLATE_OVERRIDES } =
	await import('../template-overrides');
const { applyTranslations } = await import('../translations');

/** A resolver over a literal map, keyed the way profile_template_overrides is. */
function resolver(values: Record<string, string>) {
	return {
		templateId: 7,
		isEmpty: false,
		value: (entity: string, id: number | string, field: string, base: string | null) =>
			values[`${entity}:${id}:${field}`] ?? base
	};
}

function profileWithRoles() {
	return {
		id: 1,
		summary: 'Engineer of long standing.',
		work_experiences: [
			{ id: 9, name: 'Citrus', position: 'Lead Engineer', headline: 'Consulting' },
			{ id: 10, name: 'Acme', position: 'Staff Engineer', headline: 'Product' }
		]
	};
}

describe('the overridable-field vocabulary', () => {
	it('knows a role position is overridable', () => {
		expect(isOverridable('work_experience', 'position')).toBe(true);
	});

	it('refuses a field nobody registered', () => {
		expect(isOverridable('work_experience', 'summary')).toBe(false);
		expect(isOverridable('side_project', 'name')).toBe(false);
	});

	it('registers no field the tree walk cannot reach', () => {
		// The walk handles these entities; a new one needs code in the applier,
		// which is exactly what this catches.
		const walked = new Set(['profile', 'work_experience']);
		expect(OVERRIDABLE_FIELDS.filter((f) => !walked.has(f.entity))).toEqual([]);
	});
});

describe("applying a template's overrides", () => {
	it('replaces the position of the role it names', () => {
		const profile = profileWithRoles();
		applyTemplateOverrides(profile, resolver({ 'work_experience:9:position': 'Senior Engineer' }));

		expect(profile.work_experiences[0].position).toBe('Senior Engineer');
	});

	it('leaves every other role alone', () => {
		const profile = profileWithRoles();
		applyTemplateOverrides(profile, resolver({ 'work_experience:9:position': 'Senior Engineer' }));

		expect(profile.work_experiences[1].position).toBe('Staff Engineer');
		expect(profile.work_experiences[1].name).toBe('Acme');
	});

	it('leaves fields outside the vocabulary alone, override row or not', () => {
		const profile = profileWithRoles();
		applyTemplateOverrides(
			profile,
			resolver({
				'work_experience:9:headline': 'Something else',
				'profile:1:summary': 'Something else'
			})
		);

		expect(profile.work_experiences[0].headline).toBe('Consulting');
		expect(profile.summary).toBe('Engineer of long standing.');
	});

	it('does nothing at all when there is no template', () => {
		const profile = profileWithRoles();
		applyTemplateOverrides(profile, NO_TEMPLATE_OVERRIDES);

		expect(profile.work_experiences[0].position).toBe('Lead Engineer');
	});

	it('survives a profile with no roles', () => {
		const profile = { id: 1 };
		expect(() =>
			applyTemplateOverrides(profile, resolver({ 'work_experience:9:position': 'x' }))
		).not.toThrow();
	});
});

describe('an override against a translated document', () => {
	it('wins over the translation of the value it replaces', () => {
		const profile = profileWithRoles();
		// The order the render routes use: language first, then the template.
		applyTranslations(profile, {
			locale: 'nl',
			isBase: false,
			t: (entity: string, id: number | string, field: string, base: string | null) =>
				`${entity}:${id}:${field}` === 'work_experience:9:position' ? 'Hoofdingenieur' : base
		});
		applyTemplateOverrides(profile, resolver({ 'work_experience:9:position': 'Senior Engineer' }));

		expect(profile.work_experiences[0].position).toBe('Senior Engineer');
	});
});

describe("resolving a template's overrides for a language", () => {
	beforeEach(() => {
		state.rows = [];
	});

	it('is the identity resolver when no template is being rendered', async () => {
		const ov = await loadTemplateOverrides(null, 'nl');
		expect(ov.isEmpty).toBe(true);
		expect(ov.value('work_experience', 9, 'position', 'Lead Engineer')).toBe('Lead Engineer');
	});

	it('is the identity resolver when the template overrides nothing', async () => {
		const ov = await loadTemplateOverrides(7, 'nl');
		expect(ov.isEmpty).toBe(true);
	});

	it('falls back to the base language when that language has no row', async () => {
		state.rows = [
			{
				entity_type: 'work_experience',
				entity_id: 9,
				field: 'position',
				locale: 'en',
				value: 'Senior Engineer'
			}
		];
		const ov = await loadTemplateOverrides(7, 'nl');

		expect(ov.value('work_experience', 9, 'position', 'Lead Engineer')).toBe('Senior Engineer');
	});

	it("prefers the row written in the document's language", async () => {
		state.rows = [
			{
				entity_type: 'work_experience',
				entity_id: 9,
				field: 'position',
				locale: 'en',
				value: 'Senior Engineer'
			},
			{
				entity_type: 'work_experience',
				entity_id: 9,
				field: 'position',
				locale: 'nl',
				value: 'Senior Ingenieur'
			}
		];
		const ov = await loadTemplateOverrides(7, 'nl');

		expect(ov.value('work_experience', 9, 'position', 'Lead Engineer')).toBe('Senior Ingenieur');
	});

	it('answers with the base value for a field it holds nothing for', async () => {
		state.rows = [
			{
				entity_type: 'work_experience',
				entity_id: 9,
				field: 'position',
				locale: 'en',
				value: 'Senior Engineer'
			}
		];
		const ov = await loadTemplateOverrides(7, null);

		expect(ov.value('work_experience', 10, 'position', 'Staff Engineer')).toBe('Staff Engineer');
	});
});
