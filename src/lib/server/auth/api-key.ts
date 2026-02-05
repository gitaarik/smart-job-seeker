/**
 * API Key utilities for programmatic access
 * Handles API key generation, verification, and management
 */

import crypto from "crypto";
import { db } from "$lib/server/db";

/**
 * API key prefix for identification
 */
const API_KEY_PREFIX = "sjs_";

/**
 * Length of random bytes for key generation (32 bytes = 64 hex chars)
 */
const KEY_LENGTH_BYTES = 32;

/**
 * Result of API key verification
 */
export interface ApiKeyVerificationResult {
  valid: boolean;
  profileId?: number;
  error?: string;
}

/**
 * Generate a new API key
 * Format: sjs_ + 64 hex characters (32 bytes random)
 *
 * @returns Object containing the plain key and its hash for storage
 */
export function generateApiKey(): { key: string; hash: string } {
  const randomBytes = crypto.randomBytes(KEY_LENGTH_BYTES);
  const hexPart = randomBytes.toString("hex");
  const key = `${API_KEY_PREFIX}${hexPart}`;
  const hash = hashApiKey(key);

  return { key, hash };
}

/**
 * Hash an API key using SHA-256 for secure storage
 *
 * @param key - The plain API key to hash
 * @returns SHA-256 hash of the key
 */
export function hashApiKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

/**
 * Verify an API key and return the associated profile ID
 *
 * @param key - The API key to verify
 * @returns Profile ID if valid, null if invalid
 */
export async function verifyApiKey(
  key: string,
): Promise<number | null> {
  // Basic format validation
  if (!key || !key.startsWith(API_KEY_PREFIX)) {
    return null;
  }

  const keyHash = hashApiKey(key);

  try {
    const apiKey = await db.api_keys.findUnique({
      where: { key_hash: keyHash },
      select: {
        id: true,
        profile: true,
        revoked: true,
        expires_at: true,
      },
    });

    if (!apiKey) {
      return null;
    }

    // Check if revoked
    if (apiKey.revoked) {
      return null;
    }

    // Check if expired
    if (apiKey.expires_at && new Date(apiKey.expires_at) < new Date()) {
      return null;
    }

    // Update last_used timestamp (fire and forget)
    db.api_keys.update({
      where: { id: apiKey.id },
      data: { last_used: new Date() },
    }).catch(() => {
      // Ignore errors updating last_used
    });

    return apiKey.profile;
  } catch {
    return null;
  }
}

/**
 * Verify an API key with detailed result
 *
 * @param key - The API key to verify
 * @returns Detailed verification result
 */
export async function verifyApiKeyDetailed(
  key: string,
): Promise<ApiKeyVerificationResult> {
  // Basic format validation
  if (!key) {
    return { valid: false, error: "API key is required" };
  }

  if (!key.startsWith(API_KEY_PREFIX)) {
    return { valid: false, error: "Invalid API key format" };
  }

  const keyHash = hashApiKey(key);

  try {
    const apiKey = await db.api_keys.findUnique({
      where: { key_hash: keyHash },
      select: {
        id: true,
        profile: true,
        revoked: true,
        expires_at: true,
      },
    });

    if (!apiKey) {
      return { valid: false, error: "Invalid API key" };
    }

    if (apiKey.revoked) {
      return { valid: false, error: "API key has been revoked" };
    }

    if (apiKey.expires_at && new Date(apiKey.expires_at) < new Date()) {
      return { valid: false, error: "API key has expired" };
    }

    // Update last_used timestamp (fire and forget)
    db.api_keys.update({
      where: { id: apiKey.id },
      data: { last_used: new Date() },
    }).catch(() => {
      // Ignore errors updating last_used
    });

    return { valid: true, profileId: apiKey.profile };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : "Verification failed",
    };
  }
}

/**
 * Create a new API key for a profile
 *
 * @param profileId - The profile ID to create the key for
 * @param name - A descriptive name for the key
 * @param expiresAt - Optional expiration date
 * @returns The generated API key (plain text - only returned once)
 */
export async function createApiKey(
  profileId: number,
  name: string,
  expiresAt?: Date,
): Promise<{ id: number; key: string }> {
  const { key, hash } = generateApiKey();

  const created = await db.api_keys.create({
    data: {
      profile: profileId,
      name,
      key_hash: hash,
      expires_at: expiresAt,
    },
    select: { id: true },
  });

  return { id: created.id, key };
}

/**
 * Revoke an API key
 *
 * @param keyId - The ID of the key to revoke
 * @param profileId - The profile ID (for authorization)
 * @returns True if revoked, false if not found or not authorized
 */
export async function revokeApiKey(
  keyId: number,
  profileId: number,
): Promise<boolean> {
  const result = await db.api_keys.updateMany({
    where: {
      id: keyId,
      profile: profileId,
      revoked: false,
    },
    data: { revoked: true },
  });

  return result.count > 0;
}

/**
 * List API keys for a profile (without exposing the actual keys)
 *
 * @param profileId - The profile ID
 * @returns List of API keys with metadata
 */
export async function listApiKeys(profileId: number) {
  return db.api_keys.findMany({
    where: { profile: profileId },
    select: {
      id: true,
      name: true,
      date_created: true,
      expires_at: true,
      last_used: true,
      revoked: true,
    },
    orderBy: { date_created: "desc" },
  });
}
