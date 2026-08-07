/**
 * Tests for embedding utilities (pure math — cosineSimilarity).
 */

import { describe, expect, it } from 'vitest';
import { cosineSimilarity, truncateVector } from '../embeddings';

describe('cosineSimilarity', () => {
	it('returns 1 for identical vectors', () => {
		expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1, 6);
	});

	it('returns 1 for parallel vectors regardless of magnitude', () => {
		expect(cosineSimilarity([1, 0], [5, 0])).toBeCloseTo(1, 6);
	});

	it('returns 0 for orthogonal vectors', () => {
		expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 6);
	});

	it('returns -1 for opposite vectors', () => {
		expect(cosineSimilarity([1, 1], [-1, -1])).toBeCloseTo(-1, 6);
	});

	it('ranks a near vector above a far one', () => {
		const ref = [1, 0];
		const near = cosineSimilarity(ref, [0.9, 0.1]);
		const far = cosineSimilarity(ref, [0.1, 0.9]);
		expect(near).toBeGreaterThan(far);
	});

	it('returns 0 for mismatched lengths', () => {
		expect(cosineSimilarity([1, 2], [1, 2, 3])).toBe(0);
	});

	it('returns 0 for empty or zero-magnitude vectors', () => {
		expect(cosineSimilarity([], [])).toBe(0);
		expect(cosineSimilarity([0, 0], [1, 1])).toBe(0);
	});
});

describe('truncateVector', () => {
	it('returns the input unchanged when dims >= length', () => {
		const v = [0.6, 0.8];
		expect(truncateVector(v, 2)).toBe(v);
		expect(truncateVector(v, 5)).toBe(v);
	});

	it('keeps the leading components and re-normalizes to unit length', () => {
		const out = truncateVector([3, 4, 100, 100], 2);
		expect(out).toHaveLength(2);
		// [3,4] normalized -> [0.6, 0.8]
		expect(out[0]).toBeCloseTo(0.6, 6);
		expect(out[1]).toBeCloseTo(0.8, 6);
		const mag = Math.hypot(...out);
		expect(mag).toBeCloseTo(1, 6);
	});

	it('preserves relative order of a truncated comparison', () => {
		// The whole point: truncation must not flip near/far judgments on the
		// components it keeps.
		const ref = truncateVector([1, 0, 0.01, 0.01], 2);
		const near = cosineSimilarity(ref, truncateVector([0.9, 0.1, 9, 9], 2));
		const far = cosineSimilarity(ref, truncateVector([0.1, 0.9, 9, 9], 2));
		expect(near).toBeGreaterThan(far);
	});

	it('does not crash on a zero-magnitude head', () => {
		expect(truncateVector([0, 0, 1, 1], 2)).toEqual([0, 0]);
	});
});
