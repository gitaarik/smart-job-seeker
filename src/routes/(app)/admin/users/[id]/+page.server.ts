import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { and, count, eq, gt, inArray, type SQL } from "drizzle-orm";
import { dbDirect as db, queryRaw, sql, sqlJoin } from "$lib/server/db";
import {
  accounts,
  credit_balances,
  profiles,
  sessions,
  subscriptions,
  usage_counters,
  users as usersTable,
  verifications,
} from "$lib/server/db/schema";
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
    where: eq(usersTable.id, params.id),
  });

  if (!user) {
    redirect(302, "/admin/users");
  }

  const [{ profileCount }] = await db.select({ profileCount: count() }).from(
    profiles,
  ).where(eq(profiles.user_id, user.id));

  const pendingInvite = await db.query.verifications.findFirst({
    where: and(
      eq(verifications.identifier, `invite:${user.email}`),
      gt(verifications.expiresAt, new Date()),
    ),
    columns: { id: true },
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

    const existing = await db.query.users.findFirst({
      where: eq(usersTable.id, params.id),
    });
    if (!existing) {
      return fail(404, { error: "User not found" });
    }

    await db.update(usersTable).set({
      name: name?.trim() || null,
      email: email.trim(),
      is_approved,
      is_staff,
      is_admin,
      updatedAt: new Date(),
    }).where(eq(usersTable.id, params.id));

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
      await db.update(subscriptions).set({
        status: "canceled",
        date_updated: new Date(),
      })
        .where(
          and(
            eq(subscriptions.user_id, userId),
            inArray(subscriptions.status, ["active", "trialing", "past_due"]),
          ),
        );
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
    await db.update(subscriptions).set({
      status: "canceled",
      date_updated: new Date(),
    })
      .where(
        and(
          eq(subscriptions.user_id, userId),
          inArray(subscriptions.status, ["active", "trialing", "past_due"]),
        ),
      );

    // Create admin-granted subscription (no Stripe IDs)
    await db.insert(subscriptions).values({
      user_id: userId,
      stripe_subscription_id: `admin_grant_${crypto.randomUUID()}`,
      stripe_price_id: "admin_grant",
      plan,
      status: "active",
      current_period_start: new Date(),
      current_period_end: periodEnd,
      cancel_at_period_end: false,
      date_created: new Date(),
    });

    return { success: true };
  },

  send_invite: async ({ locals, params }) => {
    if (!locals.user?.is_admin) {
      return fail(403, { error: "Admin access required" });
    }

    const user = await db.query.users.findFirst({
      where: eq(usersTable.id, params.id),
    });
    if (!user) {
      return fail(404, { error: "User not found" });
    }

    await db.delete(verifications).where(
      eq(verifications.identifier, `invite:${user.email}`),
    );

    const token = crypto.randomUUID();
    const inviteData = JSON.stringify({
      token,
      name: user.name || "",
      is_approved: user.is_approved,
      is_staff: user.is_staff,
      is_admin: user.is_admin,
    });

    await db.insert(verifications).values({
      id: crypto.randomUUID(),
      identifier: `invite:${user.email}`,
      value: inviteData,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      createdAt: new Date(),
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
        type: "invite",
        userId: user.id,
      });
    } catch (e: unknown) {
      await db.delete(verifications).where(
        eq(verifications.identifier, `invite:${user.email}`),
      );
      const message = e instanceof Error ? e.message : "Failed to send email";
      return fail(500, { error: `Invite email failed: ${message}` });
    }

    return { success: true };
  },

  impersonate: async ({ locals, cookies, params }) => {
    if (!locals.user?.is_admin) {
      return fail(403, { error: "Admin access required" });
    }

    const targetUser = await db.query.users.findFirst({
      where: eq(usersTable.id, params.id),
    });
    if (!targetUser) {
      return fail(404, { error: "User not found" });
    }

    cookies.set("sjs_impersonate", params.id, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60,
    });

    redirect(302, "/home");
  },

  clear_matches: async ({ locals, params }) => {
    if (!locals.user?.is_admin) {
      return fail(403, { error: "Admin access required" });
    }

    const user = await db.query.users.findFirst({
      where: eq(usersTable.id, params.id),
    });
    if (!user) {
      return fail(404, { error: "User not found" });
    }

    const userProfiles = await db.query.profiles.findMany({
      where: eq(profiles.user_id, params.id),
      columns: { id: true },
    });

    if (userProfiles.length === 0) {
      return fail(400, { error: "User has no profiles" });
    }

    const profileIds = userProfiles.map((p) => p.id);

    const result = await queryRaw<{ cnt: bigint }>(sql`
      WITH deleted AS (
        DELETE FROM job_matches
        WHERE profile_id IN (${sqlJoin(profileIds)})
        AND recommendation IS NOT NULL
        RETURNING id
      )
      SELECT COUNT(*) as cnt FROM deleted
    `);

    return { success: true, clearedCount: Number(result[0]?.cnt ?? 0) };
  },

  // Reset operational throttles (abuse guardrails) for this user. Clears the
  // device rate budget (incl. the per-sharee "shared device 10/day" cap), the
  // device min-run spacing, and the demo per-link run cap — all of which are
  // counted from the user's rows in search_task_runs. No money is involved.
  reset_run_limits: async ({ locals, params }) => {
    if (!locals.user?.is_admin) {
      return fail(403, { error: "Admin access required" });
    }

    const user = await db.query.users.findFirst({
      where: eq(usersTable.id, params.id),
    });
    if (!user) {
      return fail(404, { error: "User not found" });
    }

    const userProfiles = await db.query.profiles.findMany({
      where: eq(profiles.user_id, params.id),
      columns: { id: true },
    });

    if (userProfiles.length === 0) {
      return fail(400, { error: "User has no profiles" });
    }

    const profileIds = userProfiles.map((p) => p.id);

    // Cascades to scraper_logs / scraper_log_steps / search_task_run_items.
    const result = await queryRaw<{ cnt: bigint }>(sql`
      WITH deleted AS (
        DELETE FROM search_task_runs
        WHERE search_task_id IN (
          SELECT id FROM search_tasks WHERE profile_id IN (${
      sqlJoin(profileIds)
    })
        )
        RETURNING id
      )
      SELECT COUNT(*) as cnt FROM deleted
    `);

    return { success: true, clearedCount: Number(result[0]?.cnt ?? 0) };
  },

  // Reset billing usage for this period. Zeroes the consumption counters but
  // leaves plan allowance and purchased extras intact — i.e. grants the user a
  // fresh quota without removing anything they paid for. This effectively hands
  // out free usage, so it is a deliberate, separate action from run limits.
  reset_billing_usage: async ({ locals, params }) => {
    if (!locals.user?.is_admin) {
      return fail(403, { error: "Admin access required" });
    }

    const user = await db.query.users.findFirst({
      where: eq(usersTable.id, params.id),
    });
    if (!user) {
      return fail(404, { error: "User not found" });
    }

    // Zero consumption across all periods; keep extra_* (purchased) untouched.
    await db.update(usage_counters).set({
      ai_generations: 0,
      ai_followups: 0,
      job_matches: 0,
      scrape_runs: 0,
      pdf_exports: 0,
      resume_parses: 0,
    }).where(eq(usage_counters.user_id, params.id));

    // Zero credits used; keep allowance and purchased extra_credits untouched.
    await db.update(credit_balances).set({ credits_used: 0 })
      .where(eq(credit_balances.user_id, params.id));

    return { success: true };
  },

  delete: async ({ locals, params }) => {
    if (!locals.user?.is_admin) {
      return fail(403, { error: "Admin access required" });
    }

    if (params.id === locals.user.id) {
      return fail(400, { error: "Cannot delete your own account" });
    }

    const existing = await db.query.users.findFirst({
      where: eq(usersTable.id, params.id),
    });
    if (!existing) {
      return fail(404, { error: "User not found" });
    }

    await db.delete(sessions).where(eq(sessions.userId, params.id));
    await db.delete(accounts).where(eq(accounts.userId, params.id));
    await db.delete(usersTable).where(eq(usersTable.id, params.id));

    redirect(302, "/admin/users");
  },
};
