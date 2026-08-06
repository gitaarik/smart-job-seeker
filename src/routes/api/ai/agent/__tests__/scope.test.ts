/**
 * `?profile_id=` on the conversation reads.
 *
 * The interesting case is the absent one. There is no sane default for "as
 * whom" — falling back to the first profile, the cookie, or the most recently
 * used one all produce a plausible answer drawn from the wrong applicant's
 * history, and none of them are visibly wrong to the user. So it is a 400.
 */
import { describe, expect, it, vi } from "vitest";

const mockRequireProfileAccess = vi.fn();

vi.mock("$lib/server/utils/api-helpers", () => ({
  requireProfileAccess: (...a: unknown[]) => mockRequireProfileAccess(...a),
}));

vi.mock("@sveltejs/kit", () => ({
  error: (status: number, message: string) => {
    throw Object.assign(new Error(message), { status });
  },
}));

import { requireConversationProfile } from "../scope";

const url = (qs: string) => new URL(`https://x.test/api${qs}`);

describe("requireConversationProfile", () => {
  it("returns the profile when it is the caller's", async () => {
    mockRequireProfileAccess.mockResolvedValue(undefined);
    await expect(requireConversationProfile(url("?profile_id=12"), "user-1"))
      .resolves.toBe(12);
    expect(mockRequireProfileAccess).toHaveBeenCalledWith(12, "user-1");
  });

  it("rejects a missing profile_id rather than guessing one", async () => {
    await expect(requireConversationProfile(url(""), "user-1"))
      .rejects.toMatchObject({ status: 400 });
  });

  it.each([
    ["not a number", "?profile_id=abc"],
    ["zero", "?profile_id=0"],
    ["negative", "?profile_id=-3"],
    ["fractional", "?profile_id=1.5"],
    ["empty", "?profile_id="],
  ])("rejects %s", async (_label, qs) => {
    await expect(requireConversationProfile(url(qs), "user-1"))
      .rejects.toMatchObject({ status: 400 });
  });

  it("propagates the 403 when the profile is not the caller's", async () => {
    // requireProfileAccess owns that decision; this must not swallow it and
    // fall back to something permissive.
    mockRequireProfileAccess.mockRejectedValue(
      Object.assign(new Error("Not authorized"), { status: 403 }),
    );
    await expect(requireConversationProfile(url("?profile_id=99"), "user-1"))
      .rejects.toMatchObject({ status: 403 });
  });
});
