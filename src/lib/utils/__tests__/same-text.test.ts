/**
 * The rule four surfaces share for "this version says what the text says".
 *
 * Written against the case that produced it: a cheat sheet stored with CRLF and
 * a version of it written with LF, 6,159 characters against 6,092 of identical
 * prose. Every surface read that as a rewrite, so the badge sat on no version,
 * the tools reported a proposal waiting, and the guard against re-proposing an
 * unchanged text let it through.
 */
import { describe, expect, it } from 'vitest';
import { normalizeLineEndings, sameText } from '../same-text';

describe('sameText', () => {
	it('sees through line endings, which is the whole reason it exists', () => {
		expect(sameText('one\r\ntwo\r\n', 'one\ntwo\n')).toBe(true);
		expect(sameText('one\rtwo', 'one\ntwo')).toBe(true);
	});

	it('still sees through surrounding whitespace', () => {
		expect(sameText('  the text\n\n', 'the text')).toBe(true);
	});

	it('treats a missing text and an empty one as the same nothing', () => {
		expect(sameText(null, '')).toBe(true);
		expect(sameText(undefined, '   ')).toBe(true);
	});

	it('stops at differences a person can see', () => {
		// Folding these would mean a text that quietly disagrees with the version
		// it claims to be. Whitespace inside a line and case are edits somebody
		// may have made on purpose.
		expect(sameText('the  text', 'the text')).toBe(false);
		expect(sameText('The text', 'the text')).toBe(false);
		expect(sameText('one\ntwo', 'one\n\ntwo')).toBe(false);
	});
});

describe('normalizeLineEndings', () => {
	it('leaves everything but the carriage returns alone', () => {
		expect(normalizeLineEndings('a\r\nb\rc\nd  ')).toBe('a\nb\nc\nd  ');
	});
});
