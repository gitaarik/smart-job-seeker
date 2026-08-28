import { describe, it, expect } from 'vitest';
import { decodeMarkdownEntities } from '../markdown-entities';

describe('decodeMarkdownEntities', () => {
	it('decodes the set TipTap encodes', () => {
		expect(decodeMarkdownEntities('Groq &amp; Gemini')).toBe('Groq & Gemini');
		expect(decodeMarkdownEntities('a &lt; b &gt; c')).toBe('a < b > c');
		expect(decodeMarkdownEntities('he said &quot;no&quot;')).toBe('he said "no"');
	});

	it('undoes exactly one level, so text about entities survives a round trip', () => {
		// The applicant typed `&amp;`; the serializer wrote `&amp;amp;`.
		expect(decodeMarkdownEntities('write &amp;amp; for an ampersand')).toBe(
			'write &amp; for an ampersand'
		);
		// The applicant typed `&lt;`; the serializer wrote `&amp;lt;`.
		expect(decodeMarkdownEntities('&amp;lt;')).toBe('&lt;');
	});

	it('leaves text without entities alone', () => {
		const md = '## Heading\n\n- one\n- two\n\nPlain **text** with a [link](https://x.test).';
		expect(decodeMarkdownEntities(md)).toBe(md);
	});

	it('skips fenced code blocks, which the serializer leaves raw', () => {
		const md = 'Escape it:\n\n```html\n<p>a &amp; b</p>\n```\n\nGroq &amp; Gemini';
		expect(decodeMarkdownEntities(md)).toBe(
			'Escape it:\n\n```html\n<p>a &amp; b</p>\n```\n\nGroq & Gemini'
		);
	});

	it('skips tilde fences and inline code spans', () => {
		expect(decodeMarkdownEntities('~~~\n&amp;\n~~~ and &amp;')).toBe('~~~\n&amp;\n~~~ and &');
		expect(decodeMarkdownEntities('use `&amp;` for &amp;')).toBe('use `&amp;` for &');
		expect(decodeMarkdownEntities('``a ` &amp;`` then &amp;')).toBe('``a ` &amp;`` then &');
	});

	it('decodes past an unterminated inline backtick', () => {
		expect(decodeMarkdownEntities('a ` b &amp; c')).toBe('a ` b & c');
	});

	it('stops decoding at an unterminated fence, as the renderer would', () => {
		expect(decodeMarkdownEntities('&amp;\n\n```\n&amp;')).toBe('&\n\n```\n&amp;');
	});

	it('handles several code segments in one document', () => {
		const md = '&amp; `&amp;` &amp; ```&amp;``` &amp;';
		expect(decodeMarkdownEntities(md)).toBe('& `&amp;` & ```&amp;``` &');
	});

	it('is a no-op on empty input', () => {
		expect(decodeMarkdownEntities('')).toBe('');
	});
});
