import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  generateApiKey,
  hashApiKey,
  readStoredKey,
  verifyApiKey,
  verifyApiKeyDetailed,
} from "../api-key";
import { encryptCredential } from "../crypto";

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

/**
 * `key_plain` became `key_encrypted`: the column used to hold the device key as
 * plaintext beside its own sha256, which made the hash decorative.
 *
 * The case worth pinning is the ambiguous one. `decryptCredential` deliberately
 * passes non-ciphertext through unchanged so credentials could be migrated in
 * place, so "this key predates encryption" and "this ciphertext is not mine"
 * both come back as the input string. Only the first is a key.
 */
describe("readStoredKey", () => {
  const REAL = `sjs_${"a".repeat(64)}`;

  it("recovers a key it encrypted", () => {
    expect(readStoredKey(encryptCredential(REAL))).toBe(REAL);
  });

  it("reads a legacy plaintext row unchanged", () => {
    // What every row held before the migration, and what the lazy upgrade in
    // listApiKeys keys off. Reading these has to keep working or the devices
    // page loses the key before anything has had a chance to rewrite it.
    expect(readStoredKey(REAL)).toBe(REAL);
  });

  it("returns null for ciphertext this key cannot decrypt", () => {
    // A rotated SJS_CREDENTIALS_KEY. The device keeps authenticating — that
    // side runs on the sha256 — so the only loss is being able to re-read the
    // key, and the UI renders null as "no reveal button" rather than an error.
    const foreign = Buffer.concat([
      Buffer.alloc(12, 7),
      Buffer.from("not a key of ours"),
      Buffer.alloc(16, 9),
    ]).toString("base64");
    expect(readStoredKey(foreign)).toBeNull();
  });

  it("returns null rather than passing through a non-key string", () => {
    // The prefix check earning its keep: without it this would be reported as
    // a legacy plaintext key and offered to the user as one.
    expect(readStoredKey("hunter2")).toBeNull();
  });

  it("returns null for an empty or absent value", () => {
    expect(readStoredKey(null)).toBeNull();
    expect(readStoredKey("")).toBeNull();
  });
});
