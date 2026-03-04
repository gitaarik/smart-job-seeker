/**
 * Tests for Job Match Utilities (DB-dependent functions)
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockFindMany, mockFindFirst } = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
  mockFindFirst: vi.fn(),
}));

vi.mock("$lib/server/db", () => ({
  dbDirect: {
    tech_skills: { findMany: mockFindMany },
    job_matches: { findFirst: mockFindFirst },
  },
}));

import { getProfileSkills, getProfileSkillLevels, needsRematching } from "../match-utils";

describe("getProfileSkills", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns skill names", async () => {
    mockFindMany.mockResolvedValueOnce([
      { name: "TypeScript" },
      { name: "React" },
      { name: "Node.js" },
    ]);
    const skills = await getProfileSkills(1);
    expect(skills).toEqual(["TypeScript", "React", "Node.js"]);
  });

  it("filters out null names", async () => {
    mockFindMany.mockResolvedValueOnce([
      { name: "TypeScript" },
      { name: null },
      { name: "" },
      { name: "React" },
    ]);
    const skills = await getProfileSkills(1);
    expect(skills).toEqual(["TypeScript", "React"]);
  });

  it("returns empty array when no skills", async () => {
    mockFindMany.mockResolvedValueOnce([]);
    const skills = await getProfileSkills(1);
    expect(skills).toEqual([]);
  });

  it("queries with correct profile filter", async () => {
    mockFindMany.mockResolvedValueOnce([]);
    await getProfileSkills(42);
    expect(mockFindMany).toHaveBeenCalledWith({
      where: { tech_skill_categories: { profile: 42 } },
      select: { name: true },
    });
  });
});

describe("getProfileSkillLevels", () => {
  beforeEach(() => vi.clearAllMocks());

  it("classifies beginner as weak", async () => {
    mockFindMany.mockResolvedValueOnce([
      { name: "React", level: "beginner", years_experience: null },
    ]);
    const levels = await getProfileSkillLevels(1);
    expect(levels["react"]).toBe("weak");
  });

  it("classifies intermediate as weak", async () => {
    mockFindMany.mockResolvedValueOnce([
      { name: "React", level: "Intermediate", years_experience: null },
    ]);
    const levels = await getProfileSkillLevels(1);
    expect(levels["react"]).toBe("weak");
  });

  it("classifies expert as strong", async () => {
    mockFindMany.mockResolvedValueOnce([
      { name: "TypeScript", level: "expert", years_experience: null },
    ]);
    const levels = await getProfileSkillLevels(1);
    expect(levels["typescript"]).toBe("strong");
  });

  it("classifies proficient as strong", async () => {
    mockFindMany.mockResolvedValueOnce([
      { name: "TypeScript", level: "Proficient", years_experience: null },
    ]);
    const levels = await getProfileSkillLevels(1);
    expect(levels["typescript"]).toBe("strong");
  });

  it("classifies < 3 years without level as weak", async () => {
    mockFindMany.mockResolvedValueOnce([
      { name: "Go", level: null, years_experience: 2 },
    ]);
    const levels = await getProfileSkillLevels(1);
    expect(levels["go"]).toBe("weak");
  });

  it("classifies 3+ years without level as strong", async () => {
    mockFindMany.mockResolvedValueOnce([
      { name: "Go", level: null, years_experience: 3 },
    ]);
    const levels = await getProfileSkillLevels(1);
    expect(levels["go"]).toBe("strong");
  });

  it("classifies no level and no years as strong", async () => {
    mockFindMany.mockResolvedValueOnce([
      { name: "Python", level: null, years_experience: null },
    ]);
    const levels = await getProfileSkillLevels(1);
    expect(levels["python"]).toBe("strong");
  });

  it("lowercases skill names as keys", async () => {
    mockFindMany.mockResolvedValueOnce([
      { name: "TypeScript", level: "expert", years_experience: null },
    ]);
    const levels = await getProfileSkillLevels(1);
    expect(levels).toHaveProperty("typescript");
    expect(levels).not.toHaveProperty("TypeScript");
  });

  it("skips skills with null name", async () => {
    mockFindMany.mockResolvedValueOnce([
      { name: null, level: "expert", years_experience: 5 },
      { name: "React", level: "expert", years_experience: null },
    ]);
    const levels = await getProfileSkillLevels(1);
    expect(Object.keys(levels)).toEqual(["react"]);
  });

  it("level takes precedence over years", async () => {
    mockFindMany.mockResolvedValueOnce([
      { name: "React", level: "beginner", years_experience: 10 },
    ]);
    const levels = await getProfileSkillLevels(1);
    expect(levels["react"]).toBe("weak");
  });

  it("returns empty object when no skills", async () => {
    mockFindMany.mockResolvedValueOnce([]);
    const levels = await getProfileSkillLevels(1);
    expect(levels).toEqual({});
  });
});

describe("needsRematching", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns true when no existing match", async () => {
    mockFindFirst.mockResolvedValueOnce(null);
    const result = await needsRematching(1, 100, { date_updated: new Date() } as any);
    expect(result).toBe(true);
  });

  it("returns true when existing match has no timestamp", async () => {
    mockFindFirst.mockResolvedValueOnce({
      job_date_updated_when_matched: null,
    });
    const result = await needsRematching(1, 100, { date_updated: new Date() } as any);
    expect(result).toBe(true);
  });

  it("returns true when job has no date_updated", async () => {
    mockFindFirst.mockResolvedValueOnce({
      job_date_updated_when_matched: new Date("2025-01-01"),
    });
    const result = await needsRematching(1, 100, { date_updated: null } as any);
    expect(result).toBe(true);
  });

  it("returns true when job was updated after matching", async () => {
    mockFindFirst.mockResolvedValueOnce({
      job_date_updated_when_matched: new Date("2025-01-01"),
    });
    const result = await needsRematching(1, 100, {
      date_updated: new Date("2025-06-01"),
    } as any);
    expect(result).toBe(true);
  });

  it("returns false when job hasn't been updated since matching", async () => {
    mockFindFirst.mockResolvedValueOnce({
      job_date_updated_when_matched: new Date("2025-06-01"),
    });
    const result = await needsRematching(1, 100, {
      date_updated: new Date("2025-01-01"),
    } as any);
    expect(result).toBe(false);
  });

  it("returns false when timestamps are equal", async () => {
    const ts = new Date("2025-03-15");
    mockFindFirst.mockResolvedValueOnce({
      job_date_updated_when_matched: ts,
    });
    const result = await needsRematching(1, 100, { date_updated: ts } as any);
    expect(result).toBe(false);
  });

  it("queries with correct profile and job IDs", async () => {
    mockFindFirst.mockResolvedValueOnce(null);
    await needsRematching(42, 99, { date_updated: null } as any);
    expect(mockFindFirst).toHaveBeenCalledWith({
      where: { profile: 42, job: 99 },
      select: { job_date_updated_when_matched: true },
    });
  });
});
