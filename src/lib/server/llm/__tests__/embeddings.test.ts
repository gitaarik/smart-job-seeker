/**
 * Tests for embedding utilities (pure math — cosineSimilarity).
 */

import { describe, expect, it } from "vitest";
import { cosineSimilarity } from "../embeddings";

describe("cosineSimilarity", () => {
  it("returns 1 for identical vectors", () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1, 6);
  });

  it("returns 1 for parallel vectors regardless of magnitude", () => {
    expect(cosineSimilarity([1, 0], [5, 0])).toBeCloseTo(1, 6);
  });

  it("returns 0 for orthogonal vectors", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 6);
  });

  it("returns -1 for opposite vectors", () => {
    expect(cosineSimilarity([1, 1], [-1, -1])).toBeCloseTo(-1, 6);
  });

  it("ranks a near vector above a far one", () => {
    const ref = [1, 0];
    const near = cosineSimilarity(ref, [0.9, 0.1]);
    const far = cosineSimilarity(ref, [0.1, 0.9]);
    expect(near).toBeGreaterThan(far);
  });

  it("returns 0 for mismatched lengths", () => {
    expect(cosineSimilarity([1, 2], [1, 2, 3])).toBe(0);
  });

  it("returns 0 for empty or zero-magnitude vectors", () => {
    expect(cosineSimilarity([], [])).toBe(0);
    expect(cosineSimilarity([0, 0], [1, 1])).toBe(0);
  });
});
