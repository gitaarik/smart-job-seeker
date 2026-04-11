import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "@sveltejs/kit";
import { requireAuth } from "$lib/server/utils/api-helpers";
import { db } from "$lib/server/db";
import {
  getOrCreateVerificationAddress,
  regenerateVerificationAddress,
} from "$lib/server/email/verification-relay";

/**
 * GET /api/verification-email/address?profileId=123
 *
 * Get or create the verification email forwarding address for a profile.
 */
export const GET: RequestHandler = async ({ locals, url }) => {
  const user = requireAuth(locals);

  const profileId = parseInt(url.searchParams.get("profileId") || "", 10);
  if (isNaN(profileId)) {
    throw error(400, "Missing or invalid profileId parameter");
  }

  // Verify ownership
  const profile = await db.profiles.findFirst({
    where: { id: profileId, user_id: user.id },
    select: { id: true },
  });

  if (!profile) {
    throw error(404, "Profile not found");
  }

  const address = await getOrCreateVerificationAddress(profileId);

  return json({
    success: true,
    data: {
      fullAddress: address.fullAddress,
      isActive: address.isActive,
    },
  });
};

/**
 * POST /api/verification-email/address
 *
 * Regenerate the verification email token (e.g., if compromised).
 * Body: { profileId: number }
 */
export const POST: RequestHandler = async ({ locals, request }) => {
  const user = requireAuth(locals);

  let body: { profileId?: number };
  try {
    body = await request.json();
  } catch {
    throw error(400, "Invalid JSON body");
  }

  const profileId = body.profileId;
  if (!profileId || typeof profileId !== "number") {
    throw error(400, "Missing or invalid profileId");
  }

  // Verify ownership
  const profile = await db.profiles.findFirst({
    where: { id: profileId, user_id: user.id },
    select: { id: true },
  });

  if (!profile) {
    throw error(404, "Profile not found");
  }

  const address = await regenerateVerificationAddress(profileId);

  return json({
    success: true,
    message: "Verification email address regenerated",
    data: {
      fullAddress: address.fullAddress,
    },
  });
};

/**
 * PATCH /api/verification-email/address
 *
 * Toggle the verification email address on/off.
 * Body: { profileId: number, isActive: boolean }
 */
export const PATCH: RequestHandler = async ({ locals, request }) => {
  const user = requireAuth(locals);

  let body: { profileId?: number; isActive?: boolean };
  try {
    body = await request.json();
  } catch {
    throw error(400, "Invalid JSON body");
  }

  if (!body.profileId || typeof body.isActive !== "boolean") {
    throw error(400, "Missing profileId or isActive");
  }

  // Verify ownership
  const profile = await db.profiles.findFirst({
    where: { id: body.profileId, user_id: user.id },
    select: { id: true },
  });

  if (!profile) {
    throw error(404, "Profile not found");
  }

  await db.verification_email_addresses.updateMany({
    where: { profile_id: body.profileId },
    data: { is_active: body.isActive },
  });

  return json({
    success: true,
    message: body.isActive ? "Verification email enabled" : "Verification email disabled",
  });
};
