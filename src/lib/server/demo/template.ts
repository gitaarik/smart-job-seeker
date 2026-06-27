/**
 * Demo-template account management (app-runtime — works on the compiled prod
 * build, unlike the dev-only vite-node scripts).
 *
 * The demo-template is the curated source account whose profile is cloned into
 * every demo user. It's flagged `is_demo_template` so it's never a real login
 * and is excluded from metrics; provisioning finds it by that flag. Seeded by
 * cloning an existing profile on the same database — no fixture, no PII in any
 * repo. Used by the admin "set template" action and the dev CLI script.
 */

import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { dbDirect as db } from "$lib/server/db";
import { profiles, users } from "$lib/server/db/schema";
import { auth } from "$lib/server/auth/better-auth";
import { cloneProfileInto } from "./provision";

/** Synthetic, non-routable address (welcome/admin emails skip this domain). */
export const TEMPLATE_EMAIL = "demo-template@demo.smartjobseeker.local";

/** Get the demo-template user id, creating the hidden account if absent. */
export async function getOrCreateTemplateUser(): Promise<string> {
  const existing = await db.query.users.findFirst({
    where: eq(users.email, TEMPLATE_EMAIL),
    columns: { id: true },
  });
  if (existing) return existing.id;

  const result = await auth.api.signUpEmail({
    body: {
      email: TEMPLATE_EMAIL,
      password: randomBytes(24).toString("hex"),
      name: "Demo Template",
    },
  });
  if (!result.user) throw new Error("Failed to create demo-template user");
  return result.user.id;
}

/** The profile id currently backing the demo template, or null if unseeded. */
export async function getTemplateStatus(): Promise<
  { exists: boolean; profileId: number | null; profileName: string | null }
> {
  const template = await db.query.users.findFirst({
    where: eq(users.is_demo_template, true),
    columns: { id: true },
  });
  if (!template) return { exists: false, profileId: null, profileName: null };

  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.user_id, template.id),
    columns: { id: true, name: true },
    orderBy: (p, { asc }) => asc(p.id),
  });
  return {
    exists: true,
    profileId: profile?.id ?? null,
    profileName: profile?.name ?? null,
  };
}

/**
 * (Re)seed the demo template by cloning an existing profile into the template
 * account. Idempotent — overwrites the template's existing profile in place.
 */
export async function seedDemoTemplateFromProfile(
  sourceProfileId: number,
): Promise<{ userId: string; profileId: number }> {
  const userId = await getOrCreateTemplateUser();

  await db.update(users)
    .set({ is_demo_template: true, emailVerified: true })
    .where(eq(users.id, userId));

  const existingProfile = await db.query.profiles.findFirst({
    where: eq(profiles.user_id, userId),
    columns: { id: true },
    orderBy: (p, { asc }) => asc(p.id),
  });

  const profileId = await cloneProfileInto(sourceProfileId, userId, {
    overwriteProfileId: existingProfile?.id,
  });
  return { userId, profileId };
}
