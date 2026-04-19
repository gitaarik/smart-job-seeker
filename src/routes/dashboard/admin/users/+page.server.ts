import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";
import { auth } from "$lib/server/auth/better-auth";
import { sendEmail } from "$lib/server/email";
import { getEnv } from "$lib/tools/get-env";
import crypto from "crypto";

export const load: PageServerLoad = async ({ parent }) => {
  await parent();

  const users = await db.query.users.findMany({
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
  const pendingInvites = await db.query.verifications.findMany({
    where: {
      identifier: { startsWith: "invite:" },
      expiresAt: { gt: new Date() },
    },
    select: { identifier: true, value: true, expiresAt: true, createdAt: true },
  });

  const invitedEmails = new Set(
    pendingInvites.map((v) => v.identifier.replace("invite:", "")),
  );

  // Fetch active subscriptions to show plan per user
  const activeSubs = await db.query.subscriptions.findMany({
    where: { status: { in: ["active", "trialing", "past_due"] } },
    orderBy: { date_created: "desc" },
    select: { user_id: true, plan: true },
  });

  const userPlanMap = new Map<string, string>();
  for (const sub of activeSubs) {
    if (!userPlanMap.has(sub.user_id)) {
      userPlanMap.set(sub.user_id, sub.plan);
    }
  }

  const usersWithProfiles = users.map((u) => ({
    ...u,
    profileCount: profileCountMap.get(u.id) ?? 0,
    hasInvite: invitedEmails.has(u.email),
    plan: userPlanMap.get(u.id) ?? "free",
  }));

  // Build list of pending invitations that haven't been accepted yet
  const existingEmails = new Set(users.map((u) => u.email));
  const pendingInvitations = pendingInvites
    .filter((v) => !existingEmails.has(v.identifier.replace("invite:", "")))
    .map((v) => {
      const email = v.identifier.replace("invite:", "");
      let name = "";
      let is_approved = false;
      let is_staff = false;
      let is_admin = false;
      try {
        const data = JSON.parse(v.value);
        name = data.name || "";
        is_approved = data.is_approved || false;
        is_staff = data.is_staff || false;
        is_admin = data.is_admin || false;
      } catch {}
      return { email, name, is_approved, is_staff, is_admin, expiresAt: v.expiresAt, createdAt: v.createdAt };
    });

  return { users: usersWithProfiles, pendingInvitations };
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

    const existing = await db.query.users.findFirst({
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
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
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
          <p>This invitation expires in 30 days.</p>
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

  revoke_invite: async ({ request, locals }) => {
    if (!locals.user?.is_admin) {
      return fail(403, { error: "Admin access required" });
    }

    const formData = await request.formData();
    const email = formData.get("email") as string;

    if (!email?.trim()) {
      return fail(400, { error: "Email is required" });
    }

    const deleted = await db.verifications.deleteMany({
      where: { identifier: `invite:${email.trim()}` },
    });

    if (deleted.count === 0) {
      return fail(404, { error: "Invitation not found" });
    }

    return { success: true };
  },

  update_invite_expiry: async ({ request, locals }) => {
    if (!locals.user?.is_admin) {
      return fail(403, { error: "Admin access required" });
    }

    const formData = await request.formData();
    const email = formData.get("email") as string;
    const expiresAt = formData.get("expiresAt") as string;

    if (!email?.trim() || !expiresAt) {
      return fail(400, { error: "Email and expiry date are required" });
    }

    const newExpiry = new Date(expiresAt);
    if (isNaN(newExpiry.getTime())) {
      return fail(400, { error: "Invalid date" });
    }

    const updated = await db.verifications.updateMany({
      where: { identifier: `invite:${email.trim()}` },
      data: { expiresAt: newExpiry },
    });

    if (updated.count === 0) {
      return fail(404, { error: "Invitation not found" });
    }

    return { success: true };
  },

  stop_impersonate: async ({ locals, cookies }) => {
    if (!locals.user?.is_admin && !locals.adminUser?.is_admin) {
      return fail(403, { error: "Admin access required" });
    }

    cookies.delete("sjs_impersonate", { path: "/" });
    redirect(302, "/dashboard/admin/users");
  },
};
