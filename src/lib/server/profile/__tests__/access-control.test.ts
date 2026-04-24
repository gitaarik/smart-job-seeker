/**
 * Tests for Profile Access Control
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockValidateToken } = vi.hoisted(() => ({
  mockValidateToken: vi.fn(),
}));

vi.mock("$lib/server/db", () => ({ db: {} }));
vi.mock("$lib/server/auth/token-validation", () => ({
  validateToken: mockValidateToken,
}));

import { checkProfileAccess, type AccessControlOptions } from "../access-control";

const baseProfile = {
  id: 1,
  user_id: "owner-123",
  public_cv_version_id: null as number | null,
  public_resume_version_id: null as number | null,
} as any;

function opts(overrides: Partial<AccessControlOptions> = {}): AccessControlOptions {
  return {
    profile: baseProfile,
    routeType: "cv",
    ...overrides,
  };
}

describe("checkProfileAccess", () => {
  beforeEach(() => vi.clearAllMocks());

  // Public access
  it("grants public access when public CV version is set", async () => {
    const result = await checkProfileAccess(opts({
      profile: { ...baseProfile, public_cv_version_id: 10 },
    }));
    expect(result).toMatchObject({
      allowed: true,
      accessType: "public",
      versionId: 10,
    });
  });

  it("grants public access when public resume version is set", async () => {
    const result = await checkProfileAccess(opts({
      profile: { ...baseProfile, public_resume_version_id: 20 },
      routeType: "resume",
    }));
    expect(result).toMatchObject({
      allowed: true,
      accessType: "public",
      versionId: 20,
    });
  });

  it("skips public access and uses token when both public version and token are present", async () => {
    mockValidateToken.mockResolvedValueOnce({
      valid: true,
      profileVersionId: 15,
      tokenId: 99,
    });
    const result = await checkProfileAccess(opts({
      profile: { ...baseProfile, public_cv_version_id: 10 },
      token: "some-token",
    }));
    expect(result).toMatchObject({
      allowed: true,
      accessType: "token",
      versionId: 15,
    });
  });

  // Owner access
  it("grants owner access when userId matches profile", async () => {
    const result = await checkProfileAccess(opts({
      userId: "owner-123",
    }));
    expect(result).toMatchObject({
      allowed: true,
      accessType: "owner",
    });
    expect(result.versionId).toBeUndefined();
  });

  it("denies when userId doesn't match profile", async () => {
    const result = await checkProfileAccess(opts({
      userId: "other-user",
    }));
    expect(result.allowed).toBe(false);
  });

  // Token access
  it("grants token access with valid token", async () => {
    mockValidateToken.mockResolvedValueOnce({
      valid: true,
      profileVersionId: 15,
      tokenId: 99,
    });
    const result = await checkProfileAccess(opts({
      token: "valid-token",
    }));
    expect(result).toMatchObject({
      allowed: true,
      accessType: "token",
      versionId: 15,
      tokenId: 99,
    });
    expect(mockValidateToken).toHaveBeenCalledWith("valid-token", 1);
  });

  it("denies with invalid token", async () => {
    mockValidateToken.mockResolvedValueOnce({
      valid: false,
      error: "Token expired",
    });
    const result = await checkProfileAccess(opts({
      token: "bad-token",
    }));
    expect(result).toMatchObject({
      allowed: false,
      statusCode: 401,
      message: "Token expired",
      accessType: "token",
    });
  });

  it("uses default error message when token validation has no error", async () => {
    mockValidateToken.mockResolvedValueOnce({
      valid: false,
    });
    const result = await checkProfileAccess(opts({
      token: "bad-token",
    }));
    expect(result.message).toBe("Invalid or expired access token");
  });

  // No access
  it("denies access when no public version, no user, no token", async () => {
    const result = await checkProfileAccess(opts());
    expect(result).toMatchObject({
      allowed: false,
      statusCode: 401,
      accessType: "public",
    });
  });

  // Priority order
  it("prefers owner over public when user is the profile owner", async () => {
    const result = await checkProfileAccess(opts({
      profile: { ...baseProfile, public_cv_version_id: 10 },
      userId: "owner-123",
    }));
    expect(result.accessType).toBe("owner");
  });

  it("prefers owner over denial when not public and no token", async () => {
    const result = await checkProfileAccess(opts({
      userId: "owner-123",
    }));
    expect(result.accessType).toBe("owner");
  });
});
