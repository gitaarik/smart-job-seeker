/**
 * Tests for Profile API endpoints
 * PATCH /api/profile/[id]
 * GET /api/profile/[id]/export.json
 * PUT /api/profile/[id]/browser-info
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFindFirst = vi.fn();
const mockFindUnique = vi.fn();
const mockUpdate = vi.fn();

vi.mock("$lib/server/db", () => ({
  db: {
    profiles: {
      findFirst: (...a: any[]) => mockFindFirst(...a),
      update: (...a: any[]) => mockUpdate(...a),
    },
  },
  dbDirect: {
    profiles: {
      findFirst: (...a: any[]) => mockFindFirst(...a),
      findUnique: (...a: any[]) => mockFindUnique(...a),
      update: (...a: any[]) => mockUpdate(...a),
    },
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
    mockUpdate.mockResolvedValue({});
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
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        data: expect.objectContaining({
          name: "New Name",
          slug: "new-slug",
          title: "Dev",
        }),
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
    const updateCall = mockUpdate.mock.calls[0][0];
    expect(updateCall.data.user_id).toBeUndefined();
    expect(updateCall.data.is_admin).toBeUndefined();
    expect(updateCall.data.name).toBe("Test");
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
    mockFindUnique.mockResolvedValueOnce(null); // profile not found
    const event = createEvent({});
    await expect(GET(event)).rejects.toMatchObject({ status: 404 });
  });

  it("exports profile data with correct structure", async () => {
    mockFindFirst.mockResolvedValueOnce({ id: 1 });
    mockFindUnique.mockResolvedValueOnce({
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
      application_questions: null,
      profile_versions_profile_versions_profileToprofiles: [],
      highlights: [],
      tech_skill_categories: [],
      work_experiences: [],
      side_projects: [],
      education: [],
      languages: [],
      references: [],
      project_stories: [],
      cheat_sheets: [],
      salary_expectations: [],
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
    mockUpdate.mockResolvedValue({});
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
      browser_user_agent: "existing-ua",
      browser_language: null,
      browser_timezone: null,
    });
    const event = createEvent({
      method: "PUT",
      body: {
        browser_user_agent: "new-ua",
        browser_language: "en-US",
        browser_timezone: "Europe/Amsterdam",
      },
    });
    const response = await PUT(event);
    const data = await response.json();
    expect(data.success).toBe(true);
    // Should NOT update user_agent (already set), but SHOULD update language + timezone
    expect(data.updated).not.toContain("browser_user_agent");
    expect(data.updated).toContain("browser_language");
    expect(data.updated).toContain("browser_timezone");
  });

  it("overwrites all fields when force=true", async () => {
    mockFindFirst.mockResolvedValueOnce({
      id: 1,
      browser_user_agent: "existing-ua",
      browser_language: "de-DE",
      browser_timezone: "Europe/Berlin",
    });
    const event = createEvent({
      method: "PUT",
      body: {
        force: true,
        browser_user_agent: "new-ua",
        browser_language: "en-US",
        browser_timezone: "Europe/Amsterdam",
      },
    });
    const response = await PUT(event);
    const data = await response.json();
    expect(data.updated).toContain("browser_user_agent");
    expect(data.updated).toContain("browser_language");
    expect(data.updated).toContain("browser_timezone");
  });

  it("skips update when no new fields provided", async () => {
    mockFindFirst.mockResolvedValueOnce({
      id: 1,
      browser_user_agent: "existing",
      browser_language: "en",
      browser_timezone: "UTC",
    });
    const event = createEvent({ method: "PUT", body: {} });
    const response = await PUT(event);
    const data = await response.json();
    expect(data.updated).toEqual([]);
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
