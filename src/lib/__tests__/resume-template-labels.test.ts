import { describe, expect, it } from 'vitest';
import { LOCALES } from '../resume-translations';
import {
	PROFICIENCY_LABELS,
	TEMPLATE_LABELS,
	localizeLanguageName,
	proficiencyLabel,
	templateLabel
} from '../resume-template-labels';

// The dictionary falls back to English per key, which is the right behaviour
// for an unknown locale and the wrong one for a known locale that a new key
// forgot — that is how a Dutch PDF ends up with "Present" between Dutch
// bullets. So every key must carry every locale the UI offers.
describe('template chrome labels', () => {
	it('carry every offered locale for every key', () => {
		for (const [key, entry] of Object.entries(TEMPLATE_LABELS)) {
			for (const { code } of LOCALES) {
				expect(entry[code], `${key}.${code}`).toBeTruthy();
			}
		}
	});

	it('localize the "Present" date label and fall back to English otherwise', () => {
		expect(templateLabel('present', 'nl')).toBe('Heden');
		expect(templateLabel('present', 'de')).toBe('Heute');
		expect(templateLabel('present', 'xx')).toBe('Present');
		expect(templateLabel('present', null)).toBe('Present');
		expect(templateLabel('present', undefined)).toBe('Present');
	});
});

describe('proficiencyLabel', () => {
	it('carries every offered locale for every stored keyword', () => {
		for (const [keyword, entry] of Object.entries(PROFICIENCY_LABELS)) {
			for (const { code } of LOCALES) {
				expect(entry[code], `${keyword}.${code}`).toBeTruthy();
			}
		}
	});

	it('localizes the stored keywords regardless of casing', () => {
		expect(proficiencyLabel('fluent', 'nl')).toBe('Vloeiend');
		expect(proficiencyLabel('native', 'en')).toBe('Native');
		expect(proficiencyLabel('Native', null)).toBe('Native');
		expect(proficiencyLabel(' basic ', 'fr')).toBe('Notions de base');
	});

	it('prints free text capitalized as typed, whatever the locale', () => {
		expect(proficiencyLabel('expert', 'nl')).toBe('Expert');
		expect(proficiencyLabel('C1', 'de')).toBe('C1');
		expect(proficiencyLabel('', 'nl')).toBe('');
		expect(proficiencyLabel(null, 'nl')).toBe('');
	});
});

// Language names are the one piece of profile data the chrome localizes on its
// own: ICU has a word for "English" in every locale, so a Dutch PDF must not
// print "English: Vloeiend" just because nobody typed a translation.
describe('localizeLanguageName', () => {
	it('names the language in the render locale from its ISO code', () => {
		expect(localizeLanguageName('English', 'en', 'nl')).toBe('Engels');
		expect(localizeLanguageName('Dutch', 'nl', 'de')).toBe('Niederländisch');
		expect(localizeLanguageName('English', 'en', 'fr')).toBe('Anglais');
		expect(localizeLanguageName('Dutch', 'nl', 'es')).toBe('Neerlandés');
	});

	it('matches the English name when the row carries no code', () => {
		expect(localizeLanguageName('German', null, 'nl')).toBe('Duits');
		expect(localizeLanguageName('french', '', 'nl')).toBe('Frans');
	});

	it('prints as typed for the base locale and for names ICU cannot place', () => {
		expect(localizeLanguageName('English', 'en', 'en')).toBe('English');
		expect(localizeLanguageName('English', 'en', null)).toBe('English');
		expect(localizeLanguageName('Klingon', null, 'nl')).toBe('Klingon');
		expect(localizeLanguageName('Mandarin Chinese', 'not a tag', 'nl')).toBe('Mandarin Chinese');
		expect(localizeLanguageName('', 'en', 'nl')).toBe('');
	});
});
