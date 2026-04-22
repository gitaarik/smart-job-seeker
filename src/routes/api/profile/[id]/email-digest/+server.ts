import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db } from "$lib/server/db";
import { eq } from "drizzle-orm";
import { profiles, users } from "$lib/server/db/schema";
import { requireAuth, parseIntParam, requireProfileAccess } from "$lib/server/utils/api-helpers";

const ALLOWED_FREQUENCIES = [1, 2, 3, 5, 7, 14];
const ALLOWED_MIN_SCORES = [50, 60, 70, 80, 90];
const ALLOWED_SEND_TO = ["profile", "account", "both"];

/**
 * GET /api/profile/[id]/email-digest
 *
 * Get email digest preferences for a profile.
 */
export const GET: RequestHandler = async ({ params, locals }) => {
  const user = requireAuth(locals);
  const profileId = parseIntParam(params.id, "profile");
  await requireProfileAccess(profileId, user.id);

  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.id, profileId),
    columns: {
      email_digest_enabled: true,
      email_digest_frequency_days: true,
      email_digest_min_score: true,
      email_digest_last_sent_at: true,
      email_digest_preferred_hour: true,
      email_digest_send_to: true,
      email_address: true,
      location_timezone: true,
      browser_timezone: true,
    },
  });

  if (!profile) {
    throw error(404, "Profile not found");
  }

  // Get user timezone
  const userRecord = await db.query.users.findFirst({
    where: eq(users.id, user.id),
    columns: { timezone: true },
  });

  return json({
    enabled: profile.email_digest_enabled ?? false,
    frequency_days: profile.email_digest_frequency_days ?? 7,
    min_score: profile.email_digest_min_score ?? 70,
    preferred_hour: profile.email_digest_preferred_hour ?? 9,
    send_to: profile.email_digest_send_to ?? "profile",
    last_sent_at: profile.email_digest_last_sent_at?.toISOString() ?? null,
    email_address: profile.email_address ?? null,
    timezone: userRecord?.timezone ?? profile.location_timezone ?? profile.browser_timezone ?? null,
    account_email: user.email,
  });
};

/**
 * PATCH /api/profile/[id]/email-digest
 *
 * Update email digest preferences for a profile.
 * Also accepts `timezone` which is saved on the user (shared across profiles).
 */
export const PATCH: RequestHandler = async ({ params, request, locals }) => {
  const user = requireAuth(locals);
  const profileId = parseIntParam(params.id, "profile");
  await requireProfileAccess(profileId, user.id);

  const body = await request.json();
  const profileUpdate: Record<string, unknown> = {};

  if (typeof body.enabled === "boolean") {
    // If enabling, verify the profile or account has an email address
    if (body.enabled) {
      const profile = await db.query.profiles.findFirst({
        where: eq(profiles.id, profileId),
        columns: { email_address: true },
      });
      const sendTo = body.send_to ?? "profile";
      if (sendTo !== "account" && !profile?.email_address) {
        throw error(400, "Profile must have an email address to enable email digests (or use account email)");
      }
    }
    profileUpdate.email_digest_enabled = body.enabled;
  }

  if (body.frequency_days !== undefined) {
    if (!ALLOWED_FREQUENCIES.includes(body.frequency_days)) {
      throw error(400, `frequency_days must be one of: ${ALLOWED_FREQUENCIES.join(", ")}`);
    }
    profileUpdate.email_digest_frequency_days = body.frequency_days;
  }

  if (body.min_score !== undefined) {
    if (!ALLOWED_MIN_SCORES.includes(body.min_score)) {
      throw error(400, `min_score must be one of: ${ALLOWED_MIN_SCORES.join(", ")}`);
    }
    profileUpdate.email_digest_min_score = body.min_score;
  }

  if (body.preferred_hour !== undefined) {
    const hour = body.preferred_hour;
    if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
      throw error(400, "preferred_hour must be an integer between 0 and 23");
    }
    profileUpdate.email_digest_preferred_hour = hour;
  }

  if (body.send_to !== undefined) {
    if (!ALLOWED_SEND_TO.includes(body.send_to)) {
      throw error(400, `send_to must be one of: ${ALLOWED_SEND_TO.join(", ")}`);
    }
    profileUpdate.email_digest_send_to = body.send_to;
  }

  // Timezone is saved on the user, not the profile
  if (typeof body.timezone === "string") {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: body.timezone });
    } catch {
      throw error(400, "Invalid timezone");
    }
    await db.update(users).set({ timezone: body.timezone }).where(eq(users.id, user.id));
  }

  if (Object.keys(profileUpdate).length > 0) {
    await db.update(profiles).set(profileUpdate).where(eq(profiles.id, profileId));
  }

  return json({ ok: true });
};
