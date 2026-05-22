import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateApiKey, hashApiKey, verifyApiKey, verifyApiKeyDetailed } from "../api-key";

// Mock the db module with Drizzle-style API
const mockFindFirst = vi.fn();
const mockUpdateReturning = vi.fn();

vi.mock("$lib/server/db", () => ({
  db: {
    query: {
      api_keys: {
        findFirst: (...args: any[]) => mockFindFirst(...args),
      },
    },
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          catch: vi.fn(),
        })),
      })),
    })),
    insert: vi.fn(),
    delete: vi.fn(),
  },
}));

describe("generateApiKey", () => {
  it("generates key with sjs_ prefix", () => {
    const { key } = generateApiKey();
    expect(key).toMatch(/^sjs_[a-f0-9]{64}$/);
  });

  it("returns both key and hash", () => {
    const { key, hash } = generateApiKey();
    expect(key).toBeTruthy();
    expect(hash).toBeTruthy();
    expect(hash).toBe(hashApiKey(key));
  });

  it("generates unique keys", () => {
    const keys = new Set(Array.from({ length: 50 }, () => generateApiKey().key));
    expect(keys.size).toBe(50);
  });
});

describe("hashApiKey", () => {
  it("returns consistent hash", () => {
    const hash1 = hashApiKey("sjs_abc123");
    const hash2 = hashApiKey("sjs_abc123");
    expect(hash1).toBe(hash2);
  });

  it("returns 64-char hex string", () => {
    const hash = hashApiKey("sjs_test");
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[a-f0-9]+$/);
  });
});

describe("verifyApiKey", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null for empty key", async () => {
    expect(await verifyApiKey("")).toBeNull();
  });

  it("returns null for key without sjs_ prefix", async () => {
    expect(await verifyApiKey("invalid_key")).toBeNull();
  });

  it("returns null when key not found in db", async () => {
    mockFindFirst.mockResolvedValue(null);
    expect(await verifyApiKey("sjs_nonexistent")).toBeNull();
  });

  it("returns null for revoked key", async () => {
    mockFindFirst.mockResolvedValue({
      id: 1,
      user_id: "user-42",
      revoked: true,
      expires_at: null,
    });
    expect(await verifyApiKey("sjs_revoked")).toBeNull();
  });

  it("returns null for expired key", async () => {
    mockFindFirst.mockResolvedValue({
      id: 1,
      user_id: "user-42",
      revoked: false,
      expires_at: new Date("2020-01-01"),
    });
    expect(await verifyApiKey("sjs_expired")).toBeNull();
  });

  it("returns user ID for valid key", async () => {
    mockFindFirst.mockResolvedValue({
      id: 1,
      user_id: "user-42",
      revoked: false,
      expires_at: null,
    });
    expect(await verifyApiKey("sjs_valid")).toBe("user-42");
  });

  it("returns user ID for valid key with future expiry", async () => {
    mockFindFirst.mockResolvedValue({
      id: 1,
      user_id: "user-42",
      revoked: false,
      expires_at: new Date("2099-01-01"),
    });
    expect(await verifyApiKey("sjs_valid")).toBe("user-42");
  });

  it("updates last_used timestamp on valid key", async () => {
    mockFindFirst.mockResolvedValue({
      id: 7,
      user_id: "user-42",
      revoked: false,
      expires_at: null,
    });
    const { db } = await import("$lib/server/db");
    await verifyApiKey("sjs_valid");
    expect(db.update).toHaveBeenCalled();
  });

  it("returns null on db error", async () => {
    mockFindFirst.mockRejectedValue(new Error("DB down"));
    expect(await verifyApiKey("sjs_valid")).toBeNull();
  });
});

describe("verifyApiKeyDetailed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error for empty key", async () => {
    const result = await verifyApiKeyDetailed("");
    expect(result).toEqual({ valid: false, error: "Device key is required" });
  });

  it("returns error for wrong prefix", async () => {
    const result = await verifyApiKeyDetailed("bad_prefix");
    expect(result).toEqual({ valid: false, error: "Invalid device key format" });
  });

  it("returns error for unknown key", async () => {
    mockFindFirst.mockResolvedValue(null);
    const result = await verifyApiKeyDetailed("sjs_unknown");
    expect(result).toEqual({ valid: false, error: "Invalid device key" });
  });

  it("returns error for revoked key", async () => {
    mockFindFirst.mockResolvedValue({
      id: 1, user_id: "user-42", revoked: true, expires_at: null,
    });
    const result = await verifyApiKeyDetailed("sjs_revoked");
    expect(result).toEqual({ valid: false, error: "Device key has been revoked" });
  });

  it("returns error for expired key", async () => {
    mockFindFirst.mockResolvedValue({
      id: 1, user_id: "user-42", revoked: false, expires_at: new Date("2020-01-01"),
    });
    const result = await verifyApiKeyDetailed("sjs_expired");
    expect(result).toEqual({ valid: false, error: "Device key has expired" });
  });

  it("returns valid with userId for valid key", async () => {
    mockFindFirst.mockResolvedValue({
      id: 1, user_id: "user-42", revoked: false, expires_at: null,
    });
    const result = await verifyApiKeyDetailed("sjs_valid");
    expect(result).toEqual({ valid: true, userId: "user-42" });
  });

  it("returns error message on db error", async () => {
    mockFindFirst.mockRejectedValue(new Error("Connection refused"));
    const result = await verifyApiKeyDetailed("sjs_valid");
    expect(result).toEqual({ valid: false, error: "Connection refused" });
  });
});
