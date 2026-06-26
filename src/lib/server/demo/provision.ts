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
  type DemoLinks,
  demo_link_devices,
  demo_links,
  profiles,
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

/** Clone the template profile (+ its search tasks) into the demo user. */
async function cloneTemplateInto(userId: string): Promise<void> {
  const templateProfileId = await getTemplateProfileId();

  const { data } = await buildProfileExport(templateProfileId);
  const { profileId } = await importExportData(data, userId);

  const settings = await buildSettingsExport(templateProfileId);
  await importSettings(profileId, userId, settings, {
    replaceExistingTasks: true,
    applyMatchConfig: true,
    applyEmailDigest: false, // demo users shouldn't get scheduled digest emails
    applySalary: true,
  });
}

/** Grant the demo user access to every device on the link. */
async function grantLinkDevices(link: DemoLinks, userId: string): Promise<void> {
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
  await cloneTemplateInto(creds.userId);
  await grantLinkDevices(link, creds.userId);
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
