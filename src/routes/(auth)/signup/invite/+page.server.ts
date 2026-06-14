import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";
import { and, gt, like } from "drizzle-orm";
import { eq } from "drizzle-orm";
import { verifications } from "$lib/server/db/schema";
import { createOrLinkAccount } from "$lib/server/auth/invite-account";

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

    try {
      await createOrLinkAccount({
        email,
        password,
        name: data.name,
        flags: {
          is_approved: data.is_approved,
          is_staff: data.is_staff,
          is_admin: data.is_admin,
        },
      });
    } catch (e: unknown) {
      const message = e instanceof Error
        ? e.message
        : "Failed to set up account";
      return fail(400, { error: message });
    }

    // Clean up the invite
    await db.delete(verifications).where(eq(verifications.id, invite.id));

    redirect(302, "/login?invited=1");
  },
};
