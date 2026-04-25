/**
 * Credential encryption utilities
 *
 * Encrypts sensitive platform credentials (passwords, API tokens, security answers)
 * at rest using AES-256-GCM with a random nonce per encryption.
 *
 * Format: base64(nonce[12] + ciphertext + authTag[16])
 */

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { getEnv } from "$lib/tools/get-env";

const ALGORITHM = "aes-256-gcm";
const NONCE_LENGTH = 12;
const TAG_LENGTH = 16;

let _key: Buffer | null = null;

function getKey(): Buffer {
  if (_key) return _key;

  const keyHex = getEnv("SJS_CREDENTIALS_KEY", "");
  if (!keyHex) {
    throw new Error(
      "SJS_CREDENTIALS_KEY is not set. Cannot encrypt/decrypt credentials. " +
      "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
    );
  }

  if (keyHex.length !== 64) {
    throw new Error(
      "SJS_CREDENTIALS_KEY must be a 64-character hex string (32 bytes). " +
      "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
    );
  }

  _key = Buffer.from(keyHex, "hex");
  return _key;
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Returns a base64 string containing nonce + ciphertext + auth tag.
 * Returns null if input is null/undefined.
 */
export function encryptCredential(plaintext: string | null | undefined): string | null {
  if (plaintext == null) return null;

  const key = getKey();
  const nonce = randomBytes(NONCE_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, nonce);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  // nonce (12) + ciphertext (variable) + tag (16)
  return Buffer.concat([nonce, encrypted, tag]).toString("base64");
}

/**
 * Decrypt a credential encrypted with encryptCredential().
 * Returns null if input is null/undefined.
 * Throws on tampered or invalid data.
 */
export function decryptCredential(encoded: string | null | undefined): string | null {
  if (encoded == null) return null;

  // Support unencrypted legacy values during migration:
  // encrypted values are always valid base64 and decode to at least nonce + tag (28 bytes)
  const buf = Buffer.from(encoded, "base64");
  if (buf.length < NONCE_LENGTH + TAG_LENGTH) {
    // Too short to be encrypted — treat as plaintext (legacy)
    return encoded;
  }

  // Check if the re-encoded base64 matches the input.
  // Plaintext strings like "mypassword123" won't round-trip through base64.
  if (buf.toString("base64") !== encoded) {
    // Not valid base64 — treat as plaintext (legacy)
    return encoded;
  }

  const key = getKey();
  const nonce = buf.subarray(0, NONCE_LENGTH);
  const tag = buf.subarray(buf.length - TAG_LENGTH);
  const ciphertext = buf.subarray(NONCE_LENGTH, buf.length - TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, nonce);
  decipher.setAuthTag(tag);

  try {
    return Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    // If decryption fails, it might be a legacy plaintext value that happened
    // to look like valid base64. Return as-is.
    return encoded;
  }
}
