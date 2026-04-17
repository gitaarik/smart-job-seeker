/**
 * Tests for Interview Stories API
 * POST /api/interview-stories (create)
 * PUT /api/interview-stories (update)
 * DELETE /api/interview-stories (delete)
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mockProfilesFindFirst = vi.fn();
const mockStoriesFindFirst = vi.fn();
const mockStoriesCreate = vi.fn();
const mockStoriesUpdate = vi.fn();
const mockStoriesDelete = vi.fn();

vi.mock("$lib/server/db", () => ({
  dbDirect: {
    profiles: { findFirst: (...a: any[]) => mockProfilesFindFirst(...a) },
    project_stories: {
      findFirst: (...a: any[]) => mockStoriesFindFirst(...a),
      create: (...a: any[]) => mockStoriesCreate(...a),
      update: (...a: any[]) => mockStoriesUpdate(...a),
      delete: (...a: any[]) => mockStoriesDelete(...a),
    },
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
  beforeEach(() => vi.clearAllMocks());

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
    mockStoriesCreate.mockResolvedValueOnce({ id: 10, title: "My Story" });

    const res = await POST(createEvent("POST", {
      profile_id: 1,
      title: "My Story",
      category: "leadership",
      situation: "We had a problem",
    }));
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.story.id).toBe(10);
    expect(mockStoriesCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: "My Story",
          category: "leadership",
          situation: "We had a problem",
          sort: 4,
          profile_id: 1,
        }),
      }),
    );
  });

  it("starts sort at 0 when no existing stories", async () => {
    mockProfilesFindFirst.mockResolvedValueOnce({ id: 1 });
    mockStoriesFindFirst.mockResolvedValueOnce(null);
    mockStoriesCreate.mockResolvedValueOnce({ id: 1 });

    await POST(createEvent("POST", { profile_id: 1, title: "First" }));
    expect(mockStoriesCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ sort: 0 }),
      }),
    );
  });
});

describe("PUT /api/interview-stories", () => {
  beforeEach(() => vi.clearAllMocks());

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
    mockStoriesUpdate.mockResolvedValueOnce({ id: 5, title: "Updated" });

    const res = await PUT(createEvent("PUT", {
      profile_id: 1, id: 5, title: "Updated", situation: "New situation",
    }));
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(mockStoriesUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 5 },
        data: expect.objectContaining({ title: "Updated", situation: "New situation" }),
      }),
    );
  });
});

describe("DELETE /api/interview-stories", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStoriesDelete.mockResolvedValue({});
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
    expect(mockStoriesDelete).toHaveBeenCalledWith({ where: { id: 5 } });
  });
});
