/**
 * Tests for Job Match Utilities (DB-dependent functions)
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockFindMany } = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
}));

vi.mock("$lib/server/db", () => ({
  dbDirect: {
    tech_skills: { findMany: mockFindMany },
  },
}));

import { getProfileSkills, getProfileSkillLevels } from "../match-utils";

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
      where: { tech_skill_categories: { profile_id: 42 } },
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
