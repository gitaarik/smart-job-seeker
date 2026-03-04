/**
 * Tests for Job Preferences API
 * PUT /api/job-preferences
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mockProfilesFindFirst = vi.fn();
const mockConfigFindFirst = vi.fn();
const mockConfigCreate = vi.fn();
const mockConfigUpdate = vi.fn();

vi.mock("$lib/server/db", () => ({
  dbDirect: {
    profiles: { findFirst: (...a: any[]) => mockProfilesFindFirst(...a) },
    job_match_config: {
      findFirst: (...a: any[]) => mockConfigFindFirst(...a),
      create: (...a: any[]) => mockConfigCreate(...a),
      update: (...a: any[]) => mockConfigUpdate(...a),
    },
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
  beforeEach(() => vi.clearAllMocks());

  it("rejects unauthenticated", async () => {
    const res = await PUT(createEvent({}, null));
    expect(res.status).toBe(401);
  });

  it("rejects missing profile_id", async () => {
    const res = await PUT(createEvent({ job_types: ["full-time"] }));
    expect(res.status).toBe(400);
  });

  it("rejects when user doesn't own profile", async () => {
    mockProfilesFindFirst.mockResolvedValueOnce(null);
    const res = await PUT(createEvent({
      profile_id: 1, job_types: ["full-time"], work_location: ["remote"],
    }));
    expect(res.status).toBe(404);
  });

  it("rejects empty job_types", async () => {
    mockProfilesFindFirst.mockResolvedValueOnce({ id: 1 });
    const res = await PUT(createEvent({
      profile_id: 1, job_types: [], work_location: ["remote"],
    }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("job type");
  });

  it("rejects empty work_location", async () => {
    mockProfilesFindFirst.mockResolvedValueOnce({ id: 1 });
    const res = await PUT(createEvent({
      profile_id: 1, job_types: ["full-time"], work_location: [],
    }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("work location");
  });

  it("creates new config when none exists", async () => {
    mockProfilesFindFirst.mockResolvedValueOnce({ id: 1 });
    mockConfigFindFirst.mockResolvedValueOnce(null);
    mockConfigCreate.mockResolvedValueOnce({ id: 42 });

    const res = await PUT(createEvent({
      profile_id: 1,
      job_types: ["full-time", "contract"],
      work_location: ["remote", "hybrid"],
      locations: ["Amsterdam", "Berlin"],
    }));
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.id).toBe(42);
    expect(mockConfigCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          profile: 1,
          job_types: ["full-time", "contract"],
          work_location: ["remote", "hybrid"],
          locations: ["Amsterdam", "Berlin"],
        }),
      }),
    );
  });

  it("updates existing config", async () => {
    mockProfilesFindFirst.mockResolvedValueOnce({ id: 1 });
    mockConfigFindFirst.mockResolvedValueOnce({ id: 42 });
    mockConfigUpdate.mockResolvedValueOnce({ id: 42 });

    const res = await PUT(createEvent({
      profile_id: 1,
      job_types: ["full-time"],
      work_location: ["onsite"],
    }));
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(mockConfigUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 42 } }),
    );
  });

  it("nullifies empty optional arrays", async () => {
    mockProfilesFindFirst.mockResolvedValueOnce({ id: 1 });
    mockConfigFindFirst.mockResolvedValueOnce(null);
    mockConfigCreate.mockResolvedValueOnce({ id: 1 });

    await PUT(createEvent({
      profile_id: 1,
      job_types: ["full-time"],
      work_location: ["remote"],
      experience_levels: [],
      locations: [],
    }));
    expect(mockConfigCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          experience_levels: null,
          locations: null,
        }),
      }),
    );
  });
});
