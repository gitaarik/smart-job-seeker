/**
 * Tests for Scraper Respond API
 * POST /api/job-searches/[id]/runs/[runId]/respond
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mockJobSearchesFindFirst = vi.fn();
const mockJobSearchesUpdate = vi.fn();
const mockRunsFindFirst = vi.fn();
const mockRunsUpdate = vi.fn();

vi.mock("$lib/server/db", () => ({
  dbDirect: {
    job_searches: {
      findFirst: (...a: any[]) => mockJobSearchesFindFirst(...a),
      update: (...a: any[]) => mockJobSearchesUpdate(...a),
    },
    job_search_runs: {
      findFirst: (...a: any[]) => mockRunsFindFirst(...a),
      update: (...a: any[]) => mockRunsUpdate(...a),
    },
  },
}));

import { POST } from "../+server";

function createEvent(body: any, opts: {
  user?: any;
  params?: Record<string, string>;
} = {}) {
  return {
    params: opts.params ?? { id: "1", runId: "10" },
    locals: { user: opts.user === undefined ? { id: "user-1" } : opts.user, session: null },
    request: new Request("http://localhost/api/job-searches/1/runs/10/respond", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  } as any;
}

describe("POST /api/job-searches/[id]/runs/[runId]/respond", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRunsUpdate.mockResolvedValue({});
    mockJobSearchesUpdate.mockResolvedValue({});
  });

  it("rejects unauthenticated", async () => {
    await expect(POST(createEvent({ response: "continue" }, { user: null })))
      .rejects.toMatchObject({ status: 401 });
  });

  it("rejects invalid IDs", async () => {
    await expect(POST(createEvent(
      { response: "continue" },
      { params: { id: "abc", runId: "10" } },
    ))).rejects.toMatchObject({ status: 400 });
  });

  it("rejects invalid response value", async () => {
    await expect(POST(createEvent({ response: "hack" })))
      .rejects.toMatchObject({ status: 400 });
  });

  it("rejects missing response", async () => {
    await expect(POST(createEvent({})))
      .rejects.toMatchObject({ status: 400 });
  });

  it("rejects when user doesn't own job search", async () => {
    mockJobSearchesFindFirst.mockResolvedValueOnce({
      id: 1,
      profiles: { user_id: "other-user" },
    });
    await expect(POST(createEvent({ response: "continue" })))
      .rejects.toMatchObject({ status: 403 });
  });

  it("rejects when job search not found", async () => {
    mockJobSearchesFindFirst.mockResolvedValueOnce(null);
    await expect(POST(createEvent({ response: "continue" })))
      .rejects.toMatchObject({ status: 404 });
  });

  it("rejects when run not found", async () => {
    mockJobSearchesFindFirst.mockResolvedValueOnce({
      id: 1, profiles: { user_id: "user-1" },
    });
    mockRunsFindFirst.mockResolvedValueOnce(null);
    await expect(POST(createEvent({ response: "continue" })))
      .rejects.toMatchObject({ status: 404 });
  });

  it("rejects when run is not active", async () => {
    mockJobSearchesFindFirst.mockResolvedValueOnce({
      id: 1, profiles: { user_id: "user-1" },
    });
    mockRunsFindFirst.mockResolvedValueOnce({ id: 10, status: "completed" });
    await expect(POST(createEvent({ response: "continue" })))
      .rejects.toMatchObject({ status: 400 });
  });

  it("records 'continue' response", async () => {
    mockJobSearchesFindFirst.mockResolvedValueOnce({
      id: 1, profiles: { user_id: "user-1" },
    });
    mockRunsFindFirst.mockResolvedValueOnce({ id: 10, status: "running" });

    const res = await POST(createEvent({ response: "continue" }));
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.response).toBe("continue");
    expect(mockRunsUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 10 },
        data: { user_response: "continue" },
      }),
    );
    expect(mockJobSearchesUpdate).not.toHaveBeenCalled();
  });

  it("records 'skip' response", async () => {
    mockJobSearchesFindFirst.mockResolvedValueOnce({
      id: 1, profiles: { user_id: "user-1" },
    });
    mockRunsFindFirst.mockResolvedValueOnce({ id: 10, status: "blocked" });

    const res = await POST(createEvent({ response: "skip" }));
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.response).toBe("skip");
  });

  it("cancels run and job search on 'cancel'", async () => {
    mockJobSearchesFindFirst.mockResolvedValueOnce({
      id: 1, profiles: { user_id: "user-1" },
    });
    mockRunsFindFirst.mockResolvedValueOnce({ id: 10, status: "running" });

    const res = await POST(createEvent({ response: "cancel" }));
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.message).toBe("Run cancelled");

    // Run should be cancelled
    expect(mockRunsUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          user_response: "cancel",
          status: "cancelled",
        }),
      }),
    );

    // Job search should also be cancelled
    expect(mockJobSearchesUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        data: expect.objectContaining({
          status: "cancelled",
          status_message: "Cancelled by user",
        }),
      }),
    );
  });
});
