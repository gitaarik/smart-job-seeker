/**
 * Tests for Job Preferences API
 * PUT /api/job-preferences
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mockProfilesFindFirst = vi.fn();
const mockConfigFindFirst = vi.fn();

// Mock Drizzle insert chain
const mockInsertReturning = vi.fn();
const mockInsertValues = vi.fn().mockReturnValue({ returning: mockInsertReturning });
const mockInsertFn = vi.fn().mockReturnValue({ values: mockInsertValues });

// Mock Drizzle update chain
const mockUpdateReturning = vi.fn();
const mockUpdateWhere = vi.fn().mockReturnValue({ returning: mockUpdateReturning });
const mockUpdateSet = vi.fn().mockReturnValue({ where: mockUpdateWhere });
const mockUpdateFn = vi.fn().mockReturnValue({ set: mockUpdateSet });

vi.mock("$lib/server/db", () => ({
  dbDirect: {
    query: {
      profiles: { findFirst: (...a: any[]) => mockProfilesFindFirst(...a) },
      match_config: {
        findFirst: (...a: any[]) => mockConfigFindFirst(...a),
      },
    },
    insert: (...a: any[]) => mockInsertFn(...a),
    update: (...a: any[]) => mockUpdateFn(...a),
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_col: any, val: any) => val),
  and: vi.fn((...args: any[]) => args),
}));

vi.mock("$lib/server/db/schema", () => ({
  profiles: { id: "profiles.id", user_id: "profiles.user_id" },
  match_config: {
    id: "match_config.id",
    profile_id: "match_config.profile_id",
  },
}));

import { PUT } from "../+server";

function createEvent(body: any, user?: any) {
  return {
    locals: { user: user === undefined ? { id: "user-1" } : user, session: null },
    request: new Request("http://localhost/api/job-preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  } as any;
}

describe("PUT /api/job-preferences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsertReturning.mockResolvedValue([{ id: 42 }]);
    mockUpdateReturning.mockResolvedValue([{ id: 42 }]);
  });

  it("rejects unauthenticated", async () => {
    await expect(PUT(createEvent({}, null))).rejects.toMatchObject({ status: 401 });
  });

  it("rejects missing profile_id", async () => {
    await expect(PUT(createEvent({ job_types: ["full-time"] }))).rejects.toMatchObject({ status: 400 });
  });

  it("rejects when user doesn't own profile", async () => {
    mockProfilesFindFirst.mockResolvedValueOnce(null);
    const res = await PUT(createEvent({
      profile_id: 1, job_types: ["full-time"], work_location: ["remote"],
    }));
    expect(res.status).toBe(404);
  });

  it("rejects empty job_types", async () => {
    await expect(PUT(createEvent({
      profile_id: 1, job_types: [], work_location: ["remote"],
    }))).rejects.toMatchObject({ status: 400 });
  });

  it("rejects empty work_location", async () => {
    await expect(PUT(createEvent({
      profile_id: 1, job_types: ["full-time"], work_location: [],
    }))).rejects.toMatchObject({ status: 400 });
  });

  it("creates new config when none exists", async () => {
    mockProfilesFindFirst.mockResolvedValueOnce({ id: 1 });
    mockConfigFindFirst.mockResolvedValueOnce(null);
    mockInsertReturning.mockResolvedValueOnce([{ id: 42 }]);

    const res = await PUT(createEvent({
      profile_id: 1,
      job_types: ["full-time", "contract"],
      work_location: ["remote", "hybrid"],
      locations: ["Amsterdam", "Berlin"],
    }));
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.id).toBe(42);
    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        profile_id: 1,
        job_types: ["full-time", "contract"],
        work_location: ["remote", "hybrid"],
        locations: ["Amsterdam", "Berlin"],
      }),
    );
  });

  it("updates existing config", async () => {
    mockProfilesFindFirst.mockResolvedValueOnce({ id: 1 });
    mockConfigFindFirst.mockResolvedValueOnce({ id: 42 });
    mockUpdateReturning.mockResolvedValueOnce([{ id: 42 }]);

    const res = await PUT(createEvent({
      profile_id: 1,
      job_types: ["full-time"],
      work_location: ["onsite"],
    }));
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(mockUpdateFn).toHaveBeenCalled();
  });

  it("nullifies empty optional arrays", async () => {
    mockProfilesFindFirst.mockResolvedValueOnce({ id: 1 });
    mockConfigFindFirst.mockResolvedValueOnce(null);
    mockInsertReturning.mockResolvedValueOnce([{ id: 1 }]);

    await PUT(createEvent({
      profile_id: 1,
      job_types: ["full-time"],
      work_location: ["remote"],
      experience_levels: [],
      locations: [],
    }));
    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        experience_levels: null,
        locations: null,
      }),
    );
  });
});
