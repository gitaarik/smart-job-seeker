/**
 * A structured reply that is the schema's type names instead of an answer. See
 * llm/schema-echo.ts for the reply that made this necessary, and
 * llm-schema-echo.test.ts for what the model wrapper does with one.
 */
import { describe, expect, it } from 'vitest';
import { isSchemaEcho } from '../schema-echo';

describe('isSchemaEcho', () => {
	it('catches the reply that was saved as an answer', () => {
		expect(isSchemaEcho({ feedback: 'string', text: 'string' })).toBe(true);
	});

	it.each([
		['one field', { reply: 'string' }],
		['a list', { matched_skills: ['string', 'string'] }],
		['a nested object', { jobs: [{ title: 'string', company: 'string' }] }],
		['strings among other types', { score: 0, summary: 'string', remote: false }],
		['an explicit null beside it', { text: null, feedback: 'string' }],
		['another case, or padding', { reply: ' String ' }]
	])('catches an echo in %s', (_, reply) => {
		expect(isSchemaEcho(reply)).toBe(true);
	});

	it('leaves a real answer alone', () => {
		expect(isSchemaEcho({ feedback: 'I drew on your Acme work.', text: 'Since 2025…' })).toBe(
			false
		);
	});

	// Narrow on purpose: an answer with one echoed field is worse, not missing.
	it('leaves a reply that answered any of its fields alone', () => {
		expect(isSchemaEcho({ feedback: 'string', text: 'Since August 2025 I have…' })).toBe(false);
	});

	it.each([
		['an empty list', { matched_skills: [] }],
		['numbers only', { score: 12 }],
		['nothing at all', {}],
		['null', null]
	])('needs at least one string, so %s is not an echo', (_, reply) => {
		expect(isSchemaEcho(reply)).toBe(false);
	});

	it('reads the values, not the keys', () => {
		expect(isSchemaEcho({ string: 'a real value' })).toBe(false);
	});

	it('does not mistake the word inside a sentence for an echo', () => {
		expect(isSchemaEcho({ reply: 'Pass the query as a string.' })).toBe(false);
	});
});
