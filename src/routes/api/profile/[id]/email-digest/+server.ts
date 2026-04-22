import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db } from "$lib/server/db";
import { eq } from "drizzle-orm";
import { profiles } from "$lib/server/db/schema";
import { requireAuth, parseIntParam, requireProfileAccess } from "$lib/server/utils/api-helpers";

const ALLOWED_FREQUENCIES = [1, 2, 3, 5, 7, 14];
const ALLOWED_MIN_SCORES = [50, 60, 70, 80, 90];

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
      email_address: true,
    },
  });

  if (!profile) {
    throw error(404, "Profile not found");
  }

  return json({
    enabled: profile.email_digest_enabled ?? false,
    frequency_days: profile.email_digest_frequency_days ?? 7,
    min_score: profile.email_digest_min_score ?? 70,
    last_sent_at: profile.email_digest_last_sent_at?.toISOString() ?? null,
    email_address: profile.email_address ?? null,
  });
};

/**
 * PATCH /api/profile/[id]/email-digest
 *
 * Update email digest preferences for a profile.
 */
export const PATCH: RequestHandler = async ({ params, request, locals }) => {
  const user = requireAuth(locals);
  const profileId = parseIntParam(params.id, "profile");
  await requireProfileAccess(profileId, user.id);

  const body = await request.json();
  const update: Record<string, unknown> = {};

  if (typeof body.enabled === "boolean") {
    // If enabling, verify the profile has an email address
    if (body.enabled) {
      const profile = await db.query.profiles.findFirst({
        where: eq(profiles.id, profileId),
        columns: { email_address: true },
      });
      if (!profile?.email_address) {
        throw error(400, "Profile must have an email address to enable email digests");
      }
    }
    update.email_digest_enabled = body.enabled;
  }

  if (body.frequency_days !== undefined) {
    if (!ALLOWED_FREQUENCIES.includes(body.frequency_days)) {
      throw error(400, `frequency_days must be one of: ${ALLOWED_FREQUENCIES.join(", ")}`);
    }
    update.email_digest_frequency_days = body.frequency_days;
  }

  if (body.min_score !== undefined) {
    if (!ALLOWED_MIN_SCORES.includes(body.min_score)) {
      throw error(400, `min_score must be one of: ${ALLOWED_MIN_SCORES.join(", ")}`);
    }
    update.email_digest_min_score = body.min_score;
  }

  if (Object.keys(update).length === 0) {
    throw error(400, "No valid fields to update");
  }

  await db.update(profiles).set(update).where(eq(profiles.id, profileId));

  return json({ ok: true });
};
