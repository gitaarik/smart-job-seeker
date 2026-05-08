/**
 * Tests for the credential / device coupling invariant on
 * PATCH /api/import-tasks/[id].
 *
 * The invariant:
 *   - The user must own the credential, OR have it shared with them.
 *   - If the credential is shared, the task's sjsbrowser_api_key must be a
 *     device owned by the credential's owner. (Cookies, IP, fingerprint
 *     are tied together — running shared creds on a stranger's device
 *     would defeat the point.)
 *
 * These tests mock the DB so we focus purely on the validation logic.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const OWNER = "user-owner";
const CONTACT = "user-contact";

// ── DB mocks ───────────────────────────────────────────────────────────────
const mockSearchTasksFindFirst = vi.fn();
const mockPlatformProfilesFindFirst = vi.fn();
const mockApiKeysFindFirst = vi.fn();
const mockUsersFindFirst = vi.fn();

const mockUpdateWhere = vi.fn().mockResolvedValue({});
const mockUpdateSet = vi.fn().mockReturnValue({ where: mockUpdateWhere });
const mockUpdateFn = vi.fn().mockReturnValue({ set: mockUpdateSet });

vi.mock("$lib/server/db", () => ({
  dbDirect: {
    query: {
      search_tasks: {
        findFirst: (...a: any[]) => mockSearchTasksFindFirst(...a),
      },
      platform_profiles: {
        findFirst: (...a: any[]) => mockPlatformProfilesFindFirst(...a),
      },
      api_keys: { findFirst: (...a: any[]) => mockApiKeysFindFirst(...a) },
      users: { findFirst: (...a: any[]) => mockUsersFindFirst(...a) },
    },
    update: (...a: any[]) => mockUpdateFn(...a),
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((col: any, val: any) => ({ kind: "eq", col, val })),
  and: vi.fn((...args: any[]) => ({ kind: "and", args })),
}));

vi.mock("$lib/server/db/schema", () => ({
  api_keys: { id: "api_keys.id" },
  platform_profiles: { id: "platform_profiles.id" },
  search_tasks: { id: "search_tasks.id" },
  users: { id: "users.id" },
}));

vi.mock("$lib/server/utils/api-helpers", () => ({
  requireAuth: (locals: any) => {
    if (!locals?.user) throw new Error("not authed");
    return locals.user;
  },
  parseIntParam: (val: string) => parseInt(val, 10),
}));

vi.mock("$lib/server/validation/api-schemas", () => ({
  searchTaskUpdateSchema: { _: "schema" },
  parseBody: (_schema: any, body: any) => body,
}));

const mockHasDeviceAccess = vi.fn();
vi.mock("$lib/server/device-shares", () => ({
  hasDeviceAccess: (...a: any[]) => mockHasDeviceAccess(...a),
}));

const mockHasCredentialAccess = vi.fn();
vi.mock("$lib/server/credential-shares", () => ({
  hasCredentialAccess: (...a: any[]) => mockHasCredentialAccess(...a),
}));

vi.mock("$lib/server/auth/crypto", () => ({
  encryptCredential: (v: any) => v,
}));

import { PATCH } from "../+server";

// ── Helpers ────────────────────────────────────────────────────────────────
function createPatchEvent(body: any, user = { id: CONTACT }) {
  return {
    params: { id: "1" },
    locals: { user, session: null },
    request: new Request("http://localhost/api/import-tasks/1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  } as any;
}

const TASK_OWNED_BY_CONTACT = {
  id: 1,
  profile_id: 100,
  platform_id: 5,
  platform_profile_id: null,
  sjsbrowser_api_key: null,
  schedule_interval_hours: null,
  schedule_preferred_hour: 9,
  profile: { user_id: CONTACT },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockUpdateWhere.mockResolvedValue({});
  mockSearchTasksFindFirst.mockResolvedValue(TASK_OWNED_BY_CONTACT);
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe("PATCH /api/import-tasks/[id] — credential coupling", () => {
  it("allows picking own credential without a device", async () => {
    // Credential owned by the contact (caller) — coupling check is skipped.
    mockPlatformProfilesFindFirst
      .mockResolvedValueOnce({ // existence + platform check
        id: 7,
        platform_id: 5,
        profile_id: 100,
      })
      .mockResolvedValueOnce({ // post-update coupling lookup
        id: 7,
        profile: { user_id: CONTACT },
      });
    mockHasCredentialAccess.mockResolvedValueOnce(true);

    const res = await PATCH(createPatchEvent({ platform_profile_id: 7 }));

    expect(res.status).toBe(200);
    expect(mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({ platform_profile_id: 7 }),
    );
    // No device coupling check ran, so api_keys.findFirst stayed cold.
    expect(mockApiKeysFindFirst).not.toHaveBeenCalled();
  });

  it("rejects a shared credential when no device is set on the task", async () => {
    mockPlatformProfilesFindFirst
      .mockResolvedValueOnce({ id: 7, platform_id: 5, profile_id: 200 })
      .mockResolvedValueOnce({
        id: 7,
        profile: { user_id: OWNER },
      });
    mockHasCredentialAccess.mockResolvedValueOnce(true);

    await expect(
      PATCH(createPatchEvent({ platform_profile_id: 7 })),
    ).rejects.toMatchObject({ status: 400 });

    expect(mockUpdateSet).not.toHaveBeenCalled();
  });

  it("rejects a shared credential paired with a device owned by someone else", async () => {
    mockPlatformProfilesFindFirst
      .mockResolvedValueOnce({ id: 7, platform_id: 5, profile_id: 200 })
      .mockResolvedValueOnce({
        id: 7,
        profile: { user_id: OWNER },
      });
    mockHasCredentialAccess.mockResolvedValueOnce(true);
    mockHasDeviceAccess.mockResolvedValueOnce(true); // contact has share to the (wrong) device
    mockApiKeysFindFirst.mockResolvedValueOnce({
      id: 99,
      profile: { user_id: CONTACT }, // owned by contact, not OWNER
    });

    await expect(
      PATCH(
        createPatchEvent({ platform_profile_id: 7, sjsbrowser_api_key: 99 }),
      ),
    ).rejects.toMatchObject({ status: 400 });

    expect(mockUpdateSet).not.toHaveBeenCalled();
  });

  it("accepts a shared credential paired with the credential owner's device", async () => {
    mockPlatformProfilesFindFirst
      .mockResolvedValueOnce({ id: 7, platform_id: 5, profile_id: 200 })
      .mockResolvedValueOnce({
        id: 7,
        profile: { user_id: OWNER },
      });
    mockHasCredentialAccess.mockResolvedValueOnce(true);
    mockHasDeviceAccess.mockResolvedValueOnce(true);
    mockApiKeysFindFirst.mockResolvedValueOnce({
      id: 42,
      profile: { user_id: OWNER }, // matches the credential owner
    });

    const res = await PATCH(
      createPatchEvent({ platform_profile_id: 7, sjsbrowser_api_key: 42 }),
    );

    expect(res.status).toBe(200);
    expect(mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        platform_profile_id: 7,
        sjsbrowser_api_key: 42,
      }),
    );
  });

  it("rejects a credential whose platform doesn't match the task's platform", async () => {
    mockPlatformProfilesFindFirst.mockResolvedValueOnce({
      id: 7,
      platform_id: 99, // task is on platform 5
      profile_id: 100,
    });

    await expect(
      PATCH(createPatchEvent({ platform_profile_id: 7 })),
    ).rejects.toMatchObject({ status: 400 });
    expect(mockHasCredentialAccess).not.toHaveBeenCalled();
    expect(mockUpdateSet).not.toHaveBeenCalled();
  });

  it("rejects a credential the caller has no access to", async () => {
    mockPlatformProfilesFindFirst.mockResolvedValueOnce({
      id: 7,
      platform_id: 5,
      profile_id: 200,
    });
    mockHasCredentialAccess.mockResolvedValueOnce(false);

    await expect(
      PATCH(createPatchEvent({ platform_profile_id: 7 })),
    ).rejects.toMatchObject({ status: 403 });
    expect(mockUpdateSet).not.toHaveBeenCalled();
  });

  it("validates coupling against the post-update state when only the device changes", async () => {
    // Task already has a shared credential; the user is now patching only
    // sjsbrowser_api_key. The validation should re-check the (existing cred,
    // new device) pairing.
    mockSearchTasksFindFirst.mockResolvedValueOnce({
      ...TASK_OWNED_BY_CONTACT,
      platform_profile_id: 7, // already-saved shared credential
    });
    mockHasDeviceAccess.mockResolvedValueOnce(true);
    mockPlatformProfilesFindFirst.mockResolvedValueOnce({
      id: 7,
      profile: { user_id: OWNER },
    });
    mockApiKeysFindFirst.mockResolvedValueOnce({
      id: 99,
      profile: { user_id: CONTACT }, // contact's own — wrong owner
    });

    await expect(
      PATCH(createPatchEvent({ sjsbrowser_api_key: 99 })),
    ).rejects.toMatchObject({ status: 400 });
    expect(mockUpdateSet).not.toHaveBeenCalled();
  });
});
