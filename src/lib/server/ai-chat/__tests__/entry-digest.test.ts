/**
 * The digest's two boundaries: which entries need one (and when a stored one
 * has gone stale), and what counts as a usable answer from the model.
 */
import { describe, expect, it } from 'vitest';
import {
	coerceDigest,
	digestHash,
	DIGEST_CONTRACT_VERSION,
	hasCurrentDigest,
	isLongEntry,
	needsDigest
} from '../entry-digest';
import { LONG_ENTRY_CHARS } from '$lib/application-records';

const long = 'x'.repeat(LONG_ENTRY_CHARS + 1);

function entry(over: Record<string, unknown> = {}) {
	return {
		record_type: 'transcript',
		event_date: '2026-09-28',
		content: long,
		digest_hash: null as string | null,
		...over
	};
}

describe('digestHash', () => {
	it('is stable, and carries the contract version', () => {
		expect(digestHash(entry())).toBe(digestHash(entry()));
		expect(digestHash(entry()).startsWith(`v${DIGEST_CONTRACT_VERSION}:`)).toBe(true);
	});

	it.each([
		['content', { content: long + 'y' }],
		['date', { event_date: '2026-09-29' }],
		['type', { record_type: 'message' }]
	])('changes when the %s changes', (_name, over) => {
		expect(digestHash(entry(over))).not.toBe(digestHash(entry()));
	});

	// Derivation retitles an entry after it is written; that must not cost a
	// second read of a 90,000-character transcript.
	it('ignores the title', () => {
		const titled = { ...entry(), title: 'Recruiter call' };
		expect(digestHash(titled)).toBe(digestHash(entry()));
	});
});

describe('which entries need a digest', () => {
	it('only long ones', () => {
		expect(isLongEntry({ content: 'x'.repeat(LONG_ENTRY_CHARS) })).toBe(false);
		expect(isLongEntry({ content: long })).toBe(true);
		expect(isLongEntry({ content: null })).toBe(false);
		expect(needsDigest(entry({ content: 'short note' }))).toBe(false);
	});

	it('a long entry with no digest, or one written from other text', () => {
		expect(needsDigest(entry())).toBe(true);
		const current = entry({ digest_hash: digestHash(entry()) });
		expect(needsDigest(current)).toBe(false);
		expect(hasCurrentDigest(current)).toBe(true);
		const edited = { ...current, content: long + ' edited' };
		expect(needsDigest(edited)).toBe(true);
	});

	it('treats a digest from an older contract as stale', () => {
		const old = entry({ digest_hash: 'v0:' + digestHash(entry()).slice(3) });
		expect(needsDigest(old)).toBe(true);
	});
});

describe('coerceDigest', () => {
	it('takes a gist and its facts', () => {
		const out = coerceDigest({
			gist: '  Intro call   with the recruiter. ',
			facts: [{ category: 'logistics', label: 'Next round', value: 'With the CTO' }]
		})!;
		expect(out.gist).toBe('Intro call with the recruiter.');
		expect(out.facts).toEqual([
			{ category: 'logistics', label: 'Next round', value: 'With the CTO' }
		]);
	});

	// A gist with no facts is a real answer (a long onboarding guide can hold
	// nothing worth keeping); no gist is a malformed one, retried next time.
	it('accepts no facts, refuses no gist', () => {
		expect(coerceDigest({ gist: 'An onboarding guide.', facts: [] })!.facts).toEqual([]);
		expect(coerceDigest({ gist: '', facts: [] })).toBeNull();
		expect(coerceDigest({ facts: [] })).toBeNull();
		expect(coerceDigest(null)).toBeNull();
		expect(coerceDigest('a string')).toBeNull();
	});

	it('normalises facts the way details are, with a larger cap', () => {
		const facts = Array.from({ length: 30 }, (_, i) => ({
			category: i === 29 ? 'decision' : 'invented',
			label: `Fact ${i}`,
			value: `Value ${i}`
		}));
		const out = coerceDigest({ gist: 'A contract.', facts })!;
		expect(out.facts).toHaveLength(20);
		// The applicant's own decision leads, whatever the model's order.
		expect(out.facts[0]).toEqual({ category: 'decision', label: 'Fact 29', value: 'Value 29' });
		expect(out.facts[1].category).toBe('other');
	});

	it('caps a runaway gist', () => {
		const out = coerceDigest({ gist: 'word '.repeat(500), facts: [] })!;
		expect(out.gist.length).toBeLessThanOrEqual(601);
	});
});
