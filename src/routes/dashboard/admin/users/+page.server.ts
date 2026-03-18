import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";
import { auth } from "$lib/server/auth/better-auth";
import { sendEmail } from "$lib/server/email";
import { getEnv } from "$lib/tools/get-env";
import crypto from "crypto";

export const load: PageServerLoad = async ({ parent }) => {
  await parent();

  const users = await db.users.findMany({
    orderBy: { createdAt: "desc" },
  });

  const profileCounts = await db.profiles.groupBy({
    by: ["user_id"],
    _count: { id: true },
  });

  const profileCountMap = new Map(
    profileCounts.map((p) => [p.user_id, p._count.id]),
  );

  // Fetch pending invites to show invite status per user
  const pendingInvites = await db.verifications.findMany({
    where: {
      identifier: { startsWith: "invite:" },
      expiresAt: { gt: new Date() },
    },
    select: { identifier: true },
  });

  const invitedEmails = new Set(
    pendingInvites.map((v) => v.identifier.replace("invite:", "")),
  );

  const usersWithProfiles = users.map((u) => ({
    ...u,
    profileCount: profileCountMap.get(u.id) ?? 0,
    hasInvite: invitedEmails.has(u.email),
  }));

  return { users: usersWithProfiles };
};

export const actions: Actions = {
  create: async ({ request, locals }) => {
    if (!locals.user?.is_admin) {
      return fail(403, { error: "Admin access required" });
    }

    const formData = await request.formData();
    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const is_approved = formData.get("is_approved") === "on";
    const is_staff = formData.get("is_staff") === "on";
    const is_admin = formData.get("is_admin") === "on";

    if (!email?.trim()) {
      return fail(400, { error: "Email is required" });
    }
    if (!password || password.length < 8) {
      return fail(400, { error: "Password must be at least 8 characters" });
    }

    try {
      const result = await auth.api.signUpEmail({
        body: {
          email: email.trim(),
          password,
          name: name?.trim() || "",
        },
      });

      if (result.user) {
        await db.users.update({
          where: { id: result.user.id },
          data: { is_approved, is_staff, is_admin },
        });
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to create user";
      return fail(400, { error: message });
    }

    return { success: true };
  },

  invite: async ({ request, locals }) => {
    if (!locals.user?.is_admin) {
      return fail(403, { error: "Admin access required" });
    }

    const formData = await request.formData();
    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const is_approved = formData.get("is_approved") === "on";
    const is_staff = formData.get("is_staff") === "on";
    const is_admin = formData.get("is_admin") === "on";

    if (!email?.trim()) {
      return fail(400, { error: "Email is required" });
    }

    const existing = await db.users.findFirst({
      where: { email: email.trim() },
    });
    if (existing) {
      return fail(400, { error: "A user with this email already exists" });
    }

    // Delete any existing invite for this email
    await db.verifications.deleteMany({
      where: { identifier: `invite:${email.trim()}` },
    });

    const token = crypto.randomUUID();
    const inviteData = JSON.stringify({
      token,
      name: name?.trim() || "",
      is_approved,
      is_staff,
      is_admin,
    });

    await db.verifications.create({
      data: {
        id: crypto.randomUUID(),
        identifier: `invite:${email.trim()}`,
        value: inviteData,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
      },
    });

    const baseUrl = getEnv("SJS_APP_URL_HOST", "http://localhost:5173");
    try {
      await sendEmail({
        to: email.trim(),
        subject: "You're invited to Smart Job Seeker",
        html: `
          <h2>You've been invited!</h2>
          <p>You've been invited to join Smart Job Seeker.</p>
          <p>Click the link below to set up your account:</p>
          <p><a href="${baseUrl}/signup/invite?token=${token}">Accept Invitation & Set Password</a></p>
          <p>This invitation expires in 7 days.</p>
        `,
      });
    } catch (e: unknown) {
      // Clean up the verification record if email fails
      await db.verifications.deleteMany({
        where: { identifier: `invite:${email.trim()}` },
      });
      const message = e instanceof Error ? e.message : "Failed to send email";
      return fail(500, { error: `Invite email failed: ${message}` });
    }

    return { success: true };
  },

  send_invite: async ({ request, locals }) => {
    if (!locals.user?.is_admin) {
      return fail(403, { error: "Admin access required" });
    }

    const formData = await request.formData();
    const id = formData.get("id") as string;

    if (!id) {
      return fail(400, { error: "User ID is required" });
    }

    const user = await db.users.findUnique({ where: { id } });
    if (!user) {
      return fail(404, { error: "User not found" });
    }

    // Delete any existing invite for this email
    await db.verifications.deleteMany({
      where: { identifier: `invite:${user.email}` },
    });

    const token = crypto.randomUUID();
    const inviteData = JSON.stringify({
      token,
      name: user.name || "",
      is_approved: user.is_approved,
      is_staff: user.is_staff,
      is_admin: user.is_admin,
    });

    await db.verifications.create({
      data: {
        id: crypto.randomUUID(),
        identifier: `invite:${user.email}`,
        value: inviteData,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
      },
    });

    const baseUrl = getEnv("SJS_APP_URL_HOST", "http://localhost:5173");
    try {
      await sendEmail({
        to: user.email,
        subject: "You're invited to Smart Job Seeker",
        html: `
          <h2>You've been invited!</h2>
          <p>You've been invited to join Smart Job Seeker.</p>
          <p>Click the link below to set up your account:</p>
          <p><a href="${baseUrl}/signup/invite?token=${token}">Accept Invitation & Set Password</a></p>
          <p>This invitation expires in 7 days.</p>
        `,
      });
    } catch (e: unknown) {
      await db.verifications.deleteMany({
        where: { identifier: `invite:${user.email}` },
      });
      const message = e instanceof Error ? e.message : "Failed to send email";
      return fail(500, { error: `Invite email failed: ${message}` });
    }

    return { success: true };
  },

  update: async ({ request, locals }) => {
    if (!locals.user?.is_admin) {
      return fail(403, { error: "Admin access required" });
    }

    const formData = await request.formData();
    const id = formData.get("id") as string;
    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const is_approved = formData.get("is_approved") === "on";
    const is_staff = formData.get("is_staff") === "on";
    const is_admin = formData.get("is_admin") === "on";

    if (!id) {
      return fail(400, { error: "User ID is required" });
    }

    if (!email?.trim()) {
      return fail(400, { error: "Email is required" });
    }

    // Prevent admin from removing their own admin flag
    if (id === locals.user.id && !is_admin) {
      return fail(400, { error: "Cannot remove your own admin status" });
    }

    const existing = await db.users.findUnique({ where: { id } });
    if (!existing) {
      return fail(404, { error: "User not found" });
    }

    await db.users.update({
      where: { id },
      data: {
        name: name?.trim() || null,
        email: email.trim(),
        is_approved,
        is_staff,
        is_admin,
        updatedAt: new Date(),
      },
    });

    return { success: true };
  },

  impersonate: async ({ request, locals, cookies }) => {
    if (!locals.user?.is_admin) {
      return fail(403, { error: "Admin access required" });
    }

    const formData = await request.formData();
    const id = formData.get("id") as string;

    if (!id) {
      return fail(400, { error: "User ID is required" });
    }

    const targetUser = await db.users.findUnique({ where: { id } });
    if (!targetUser) {
      return fail(404, { error: "User not found" });
    }

    cookies.set("sjs_impersonate", id, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60, // 1 hour
    });

    redirect(302, "/dashboard");
  },

  stop_impersonate: async ({ locals, cookies }) => {
    if (!locals.user?.is_admin && !locals.adminUser?.is_admin) {
      return fail(403, { error: "Admin access required" });
    }

    cookies.delete("sjs_impersonate", { path: "/" });
    redirect(302, "/dashboard/admin/users");
  },

  delete: async ({ request, locals }) => {
    if (!locals.user?.is_admin) {
      return fail(403, { error: "Admin access required" });
    }

    const formData = await request.formData();
    const id = formData.get("id") as string;

    if (!id) {
      return fail(400, { error: "User ID is required" });
    }

    if (id === locals.user.id) {
      return fail(400, { error: "Cannot delete your own account" });
    }

    const existing = await db.users.findUnique({ where: { id } });
    if (!existing) {
      return fail(404, { error: "User not found" });
    }

    // Delete sessions and accounts first (cascade)
    await db.sessions.deleteMany({ where: { userId: id } });
    await db.accounts.deleteMany({ where: { userId: id } });
    await db.users.delete({ where: { id } });

    return { success: true };
  },
};
