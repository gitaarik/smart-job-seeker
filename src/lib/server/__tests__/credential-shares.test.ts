/**
 * Tests for credential sharing service.
 *
 * Focus is on the security invariants:
 *   - shareCredential refuses non-owners and non-contacts
 *   - listSharedCredentialsWithMe never exposes the password column
 *   - hasCredentialAccess accepts owner OR shared recipient, refuses everyone else
 *   - revokeOrphanedCredentialShares only fires when no devices remain shared
 *   - revokeAllSharesBetweenContacts wipes both directions
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mock query.findFirst / findMany per table ──────────────────────────────
const mockProfilesFindMany = vi.fn();
const mockPlatformProfilesFindFirst = vi.fn();
const mockPlatformProfilesFindMany = vi.fn();
const mockApiKeysFindMany = vi.fn();
const mockDeviceSharesFindFirst = vi.fn();
const mockCredentialSharesFindFirst = vi.fn();
const mockCredentialSharesFindMany = vi.fn();
const mockUsersFindFirst = vi.fn();
const mockUsersFindMany = vi.fn().mockResolvedValue([]);

// ── Mock Drizzle insert / delete chains ────────────────────────────────────
const mockInsertValues = vi.fn().mockResolvedValue({});
const mockInsertFn = vi.fn().mockReturnValue({ values: mockInsertValues });
const mockDeleteWhere = vi.fn().mockResolvedValue({ rowCount: 0 });
const mockDeleteFn = vi.fn().mockReturnValue({ where: mockDeleteWhere });

vi.mock("$lib/server/db", () => ({
  db: {
    query: {
      profiles: { findMany: (...a: any[]) => mockProfilesFindMany(...a) },
      platform_profiles: {
        findFirst: (...a: any[]) => mockPlatformProfilesFindFirst(...a),
        findMany: (...a: any[]) => mockPlatformProfilesFindMany(...a),
      },
      api_keys: { findMany: (...a: any[]) => mockApiKeysFindMany(...a) },
      device_shares: {
        findFirst: (...a: any[]) => mockDeviceSharesFindFirst(...a),
      },
      credential_shares: {
        findFirst: (...a: any[]) => mockCredentialSharesFindFirst(...a),
        findMany: (...a: any[]) => mockCredentialSharesFindMany(...a),
      },
      users: {
        findFirst: (...a: any[]) => mockUsersFindFirst(...a),
        findMany: (...a: any[]) => mockUsersFindMany(...a),
      },
    },
    insert: (...a: any[]) => mockInsertFn(...a),
    delete: (...a: any[]) => mockDeleteFn(...a),
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((col: any, val: any) => ({ kind: "eq", col, val })),
  and: vi.fn((...args: any[]) => ({ kind: "and", args })),
  or: vi.fn((...args: any[]) => ({ kind: "or", args })),
  inArray: vi.fn((col: any, vals: any[]) => ({ kind: "in", col, vals })),
  desc: vi.fn((col: any) => ({ kind: "desc", col })),
}));

vi.mock("$lib/server/db/schema", () => ({
  api_keys: { id: "api_keys.id", profile_id: "api_keys.profile_id" },
  credential_shares: {
    id: "credential_shares.id",
    platform_profile_id: "credential_shares.platform_profile_id",
    shared_with: "credential_shares.shared_with",
    date_created: "credential_shares.date_created",
  },
  device_shares: {
    api_key_id: "device_shares.api_key_id",
    shared_with: "device_shares.shared_with",
  },
  platform_profiles: {
    id: "platform_profiles.id",
    profile_id: "platform_profiles.profile_id",
  },
  profiles: { id: "profiles.id", user_id: "profiles.user_id" },
  users: { id: "users.id" },
}));

const mockAreContacts = vi.fn();
vi.mock("$lib/server/contacts", () => ({
  areContacts: (...a: any[]) => mockAreContacts(...a),
}));

const mockCreateNotification = vi.fn().mockResolvedValue(undefined);
vi.mock("$lib/server/notifications", () => ({
  createNotification: (...a: any[]) => mockCreateNotification(...a),
}));

import {
  hasCredentialAccess,
  listSharedCredentialsWithMe,
  revokeAllSharesBetweenContacts,
  revokeOrphanedCredentialShares,
  shareCredential,
  unshareCredential,
} from "../credential-shares";

// ── Helpers ────────────────────────────────────────────────────────────────
const OWNER = "user-owner";
const CONTACT = "user-contact";
const STRANGER = "user-stranger";
const CRED_ID = 42;

beforeEach(() => {
  vi.clearAllMocks();
  mockDeleteWhere.mockResolvedValue({ rowCount: 0 });
  mockInsertValues.mockResolvedValue({});
});

// ── shareCredential ────────────────────────────────────────────────────────
describe("shareCredential", () => {
  it("refuses to share a credential the caller doesn't own", async () => {
    mockPlatformProfilesFindFirst.mockResolvedValue({
      id: CRED_ID,
      profile: { user_id: STRANGER },
    });

    const result = await shareCredential(CRED_ID, OWNER, CONTACT);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Credential not found");
    expect(mockInsertFn).not.toHaveBeenCalled();
  });

  it("refuses to share with someone who isn't an accepted contact", async () => {
    mockPlatformProfilesFindFirst.mockResolvedValue({
      id: CRED_ID,
      profile: { user_id: OWNER },
    });
    mockAreContacts.mockResolvedValue(false);

    const result = await shareCredential(CRED_ID, OWNER, CONTACT);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/contacts/i);
    expect(mockInsertFn).not.toHaveBeenCalled();
  });

  it("is idempotent — refuses a duplicate share", async () => {
    mockPlatformProfilesFindFirst.mockResolvedValue({
      id: CRED_ID,
      profile: { user_id: OWNER },
    });
    mockAreContacts.mockResolvedValue(true);
    mockCredentialSharesFindFirst.mockResolvedValue({ id: 1 });

    const result = await shareCredential(CRED_ID, OWNER, CONTACT);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/already shared/i);
    expect(mockInsertFn).not.toHaveBeenCalled();
  });

  it("inserts the share and notifies the recipient on the happy path", async () => {
    mockPlatformProfilesFindFirst.mockResolvedValue({
      id: CRED_ID,
      profile: { user_id: OWNER },
    });
    mockAreContacts.mockResolvedValue(true);
    mockCredentialSharesFindFirst.mockResolvedValue(null);
    mockUsersFindFirst.mockResolvedValue({
      name: "Alice",
      email: "alice@example.com",
    });

    const result = await shareCredential(CRED_ID, OWNER, CONTACT);

    expect(result.success).toBe(true);
    expect(mockInsertFn).toHaveBeenCalledTimes(1);
    expect(mockInsertValues).toHaveBeenCalledWith({
      platform_profile_id: CRED_ID,
      shared_with: CONTACT,
    });
    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: CONTACT,
        type: "credential_share",
        link: "/jobs/import/devices",
      }),
    );
  });
});

// ── unshareCredential ──────────────────────────────────────────────────────
describe("unshareCredential", () => {
  it("returns false when the caller doesn't own the credential", async () => {
    mockPlatformProfilesFindFirst.mockResolvedValue({
      id: CRED_ID,
      profile: { user_id: STRANGER },
    });

    const result = await unshareCredential(CRED_ID, OWNER, CONTACT);

    expect(result).toBe(false);
    expect(mockDeleteFn).not.toHaveBeenCalled();
  });

  it("deletes the share row when the caller owns the credential", async () => {
    mockPlatformProfilesFindFirst.mockResolvedValue({
      id: CRED_ID,
      profile: { user_id: OWNER },
    });
    mockDeleteWhere.mockResolvedValue({ rowCount: 1 });

    const result = await unshareCredential(CRED_ID, OWNER, CONTACT);

    expect(result).toBe(true);
    expect(mockDeleteFn).toHaveBeenCalledTimes(1);
  });
});

// ── hasCredentialAccess ────────────────────────────────────────────────────
describe("hasCredentialAccess", () => {
  it("accepts the owner", async () => {
    mockPlatformProfilesFindFirst.mockResolvedValue({
      id: CRED_ID,
      profile: { user_id: OWNER },
    });

    expect(await hasCredentialAccess(CRED_ID, OWNER)).toBe(true);
    expect(mockCredentialSharesFindFirst).not.toHaveBeenCalled();
  });

  it("accepts a recipient who has a share row", async () => {
    mockPlatformProfilesFindFirst.mockResolvedValue({
      id: CRED_ID,
      profile: { user_id: OWNER },
    });
    mockCredentialSharesFindFirst.mockResolvedValue({ id: 7 });

    expect(await hasCredentialAccess(CRED_ID, CONTACT)).toBe(true);
  });

  it("rejects a stranger who is neither owner nor recipient", async () => {
    mockPlatformProfilesFindFirst.mockResolvedValue({
      id: CRED_ID,
      profile: { user_id: OWNER },
    });
    mockCredentialSharesFindFirst.mockResolvedValue(null);

    expect(await hasCredentialAccess(CRED_ID, STRANGER)).toBe(false);
  });
});

// ── listSharedCredentialsWithMe — secret-leak guard ────────────────────────
describe("listSharedCredentialsWithMe", () => {
  it("never reads password / api_token / security_answer columns", async () => {
    mockCredentialSharesFindMany.mockResolvedValue([]);

    await listSharedCredentialsWithMe(CONTACT);

    expect(mockCredentialSharesFindMany).toHaveBeenCalledTimes(1);
    const call = mockCredentialSharesFindMany.mock.calls[0][0];
    const ppCols = call.with.platform_profile.columns;
    expect(ppCols.password).toBeUndefined();
    expect(ppCols.api_token).toBeUndefined();
    expect(ppCols.security_answer).toBeUndefined();
    // And the only fields it does pull are safe to expose:
    expect(Object.keys(ppCols).sort()).toEqual(
      ["id", "platform_id", "status", "username"].sort(),
    );
  });

  it("includes only safe fields in the returned shape", async () => {
    mockCredentialSharesFindMany.mockResolvedValue([
      {
        id: 1,
        date_created: new Date(0),
        platform_profile: {
          id: CRED_ID,
          username: "alice@site",
          platform_id: 5,
          status: "active",
          profile: { user_id: OWNER },
          job_platform: { id: 5, name: "Acme" },
        },
      },
    ]);
    mockUsersFindMany.mockResolvedValueOnce([
      { id: OWNER, name: "Alice", email: "alice@example.com" },
    ]);

    const result = await listSharedCredentialsWithMe(CONTACT);

    expect(result).toHaveLength(1);
    const pp = result[0].platform_profile;
    expect(pp).not.toHaveProperty("password");
    expect(pp).not.toHaveProperty("api_token");
    expect(pp).not.toHaveProperty("security_answer");
    expect(pp.username).toBe("alice@site");
    expect(pp.platform_id).toBe(5);
  });
});

// ── revokeOrphanedCredentialShares — only fires when devices are gone ──────
describe("revokeOrphanedCredentialShares", () => {
  it("does nothing when at least one device of the owner remains shared", async () => {
    mockProfilesFindMany.mockResolvedValueOnce([{ id: 100 }]); // owner profiles
    mockApiKeysFindMany.mockResolvedValueOnce([{ id: 1 }, { id: 2 }]); // owner keys
    mockDeviceSharesFindFirst.mockResolvedValueOnce({ id: 1 }); // still shared

    const removed = await revokeOrphanedCredentialShares(OWNER, CONTACT);

    expect(removed).toBe(0);
    expect(mockDeleteFn).not.toHaveBeenCalled();
  });

  it("revokes credential shares when no owner devices are left shared", async () => {
    // ownedApiKeyIds(): profiles → keys
    mockProfilesFindMany.mockResolvedValueOnce([{ id: 100 }]);
    mockApiKeysFindMany.mockResolvedValueOnce([{ id: 1 }]);
    // Remaining device check: none
    mockDeviceSharesFindFirst.mockResolvedValueOnce(null);
    // ownedCredentialIds(): profiles → platform_profiles
    mockProfilesFindMany.mockResolvedValueOnce([{ id: 100 }]);
    mockPlatformProfilesFindMany.mockResolvedValueOnce([
      { id: CRED_ID },
      { id: CRED_ID + 1 },
    ]);
    mockDeleteWhere.mockResolvedValue({ rowCount: 2 });

    const removed = await revokeOrphanedCredentialShares(OWNER, CONTACT);

    expect(removed).toBe(2);
    expect(mockDeleteFn).toHaveBeenCalledTimes(1);
  });
});

// ── Cascade error handling ─────────────────────────────────────────────────
describe("revokeOrphanedCredentialShares — error propagation", () => {
  it("propagates errors so the caller can retry", async () => {
    mockProfilesFindMany.mockResolvedValueOnce([{ id: 100 }]);
    mockApiKeysFindMany.mockResolvedValueOnce([{ id: 1 }]);
    mockDeviceSharesFindFirst.mockResolvedValueOnce(null);
    mockProfilesFindMany.mockResolvedValueOnce([{ id: 100 }]);
    mockPlatformProfilesFindMany.mockResolvedValueOnce([{ id: CRED_ID }]);
    mockDeleteWhere.mockRejectedValueOnce(new Error("DB down"));

    await expect(
      revokeOrphanedCredentialShares(OWNER, CONTACT),
    ).rejects.toThrow("DB down");
  });
});

// ── revokeAllSharesBetweenContacts ─────────────────────────────────────────
describe("revokeAllSharesBetweenContacts", () => {
  it("attempts to delete shares in both directions", async () => {
    // ownedApiKeyIds for userA and userB run in parallel. Each runs:
    //   profiles.findMany(by user_id) → api_keys.findMany(by profile_ids)
    mockProfilesFindMany
      .mockResolvedValueOnce([{ id: 100 }]) // userA profiles
      .mockResolvedValueOnce([{ id: 200 }]); // userB profiles
    mockApiKeysFindMany
      .mockResolvedValueOnce([{ id: 11 }]) // userA keys
      .mockResolvedValueOnce([{ id: 22 }]); // userB keys

    // Then revokeAllCredentialSharesBetween(A, B): profiles + platform_profiles
    mockProfilesFindMany.mockResolvedValueOnce([{ id: 100 }]);
    mockPlatformProfilesFindMany.mockResolvedValueOnce([{ id: CRED_ID }]);
    // Then revokeAllCredentialSharesBetween(B, A):
    mockProfilesFindMany.mockResolvedValueOnce([{ id: 200 }]);
    mockPlatformProfilesFindMany.mockResolvedValueOnce([{ id: CRED_ID + 1 }]);

    await revokeAllSharesBetweenContacts(OWNER, CONTACT);

    // 2 device-share deletes (A→B, B→A) + 2 credential-share deletes
    expect(mockDeleteFn).toHaveBeenCalledTimes(4);
  });
});
