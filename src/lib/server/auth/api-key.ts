/**
 * API Key utilities for programmatic access
 *
 * API keys identify devices owned by the user. They're scoped to user_id,
 * not profile_id — a device is the same physical machine regardless of
 * which profile is active.
 */

import crypto from "crypto";
import { db } from "$lib/server/db";
import { and, eq } from "drizzle-orm";
import { api_keys } from "$lib/server/db/schema";
import { getErrorMessage } from "$lib/server/utils/errors";
import { decryptCredential, encryptCredential } from "./crypto";

/** API key prefix for identification */
const API_KEY_PREFIX = "sjs_";

/** Length of random bytes for key generation (32 bytes = 64 hex chars) */
const KEY_LENGTH_BYTES = 32;

/** Result of API key verification */
export interface ApiKeyVerificationResult {
  valid: boolean;
  userId?: string;
  error?: string;
}

/** Generate a new API key. Format: sjs_ + 64 hex characters. */
export function generateApiKey(): { key: string; hash: string } {
  const randomBytes = crypto.randomBytes(KEY_LENGTH_BYTES);
  const hexPart = randomBytes.toString("hex");
  const key = `${API_KEY_PREFIX}${hexPart}`;
  const hash = hashApiKey(key);

  return { key, hash };
}

/** Hash an API key using SHA-256 for secure storage. */
export function hashApiKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

/**
 * Recover a stored key for display, or null when it can't be read.
 *
 * Null is a normal outcome, not an error: `decryptCredential` needs
 * SJS_CREDENTIALS_KEY, and a row written under a key that has since been
 * rotated is simply no longer readable. The device keeps working — that side
 * authenticates on the sha256, which this does not touch — so the only loss is
 * the ability to re-read the key, and the UI already hides the reveal and copy
 * controls when there is nothing to show.
 *
 * The prefix check is what makes that distinction reliable. `decryptCredential`
 * deliberately passes non-ciphertext through unchanged so credentials could be
 * migrated in place, which means "failed to decrypt" and "was never encrypted"
 * both come back as the input. For a value with a known shape that ambiguity is
 * resolvable: a real key always starts with `sjs_`, so anything else is
 * unreadable rather than legacy, whatever it looks like.
 */
export function readStoredKey(stored: string | null): string | null {
  if (!stored) return null;
  try {
    const value = decryptCredential(stored);
    return value?.startsWith(API_KEY_PREFIX) ? value : null;
  } catch {
    return null;
  }
}

/**
 * Verify an API key and return the owning user_id.
 * Returns null if invalid, revoked, or expired.
 */
export async function verifyApiKey(key: string): Promise<string | null> {
  if (!key || !key.startsWith(API_KEY_PREFIX)) return null;

  const keyHash = hashApiKey(key);

  try {
    const apiKey = await db.query.api_keys.findFirst({
      where: eq(api_keys.key_hash, keyHash),
      columns: {
        id: true,
        user_id: true,
        revoked: true,
        expires_at: true,
      },
    });

    if (!apiKey) return null;
    if (apiKey.revoked) return null;
    if (apiKey.expires_at && new Date(apiKey.expires_at) < new Date()) {
      return null;
    }

    // Update last_used timestamp (fire and forget)
    db.update(api_keys).set({ last_used: new Date() })
      .where(eq(api_keys.id, apiKey.id))
      .catch(() => {
        // Ignore errors updating last_used
      });

    return apiKey.user_id;
  } catch {
    return null;
  }
}

/** Verify an API key with detailed result */
export async function verifyApiKeyDetailed(
  key: string,
): Promise<ApiKeyVerificationResult> {
  if (!key) return { valid: false, error: "Device key is required" };
  if (!key.startsWith(API_KEY_PREFIX)) {
    return { valid: false, error: "Invalid device key format" };
  }

  const keyHash = hashApiKey(key);

  try {
    const apiKey = await db.query.api_keys.findFirst({
      where: eq(api_keys.key_hash, keyHash),
      columns: {
        id: true,
        user_id: true,
        revoked: true,
        expires_at: true,
      },
    });

    if (!apiKey) return { valid: false, error: "Invalid device key" };
    if (apiKey.revoked) {
      return { valid: false, error: "Device key has been revoked" };
    }
    if (apiKey.expires_at && new Date(apiKey.expires_at) < new Date()) {
      return { valid: false, error: "Device key has expired" };
    }

    db.update(api_keys).set({ last_used: new Date() })
      .where(eq(api_keys.id, apiKey.id))
      .catch(() => {
        // Ignore errors updating last_used
      });

    return { valid: true, userId: apiKey.user_id };
  } catch (error) {
    return {
      valid: false,
      error: getErrorMessage(error, "Verification failed"),
    };
  }
}

