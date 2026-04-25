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

// Mock Drizzle update chain
const mockUpdateWhere = vi.fn().mockResolvedValue({});
const mockUpdateSet = vi.fn().mockReturnValue({ where: mockUpdateWhere });
const mockUpdateFn = vi.fn().mockReturnValue({ set: mockUpdateSet });

// Mock Drizzle insert chain
const mockInsertValues = vi.fn().mockResolvedValue({});
const mockInsertFn = vi.fn().mockReturnValue({ values: mockInsertValues });

// Mock Drizzle delete chain
const mockDeleteWhere = vi.fn().mockResolvedValue({});
const mockDeleteFn = vi.fn().mockReturnValue({ where: mockDeleteWhere });

vi.mock("$lib/server/db", () => ({
  dbDirect: {
    query: {
      profiles: { findFirst: (...a: any[]) => mockProfilesFindFirst(...a) },
      job_platforms: { findFirst: (...a: any[]) => mockPlatformsFindFirst(...a) },
      platform_profiles: {
        findFirst: (...a: any[]) => mockPlatformProfilesFindFirst(...a),
        findMany: (...a: any[]) => mockPlatformProfilesFindMany(...a),
      },
    },
    update: (...a: any[]) => mockUpdateFn(...a),
    insert: (...a: any[]) => mockInsertFn(...a),
    delete: (...a: any[]) => mockDeleteFn(...a),
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_col: any, val: any) => val),
  and: vi.fn((...args: any[]) => args),
  inArray: vi.fn((_col: any, vals: any[]) => vals),
}));

vi.mock("$lib/server/db/schema", () => ({
  profiles: { id: "profiles.id", user_id: "profiles.user_id" },
  job_platforms: { id: "job_platforms.id", status: "job_platforms.status" },
  platform_profiles: {
    id: "platform_profiles.id",
    profile_id: "platform_profiles.profile_id",
    platform_id: "platform_profiles.platform_id",
  },
  search_tasks: {
    platform_profile_id: "search_tasks.platform_profile_id",
    profile_id: "search_tasks.profile_id",
  },
}));

vi.mock("$lib/server/auth/crypto", () => ({
  encryptCredential: (v: any) => v,
  decryptCredential: (v: any) => v,
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
    mockUpdateWhere.mockResolvedValue({});
    mockInsertValues.mockResolvedValue({});
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
    // Verify insert was called
    expect(mockInsertFn).toHaveBeenCalled();
    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        profile_id: 1, platform_id: 5, username: "user@test.com", password: "pass123",
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
    // Verify update was called
    expect(mockUpdateFn).toHaveBeenCalled();
    expect(mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        username: "new@test.com", password: "newpass", login_error: null,
      }),
    );
  });
});

describe("DELETE /api/platforms/[id]/credentials", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDeleteWhere.mockResolvedValue({});
    mockUpdateWhere.mockResolvedValue({});
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
    // Verify delete was called
    expect(mockDeleteFn).toHaveBeenCalled();
    // Verify update was called for clearing search task references
    expect(mockUpdateFn).toHaveBeenCalled();
    expect(mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({ platform_profile_id: null }),
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
    // Verify delete was called
    expect(mockDeleteFn).toHaveBeenCalled();
    // Verify update was called for clearing search task references
    expect(mockUpdateFn).toHaveBeenCalled();
  });
});
