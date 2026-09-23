/**
 * Tests for a section's translations as the capability registry sees them.
 *
 * The database half is exercised live, on dev; what is pinned here is the part
 * that decides what a model may write — which names are translations at all,
 * which languages are offered, and the three refusals that keep a translated
 * CV from disagreeing with itself.
 */

import { describe, expect, it, vi } from 'vitest';
import { TRANSLATABLE_FIELDS } from '$lib/resume-translations';

// The module reads and writes the overlay; nothing below touches it.
vi.mock('$lib/server/db', () => ({ db: {}, dbDirect: {} }));

const {
	isOfferedField,
	languageList,
	parseTranslationField,
	staleTranslations,
	translatableColumns,
	translationFieldKinds,
	translationRefusal
} = await import('../section-translations');
const { PROFILE_RESOURCE_NAMES, PROFILE_RESOURCES, assistantFields } = await import('../resources');

describe('the declaration', () => {
	it('names every entity the overlay translates on exactly one section', () => {
		// The two the registry has no section for: the profile row itself, and the
		// alternative wordings, which are not written through capabilities.
		const unsectioned = new Set(['profile', 'profile_field_variant']);
		const entities = new Set(
			TRANSLATABLE_FIELDS.map((f) => f.entity).filter((entity) => !unsectioned.has(entity))
		);

		for (const entity of entities) {
			const claimed = PROFILE_RESOURCE_NAMES.filter(
				(name) => PROFILE_RESOURCES[name].translationEntity === entity
			);
			expect(claimed, entity).toHaveLength(1);
		}
	});

	it('can reach every column the overlay translates on a section', () => {
		// A translatable column the assistant may not write would be a field the
		// pages translate and an agent silently cannot.
		for (const name of PROFILE_RESOURCE_NAMES) {
			const entity = PROFILE_RESOURCES[name].translationEntity;
			if (!entity) continue;

			const vocabulary = TRANSLATABLE_FIELDS.filter((f) => f.entity === entity).map((f) => f.field);
			expect([...translatableColumns(name)].sort(), name).toEqual([...vocabulary].sort());
			expect(
				vocabulary.every((field) => field in assistantFields(PROFILE_RESOURCES[name])),
				name
			).toBe(true);
		}
	});

	it('stores a skill group under the table’s name, not the section’s', () => {
		// Persisted rows are keyed `tech_skill_category`; renaming would orphan them.
		expect(PROFILE_RESOURCES.skill_category.translationEntity).toBe('tech_skill_category');
		expect(translatableColumns('skill_category')).toEqual(['name']);
	});

	it('translates nothing on a section the overlay does not cover', () => {
		expect(translatableColumns('certificate')).toEqual([]);
		expect(translationFieldKinds('certificate')).toEqual({});
	});
});

describe('parseTranslationField', () => {
	it('reads a translation as the English field it translates, in its language', () => {
		expect(parseTranslationField('reference.text.nl')).toEqual({
			section: 'reference',
			column: 'text',
			locale: 'nl',
			base: 'reference.text'
		});
	});

	it('is not fooled by a name that merely ends in a language code', () => {
		expect(parseTranslationField('reference.text')).toBeNull();
		// English is the column itself, never a twin.
		expect(parseTranslationField('reference.text.en')).toBeNull();
		// A column the overlay does not translate.
		expect(parseTranslationField('reference.author.nl')).toBeNull();
		// Not a section at all.
		expect(parseTranslationField('directive.salary.nl')).toBeNull();
		expect(parseTranslationField('text.nl')).toBeNull();
	});
});

describe('isOfferedField', () => {
	it('offers a translation only in a language the profile writes in', () => {
		expect(isOfferedField('reference.text.nl', ['nl'])).toBe(true);
		expect(isOfferedField('reference.text.de', ['nl'])).toBe(false);
		expect(isOfferedField('reference.text.nl', [])).toBe(false);
	});

	it('offers every field that is not a translation', () => {
		expect(isOfferedField('reference.text', [])).toBe(true);
		expect(isOfferedField('job_description', [])).toBe(true);
	});
});

describe('languageList', () => {
	it('names the languages the way a sentence would', () => {
		expect(languageList(['nl'])).toBe('Dutch');
		expect(languageList(['nl', 'de'])).toBe('Dutch and German');
		expect(languageList(['nl', 'de', 'fr'])).toBe('Dutch, German and French');
	});
});

describe('translationRefusal', () => {
	const current = {
		'reference.text': 'Rik led.',
		'reference.text.nl': 'Rik leidde.',
		'reference.author_position': null,
		'reference.author_position.nl': null
	};

	it('passes a translation of English that exists, in a started language', () => {
		expect(
			translationRefusal('reference', { 'reference.text.nl': 'Rik gaf leiding.' }, current, ['nl'])
		).toBeNull();
	});

	it('refuses a language the profile has not started, and says which it has', () => {
		const refusal = translationRefusal(
			'reference',
			{ 'reference.text.de': 'Rik führte.' },
			current,
			['nl']
		);
		expect(refusal).toContain('no German version');
		expect(refusal).toContain('Dutch only');
	});

	it('refuses a translation of nothing, unless the English comes with it', () => {
		expect(
			translationRefusal('reference', { 'reference.author_position.nl': 'Oprichter' }, current, [
				'nl'
			])
		).toContain('which is empty');
		expect(
			translationRefusal(
				'reference',
				{ 'reference.author_position': 'Founder', 'reference.author_position.nl': 'Oprichter' },
				current,
				['nl']
			)
		).toBeNull();
	});

	it('lets a translation be removed whatever the English holds', () => {
		expect(
			translationRefusal('reference', { 'reference.text.nl': null }, current, ['nl'])
		).toBeNull();
	});

	it('refuses clearing English that a translation still prints for', () => {
		const refusal = translationRefusal('reference', { 'reference.text': null }, current, ['nl']);
		expect(refusal).toContain('"reference.text.nl"');
		expect(
			translationRefusal(
				'reference',
				{ 'reference.text': null, 'reference.text.nl': null },
				current,
				['nl']
			)
		).toBeNull();
	});

	it('ignores another section’s translations', () => {
		expect(
			translationRefusal('reference', { 'education.summary.nl': 'Iets' }, current, ['nl'])
		).toBeNull();
	});
});

describe('staleTranslations', () => {
	const current = {
		'reference.text': 'Rik led.',
		'reference.text.nl': 'Rik leidde.',
		'reference.author_position': 'Founder',
		'reference.author_position.nl': null
	};

	it('names a translation left describing English that changed', () => {
		expect(staleTranslations({ 'reference.text': 'Rik led the team.' }, current)).toEqual([
			'reference.text.nl'
		]);
	});

	it('names none when the translation changes with it', () => {
		expect(
			staleTranslations(
				{ 'reference.text': 'Rik led the team.', 'reference.text.nl': 'Rik leidde het team.' },
				current
			)
		).toEqual([]);
	});

	it('names none where there was no translation to go stale', () => {
		expect(staleTranslations({ 'reference.author_position': 'CEO' }, current)).toEqual([]);
	});

	it('names none when the English was sent back unchanged', () => {
		expect(staleTranslations({ 'reference.text': 'Rik led.' }, current)).toEqual([]);
	});
});
