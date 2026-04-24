import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";
import { eq, and, gt, like } from "drizzle-orm";
import { verifications, users, sessions, accounts } from "$lib/server/db/schema";
import { auth } from "$lib/server/auth/better-auth";
import { randomBytes, scrypt } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);

/**
 * Hash a password using the same algorithm as Better Auth (scrypt).
 * Format: "salt_hex:key_hex" — compatible with Better Auth's default password hasher.
 */
async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const key = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${key.toString("hex")}`;
}

function findInviteByToken(
  invites: { id: string; identifier: string; value: string }[],
  token: string,
) {
  return invites.find((v) => {
    try {
      return JSON.parse(v.value).token === token;
    } catch {
      return false;
    }
  });
}

export const load: PageServerLoad = async (event) => {
  // If already logged in, redirect away
  if (event.locals.user) {
    redirect(302, "/home");
  }

  const token = event.url.searchParams.get("token");
  if (!token) {
    return { valid: false as const, error: "No invitation token provided." };
  }

  const invites = await db.query.verifications.findMany({
    where: and(
      like(verifications.identifier, "invite:%"),
      gt(verifications.expiresAt, new Date()),
    ),
  });

  const invite = findInviteByToken(invites, token);

  if (!invite) {
    return {
      valid: false as const,
      error: "This invitation link is invalid or has expired.",
    };
  }

  const data = JSON.parse(invite.value);
  const email = invite.identifier.replace("invite:", "");

  return {
    valid: true as const,
    email,
    name: data.name || "",
    token,
  };
};

export const actions: Actions = {
  default: async (event) => {
    const formData = await event.request.formData();
    const token = formData.get("token") as string;
    const password = formData.get("password") as string;
    const confirmPassword = formData.get("confirm_password") as string;

    if (!token) {
      return fail(400, { error: "Missing invitation token" });
    }

    if (!password || password.length < 8) {
      return fail(400, { error: "Password must be at least 8 characters" });
    }

    if (password !== confirmPassword) {
      return fail(400, { error: "Passwords do not match" });
    }

    // Find and validate invite
    const invites = await db.query.verifications.findMany({
      where: and(
        like(verifications.identifier, "invite:%"),
        gt(verifications.expiresAt, new Date()),
      ),
    });

    const invite = findInviteByToken(invites, token);

    if (!invite) {
      return fail(400, {
        error: "This invitation link is invalid or has expired.",
      });
    }

    const data = JSON.parse(invite.value);
    const email = invite.identifier.replace("invite:", "");

    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (existingUser) {
      // Existing user (invite sent after user was already created)
      // Replace their credentials so they can log in with the new password
      try {
        await db.delete(sessions).where(eq(sessions.userId, existingUser.id));
        await db.delete(accounts).where(eq(accounts.userId, existingUser.id));

        const hashedPassword = await hashPassword(password);
        const [newAccount] = await db.insert(accounts).values({
          id: crypto.randomUUID(),
          userId: existingUser.id,
          accountId: existingUser.id,
          providerId: "credential",
          password: hashedPassword,
          createdAt: new Date(),
          updatedAt: new Date(),
        }).returning();

        // Update flags from invite data
        await db.update(users).set({
          is_approved: data.is_approved ?? existingUser.is_approved,
          is_staff: data.is_staff ?? existingUser.is_staff,
          is_admin: data.is_admin ?? existingUser.is_admin,
        }).where(eq(users.id, existingUser.id));
      } catch (e: unknown) {
        const message = e instanceof Error
          ? e.message
          : "Failed to set up account";
        return fail(400, { error: message });
      }
    } else {
      // New user — create via Better Auth (handles password hashing + account)
      try {
        const result = await auth.api.signUpEmail({
          body: { email, password, name: data.name || "" },
        });

        if (result.user) {
          await db.update(users).set({
            is_approved: data.is_approved ?? false,
            is_staff: data.is_staff ?? false,
            is_admin: data.is_admin ?? false,
          }).where(eq(users.id, result.user.id));
        }
      } catch (e: unknown) {
        const message = e instanceof Error
          ? e.message
          : "Failed to create account";
        return fail(400, { error: message });
      }
    }

    // Clean up the invite
    await db.delete(verifications).where(eq(verifications.id, invite.id));

    redirect(302, "/login?invited=1");
  },
};
