/**
 * Demo-user provisioning.
 *
 * A demo invite link (`demo_links`) maps to exactly one ephemeral demo user,
 * minted on first open and resumed on later opens until the link expires. This
 * module mints that user, clones the curated template profile into it, grants
 * access to the link's devices, and seeds the Seeker plan so scraping + AI work
 * out of the box. See planning/DEMO-INVITE-LINKS.md.
 */

import { createHmac } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { dbDirect as db } from "$lib/server/db";
import {
  credential_shares,
  demo_link_devices,
  demo_links,
  type DemoLinks,
  platform_credentials,
  platform_profiles,
  profiles,
  search_tasks,
  subscriptions,
  users,
} from "$lib/server/db/schema";
import { auth } from "$lib/server/auth/better-auth";
import { getEnv } from "$lib/tools/get-env";
import { insertDeviceShare } from "$lib/server/device-shares";
import {
  buildProfileExport,
  buildSettingsExport,
  importExportData,
  importSettings,
} from "$lib/server/export";

/**
 * Demo accounts use a non-routable domain so the address is obviously synthetic
 * and never collides with a real signup. The welcome/admin-email hook skips
 * this domain (see better-auth.ts).
 */
export const DEMO_EMAIL_DOMAIN = "demo.smartjobseeker.local";

/** Demo users land on the second tier (after free Explorer). */
const DEMO_PLAN = "seeker";

export interface DemoCredentials {
  userId: string;
  email: string;
  password: string;
}

/** Email for a link's demo user — deterministic so resume finds the same row. */
function demoEmail(token: string): string {
  return `demo+${token}@${DEMO_EMAIL_DOMAIN}`;
}

/**
 * Password for a link's demo user, derived from the token + the auth secret.
 * Never stored: both mint and resume re-derive it to sign the user in, so there
 * is no plaintext credential at rest. Knowing it only grants access to this one
 * ephemeral account — exactly what holding the link already grants.
 */
function demoPassword(token: string): string {
  return createHmac("sha256", getEnv("SJS_AUTH_SECRET"))
    .update(`demo-login:${token}`)
    .digest("hex");
}

/** The profile cloned into each demo user — owned by the demo-template account. */
async function getTemplateProfileId(): Promise<number> {
  const template = await db.query.users.findFirst({
    where: eq(users.is_demo_template, true),
    columns: { id: true },
  });
  if (!template) {
    throw new Error(
      "No demo-template account found. Run `npm run demo:seed-template` first.",
    );
  }
  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.user_id, template.id),
    columns: { id: true },
    orderBy: (p, { asc }) => asc(p.id),
  });
  if (!profile) {
    throw new Error("Demo-template account has no profile to clone.");
  }
  return profile.id;
}

/** Create the ephemeral demo user (auth account + flags + Seeker subscription). */
async function mintDemoUser(link: DemoLinks): Promise<DemoCredentials> {
  const email = demoEmail(link.token);
  const password = demoPassword(link.token);

  // Idempotent: a prior attempt that failed *after* creating the user (e.g.
  // template not yet seeded) leaves this account behind. Reuse it so re-opening
  // the link self-heals instead of dying on a duplicate-email signup.
  const existing = await db.query.users.findFirst({
    where: eq(users.email, email),
    columns: { id: true },
  });
  if (existing) {
    return { userId: existing.id, email, password };
  }

  const result = await auth.api.signUpEmail({
    body: { email, password, name: "Demo User" },
  });
  if (!result.user) {
    throw new Error("Failed to create demo user");
  }
  const userId = result.user.id;

  // Approved (no admin gate), email pre-verified (no verification step), and
  // flagged demo so the UI hides destructive controls / metrics exclude it.
  await db.update(users).set({
    is_approved: true,
    is_demo: true,
    emailVerified: true,
  }).where(eq(users.id, userId));

  // Seed a Seeker subscription so the normal credit path resolves to the second
  // tier. Placeholder stripe ids satisfy the not-null columns (same shape as
  // today's hand-seeded subs). Period ends when the link expires.
  await db.insert(subscriptions).values({
    user_id: userId,
    stripe_subscription_id: `demo:${userId}`,
    stripe_price_id: "demo",
    plan: DEMO_PLAN,
    status: "active",
    current_period_start: new Date(),
    current_period_end: link.expires_at,
  });

  return { userId, email, password };
}

/**
 * Clone a profile (+ its search tasks / match config / salary) into a target
 * user, same-DB. Reused by demo provisioning (template → demo user) and by the
 * seed script (an existing profile → the template account). Pass
 * `overwriteProfileId` to re-key an existing profile in place (idempotent seed).
 * Returns the new/updated profile id.
 */
