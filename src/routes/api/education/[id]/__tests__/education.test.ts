/**
 * Tests for Education API
 * PATCH /api/education/[id]
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFindFirst = vi.fn();
const mockUpdate = vi.fn();

vi.mock("$lib/server/db", () => ({
  dbDirect: {
    education: {
      findFirst: (...a: any[]) => mockFindFirst(...a),
      update: (...a: any[]) => mockUpdate(...a),
    },
  },
}));

import { PATCH } from "../+server";

function createEvent(body: any, opts: {
  user?: any;
  params?: Record<string, string>;
} = {}) {
  return {
    params: opts.params ?? { id: "1" },
    locals: { user: opts.user === undefined ? { id: "user-1" } : opts.user, session: null },
    request: new Request("http://localhost/api/education/1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  } as any;
}

describe("PATCH /api/education/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdate.mockResolvedValue({});
  });

  it("rejects unauthenticated", async () => {
    await expect(PATCH(createEvent({}, { user: null })))
      .rejects.toMatchObject({ status: 401 });
  });

  it("rejects invalid ID", async () => {
    await expect(PATCH(createEvent({}, { params: { id: "abc" } })))
      .rejects.toMatchObject({ status: 400 });
  });

  it("rejects when user doesn't own education record", async () => {
    mockFindFirst.mockResolvedValueOnce({
      id: 1, profiles: { user_id: "other-user" },
    });
    await expect(PATCH(createEvent({ institution: "MIT" })))
      .rejects.toMatchObject({ status: 403 });
  });

  it("rejects when education not found", async () => {
    mockFindFirst.mockResolvedValueOnce(null);
    await expect(PATCH(createEvent({ institution: "MIT" })))
      .rejects.toMatchObject({ status: 403 });
  });

  it("rejects empty institution", async () => {
    mockFindFirst.mockResolvedValueOnce({
      id: 1, profiles: { user_id: "user-1" },
    });
    await expect(PATCH(createEvent({ institution: "" })))
      .rejects.toMatchObject({ status: 400 });
  });

  it("updates education with valid data", async () => {
    mockFindFirst.mockResolvedValueOnce({
      id: 1, profiles: { user_id: "user-1" },
    });
    const res = await PATCH(createEvent({
      institution: "MIT",
      area: "Computer Science",
      graduation_year: "2020",
    }));
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        data: expect.objectContaining({
          institution: "MIT",
          area: "Computer Science",
          graduation_year: 2020,
        }),
      }),
    );
  });

  it("converts date fields to Date objects", async () => {
    mockFindFirst.mockResolvedValueOnce({
      id: 1, profiles: { user_id: "user-1" },
    });
    await PATCH(createEvent({
      start_date: "2016-09-01",
      end_date: "2020-06-15",
    }));
    const updateData = mockUpdate.mock.calls[0][0].data;
    expect(updateData.start_date).toBeInstanceOf(Date);
    expect(updateData.end_date).toBeInstanceOf(Date);
  });

  it("only updates allowed fields", async () => {
    mockFindFirst.mockResolvedValueOnce({
      id: 1, profiles: { user_id: "user-1" },
    });
    await PATCH(createEvent({
      institution: "MIT",
      profile: 999,
      user_id: "hacker",
    }));
    const updateData = mockUpdate.mock.calls[0][0].data;
    expect(updateData.institution).toBe("MIT");
    expect(updateData.profile).toBeUndefined();
    expect(updateData.user_id).toBeUndefined();
  });
});
