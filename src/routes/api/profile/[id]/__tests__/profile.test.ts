/**
 * Tests for Profile API endpoints
 * PATCH /api/profile/[id]
 * GET /api/profile/[id]/export.json
 * PUT /api/profile/[id]/browser-info
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFindFirst = vi.fn();

// Mock Drizzle update chain
const mockUpdateWhere = vi.fn().mockResolvedValue({});
const mockUpdateSet = vi.fn().mockReturnValue({ where: mockUpdateWhere });
const mockUpdateFn = vi.fn().mockReturnValue({ set: mockUpdateSet });

vi.mock("$lib/server/db", () => ({
  db: {
    query: {
      profiles: {
        findFirst: (...a: any[]) => mockFindFirst(...a),
      },
    },
    update: (...a: any[]) => mockUpdateFn(...a),
  },
  dbDirect: {
    query: {
      profiles: {
        findFirst: (...a: any[]) => mockFindFirst(...a),
      },
    },
    update: (...a: any[]) => mockUpdateFn(...a),
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_col: any, val: any) => val),
  and: vi.fn((...args: any[]) => args),
  ne: vi.fn((_col: any, val: any) => val),
  asc: vi.fn(),
}));

vi.mock("$lib/server/db/schema", () => ({
  profiles: {
    id: "profiles.id",
    user_id: "profiles.user_id",
    slug: "profiles.slug",
  },
}));

import { PATCH } from "../+server";
import { GET } from "../export.json/+server";
import { PUT } from "../browser-info/+server";

function createEvent(opts: {
  user?: any;
  params?: Record<string, string>;
  body?: any;
  method?: string;
}) {
  const user = opts.user === undefined ? { id: "user-1" } : opts.user;
  const params = opts.params ?? { id: "1" };
  const body = opts.body ?? {};

  return {
    params,
    locals: { user, session: null },
    request: new Request("http://localhost/api/profile/1", {
      method: opts.method ?? "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    url: new URL("http://localhost/api/profile/1"),
  } as any;
}

describe("PATCH /api/profile/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateWhere.mockResolvedValue({});
  });

  it("rejects unauthenticated", async () => {
    await expect(PATCH(createEvent({ user: null }))).rejects.toMatchObject({
      status: 401,
    });
  });

  it("rejects invalid profile ID", async () => {
    const event = createEvent({ params: { id: "abc" } });
    await expect(PATCH(event)).rejects.toMatchObject({ status: 400 });
  });

  it("rejects when user doesn't own profile", async () => {
    mockFindFirst.mockResolvedValueOnce(null);
    const event = createEvent({ body: { name: "Test" } });
    await expect(PATCH(event)).rejects.toMatchObject({ status: 403 });
  });

  it("rejects empty name", async () => {
    mockFindFirst.mockResolvedValueOnce({ id: 1, slug: "test" });
    const event = createEvent({ body: { name: "" } });
    await expect(PATCH(event)).rejects.toMatchObject({ status: 400 });
  });

  it("rejects slug that's too short", async () => {
    mockFindFirst.mockResolvedValueOnce({ id: 1, slug: "test" });
    const event = createEvent({ body: { slug: "a" } });
    await expect(PATCH(event)).rejects.toMatchObject({ status: 400 });
  });

  it("rejects duplicate slug", async () => {
    mockFindFirst
      .mockResolvedValueOnce({ id: 1, slug: "test" }) // ownership check
      .mockResolvedValueOnce({ id: 2 }); // existing slug
    const event = createEvent({ body: { slug: "taken-slug" } });
    await expect(PATCH(event)).rejects.toMatchObject({ status: 400 });
  });

  it("updates profile with valid data", async () => {
    mockFindFirst
      .mockResolvedValueOnce({ id: 1, slug: "test" }) // ownership check
      .mockResolvedValueOnce(null); // slug not taken
    const event = createEvent({
      body: { name: "New Name", slug: "new-slug", title: "Dev" },
    });
    const response = await PATCH(event);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(mockUpdateFn).toHaveBeenCalled();
    expect(mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "New Name",
        slug: "new-slug",
        title: "Dev",
      }),
    );
  });

  it("only updates allowed fields", async () => {
    mockFindFirst.mockResolvedValueOnce({ id: 1, slug: "test" });
    const event = createEvent({
      body: { name: "Test", user_id: "hacker", is_admin: true },
    });
    const response = await PATCH(event);
    expect(response.status).toBe(200);
    const setCall = mockUpdateSet.mock.calls[0][0];
    expect(setCall.user_id).toBeUndefined();
    expect(setCall.is_admin).toBeUndefined();
    expect(setCall.name).toBe("Test");
  });
});

describe("GET /api/profile/[id]/export.json", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects unauthenticated", async () => {
    await expect(GET(createEvent({ user: null }))).rejects.toMatchObject({
      status: 401,
    });
  });

  it("rejects when user doesn't own profile", async () => {
    mockFindFirst.mockResolvedValueOnce(null);
    const event = createEvent({});
    await expect(GET(event)).rejects.toMatchObject({ status: 403 });
  });

  it("returns 404 when profile not found", async () => {
    mockFindFirst.mockResolvedValueOnce({ id: 1 }); // ownership OK
    mockFindFirst.mockResolvedValueOnce(null); // profile not found
    const event = createEvent({});
    await expect(GET(event)).rejects.toMatchObject({ status: 404 });
  });

  it("exports profile data with correct structure", async () => {
    mockFindFirst.mockResolvedValueOnce({ id: 1 }); // ownership check
    mockFindFirst.mockResolvedValueOnce({
      name: "Alice",
      title: "Developer",
      location: null,
      phone_number: null,
      email_address: "alice@example.com",
      personal_website: null,
      subtitle: null,
      core_stack: null,
      linkedin_profile: null,
      github_profile: null,
      stackoverflow_profile: null,
      headline: null,
      summary: "A developer",
      nationality: null,
      location_url: null,
      location_timezone: null,
      salary_base_rate: null,
      salary_currency: null,
      salary_adjustments: null,
      salary_region_overrides: null,
      application_questions: null,
      profile_versions: [],
      highlights: [],
      tech_skill_categories: [],
      work_experiences: [],
      side_projects: [],
      educations: [],
      languages: [],
      references: [],
      project_stories: [],
      cheat_sheets: [],
    });
    const event = createEvent({});
    const response = await GET(event);
    const data = await response.json();
    expect(data.profile.name).toBe("Alice");
    expect(data.profile.email_address).toBe("alice@example.com");
    expect(data.profile.summary).toBe("A developer");
    expect(data.profile.work_experiences).toEqual([]);
  });
});

describe("PUT /api/profile/[id]/browser-info", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateWhere.mockResolvedValue({});
  });

  it("rejects unauthenticated", async () => {
    await expect(PUT(createEvent({ user: null, method: "PUT", body: {} })))
      .rejects.toMatchObject({ status: 401 });
  });

  it("rejects when user doesn't own profile", async () => {
    mockFindFirst.mockResolvedValueOnce(null);
    const event = createEvent({ method: "PUT", body: {} });
    await expect(PUT(event)).rejects.toMatchObject({ status: 403 });
  });

  it("only updates empty fields by default", async () => {
    mockFindFirst.mockResolvedValueOnce({
      id: 1,
      browser_language: null,
      browser_timezone: null,
    });
    const event = createEvent({
      method: "PUT",
      body: {
        browser_language: "en-US",
        browser_timezone: "Europe/Amsterdam",
      },
    });
    const response = await PUT(event);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.updated).toContain("browser_language");
    expect(data.updated).toContain("browser_timezone");
  });

  it("overwrites all fields when force=true", async () => {
    mockFindFirst.mockResolvedValueOnce({
      id: 1,
      browser_language: "de-DE",
      browser_timezone: "Europe/Berlin",
    });
    const event = createEvent({
      method: "PUT",
      body: {
        force: true,
        browser_language: "en-US",
        browser_timezone: "Europe/Amsterdam",
      },
    });
    const response = await PUT(event);
    const data = await response.json();
    expect(data.updated).toContain("browser_language");
    expect(data.updated).toContain("browser_timezone");
  });

  it("skips update when no new fields provided", async () => {
    mockFindFirst.mockResolvedValueOnce({
      id: 1,
      browser_language: "en",
      browser_timezone: "UTC",
    });
    const event = createEvent({ method: "PUT", body: {} });
    const response = await PUT(event);
    const data = await response.json();
    expect(data.updated).toEqual([]);
    expect(mockUpdateFn).not.toHaveBeenCalled();
  });
});
