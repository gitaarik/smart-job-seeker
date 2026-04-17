import { beforeEach, describe, expect, it, vi } from "vitest";
import { hashToken } from "../token-generator";

const mockFindUniqueToken = vi.fn();
const mockFindUniqueVersion = vi.fn();
const mockUpdateToken = vi.fn();

vi.mock("$lib/server/db", () => ({
  db: {
    profile_tokens: {
      findUnique: (...args: any[]) => mockFindUniqueToken(...args),
      update: (...args: any[]) => mockUpdateToken(...args),
    },
    profile_versions: {
      findUnique: (...args: any[]) => mockFindUniqueVersion(...args),
    },
  },
}));

import { validateToken, incrementTokenVisit } from "../token-validation";

describe("validateToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns invalid for non-existent token", async () => {
    mockFindUniqueToken.mockResolvedValue(null);
    const result = await validateToken("nonexistent", 1);
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Invalid or expired access token");
  });

  it("returns invalid for unpublished token", async () => {
    mockFindUniqueToken.mockResolvedValue({
      id: 1,
      status: "draft",
      profile_version: 10,
      expires_at: null,
      visit_limit: null,
      visit_count: 0,
    });
    const result = await validateToken("some-token", 1);
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Access token is no longer valid");
  });

  it("returns invalid when profile version doesn't match profile", async () => {
    mockFindUniqueToken.mockResolvedValue({
      id: 1,
      status: "published",
      profile_version: 10,
      expires_at: null,
      visit_limit: null,
      visit_count: 0,
    });
    mockFindUniqueVersion.mockResolvedValue({ profile_id: 999 });
    const result = await validateToken("some-token", 1);
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Access token is not valid for this profile");
  });

  it("returns invalid for expired token", async () => {
    mockFindUniqueToken.mockResolvedValue({
      id: 1,
      status: "published",
      profile_version: 10,
      expires_at: new Date("2020-01-01"),
      visit_limit: null,
      visit_count: 0,
    });
    mockFindUniqueVersion.mockResolvedValue({ profile_id: 1 });
    const result = await validateToken("some-token", 1);
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Access token has expired");
  });

  it("returns invalid when visit limit exceeded", async () => {
    mockFindUniqueToken.mockResolvedValue({
      id: 1,
      status: "published",
      profile_version: 10,
      expires_at: null,
      visit_limit: 5,
      visit_count: 5,
    });
    mockFindUniqueVersion.mockResolvedValue({ profile_id: 1 });
    const result = await validateToken("some-token", 1);
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Access token visit limit exceeded");
  });

  it("returns valid with correct profileVersionId", async () => {
    mockFindUniqueToken.mockResolvedValue({
      id: 1,
      status: "published",
      profile_version: 10,
      expires_at: null,
      visit_limit: null,
      visit_count: 0,
    });
    mockFindUniqueVersion.mockResolvedValue({ profile_id: 1 });
    const result = await validateToken("some-token", 1);
    expect(result).toEqual({
      valid: true,
      profileVersionId: 10,
      tokenId: 1,
    });
  });

  it("returns valid when under visit limit", async () => {
    mockFindUniqueToken.mockResolvedValue({
      id: 1,
      status: "published",
      profile_version: 10,
      expires_at: null,
      visit_limit: 10,
      visit_count: 3,
    });
    mockFindUniqueVersion.mockResolvedValue({ profile_id: 1 });
    const result = await validateToken("some-token", 1);
    expect(result.valid).toBe(true);
  });

  it("looks up token by hash, not plain text", async () => {
    mockFindUniqueToken.mockResolvedValue(null);
    await validateToken("my-token", 1);
    expect(mockFindUniqueToken).toHaveBeenCalledWith({
      where: { token_hash: hashToken("my-token") },
    });
  });
});

describe("incrementTokenVisit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateToken.mockResolvedValue({});
  });

  it("increments visit count and sets last_accessed_at", async () => {
    await incrementTokenVisit(5);
    expect(mockUpdateToken).toHaveBeenCalledWith({
      where: { id: 5 },
      data: {
        visit_count: { increment: 1 },
        last_accessed_at: expect.any(Date),
        last_accessed_ip: null,
      },
    });
  });

  it("stores IP address when provided", async () => {
    await incrementTokenVisit(5, "192.168.1.1");
    expect(mockUpdateToken).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          last_accessed_ip: "192.168.1.1",
        }),
      }),
    );
  });
});
