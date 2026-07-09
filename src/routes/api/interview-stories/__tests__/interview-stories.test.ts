/**
 * Tests for Interview Stories API
 * POST /api/interview-stories (create)
 * PUT /api/interview-stories (update)
 * DELETE /api/interview-stories (delete)
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mockProfilesFindFirst = vi.fn();
const mockStoriesFindFirst = vi.fn();

// Mock Drizzle insert chain
const mockInsertReturning = vi.fn();
const mockInsertValues = vi.fn().mockReturnValue({ returning: mockInsertReturning });
const mockInsertFn = vi.fn().mockReturnValue({ values: mockInsertValues });

// Mock Drizzle update chain
const mockUpdateReturning = vi.fn();
const mockUpdateWhere = vi.fn().mockReturnValue({ returning: mockUpdateReturning });
const mockUpdateSet = vi.fn().mockReturnValue({ where: mockUpdateWhere });
const mockUpdateFn = vi.fn().mockReturnValue({ set: mockUpdateSet });

// Mock Drizzle delete chain
const mockDeleteWhere = vi.fn().mockResolvedValue({});
const mockDeleteFn = vi.fn().mockReturnValue({ where: mockDeleteWhere });

vi.mock("$lib/server/db", () => ({
  dbDirect: {
    query: {
      profiles: { findFirst: (...a: any[]) => mockProfilesFindFirst(...a) },
      project_stories: {
        findFirst: (...a: any[]) => mockStoriesFindFirst(...a),
      },
    },
    insert: (...a: any[]) => mockInsertFn(...a),
    update: (...a: any[]) => mockUpdateFn(...a),
    delete: (...a: any[]) => mockDeleteFn(...a),
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_col: any, val: any) => val),
  and: vi.fn((...args: any[]) => args),
  desc: vi.fn(),
}));

vi.mock("$lib/server/db/schema", () => ({
  profiles: { id: "profiles.id", user_id: "profiles.user_id" },
  project_stories: {
    id: "project_stories.id",
    profile_id: "project_stories.profile_id",
    sort: "project_stories.sort",
  },
}));

import { POST, PUT, DELETE } from "../+server";

function createEvent(method: string, body: any, user?: any) {
  return {
    locals: { user: user === undefined ? { id: "user-1" } : user, session: null },
    request: new Request("http://localhost/api/interview-stories", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  } as any;
}

describe("POST /api/interview-stories", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsertReturning.mockResolvedValue([{ id: 10, title: "Test" }]);
  });

  it("rejects unauthenticated", async () => {
    await expect(POST(createEvent("POST", {}, null))).rejects.toMatchObject({ status: 401 });
  });

  it("rejects missing profile_id", async () => {
    await expect(POST(createEvent("POST", { title: "Test" }))).rejects.toMatchObject({ status: 400 });
  });

  it("rejects when user doesn't own profile", async () => {
    mockProfilesFindFirst.mockResolvedValueOnce(null);
    const res = await POST(createEvent("POST", { profile_id: 1, title: "Test" }));
    expect(res.status).toBe(404);
  });

  it("rejects empty title", async () => {
    await expect(POST(createEvent("POST", { profile_id: 1, title: "" }))).rejects.toMatchObject({ status: 400 });
  });

  it("creates story with auto-increment sort", async () => {
    mockProfilesFindFirst.mockResolvedValueOnce({ id: 1 });
    mockStoriesFindFirst.mockResolvedValueOnce({ sort: 3 }); // last sort = 3
    mockInsertReturning.mockResolvedValueOnce([{ id: 10, title: "My Story" }]);

    const res = await POST(createEvent("POST", {
      profile_id: 1,
      title: "My Story",
      category: "leadership",
      situation: "We had a problem",
    }));
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.story.id).toBe(10);
    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "My Story",
        category: "leadership",
        situation: "We had a problem",
        sort: 4,
        profile_id: 1,
      }),
    );
  });

  it("starts sort at 0 when no existing stories", async () => {
    mockProfilesFindFirst.mockResolvedValueOnce({ id: 1 });
    mockStoriesFindFirst.mockResolvedValueOnce(null);
    mockInsertReturning.mockResolvedValueOnce([{ id: 1 }]);

    await POST(createEvent("POST", { profile_id: 1, title: "First" }));
    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({ sort: 0 }),
    );
  });

  it("bumps the profile's date_updated so the match snapshot re-exports", async () => {
    mockProfilesFindFirst.mockResolvedValueOnce({ id: 1 });
    mockStoriesFindFirst.mockResolvedValueOnce(null);
    mockInsertReturning.mockResolvedValueOnce([{ id: 1 }]);

    await POST(createEvent("POST", { profile_id: 1, title: "First" }));

    // touchProfile runs db.update(profiles).set({ date_updated }) on success.
    expect(mockUpdateFn).toHaveBeenCalledWith(
      expect.objectContaining({ id: "profiles.id" }),
    );
    expect(mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({ date_updated: expect.any(Date) }),
    );
  });
});

describe("PUT /api/interview-stories", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateReturning.mockResolvedValue([{ id: 5, title: "Updated" }]);
  });

  it("rejects unauthenticated", async () => {
    await expect(PUT(createEvent("PUT", {}, null))).rejects.toMatchObject({ status: 401 });
  });

  it("rejects missing story ID", async () => {
    await expect(PUT(createEvent("PUT", { profile_id: 1, title: "Test" }))).rejects.toMatchObject({ status: 400 });
  });

  it("rejects when story doesn't belong to profile", async () => {
    mockProfilesFindFirst.mockResolvedValueOnce({ id: 1 });
    mockStoriesFindFirst.mockResolvedValueOnce(null);
    const res = await PUT(createEvent("PUT", { profile_id: 1, id: 99, title: "Test" }));
    expect(res.status).toBe(404);
  });

  it("updates story successfully", async () => {
    mockProfilesFindFirst.mockResolvedValueOnce({ id: 1 });
    mockStoriesFindFirst.mockResolvedValueOnce({ id: 5 });
    mockUpdateReturning.mockResolvedValueOnce([{ id: 5, title: "Updated" }]);

    const res = await PUT(createEvent("PUT", {
      profile_id: 1, id: 5, title: "Updated", situation: "New situation",
    }));
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Updated", situation: "New situation" }),
    );
  });
});

describe("DELETE /api/interview-stories", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDeleteWhere.mockResolvedValue({});
  });

  it("rejects unauthenticated", async () => {
    await expect(DELETE(createEvent("DELETE", {}, null))).rejects.toMatchObject({ status: 401 });
  });

  it("rejects when story doesn't belong to profile", async () => {
    mockProfilesFindFirst.mockResolvedValueOnce({ id: 1 });
    mockStoriesFindFirst.mockResolvedValueOnce(null);
    const res = await DELETE(createEvent("DELETE", { profile_id: 1, id: 99 }));
    expect(res.status).toBe(404);
  });

  it("deletes story successfully", async () => {
    mockProfilesFindFirst.mockResolvedValueOnce({ id: 1 });
    mockStoriesFindFirst.mockResolvedValueOnce({ id: 5 });
    const res = await DELETE(createEvent("DELETE", { profile_id: 1, id: 5 }));
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(mockDeleteFn).toHaveBeenCalled();
  });
});
