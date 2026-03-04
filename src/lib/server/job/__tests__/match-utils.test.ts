/**
 * Tests for Job Match Utilities (pure functions)
 */

import { describe, expect, it } from "vitest";
import { hasArrayOverlap, matchesLocation } from "../match-utils";

describe("hasArrayOverlap", () => {
  it("returns false for empty arrays", () => {
    expect(hasArrayOverlap([], [])).toBe(false);
  });

  it("returns false when first array is empty", () => {
    expect(hasArrayOverlap([], [1, 2])).toBe(false);
  });

  it("returns false when second array is empty", () => {
    expect(hasArrayOverlap([1, 2], [])).toBe(false);
  });

  it("returns false for disjoint arrays", () => {
    expect(hasArrayOverlap([1, 2, 3], [4, 5, 6])).toBe(false);
  });

  it("returns true for overlapping arrays", () => {
    expect(hasArrayOverlap([1, 2, 3], [3, 4, 5])).toBe(true);
  });

  it("returns true for identical arrays", () => {
    expect(hasArrayOverlap([1, 2], [1, 2])).toBe(true);
  });

  it("works with strings", () => {
    expect(hasArrayOverlap(["React", "Vue"], ["Angular", "React"])).toBe(true);
    expect(hasArrayOverlap(["React", "Vue"], ["Angular", "Svelte"])).toBe(false);
  });

  it("handles null/undefined arrays", () => {
    expect(hasArrayOverlap(null as any, [1])).toBe(false);
    expect(hasArrayOverlap([1], null as any)).toBe(false);
    expect(hasArrayOverlap(null as any, null as any)).toBe(false);
  });
});

describe("matchesLocation", () => {
  // Remote/null location handling
  it("matches when job location is null (remote)", () => {
    expect(matchesLocation(null, ["Amsterdam"])).toBe(true);
  });

  it("matches when job location is empty string", () => {
    expect(matchesLocation("", ["Amsterdam"])).toBe(true);
  });

  it("matches when job location is whitespace", () => {
    expect(matchesLocation("   ", ["Amsterdam"])).toBe(true);
  });

  // Empty preferences
  it("matches when no location preferences", () => {
    expect(matchesLocation("Berlin", [])).toBe(true);
  });

  it("matches when preferences is null", () => {
    expect(matchesLocation("Berlin", null as any)).toBe(true);
  });

  // Exact match
  it("matches exact location", () => {
    expect(matchesLocation("Amsterdam", ["Amsterdam"])).toBe(true);
  });

  it("matches case-insensitively", () => {
    expect(matchesLocation("AMSTERDAM", ["amsterdam"])).toBe(true);
    expect(matchesLocation("amsterdam", ["AMSTERDAM"])).toBe(true);
  });

  // Contains match
  it("matches when job location contains preference", () => {
    expect(matchesLocation("Amsterdam, Netherlands", ["Amsterdam"])).toBe(true);
  });

  it("matches when job location contains preference (city in full address)", () => {
    expect(matchesLocation("Berlin, Germany (Hybrid)", ["Berlin"])).toBe(true);
  });

  // Reverse contains
  it("matches when preference contains job location", () => {
    expect(matchesLocation("Amsterdam", ["Amsterdam, Netherlands"])).toBe(true);
  });

  // Multiple preferences
  it("matches if any preference matches", () => {
    expect(matchesLocation("Berlin", ["Amsterdam", "Berlin", "London"])).toBe(true);
  });

  it("rejects when no preferences match", () => {
    expect(matchesLocation("Tokyo", ["Amsterdam", "Berlin", "London"])).toBe(false);
  });

  // Remote preference
  it("matches remote job with 'remote' preference", () => {
    expect(matchesLocation("Remote - US", ["remote"])).toBe(true);
  });

  it("matches 'anywhere' with 'remote' preference", () => {
    expect(matchesLocation("Anywhere", ["remote"])).toBe(true);
  });

  it("matches 'worldwide' with 'remote' preference", () => {
    expect(matchesLocation("Worldwide", ["remote"])).toBe(true);
  });

  it("doesn't match unrelated location with 'remote' preference", () => {
    expect(matchesLocation("Berlin, Germany", ["remote"])).toBe(false);
  });

  // Trimming
  it("trims whitespace from both sides", () => {
    expect(matchesLocation("  Amsterdam  ", ["  Amsterdam  "])).toBe(true);
  });
});
