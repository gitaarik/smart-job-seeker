import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db } from "$lib/server/db";
import { eq, and, inArray } from "drizzle-orm";
import { profiles, job_platforms, platform_profiles, search_tasks } from "$lib/server/db/schema";
import { parseIntParam, requireAuth } from "$lib/server/utils/api-helpers";
import {
  parseBody,
  platformCredentialsSchema,
} from "$lib/server/validation/api-schemas";
import { encryptCredential, decryptCredential } from "$lib/server/auth/crypto";

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
  const profile = await db.query.profiles.findFirst({
    where: and(eq(profiles.id, parseInt(profileId)), eq(profiles.user_id, user.id)),
  });
  if (!profile) {
    throw error(403, "Not authorized");
  }

  const credentials = await db.query.platform_profiles.findMany({
    where: and(
      eq(platform_profiles.profile_id, profile.id),
      eq(platform_profiles.platform_id, platformId),
    ),
    columns: { id: true, username: true, security_answer: true },
  });

  return json(credentials.map((c) => ({
    ...c,
    security_answer: decryptCredential(c.security_answer),
  })));
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
  const profile = await db.query.profiles.findFirst({
    where: and(
      eq(profiles.id, profileId),
      eq(profiles.user_id, user.id),
    ),
  });

  if (!profile) {
    throw error(403, "Not authorized");
  }

  // Check platform exists
  const platform = await db.query.job_platforms.findFirst({
    where: and(
      eq(job_platforms.id, platformId),
      eq(job_platforms.status, "published"),
    ),
  });

  if (!platform) {
    throw error(404, "Platform not found");
  }

  // Upsert credentials
  const existing = await db.query.platform_profiles.findFirst({
    where: and(
      eq(platform_profiles.profile_id, profile.id),
      eq(platform_profiles.platform_id, platformId),
    ),
  });

  if (existing) {
    // Update existing
    await db.update(platform_profiles).set({
      username: username || null,
      password: encryptCredential(password || null),
      security_answer: encryptCredential(security_answer || null),
      login_error: null, // Clear any previous error
      date_updated: new Date(),
    }).where(eq(platform_profiles.id, existing.id));
  } else {
    // Create new
    await db.insert(platform_profiles).values({
      profile_id: profile.id,
      platform_id: platformId,
      username: username || null,
      password: encryptCredential(password || null),
      security_answer: encryptCredential(security_answer || null),
      status: "active",
      date_created: new Date(),
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
  const profile = await db.query.profiles.findFirst({
    where: and(
      eq(profiles.id, parseInt(profileId)),
      eq(profiles.user_id, user.id),
    ),
  });

  if (!profile) {
    throw error(403, "Not authorized");
  }

  const credentialId = url.searchParams.get("credentialId");

  if (credentialId) {
    // Delete specific credential
    const cred = await db.query.platform_profiles.findFirst({
      where: and(
        eq(platform_profiles.id, parseInt(credentialId)),
        eq(platform_profiles.profile_id, profile.id),
        eq(platform_profiles.platform_id, platformId),
      ),
    });
    if (!cred) {
      throw error(404, "Credential not found");
    }

    await db.delete(platform_profiles).where(eq(platform_profiles.id, cred.id));

    // Clear platform_profile_id on any job searches using this credential
    await db.update(search_tasks)
      .set({ platform_profile_id: null })
      .where(and(
        eq(search_tasks.platform_profile_id, cred.id),
        eq(search_tasks.profile_id, profile.id),
      ));
  } else {
    // Delete all credentials for this platform
    const creds = await db.query.platform_profiles.findMany({
      where: and(
        eq(platform_profiles.profile_id, profile.id),
        eq(platform_profiles.platform_id, platformId),
      ),
      columns: { id: true },
    });
    const credIds = creds.map((c) => c.id);

    await db.delete(platform_profiles).where(and(
      eq(platform_profiles.profile_id, profile.id),
      eq(platform_profiles.platform_id, platformId),
    ));

    // Clear platform_profile_id on any job searches using these credentials
    if (credIds.length > 0) {
      await db.update(search_tasks)
        .set({ platform_profile_id: null })
        .where(and(
          inArray(search_tasks.platform_profile_id, credIds),
          eq(search_tasks.profile_id, profile.id),
        ));
    }
  }

  return json({ success: true });
};