export async function cloneProfileInto(
  sourceProfileId: number,
  targetUserId: string,
  opts: { overwriteProfileId?: number } = {},
): Promise<number> {
  const { data } = await buildProfileExport(sourceProfileId);
  const { profileId } = await importExportData(data, targetUserId, opts);

  const settings = await buildSettingsExport(sourceProfileId);
  await importSettings(profileId, targetUserId, settings, {
    replaceExistingTasks: true,
    applyMatchConfig: true,
    applyEmailDigest: false, // demo users shouldn't get scheduled digest emails
    applySalary: true,
  });
  return profileId;
}

/** Clone the template profile (+ its search tasks) into the demo user. */
async function cloneTemplateInto(userId: string): Promise<number> {
  const templateProfileId = await getTemplateProfileId();
  // Overwrite an existing profile (from a retried provision) rather than
  // stacking duplicates.
  const existing = await db.query.profiles.findFirst({
    where: eq(profiles.user_id, userId),
    columns: { id: true },
    orderBy: (p, { asc }) => asc(p.id),
  });
  return cloneProfileInto(templateProfileId, userId, {
    overwriteProfileId: existing?.id,
  });
}

/**
 * Wire the demo user's cloned tasks to log in with the link creator's
 * credentials, so scrapers work without any manual login (the demo UI has no
 * interactive control). For each platform the tasks target, share the creator's
 * credential, point the task's platform_profiles binding at it, and force
 * `login_mode: auto`. Tasks for platforms the creator has no credential for are
 * left as-is (public scraping still works).
 */
async function wireDemoCredentials(
  link: DemoLinks,
  demoUserId: string,
  demoProfileId: number,
): Promise<void> {
  const tasks = await db.query.search_tasks.findMany({
    where: eq(search_tasks.profile_id, demoProfileId),
    columns: { id: true, platform_id: true, platform_profile_id: true },
  });

  const platformIds = Array.from(
    new Set(
      tasks.map((t) => t.platform_id).filter((id): id is number => id != null),
    ),
  );

  for (const platformId of platformIds) {
    const credential = await db.query.platform_credentials.findFirst({
      where: and(
        eq(platform_credentials.user_id, link.created_by),
        eq(platform_credentials.platform_id, platformId),
      ),
      columns: { id: true },
      orderBy: (c, { asc }) => asc(c.id),
    });
    if (!credential) continue; // public scrape / no login available — leave task

    // Share the creator's credential with the demo user (the link is the
    // authorization, so this bypasses the contact gate).
    await db.insert(credential_shares).values({
      platform_credential_id: credential.id,
      shared_with: demoUserId,
    }).onConflictDoNothing();

    for (const task of tasks.filter((t) => t.platform_id === platformId)) {
      // Reuse the binding row importSettings made, else create one.
      let bindingId = task.platform_profile_id;
      if (!bindingId) {
        const [pp] = await db.insert(platform_profiles).values({
          profile_id: demoProfileId,
          platform_id: platformId,
          platform_credential_id: credential.id,
          status: "active",
        }).returning({ id: platform_profiles.id });
        bindingId = pp.id;
      } else {
        await db.update(platform_profiles)
          .set({ platform_credential_id: credential.id, status: "active" })
          .where(eq(platform_profiles.id, bindingId));
      }

      await db.update(search_tasks)
        .set({ platform_profile_id: bindingId, login_mode: "auto" })
        .where(eq(search_tasks.id, task.id));
    }
  }
}

/** Grant the demo user access to every device on the link. */
async function grantLinkDevices(
  link: DemoLinks,
  userId: string,
): Promise<void> {
  const devices = await db.query.demo_link_devices.findMany({
    where: eq(demo_link_devices.demo_link_id, link.id),
    columns: { api_key_id: true },
  });
  for (const { api_key_id } of devices) {
    // The link's creator owns the devices; the link itself is the authorization,
    // so this bypasses the contact gate (insertDeviceShare, not shareDevice).
    await insertDeviceShare(api_key_id, link.created_by, userId);
  }
}

/**
 * First open: mint the demo user, clone the template, grant devices, and pin the
 * user to the link. Returns credentials for auto-login.
 */
export async function provisionDemoUser(
  link: DemoLinks,
): Promise<DemoCredentials> {
  const creds = await mintDemoUser(link);
  const profileId = await cloneTemplateInto(creds.userId);
  await grantLinkDevices(link, creds.userId);
  await wireDemoCredentials(link, creds.userId, profileId);
  await db.update(demo_links)
    .set({ demo_user_id: creds.userId })
    .where(eq(demo_links.id, link.id));
  return creds;
}

/**
 * Later opens within TTL: re-derive credentials for the existing demo user so
 * the route can re-establish a session. Returns null if the pinned user is gone.
 */
export async function resumeDemoUser(
  link: DemoLinks,
): Promise<DemoCredentials | null> {
  if (!link.demo_user_id) return null;
  const user = await db.query.users.findFirst({
    where: and(eq(users.id, link.demo_user_id), eq(users.is_demo, true)),
    columns: { id: true },
  });
  if (!user) return null;
  return {
    userId: user.id,
    email: demoEmail(link.token),
    password: demoPassword(link.token),
  };
}
