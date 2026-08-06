/**
 * Tests for the plan / device grants an admin can attach to an invitation.
 *
 * The invariants worth pinning down:
 *   - parseInviteGrants validates the plan and duration, and refuses device
 *     ids the inviting admin doesn't own
 *   - grantsFromInvitePayload tolerates invites minted before grants existed
 *   - applyInviteGrants never throws, whatever the underlying writes do
 *   - a plan grant does NOT overwrite a subscription the account already has
 *   - device shares establish the contact row and bypass the contact gate
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mock Drizzle query / write chains ──────────────────────────────────────
const mockApiKeysFindMany = vi.fn();
const mockSubscriptionsFindFirst = vi.fn();

const mockInsertValues = vi.fn().mockResolvedValue({});
const mockInsertFn = vi.fn().mockReturnValue({ values: mockInsertValues });
const mockUpdateWhere = vi.fn().mockResolvedValue({ rowCount: 1 });
const mockUpdateSet = vi.fn().mockReturnValue({ where: mockUpdateWhere });
const mockUpdateFn = vi.fn().mockReturnValue({ set: mockUpdateSet });

vi.mock("$lib/server/db", () => ({
  dbDirect: {
    query: {
      api_keys: { findMany: (...a: any[]) => mockApiKeysFindMany(...a) },
      subscriptions: {
        findFirst: (...a: any[]) => mockSubscriptionsFindFirst(...a),
      },
    },
    insert: (...a: any[]) => mockInsertFn(...a),
    update: (...a: any[]) => mockUpdateFn(...a),
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((col: any, val: any) => ({ kind: "eq", col, val })),
  and: vi.fn((...args: any[]) => ({ kind: "and", args })),
  inArray: vi.fn((col: any, vals: any[]) => ({ kind: "in", col, vals })),
}));

vi.mock("$lib/server/db/schema", () => ({
  api_keys: {
    id: "api_keys.id",
    user_id: "api_keys.user_id",
    revoked: "api_keys.revoked",
  },
  subscriptions: {
    id: "subscriptions.id",
    user_id: "subscriptions.user_id",
    status: "subscriptions.status",
  },
}));

vi.mock("$lib/server/billing/plans", () => ({
  PLAN_LIMITS: { explorer: {}, seeker: {}, hunter: {}, contractor: {} },
}));

const mockEnsureAcceptedContact = vi.fn().mockResolvedValue(undefined);
vi.mock("$lib/server/contacts", () => ({
  ensureAcceptedContact: (...a: any[]) => mockEnsureAcceptedContact(...a),
}));

const mockInsertDeviceShare = vi.fn().mockResolvedValue({ success: true });
vi.mock("$lib/server/device-shares", () => ({
  insertDeviceShare: (...a: any[]) => mockInsertDeviceShare(...a),
}));

const mockCreateNotification = vi.fn().mockResolvedValue(undefined);
vi.mock("$lib/server/notifications", () => ({
  createNotification: (...a: any[]) => mockCreateNotification(...a),
}));

import {
  addMonths,
  applyInviteGrants,
  grantsFromInvitePayload,
  hasGrants,
  parseInviteGrants,
} from "$lib/server/auth/invite-grants";

/** Minimal FormData stand-in over a list of [key, value] pairs. */
function form(pairs: [string, string][]): FormData {
  const fd = new FormData();
  for (const [k, v] of pairs) fd.append(k, v);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockInsertFn.mockReturnValue({ values: mockInsertValues });
  mockUpdateFn.mockReturnValue({ set: mockUpdateSet });
  mockUpdateSet.mockReturnValue({ where: mockUpdateWhere });
  mockInsertValues.mockResolvedValue({});
  mockInsertDeviceShare.mockResolvedValue({ success: true });
  mockSubscriptionsFindFirst.mockResolvedValue(undefined);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("parseInviteGrants", () => {
  it("treats explorer as no plan grant", async () => {
    const res = await parseInviteGrants(form([["plan", "explorer"]]), "admin");
    expect(res).toEqual({ grants: { inviterId: "admin" } });
  });

  it("rejects an unknown plan", async () => {
    const res = await parseInviteGrants(form([["plan", "unlimited"]]), "admin");
    expect(res).toEqual({ error: "Invalid plan" });
  });

  it("defaults the duration when none is given", async () => {
    const res = await parseInviteGrants(form([["plan", "seeker"]]), "admin");
    expect(res).toMatchObject({ grants: { plan: "seeker", planMonths: 12 } });
  });

  it("rejects an out-of-range duration", async () => {
    const res = await parseInviteGrants(
      form([["plan", "seeker"], ["plan_months", "0"]]),
      "admin",
    );
    expect(res).toMatchObject({ error: expect.stringMatching(/duration/i) });
  });

  it("refuses device ids the inviter doesn't own", async () => {
    mockApiKeysFindMany.mockResolvedValue([{ id: 1 }]); // asked for 2, own 1
    const res = await parseInviteGrants(
      form([["device_ids", "1"], ["device_ids", "99"]]),
      "admin",
    );
    expect(res).toMatchObject({ error: expect.stringMatching(/aren't yours/i) });
  });

  it("accepts devices the inviter owns", async () => {
    mockApiKeysFindMany.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    const res = await parseInviteGrants(
      form([["device_ids", "1"], ["device_ids", "2"]]),
      "admin",
    );
    expect(res).toMatchObject({ grants: { deviceIds: [1, 2] } });
  });
});

describe("grantsFromInvitePayload", () => {
  it("finds nothing in a pre-grants invite", () => {
    const grants = grantsFromInvitePayload({ token: "t", name: "Bob" });
    expect(hasGrants(grants)).toBe(false);
  });

  it("ignores a plan that is no longer a real plan", () => {
    const grants = grantsFromInvitePayload({ plan: "legacy-pro" });
    expect(grants.plan).toBeUndefined();
  });

  it("reads plan, duration, inviter and devices", () => {
    const grants = grantsFromInvitePayload({
      inviterId: "admin",
      plan: "hunter",
      planMonths: 6,
      deviceIds: [3, 7],
    });
    expect(grants).toEqual({
      inviterId: "admin",
      plan: "hunter",
      planMonths: 6,
      deviceIds: [3, 7],
    });
    expect(hasGrants(grants)).toBe(true);
  });
});

describe("applyInviteGrants", () => {
  it("does nothing when there are no grants", async () => {
    expect(await applyInviteGrants("bob", {})).toEqual([]);
    expect(mockInsertFn).not.toHaveBeenCalled();
    expect(mockInsertDeviceShare).not.toHaveBeenCalled();
  });

  it("writes an admin-granted subscription ending planMonths out", async () => {
    const warnings = await applyInviteGrants("bob", {
      plan: "seeker",
      planMonths: 3,
    });

    expect(warnings).toEqual([]);
    const row = mockInsertValues.mock.calls[0][0];
    expect(row).toMatchObject({
      user_id: "bob",
      plan: "seeker",
      status: "active",
      stripe_price_id: "admin_grant",
    });
    // Duration runs from now (acceptance), not from when the invite was minted.
    const expected = addMonths(new Date(), 3);
    expect(
      Math.abs(row.current_period_end.getTime() - expected.getTime()),
    ).toBeLessThan(60_000);
  });

  it("leaves an existing subscription alone and warns", async () => {
    mockSubscriptionsFindFirst.mockResolvedValue({ id: 1 });

    const warnings = await applyInviteGrants("bob", { plan: "seeker" });

    expect(mockInsertFn).not.toHaveBeenCalled();
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/already has an active subscription/i);
  });

  it("makes the pair contacts, then shares each device", async () => {
    const warnings = await applyInviteGrants("bob", {
      inviterId: "admin",
      deviceIds: [3, 7],
    });

    expect(warnings).toEqual([]);
    expect(mockEnsureAcceptedContact).toHaveBeenCalledWith("admin", "bob");
    expect(mockEnsureAcceptedContact).toHaveBeenCalledTimes(1);
    expect(mockInsertDeviceShare).toHaveBeenCalledWith(3, "admin", "bob");
    expect(mockInsertDeviceShare).toHaveBeenCalledWith(7, "admin", "bob");
  });

  it("treats an already-shared device as success", async () => {
    mockInsertDeviceShare.mockResolvedValue({
      success: false,
      error: "Device is already shared with this contact",
    });
    expect(
      await applyInviteGrants("bob", { inviterId: "admin", deviceIds: [3] }),
    ).toEqual([]);
  });

  it("warns instead of throwing when a device is gone", async () => {
    mockInsertDeviceShare.mockResolvedValue({
      success: false,
      error: "Device not found",
    });

    const warnings = await applyInviteGrants("bob", {
      inviterId: "admin",
      deviceIds: [3],
    });

    expect(warnings).toEqual(["Device 3 not shared: Device not found"]);
  });

  it("survives a throwing write and still applies the rest", async () => {
    mockInsertDeviceShare
      .mockRejectedValueOnce(new Error("connection reset"))
      .mockResolvedValueOnce({ success: true });

    const warnings = await applyInviteGrants("bob", {
      inviterId: "admin",
      deviceIds: [3, 7],
    });

    expect(warnings).toEqual(["Device 3 not shared: connection reset"]);
    expect(mockInsertDeviceShare).toHaveBeenCalledWith(7, "admin", "bob");
  });

  it("tells the inviter when something didn't apply", async () => {
    mockInsertDeviceShare.mockResolvedValue({
      success: false,
      error: "Device not found",
    });

    await applyInviteGrants("bob", { inviterId: "admin", deviceIds: [3] });

    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "admin",
        type: "invite_grant_failed",
        link: "/admin/users/bob",
      }),
    );
  });

  it("skips device grants when the invite has no inviter", async () => {
    const warnings = await applyInviteGrants("bob", { deviceIds: [3] });
    expect(warnings).toEqual([]);
    expect(mockInsertDeviceShare).not.toHaveBeenCalled();
  });
});