/**
 * Create a new API key for a user.
 * @returns The generated API key (plain text - only returned once)
 */
export async function createApiKey(
  userId: string,
  name: string,
  expiresAt?: Date,
): Promise<{ id: number; key: string }> {
  const { key, hash } = generateApiKey();

  const [created] = await db.insert(api_keys).values({
    user_id: userId,
    name,
    key_hash: hash,
    key_encrypted: encryptCredential(key),
    expires_at: expiresAt,
  }).returning({ id: api_keys.id });

  return { id: created.id, key };
}

/** Revoke an API key. */
export async function revokeApiKey(
  keyId: number,
  userId: string,
): Promise<boolean> {
  const result = await db.update(api_keys).set({ revoked: true })
    .where(and(
      eq(api_keys.id, keyId),
      eq(api_keys.user_id, userId),
      eq(api_keys.revoked, false),
    ));

  return (result.rowCount ?? 0) > 0;
}

/** Re-activate a revoked API key. */
export async function activateApiKey(
  keyId: number,
  userId: string,
): Promise<boolean> {
  const result = await db.update(api_keys).set({ revoked: false })
    .where(and(
      eq(api_keys.id, keyId),
      eq(api_keys.user_id, userId),
      eq(api_keys.revoked, true),
    ));

  return (result.rowCount ?? 0) > 0;
}

/** Rename an API key. */
export async function renameApiKey(
  keyId: number,
  userId: string,
  name: string,
): Promise<boolean> {
  const result = await db.update(api_keys).set({ name })
    .where(and(eq(api_keys.id, keyId), eq(api_keys.user_id, userId)));

  return (result.rowCount ?? 0) > 0;
}

/** Permanently delete an API key. */
export async function deleteApiKey(
  keyId: number,
  userId: string,
): Promise<boolean> {
  const result = await db.delete(api_keys)
    .where(and(eq(api_keys.id, keyId), eq(api_keys.user_id, userId)));

  return (result.rowCount ?? 0) > 0;
}

/**
 * Rewrite a row still holding its pre-encryption plaintext.
 *
 * Lazy, in the manner of `last_used` above: fire-and-forget, and a failure
 * leaves the row exactly as it was. Belt and braces alongside
 * `scripts/encrypt-api-keys.ts` — that script is the deterministic answer, and
 * this is what covers the case where it is forgotten on an environment, which
 * is not hypothetical here (the jobs.region backfill has never been run on
 * preview). Between them, a key reaches ciphertext either when the script runs
 * or the first time its owner opens the devices page.
 *
 * The try/catch is not decoration: encryptCredential throws synchronously when
 * SJS_CREDENTIALS_KEY is unset, before there is a promise for .catch to attach
 * to.
 */
function upgradeStoredKey(id: number, key: string): void {
  try {
    db.update(api_keys)
      .set({ key_encrypted: encryptCredential(key) })
      .where(eq(api_keys.id, id))
      .catch(() => {
        // Ignore — the next read tries again.
      });
  } catch {
    // No encryption key configured; leave the row alone.
  }
}

/**
 * List a user's API keys, each with its key decrypted for display.
 *
 * `key_plain` on the way out is accurate — it is the plain key — even though
 * the column behind it is `key_encrypted`. Null means unreadable (see
 * readStoredKey), which the devices page already renders as "no reveal button"
 * rather than as an error.
 */
export async function listApiKeys(userId: string) {
  const rows = await db.query.api_keys.findMany({
    where: eq(api_keys.user_id, userId),
    columns: {
      id: true,
      name: true,
      key_encrypted: true,
      date_created: true,
      expires_at: true,
      last_used: true,
      revoked: true,
    },
    orderBy: (api_keys, { desc }) => desc(api_keys.date_created),
  });

  return rows.map(({ key_encrypted, ...rest }) => {
    const key = readStoredKey(key_encrypted);
    // Unchanged by the round trip means it was never encrypted — a legacy row.
    if (key !== null && key === key_encrypted) upgradeStoredKey(rest.id, key);
    return { ...rest, key_plain: key };
  });
}
