/**
 * POST /api/profile-skills — how a quick-added skill picks its category.
 *
 * The interesting part is `category_name`: it lets the applicant file a skill
 * under a category the profile doesn't have yet, without leaving the job they
 * were reading to go and create it first. That means the endpoint has to decide
 * between a picked id, a typed name, and a name that already exists — and get
 * it wrong in the direction of duplicate categories if it doesn't.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCategoriesFindMany = vi.fn();
const mockSkillsFindFirst = vi.fn();

const mockInsertReturning = vi.fn();
const mockInsertValues = vi.fn().mockReturnValue({
  returning: mockInsertReturning,
});
const mockInsertFn = vi.fn().mockReturnValue({ values: mockInsertValues });

vi.mock("$lib/server/db", () => ({
  dbDirect: {
    query: {
      tech_skill_categories: {
        findMany: (...a: any[]) => mockCategoriesFindMany(...a),
      },
      tech_skills: { findFirst: (...a: any[]) => mockSkillsFindFirst(...a) },
    },
    insert: (...a: any[]) => mockInsertFn(...a),
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_col: any, val: any) => val),
  and: vi.fn((...args: any[]) => args),
  asc: vi.fn((col: any) => col),
  desc: vi.fn((col: any) => col),
}));

vi.mock("$lib/server/db/schema", () => ({
  tech_skills: { id: "id", category_id: "category_id", sort: "sort" },
  tech_skill_categories: { id: "id", profile_id: "profile_id", sort: "sort" },
  profile_versions: { id: "id", profile_id: "profile_id", slug: "slug" },
}));

vi.mock("../../../profile/utils", () => ({
  getSelectedProfileId: vi.fn(async () => 7),
  touchProfile: vi.fn(async () => {}),
}));

import { POST } from "../+server";

const CATEGORIES = [
  { id: 10, name: "Frontend", sort: 0, tech_skills: [] },
  { id: 11, name: "Backend", sort: 4, tech_skills: [] },
];

function createEvent(body: any) {
  return {
    locals: { user: { id: "user-1" }, session: null },
    cookies: { get: () => undefined },
    request: new Request("http://localhost/api/profile-skills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  } as any;
}

/** The values handed to the last insert of a given kind. */
function insertedCategory() {
  return mockInsertValues.mock.calls.find((c) => "profile_id" in c[0])?.[0];
}
function insertedSkill() {
  return mockInsertValues.mock.calls.find((c) => "category_id" in c[0])?.[0];
}

describe("POST /api/profile-skills — category choice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCategoriesFindMany.mockResolvedValue(CATEGORIES);
    mockSkillsFindFirst.mockResolvedValue(undefined);
    // Category insert first (id 99), then the skill.
    mockInsertReturning.mockResolvedValueOnce([{ id: 99 }]).mockResolvedValue([
      { id: 500 },
    ]);
  });

  it("uses the picked category", async () => {
    const res = await POST(createEvent({ name: "Rust", category_id: 11 }));

    expect(await res.json()).toMatchObject({ category_id: 11 });
    expect(insertedCategory()).toBeUndefined();
    expect(insertedSkill()).toMatchObject({ category_id: 11 });
  });

  it("falls back to the first category when none is picked", async () => {
    const res = await POST(createEvent({ name: "Rust" }));
    expect(await res.json()).toMatchObject({ category_id: 10 });
  });

  it("rejects a category belonging to someone else", async () => {
    const res = await POST(createEvent({ name: "Rust", category_id: 999 }));
    expect(res.status).toBe(404);
  });

  it("creates a category from a typed name, after the last one", async () => {
    const res = await POST(
      createEvent({ name: "Rust", category_name: "Data & ML" }),
    );

    expect(await res.json()).toMatchObject({ category_id: 99 });
    // sort 5, not 1: the highest existing sort is 4, and appending has to
    // survive a profile whose sort values aren't contiguous.
    expect(insertedCategory()).toMatchObject({
      name: "Data & ML",
      profile_id: 7,
      sort: 5,
    });
  });

  it("reuses an existing category of that name", async () => {
    // Typing what you already have shouldn't leave the profile with two.
    const res = await POST(
      createEvent({ name: "Rust", category_name: "  bAcKeNd  " }),
    );

    expect(await res.json()).toMatchObject({ category_id: 11 });
    expect(insertedCategory()).toBeUndefined();
  });

  it("prefers the typed name over a picked id", async () => {
    const res = await POST(
      createEvent({ name: "Rust", category_id: 10, category_name: "Backend" }),
    );
    expect(await res.json()).toMatchObject({ category_id: 11 });
  });

  it("names the fallback category when the profile has none", async () => {
    mockCategoriesFindMany.mockResolvedValue([]);

    const res = await POST(createEvent({ name: "Rust" }));

    expect(await res.json()).toMatchObject({ category_id: 99 });
    expect(insertedCategory()).toMatchObject({ name: "Other", sort: 0 });
  });
});
