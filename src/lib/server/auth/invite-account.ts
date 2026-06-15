/**
 * Account provisioning for invite flows.
 *
 * Shared by the email signup-invite (`/signup/invite`) and the device-share
 * invite (`/invite/[token]`): given an email + password, either create a brand
 * new credential account or re-key an existing user, then apply the invite's
 * permission flags. Factored out so both routes provision accounts identically.
 */

import { dbDirect as db } from "$lib/server/db";
import { eq } from "drizzle-orm";
import { accounts, sessions, users } from "$lib/server/db/schema";
import { auth } from "$lib/server/auth/better-auth";
import { randomBytes, scrypt } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);

/**
 * Hash a password using the same algorithm as Better Auth (scrypt).
 * Format: "salt_hex:key_hex" — compatible with Better Auth's default hasher.
 */
async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const key = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${key.toString("hex")}`;
}

/** Permission flags an invite can set on the provisioned account. */
export interface InviteAccountFlags {
  is_approved?: boolean;
  is_staff?: boolean;
  is_admin?: boolean;
}

/**
 * Create or re-key an account for an invited email and apply permission flags.
 *
 * - **Existing user** (invite sent after the user already existed): wipe their
 *   sessions + accounts and install a fresh credential account with the new
 *   password. Unspecified flags fall back to the user's current values, so an
 *   existing admin/staff is never silently downgraded.
 * - **New user**: create via Better Auth (handles hashing + account row).
 *   Unspecified flags default to `false`.
 *
 * Returns the user id so callers can act on the account (e.g. grant a device
 * share). Throws on failure — callers should surface a form error.
 */
export async function createOrLinkAccount(params: {
  email: string;
  password: string;
  name?: string;
  flags?: InviteAccountFlags;
}): Promise<{ userId: string }> {
  const { email, password, name, flags } = params;

  const existingUser = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  if (existingUser) {
    await db.delete(sessions).where(eq(sessions.userId, existingUser.id));
    await db.delete(accounts).where(eq(accounts.userId, existingUser.id));

    const hashedPassword = await hashPassword(password);
    await db.insert(accounts).values({
      id: crypto.randomUUID(),
      userId: existingUser.id,
      accountId: existingUser.id,
      providerId: "credential",
      password: hashedPassword,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.update(users).set({
      is_approved: flags?.is_approved ?? existingUser.is_approved,
      is_staff: flags?.is_staff ?? existingUser.is_staff,
      is_admin: flags?.is_admin ?? existingUser.is_admin,
    }).where(eq(users.id, existingUser.id));

    return { userId: existingUser.id };
  }

  const result = await auth.api.signUpEmail({
    body: { email, password, name: name || "" },
  });
  if (!result.user) {
    throw new Error("Failed to create account");
  }

  await db.update(users).set({
    is_approved: flags?.is_approved ?? false,
    is_staff: flags?.is_staff ?? false,
    is_admin: flags?.is_admin ?? false,
  }).where(eq(users.id, result.user.id));

  return { userId: result.user.id };
}
