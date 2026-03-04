/**
 * Tests for Slug Generator
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockFindFirst } = vi.hoisted(() => ({
  mockFindFirst: vi.fn(),
}));

vi.mock("$lib/server/db", () => ({
  dbDirect: {
    profiles: { findFirst: mockFindFirst },
  },
}));

import { generateSlug, ensureUniqueSlug, generateUniqueSlug } from "../slug-generator";

describe("generateSlug", () => {
  it("converts to lowercase", () => {
    expect(generateSlug("Hello World")).toBe("hello-world");
  });

  it("replaces spaces with hyphens", () => {
    expect(generateSlug("foo bar baz")).toBe("foo-bar-baz");
  });

  it("removes accents", () => {
    expect(generateSlug("café résumé")).toBe("cafe-resume");
  });

  it("removes special characters", () => {
    expect(generateSlug("hello@world!")).toBe("helloworld");
  });

  it("collapses multiple hyphens", () => {
    expect(generateSlug("foo---bar")).toBe("foo-bar");
  });

  it("trims leading/trailing hyphens", () => {
    expect(generateSlug("-hello-")).toBe("hello");
  });

  it("replaces underscores with hyphens", () => {
    expect(generateSlug("foo_bar")).toBe("foo-bar");
  });

  it("handles empty string", () => {
    expect(generateSlug("")).toBe("");
  });

  it("handles only special characters", () => {
    expect(generateSlug("!@#$%")).toBe("");
  });

  it("handles unicode names", () => {
    expect(generateSlug("José García")).toBe("jose-garcia");
  });

  it("handles German umlauts", () => {
    expect(generateSlug("Ärger über Ödland")).toBe("arger-uber-odland");
  });

  it("trims whitespace", () => {
    expect(generateSlug("  hello  ")).toBe("hello");
  });
});

describe("ensureUniqueSlug", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns base slug when no conflict", async () => {
    mockFindFirst.mockResolvedValueOnce(null);
    expect(await ensureUniqueSlug("john-doe")).toBe("john-doe");
  });

  it("appends -2 on first conflict", async () => {
    mockFindFirst
      .mockResolvedValueOnce({ id: 1 }) // "john-doe" taken
      .mockResolvedValueOnce(null);     // "john-doe-2" available
    expect(await ensureUniqueSlug("john-doe")).toBe("john-doe-2");
  });

  it("increments counter until unique", async () => {
    mockFindFirst
      .mockResolvedValueOnce({ id: 1 }) // "john-doe" taken
      .mockResolvedValueOnce({ id: 2 }) // "john-doe-2" taken
      .mockResolvedValueOnce({ id: 3 }) // "john-doe-3" taken
      .mockResolvedValueOnce(null);     // "john-doe-4" available
    expect(await ensureUniqueSlug("john-doe")).toBe("john-doe-4");
  });

  it("excludes specified profile ID from conflict check", async () => {
    mockFindFirst.mockResolvedValueOnce(null);
    await ensureUniqueSlug("john-doe", 42);
    expect(mockFindFirst).toHaveBeenCalledWith({
      where: {
        slug: "john-doe",
        id: { not: 42 },
      },
    });
  });
});

describe("generateUniqueSlug", () => {
  beforeEach(() => vi.clearAllMocks());

  it("generates slug from name", async () => {
    mockFindFirst.mockResolvedValueOnce(null);
    expect(await generateUniqueSlug("John Doe")).toBe("john-doe");
  });

  it("falls back to 'profile' when name is null", async () => {
    mockFindFirst.mockResolvedValueOnce(null);
    expect(await generateUniqueSlug(null)).toBe("profile");
  });

  it("falls back to 'profile-{id}' when name is null and profileId given", async () => {
    mockFindFirst.mockResolvedValueOnce(null);
    expect(await generateUniqueSlug(null, 42)).toBe("profile-42");
  });

  it("falls back when name is empty string", async () => {
    mockFindFirst.mockResolvedValueOnce(null);
    expect(await generateUniqueSlug("")).toBe("profile");
  });

  it("falls back when name is only whitespace", async () => {
    mockFindFirst.mockResolvedValueOnce(null);
    expect(await generateUniqueSlug("   ")).toBe("profile");
  });

  it("falls back when slug generates empty (only special chars)", async () => {
    mockFindFirst.mockResolvedValueOnce(null);
    expect(await generateUniqueSlug("!@#$%")).toBe("profile");
  });

  it("truncates slug to 240 chars", async () => {
    mockFindFirst.mockResolvedValueOnce(null);
    const longName = "a".repeat(300);
    const slug = await generateUniqueSlug(longName);
    expect(slug.length).toBeLessThanOrEqual(240);
  });
});
