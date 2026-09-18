/**
 * The letter-label rule, which exists because four copies of it disagreed.
 *
 * Two of the four Svelte lists spelled the cover-letter label "Cover Letter"
 * and two spelled it "Cover letter". These tests pin the spelling as well as
 * the fallback order, since a single shared copy is only worth having if
 * something notices when it changes.
 */

import { describe, expect, it } from 'vitest';
import { LETTER_TYPE_LABELS, letterLabel } from '../letter-label';

describe('letterLabel', () => {
	it('calls a letter by its title when it has one', () => {
		expect(letterLabel('cover_letter', 'Second attempt, warmer')).toBe('Second attempt, warmer');
	});

	it('falls back to the type when there is no title', () => {
		expect(letterLabel('cover_letter')).toBe('Cover letter');
		expect(letterLabel('cover_letter', null)).toBe('Cover letter');
		expect(letterLabel('cheat_sheet')).toBe('Interview cheat sheet');
	});

	// A cleared field arrives as '' or '   ', and naming a row "" would leave
	// the list showing nothing at all.
	it('treats a blank or whitespace title as no title', () => {
		expect(letterLabel('cover_letter', '')).toBe('Cover letter');
		expect(letterLabel('cover_letter', '   ')).toBe('Cover letter');
	});

	it('trims the title it does use', () => {
		expect(letterLabel('cover_letter', '  Warmer draft  ')).toBe('Warmer draft');
	});

	// An unknown type is not an error: the row still has to be called something.
	it('falls back to the raw type when the type is unknown', () => {
		expect(letterLabel('follow_up')).toBe('follow_up');
		expect(letterLabel('follow_up', 'Thank-you note')).toBe('Thank-you note');
	});

	it('spells the two known labels exactly one way', () => {
		expect(LETTER_TYPE_LABELS).toEqual({
			cover_letter: 'Cover letter',
			cheat_sheet: 'Interview cheat sheet'
		});
	});
});
