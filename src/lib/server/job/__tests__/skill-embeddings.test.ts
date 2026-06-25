/**
 * Tests for semantic skill expansion (expandProfileSkills).
 *
 * Embeddings + DB are mocked: known skills get fixed vectors so "React" sits
 * near "frontend" and far from "python", and the vocabulary is seeded via the
 * mocked select chain. No API key or live provider needed.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// Hoisted so the vi.mock factory (also hoisted) can reference them.
const h = vi.hoisted(() => {
  const VECTORS: Record<string, number[]> = {
    react: [0.9, 0.1, 0],
    frontend: [1, 0, 0],
    python: [0, 1, 0],
  };
  function cosine(a: number[], b: number[]): number {
    let dot = 0, ma = 0, mb = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      ma += a[i] * a[i];
      mb += b[i] * b[i];
    }
    return ma === 0 || mb === 0 ? 0 : dot / (Math.sqrt(ma) * Math.sqrt(mb));
  }
  return {
    VECTORS,
    configured: { value: true },
    cosineSpy: vi.fn(cosine),
    embedSpy: vi.fn((labels: string[]) =>
      Promise.resolve(labels.map((l) => VECTORS[l.toLowerCase()] ?? [0, 0, 1]))
    ),
  };
});

vi.mock("$lib/server/llm/embeddings", () => ({
  isEmbeddingConfigured: () => h.configured.value,
  cosineSimilarity: h.cosineSpy,
  embedBatch: h.embedSpy,
}));

vi.mock("$lib/server/config", () => ({
  config: { embeddingModel: "test-model", embeddingSkillThreshold: 0.55 },
}));

// DB mock: select chain seeds the vocabulary; insert chain is a no-op.
const mockWhere = vi.fn();
const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
const mockOnConflict = vi.fn().mockResolvedValue(undefined);
const mockValues = vi.fn().mockReturnValue({ onConflictDoNothing: mockOnConflict });
const mockInsert = vi.fn().mockReturnValue({ values: mockValues });

vi.mock("$lib/server/db", () => ({
  dbDirect: {
    select: (...a: any[]) => mockSelect(...a),
    insert: (...a: any[]) => mockInsert(...a),
  },
}));

vi.mock("$lib/server/db/schema", () => ({
  skill_embeddings: { skill: "skill", label: "label", model: "model" },
}));

vi.mock("drizzle-orm", () => ({ eq: vi.fn((_c: any, v: any) => v) }));

import {
  _resetVocabCache,
  backfillSkillVocabulary,
  expandProfileSkills,
} from "../skill-embeddings";

// Mirrors normalizeSkill + findExactSkillMatches in
// cloud/src/server/job/match-utils.ts (the downstream gate). Kept here so the
// "rescue" test asserts real match behavior, not just expansion membership.
function normalizeSkill(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9+#]/g, "").trim();
}
function exactMatches(profile: string[], job: string[]): string[] {
  const set = new Set(profile.map(normalizeSkill));
  return job.filter((j) => set.has(normalizeSkill(j)));
}

describe("expandProfileSkills", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetVocabCache();
    h.configured.value = true;
    mockFrom.mockReturnValue({ where: mockWhere });
    mockValues.mockReturnValue({ onConflictDoNothing: mockOnConflict });
    // Vocabulary already contains "frontend" and "python".
    mockWhere.mockResolvedValue([
      { skill: "frontend", label: "frontend", embedding: h.VECTORS.frontend, model: "test-model" },
      { skill: "python", label: "Python", embedding: h.VECTORS.python, model: "test-model" },
    ]);
  });

  it("adds a semantically-near vocabulary skill (React → frontend)", async () => {
    const result = await expandProfileSkills(["React"]);
    expect(result).toContain("React");
    expect(result).toContain("frontend");
  });

  it("does not add unrelated vocabulary skills (no Python)", async () => {
    const result = await expandProfileSkills(["React"]);
    expect(result).not.toContain("Python");
  });

  it("is a no-op when embeddings are unconfigured", async () => {
    h.configured.value = false;
    const result = await expandProfileSkills(["React"]);
    expect(result).toEqual(["React"]);
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it("returns input unchanged on empty skills", async () => {
    expect(await expandProfileSkills([])).toEqual([]);
  });

  it("falls back to input skills if the DB throws", async () => {
    mockWhere.mockRejectedValueOnce(new Error("db down"));
    const result = await expandProfileSkills(["React"]);
    expect(result).toEqual(["React"]);
  });

  it("embeds + persists skills not yet in the vocabulary", async () => {
    await expandProfileSkills(["React"]);
    expect(mockInsert).toHaveBeenCalled();
    expect(mockValues).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ skill: "react", label: "React" }),
      ]),
    );
  });

  it("memoizes: a repeat call for the same skills skips the cosine scan", async () => {
    await expandProfileSkills(["React"]);
    expect(h.cosineSpy).toHaveBeenCalled();
    h.cosineSpy.mockClear();

    const second = await expandProfileSkills(["React"]);
    // Cache hit — no recomputation.
    expect(h.cosineSpy).not.toHaveBeenCalled();
    expect(second).toContain("frontend");
  });

  it("does not share the memo across different skill sets", async () => {
    await expandProfileSkills(["React"]);
    h.cosineSpy.mockClear();
    await expandProfileSkills(["Python"]);
    expect(h.cosineSpy).toHaveBeenCalled();
  });
});

// End-to-end behavior: a job that the exact-match gate misses is rescued once
// the profile's skills are semantically expanded.
describe("semantic expansion rescues an otherwise-unmatched job", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetVocabCache();
    h.configured.value = true;
    mockFrom.mockReturnValue({ where: mockWhere });
    mockValues.mockReturnValue({ onConflictDoNothing: mockOnConflict });
    mockWhere.mockResolvedValue([
      { skill: "frontend", label: "Frontend", embedding: h.VECTORS.frontend, model: "test-model" },
    ]);
  });

  it("no overlap with exact matching, overlap after expansion", async () => {
    const profileSkills = ["React"];
    const jobSkills = ["Frontend"];

    // Baseline: exact matching finds nothing (React != Frontend).
    expect(exactMatches(profileSkills, jobSkills)).toEqual([]);

    // After semantic expansion, the job's skill now matches.
    const expanded = await expandProfileSkills(profileSkills);
    expect(exactMatches(expanded, jobSkills)).toEqual(["Frontend"]);
  });

  it("stays unmatched when embeddings are disabled", async () => {
    h.configured.value = false;
    const expanded = await expandProfileSkills(["React"]);
    expect(exactMatches(expanded, ["Frontend"])).toEqual([]);
  });
});

describe("backfillSkillVocabulary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetVocabCache();
    h.configured.value = true;
    mockFrom.mockReturnValue({ where: mockWhere });
    mockValues.mockReturnValue({ onConflictDoNothing: mockOnConflict });
    mockWhere.mockResolvedValue([]); // empty vocab
  });

  it("counts newly embedded skills", async () => {
    const added = await backfillSkillVocabulary(["React", "Frontend"]);
    expect(added).toBe(2);
  });

  it("is a no-op when unconfigured", async () => {
    h.configured.value = false;
    expect(await backfillSkillVocabulary(["React"])).toBe(0);
  });
});
