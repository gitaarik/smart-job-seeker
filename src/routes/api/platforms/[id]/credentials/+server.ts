import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db } from "$lib/server/db";
import { parseIntParam, requireAuth } from "$lib/server/utils/api-helpers";
import {
  parseBody,
  platformCredentialsSchema,
} from "$lib/server/validation/api-schemas";

/**
 * GET /api/platforms/[id]/credentials?profileId=X
 *
 * List all credentials for a platform and profile.
 */
export const GET: RequestHandler = async ({ params, locals, url }) => {
  const user = requireAuth(locals);
  const platformId = parseIntParam(params.id, "platform");

  const profileId = url.searchParams.get("profileId");
  if (!profileId) {
    throw error(400, "Profile ID required");
  }

  // Verify user owns this profile
  const profile = await db.profiles.findFirst({
    where: { id: parseInt(profileId), user_id: user.id },
  });
  if (!profile) {
    throw error(403, "Not authorized");
  }

  const credentials = await db.platform_profiles.findMany({
    where: { profile_id: profile.id, platform_id: platformId },
    select: { id: true, username: true, security_answer: true },
  });

  return json(credentials);
};

/**
 * PUT /api/platforms/[id]/credentials
 *
 * Update or create credentials for a platform.
 */
export const PUT: RequestHandler = async ({ params, locals, request }) => {
  const user = requireAuth(locals);
  const platformId = parseIntParam(params.id, "platform");

  const { profileId, username, password, security_answer } = parseBody(
    platformCredentialsSchema,
    await request.json(),
  );

  // Verify user owns this profile
  const profile = await db.profiles.findFirst({
    where: {
      id: profileId,
      user_id: user.id,
    },
  });

  if (!profile) {
    throw error(403, "Not authorized");
  }

  // Check platform exists
  const platform = await db.job_platforms.findFirst({
    where: {
      id: platformId,
      status: "published",
    },
  });

  if (!platform) {
    throw error(404, "Platform not found");
  }

  // Upsert credentials
  const existing = await db.platform_profiles.findFirst({
    where: {
      profile_id: profile.id,
      platform_id: platformId,
    },
  });

  if (existing) {
    // Update existing
    await db.platform_profiles.update({
      where: { id: existing.id },
      data: {
        username: username || null,
        password: password || null,
        security_answer: security_answer || null,
        login_error: null, // Clear any previous error
        date_updated: new Date(),
      },
    });
  } else {
    // Create new
    await db.platform_profiles.create({
      data: {
        profile_id: profile.id,
        platform_id: platformId,
        username: username || null,
        password: password || null,
        security_answer: security_answer || null,
        status: "active",
        date_created: new Date(),
      },
    });
  }

  return json({ success: true });
};

/**
 * DELETE /api/platforms/[id]/credentials
 *
 * Delete credentials for a platform.
 * Pass ?credentialId=X to delete a specific credential,
 * or just ?profileId=X to delete all credentials for that platform.
 */
export const DELETE: RequestHandler = async ({ params, locals, url }) => {
  const user = requireAuth(locals);
  const platformId = parseIntParam(params.id, "platform");

  const profileId = url.searchParams.get("profileId");
  if (!profileId) {
    throw error(400, "Profile ID required");
  }

  // Verify user owns this profile
  const profile = await db.profiles.findFirst({
    where: {
      id: parseInt(profileId),
      user_id: user.id,
    },
  });

  if (!profile) {
    throw error(403, "Not authorized");
  }

  const credentialId = url.searchParams.get("credentialId");

  if (credentialId) {
    // Delete specific credential
    const cred = await db.platform_profiles.findFirst({
      where: {
        id: parseInt(credentialId),
        profile_id: profile.id,
        platform_id: platformId,
      },
    });
    if (!cred) {
      throw error(404, "Credential not found");
    }

    await db.platform_profiles.delete({
      where: { id: cred.id },
    });

    // Clear platform_profile_id on any job searches using this credential
    await db.search_tasks.updateMany({
      where: {
        platform_profile_id: cred.id,
        profile_id: profile.id,
      },
      data: { platform_profile_id: null },
    });
  } else {
    // Delete all credentials for this platform
    const creds = await db.platform_profiles.findMany({
      where: { profile_id: profile.id, platform_id: platformId },
      select: { id: true },
    });
    const credIds = creds.map((c) => c.id);

    await db.platform_profiles.deleteMany({
      where: {
        profile_id: profile.id,
        platform_id: platformId,
      },
    });

    // Clear platform_profile_id on any job searches using these credentials
    if (credIds.length > 0) {
      await db.search_tasks.updateMany({
        where: {
          platform_profile_id: { in: credIds },
          profile_id: profile.id,
        },
        data: { platform_profile_id: null },
      });
    }
  }

  return json({ success: true });
};
