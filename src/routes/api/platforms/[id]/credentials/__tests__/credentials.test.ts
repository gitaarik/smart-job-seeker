/**
 * Tests for Platform Credentials API
 * PUT /api/platforms/[id]/credentials
 * DELETE /api/platforms/[id]/credentials
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mockProfilesFindFirst = vi.fn();
const mockPlatformsFindFirst = vi.fn();
const mockPlatformProfilesFindFirst = vi.fn();
const mockPlatformProfilesFindMany = vi.fn();
const mockPlatformProfilesCreate = vi.fn();
const mockPlatformProfilesUpdate = vi.fn();
const mockPlatformProfilesDelete = vi.fn();
const mockPlatformProfilesDeleteMany = vi.fn();
const mockJobSearchesUpdateMany = vi.fn();

vi.mock("$lib/server/db", () => ({
  dbDirect: {
    profiles: { findFirst: (...a: any[]) => mockProfilesFindFirst(...a) },
    job_platforms: { findFirst: (...a: any[]) => mockPlatformsFindFirst(...a) },
    platform_profiles: {
      findFirst: (...a: any[]) => mockPlatformProfilesFindFirst(...a),
      findMany: (...a: any[]) => mockPlatformProfilesFindMany(...a),
      create: (...a: any[]) => mockPlatformProfilesCreate(...a),
      update: (...a: any[]) => mockPlatformProfilesUpdate(...a),
      delete: (...a: any[]) => mockPlatformProfilesDelete(...a),
      deleteMany: (...a: any[]) => mockPlatformProfilesDeleteMany(...a),
    },
    search_tasks: { updateMany: (...a: any[]) => mockJobSearchesUpdateMany(...a) },
  },
}));

import { PUT, DELETE } from "../+server";

function createPutEvent(body: any, user?: any) {
  return {
    params: { id: "5" },
    locals: { user: user === undefined ? { id: "user-1" } : user, session: null },
    request: new Request("http://localhost/api/platforms/5/credentials", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  } as any;
}

function createDeleteEvent(params: Record<string, string>, user?: any) {
  const url = new URL("http://localhost/api/platforms/5/credentials");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return {
    params: { id: "5" },
    locals: { user: user === undefined ? { id: "user-1" } : user, session: null },
    url,
  } as any;
}

describe("PUT /api/platforms/[id]/credentials", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPlatformProfilesCreate.mockResolvedValue({});
    mockPlatformProfilesUpdate.mockResolvedValue({});
  });

  it("rejects unauthenticated", async () => {
    await expect(PUT(createPutEvent({ profileId: 1 }, null))).rejects.toMatchObject({ status: 401 });
  });

  it("rejects missing profileId", async () => {
    await expect(PUT(createPutEvent({ username: "test" }))).rejects.toMatchObject({ status: 400 });
  });

  it("rejects when user doesn't own profile", async () => {
    mockProfilesFindFirst.mockResolvedValueOnce(null);
    await expect(PUT(createPutEvent({ profileId: 1 }))).rejects.toMatchObject({ status: 403 });
  });

  it("rejects when platform doesn't exist", async () => {
    mockProfilesFindFirst.mockResolvedValueOnce({ id: 1 });
    mockPlatformsFindFirst.mockResolvedValueOnce(null);
    await expect(PUT(createPutEvent({ profileId: 1 }))).rejects.toMatchObject({ status: 404 });
  });

  it("creates new credentials when none exist", async () => {
    mockProfilesFindFirst.mockResolvedValueOnce({ id: 1 });
    mockPlatformsFindFirst.mockResolvedValueOnce({ id: 5 });
    mockPlatformProfilesFindFirst.mockResolvedValueOnce(null);

    const response = await PUT(createPutEvent({
      profileId: 1, username: "user@test.com", password: "pass123",
    }));
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(mockPlatformProfilesCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          profile_id: 1, platform_id: 5, username: "user@test.com", password: "pass123",
        }),
      }),
    );
  });

  it("updates existing credentials and clears login_error", async () => {
    mockProfilesFindFirst.mockResolvedValueOnce({ id: 1 });
    mockPlatformsFindFirst.mockResolvedValueOnce({ id: 5 });
    mockPlatformProfilesFindFirst.mockResolvedValueOnce({ id: 10 });

    const response = await PUT(createPutEvent({
      profileId: 1, username: "new@test.com", password: "newpass",
    }));
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(mockPlatformProfilesUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 10 },
        data: expect.objectContaining({
          username: "new@test.com", password: "newpass", login_error: null,
        }),
      }),
    );
  });
});

describe("DELETE /api/platforms/[id]/credentials", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPlatformProfilesDelete.mockResolvedValue({});
    mockPlatformProfilesDeleteMany.mockResolvedValue({});
    mockJobSearchesUpdateMany.mockResolvedValue({});
  });

  it("rejects unauthenticated", async () => {
    await expect(DELETE(createDeleteEvent({ profileId: "1" }, null)))
      .rejects.toMatchObject({ status: 401 });
  });

  it("rejects missing profileId", async () => {
    await expect(DELETE(createDeleteEvent({})))
      .rejects.toMatchObject({ status: 400 });
  });

  it("rejects when user doesn't own profile", async () => {
    mockProfilesFindFirst.mockResolvedValueOnce(null);
    await expect(DELETE(createDeleteEvent({ profileId: "1" })))
      .rejects.toMatchObject({ status: 403 });
  });

  it("deletes specific credential and clears job search references", async () => {
    mockProfilesFindFirst.mockResolvedValueOnce({ id: 1 });
    mockPlatformProfilesFindFirst.mockResolvedValueOnce({ id: 10 });

    const response = await DELETE(createDeleteEvent({
      profileId: "1", credentialId: "10",
    }));
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(mockPlatformProfilesDelete).toHaveBeenCalledWith({ where: { id: 10 } });
    expect(mockJobSearchesUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ platform_profile_id: 10 }),
        data: { platform_profile_id: null },
      }),
    );
  });

  it("returns 404 for non-existent credential", async () => {
    mockProfilesFindFirst.mockResolvedValueOnce({ id: 1 });
    mockPlatformProfilesFindFirst.mockResolvedValueOnce(null);
    await expect(DELETE(createDeleteEvent({ profileId: "1", credentialId: "99" })))
      .rejects.toMatchObject({ status: 404 });
  });

  it("deletes all credentials for platform when no credentialId", async () => {
    mockProfilesFindFirst.mockResolvedValueOnce({ id: 1 });
    mockPlatformProfilesFindMany.mockResolvedValueOnce([{ id: 10 }, { id: 11 }]);

    const response = await DELETE(createDeleteEvent({ profileId: "1" }));
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(mockPlatformProfilesDeleteMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { profile_id: 1, platform_id: 5 } }),
    );
    expect(mockJobSearchesUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          platform_profile_id: { in: [10, 11] },
        }),
      }),
    );
  });
});
