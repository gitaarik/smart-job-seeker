/**
 * A role's projects, in the translation layer.
 *
 * Registering the fields in resume-translations.ts is the smallest part of
 * making them translatable: the resolver walks the tree by hand, entity by
 * entity, and `collectTranslatable` builds the row list the auto-translate
 * endpoint answers from — a field missing there is a 404 behind a ✨ button the
 * UI is happily showing. Both are per-entity code, so both are pinned here.
 */

import { describe, expect, it, vi } from 'vitest';
import { isTranslatable } from '$lib/resume-translations';

// The module imports the db for its ownership queries; none of the tree walking
// below touches it.
vi.mock('$lib/server/db', () => ({ db: {}, dbDirect: {} }));

const { applyTranslations, collectTranslatable } = await import('../translations');

/** A resolver over a literal map, keyed the way profile_translations is. */
function translator(overlays: Record<string, string>) {
	return {
		locale: 'nl',
		isBase: false,
		t: (entity: string, id: number | string, field: string, base: string | null) =>
			overlays[`${entity}:${id}:${field}`] ?? base
	};
}

function profileWithProject(project: Record<string, unknown>) {
	return {
		id: 1,
		work_experiences: [
			{
				id: 9,
				name: 'Acme',
				position: 'Engineer',
				work_experience_achievements: [],
				work_experience_projects: [project]
			}
		]
	};
}

const project = {
	id: 4,
	name: 'Payments rewrite',
	url: 'https://acme.example/payments',
	start_date: '2024-01-01',
	description: 'Replaced the payment provider.',
	outcome: 'Checkout got a second faster.'
};

describe('applyTranslations — work experience projects', () => {
	it('overlays name, description and outcome', () => {
		const profile = profileWithProject({ ...project });
		applyTranslations(
			profile,
			translator({
				'work_experience_project:4:name': 'Herbouw betalingen',
				'work_experience_project:4:description': 'De betaalprovider vervangen.',
				'work_experience_project:4:outcome': 'Afrekenen werd een seconde sneller.'
			})
		);

		const p = profile.work_experiences[0].work_experience_projects[0];
		expect(p.name).toBe('Herbouw betalingen');
		expect(p.description).toBe('De betaalprovider vervangen.');
		expect(p.outcome).toBe('Afrekenen werd een seconde sneller.');
	});

	it('leaves the URL and the dates alone, and falls back per field', () => {
		const profile = profileWithProject({ ...project });
		applyTranslations(
			profile,
			translator({ 'work_experience_project:4:name': 'Herbouw betalingen' })
		);

		const p = profile.work_experiences[0].work_experience_projects[0];
		expect(p.url).toBe('https://acme.example/payments');
		expect(p.start_date).toBe('2024-01-01');
		// Untranslated: the English base survives rather than emptying out.
		expect(p.description).toBe('Replaced the payment provider.');
	});

	it('keeps a URL out of the translatable vocabulary', () => {
		expect(isTranslatable('work_experience_project', 'name')).toBe(true);
		expect(isTranslatable('work_experience_project', 'url')).toBe(false);
		expect(isTranslatable('work_experience_project', 'start_date')).toBe(false);
	});
});

describe('collectTranslatable — work experience projects', () => {
	it('lists the project fields in the role group, labelled by project', () => {
		const groups = collectTranslatable(profileWithProject({ ...project }));
		const rows = groups.find((g) => g.key === 'we-9')?.rows ?? [];
		const projectRows = rows.filter((r) => r.entity === 'work_experience_project');

		expect(projectRows.map((r) => [r.field, r.label, r.multiline])).toEqual([
			['name', 'Payments rewrite — Project name', false],
			['description', 'Payments rewrite — Description', true],
			['outcome', 'Payments rewrite — Outcome', true]
		]);
		expect(projectRows.every((r) => r.id === 4)).toBe(true);
	});

	it('skips empty fields and falls back to a positional label', () => {
		const groups = collectTranslatable(
			profileWithProject({ id: 4, name: '', description: 'Something', outcome: '' })
		);
		const projectRows = (groups.find((g) => g.key === 'we-9')?.rows ?? []).filter(
			(r) => r.entity === 'work_experience_project'
		);

		expect(projectRows.map((r) => [r.field, r.label])).toEqual([
			['description', 'Project 1 — Description']
		]);
	});
});

describe('applyTranslations — languages and location', () => {
	function profileWith(...languages: Record<string, unknown>[]) {
		return { id: 1, location: 'Haarlem, The Netherlands', languages };
	}

	it('localizes a language name from its ISO code without an overlay row', () => {
		const p = profileWith(
			{ id: 112, name: 'English', language_code: 'en' },
			{ id: 111, name: 'Dutch', language_code: 'nl' }
		);
		applyTranslations(p, translator({}));
		expect(p.languages.map((l) => l.name)).toEqual(['Engels', 'Nederlands']);
	});

	it('matches the English name when the row has no code, and leaves the unknown as typed', () => {
		const p = profileWith(
			{ id: 1, name: 'German', language_code: null },
			{ id: 2, name: 'Klingon', language_code: null }
		);
		applyTranslations(p, translator({}));
		expect(p.languages.map((l) => l.name)).toEqual(['Duits', 'Klingon']);
	});

	it('lets an overlay row win over ICU', () => {
		const p = profileWith({ id: 5, name: 'Chinese', language_code: 'zh' });
		applyTranslations(p, translator({ 'language:5:name': 'Mandarijn' }));
		expect(p.languages[0].name).toBe('Mandarijn');
	});

	it('overlays the profile location', () => {
		const p = profileWith();
		applyTranslations(p, translator({ 'profile:1:location': 'Haarlem, Nederland' }));
		expect(p.location).toBe('Haarlem, Nederland');
	});

	it('keeps both in the vocabulary the API accepts', () => {
		expect(isTranslatable('language', 'name')).toBe(true);
		expect(isTranslatable('profile', 'location')).toBe(true);
	});
});

describe('collectTranslatable — languages and location', () => {
	it('lists the location with the profile and each named language on its own', () => {
		const groups = collectTranslatable({
			id: 1,
			location: 'Haarlem, The Netherlands',
			languages: [
				{ id: 112, name: 'English', language_code: 'en' },
				{ id: 3, name: '' }
			]
		});

		expect(groups.find((g) => g.key === 'profile')?.rows).toContainEqual(
			expect.objectContaining({
				entity: 'profile',
				id: 1,
				field: 'location',
				base: 'Haarlem, The Netherlands',
				multiline: false
			})
		);
		expect(groups.find((g) => g.key === 'languages')?.rows).toEqual([
			expect.objectContaining({
				entity: 'language',
				id: 112,
				field: 'name',
				base: 'English',
				label: 'English — Language'
			})
		]);
	});
});
