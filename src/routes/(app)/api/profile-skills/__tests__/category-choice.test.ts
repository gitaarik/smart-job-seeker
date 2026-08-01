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
const mockVersionsFindMany = vi.fn();

const mockUpdateWhere = vi.fn();
const mockUpdateSet = vi.fn().mockReturnValue({ where: mockUpdateWhere });
const mockUpdateFn = vi.fn().mockReturnValue({ set: mockUpdateSet });

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
      profile_versions: {
        findMany: (...a: any[]) => mockVersionsFindMany(...a),
      },
    },
    insert: (...a: any[]) => mockInsertFn(...a),
    update: (...a: any[]) => mockUpdateFn(...a),
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

import { PATCH, POST } from "../+server";

const CATEGORIES = [
  { id: 10, name: "Frontend", sort: 0, tech_skills: [] },
  { id: 11, name: "Backend", sort: 4, tech_skills: [] },
];

function createEvent(body: any, method = "POST") {
  return {
    locals: { user: { id: "user-1" }, session: null },
    cookies: { get: () => undefined },
    request: new Request("http://localhost/api/profile-skills", {
      method,
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
    mockVersionsFindMany.mockResolvedValue([{ slug: "backend" }]);
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

describe("PATCH /api/profile-skills — editing a skill in place", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCategoriesFindMany.mockResolvedValue(CATEGORIES);
    mockVersionsFindMany.mockResolvedValue([{ slug: "backend" }]);
    mockInsertReturning.mockResolvedValue([{ id: 99 }]);
    mockSkillsFindFirst.mockResolvedValue({
      id: 5,
      category_id: 10,
      tags: ["!resume", "!cv"],
      tech_skill_category: { profile_id: 7 },
    });
  });

  /** The columns the update would write. */
  function updated() {
    return mockUpdateSet.mock.calls[0]?.[0];
  }

  function edit(body: any) {
    return PATCH(createEvent({ id: 5, ...body }, "PATCH"));
  }

  it("refuses a skill on another profile", async () => {
    mockSkillsFindFirst.mockResolvedValue({
      id: 5,
      tech_skill_category: { profile_id: 999 },
    });
    expect((await edit({ level: "expert" })).status).toBe(404);
  });

  it("writes only what was sent", async () => {
    await edit({ level: "Expert" });

    expect(updated()).toMatchObject({ level: "expert" });
    expect(updated()).not.toHaveProperty("tags");
    expect(updated()).not.toHaveProperty("category_id");
  });

  it("rejects an unknown level", async () => {
    expect((await edit({ level: "wizard" })).status).toBe(400);
    expect(mockUpdateSet).not.toHaveBeenCalled();
  });

  it("moves the skill to another category", async () => {
    await edit({ category_id: 11 });
    expect(updated()).toMatchObject({ category_id: 11 });
  });

  it("creates a category from a typed name here too", async () => {
    await edit({ category_id: null, category_name: "Data & ML" });

    expect(updated()).toMatchObject({ category_id: 99 });
    expect(insertedCategory()).toMatchObject({ name: "Data & ML", sort: 5 });
  });

  it("lifts a held-back skill onto every document", async () => {
    const res = await edit({ profile_only: false });

    expect(updated()).toMatchObject({ tags: null });
    // Reported as cleared, not as unchanged — a client that trusts the
    // response would otherwise think the lift did nothing.
    expect(await res.json()).toMatchObject({ tags: null });
  });

  it("drops the version whitelist when lifting", async () => {
    // Keeping it would quietly mean "only on backend" rather than everywhere.
    mockSkillsFindFirst.mockResolvedValue({
      id: 5,
      category_id: 10,
      tags: ["!resume", "!cv", "backend"],
      tech_skill_category: { profile_id: 7 },
    });

    await edit({ profile_only: false, versions: [] });
    expect(updated()).toMatchObject({ tags: null });
  });

  it("holds a skill back but keeps it on the named versions", async () => {
    mockSkillsFindFirst.mockResolvedValue({
      id: 5,
      category_id: 10,
      tags: null,
      tech_skill_category: { profile_id: 7 },
    });

    await edit({ profile_only: true, versions: ["backend"] });
    expect(updated()?.tags).toEqual(["!resume", "!cv", "backend"]);
  });

  it("refuses a version the profile doesn't have", async () => {
    const res = await edit({ profile_only: true, versions: ["nope"] });

    expect(res.status).toBe(404);
    // Nothing written: a tag no document activates is worse than an error,
    // because it looks like it worked.
    expect(mockUpdateSet).not.toHaveBeenCalled();
  });

  it("still honours the documents tab's lift shorthand", async () => {
    await edit({ show_on: "backend" });
    expect(updated()?.tags).toEqual(["!resume", "!cv", "backend"]);
  });

  it("does nothing when nothing changed", async () => {
    await edit({});
    expect(mockUpdateSet).not.toHaveBeenCalled();
  });
});
