import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db } from "$lib/server/db";

/**
 * PUT /api/platforms/[id]/credentials
 *
 * Update or create credentials for a platform.
 */
export const PUT: RequestHandler = async ({ params, locals, request }) => {
  const user = locals.user;
  if (!user) {
    throw error(401, "Not authenticated");
  }

  const platformId = parseInt(params.id);
  if (isNaN(platformId)) {
    throw error(400, "Invalid platform ID");
  }

  const body = await request.json();
  const { profileId, username, password } = body;

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
      profile: profile.id,
      platform: platformId,
    },
  });

  if (existing) {
    // Update existing
    await db.platform_profiles.update({
      where: { id: existing.id },
      data: {
        username: username || null,
        password: password || null,
        login_error: null, // Clear any previous error
        date_updated: new Date(),
      },
    });
  } else {
    // Create new
    await db.platform_profiles.create({
      data: {
        profile: profile.id,
        platform: platformId,
        username: username || null,
        password: password || null,
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
  const user = locals.user;
  if (!user) {
    throw error(401, "Not authenticated");
  }

  const platformId = parseInt(params.id);
  if (isNaN(platformId)) {
    throw error(400, "Invalid platform ID");
  }

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
        profile: profile.id,
        platform: platformId,
      },
    });
    if (!cred) {
      throw error(404, "Credential not found");
    }

    await db.platform_profiles.delete({
      where: { id: cred.id },
    });

    // Clear platform_profile_id on any job searches using this credential
    await db.job_searches.updateMany({
      where: {
        platform_profile_id: cred.id,
        profile: profile.id,
      },
      data: { platform_profile_id: null },
    });
  } else {
    // Delete all credentials for this platform
    const creds = await db.platform_profiles.findMany({
      where: { profile: profile.id, platform: platformId },
      select: { id: true },
    });
    const credIds = creds.map((c) => c.id);

    await db.platform_profiles.deleteMany({
      where: {
        profile: profile.id,
        platform: platformId,
      },
    });

    // Clear platform_profile_id on any job searches using these credentials
    if (credIds.length > 0) {
      await db.job_searches.updateMany({
        where: {
          platform_profile_id: { in: credIds },
          profile: profile.id,
        },
        data: { platform_profile_id: null },
      });
    }
  }

  return json({ success: true });
};
