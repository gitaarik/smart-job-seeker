import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { sql, type SQL } from "drizzle-orm";
import { dbDirect as db, sqlJoin, queryRaw } from "$lib/server/db";
import { auth } from "$lib/server/auth/better-auth";
import { sendEmail } from "$lib/server/email";
import { getEnv } from "$lib/tools/get-env";
import { getActiveSubscription } from "$lib/server/billing/subscription";
import { getBalance, getRecentTransactions } from "$lib/server/billing/credits";
import { PLAN_LIMITS, type PlanId } from "$lib/server/billing/plans";
import crypto from "crypto";

export const load: PageServerLoad = async ({ params, parent }) => {
  const layoutData = await parent();

  const user = await db.query.users.findFirst({
    where: { id: params.id },
  });

  if (!user) {
    redirect(302, "/dashboard/admin/users");
  }

  const profileCount = await db.profiles.count({
    where: { user_id: user.id },
  });

  const pendingInvite = await db.query.verifications.findFirst({
    where: {
      identifier: `invite:${user.email}`,
      expiresAt: { gt: new Date() },
    },
    select: { id: true },
  });

  const [subscription, creditBalance, recentTransactions] = await Promise.all([
    getActiveSubscription(user.id),
    getBalance(user.id),
    getRecentTransactions(user.id, 10),
  ]);

  return {
    targetUser: {
      ...user,
      profileCount,
      hasInvite: !!pendingInvite,
    },
    subscription,
    creditBalance,
    recentTransactions,
    planOptions: Object.keys(PLAN_LIMITS) as PlanId[],
  };
};

export const actions: Actions = {
  update: async ({ request, locals, params }) => {
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

    // Prevent admin from removing their own admin flag
    if (params.id === locals.user.id && !is_admin) {
      return fail(400, { error: "Cannot remove your own admin status" });
    }

    const existing = await db.query.users.findFirst({ where: { id: params.id } });
    if (!existing) {
      return fail(404, { error: "User not found" });
    }

    await db.users.update({
      where: { id: params.id },
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

  set_subscription: async ({ request, locals, params }) => {
    if (!locals.user?.is_admin) {
      return fail(403, { error: "Admin access required" });
    }

    const formData = await request.formData();
    const plan = formData.get("plan") as string;
    const expiresAt = formData.get("expires_at") as string;

    if (!plan || !(plan in PLAN_LIMITS)) {
      return fail(400, { error: "Invalid plan" });
    }

    const userId = params.id;

    if (plan === "explorer") {
      // Cancel any active subscription
      await db.subscriptions.updateMany({
        where: {
          user_id: userId,
          status: { in: ["active", "trialing", "past_due"] },
        },
        data: { status: "canceled", date_updated: new Date() },
      });
      return { success: true };
    }

    // Parse expiry date
    let periodEnd: Date;
    if (expiresAt) {
      periodEnd = new Date(expiresAt);
      if (isNaN(periodEnd.getTime())) {
        return fail(400, { error: "Invalid expiry date" });
      }
    } else {
      // Default: 1 month from now
      periodEnd = new Date();
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    // Cancel any existing active subs first
    await db.subscriptions.updateMany({
      where: {
        user_id: userId,
        status: { in: ["active", "trialing", "past_due"] },
      },
      data: { status: "canceled", date_updated: new Date() },
    });

    // Create admin-granted subscription (no Stripe IDs)
    await db.subscriptions.create({
      data: {
        user_id: userId,
        stripe_subscription_id: `admin_grant_${crypto.randomUUID()}`,
        stripe_price_id: "admin_grant",
        plan,
        status: "active",
        current_period_start: new Date(),
        current_period_end: periodEnd,
        cancel_at_period_end: false,
        date_created: new Date(),
      },
    });

    return { success: true };
  },

  send_invite: async ({ locals, params }) => {
    if (!locals.user?.is_admin) {
      return fail(403, { error: "Admin access required" });
    }

    const user = await db.query.users.findFirst({ where: { id: params.id } });
    if (!user) {
      return fail(404, { error: "User not found" });
    }

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

  impersonate: async ({ locals, cookies, params }) => {
    if (!locals.user?.is_admin) {
      return fail(403, { error: "Admin access required" });
    }

    const targetUser = await db.query.users.findFirst({ where: { id: params.id } });
    if (!targetUser) {
      return fail(404, { error: "User not found" });
    }

    cookies.set("sjs_impersonate", params.id, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60,
    });

    redirect(302, "/dashboard");
  },

  clear_matches: async ({ locals, params }) => {
    if (!locals.user?.is_admin) {
      return fail(403, { error: "Admin access required" });
    }

    const user = await db.query.users.findFirst({ where: { id: params.id } });
    if (!user) {
      return fail(404, { error: "User not found" });
    }

    const profiles = await db.query.profiles.findMany({
      where: { user_id: params.id },
      select: { id: true },
    });

    if (profiles.length === 0) {
      return fail(400, { error: "User has no profiles" });
    }

    const profileIds = profiles.map((p) => p.id);

    const result = await queryRaw<{ cnt: bigint }[]>(sql`
      WITH deleted AS (
        DELETE FROM job_matches
        WHERE profile_id IN (${sqlJoin(profileIds)})
        AND reasoning IS NOT NULL
        RETURNING id
      )
      SELECT COUNT(*) as cnt FROM deleted
    `);

    return { success: true, clearedCount: Number(result[0]?.cnt ?? 0) };
  },

  delete: async ({ locals, params }) => {
    if (!locals.user?.is_admin) {
      return fail(403, { error: "Admin access required" });
    }

    if (params.id === locals.user.id) {
      return fail(400, { error: "Cannot delete your own account" });
    }

    const existing = await db.query.users.findFirst({ where: { id: params.id } });
    if (!existing) {
      return fail(404, { error: "User not found" });
    }

    await db.sessions.deleteMany({ where: { userId: params.id } });
    await db.accounts.deleteMany({ where: { userId: params.id } });
    await db.users.delete({ where: { id: params.id } });

    redirect(302, "/dashboard/admin/users");
  },
};
