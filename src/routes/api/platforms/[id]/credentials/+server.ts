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

  const { profileId, credentialId, username, password, security_answer } =
    parseBody(platformCredentialsSchema, await request.json());

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

  // Editing an existing credential requires its id; without one we always
  // create a new row so a user can have multiple credentials per platform.
  const existing = credentialId !== undefined
    ? await db.query.platform_profiles.findFirst({
      where: and(
        eq(platform_profiles.id, credentialId),
        eq(platform_profiles.profile_id, profile.id),
        eq(platform_profiles.platform_id, platformId),
      ),
    })
    : null;

  if (credentialId !== undefined && !existing) {
    throw error(404, "Credential not found");
  }

  if (existing) {
    // Update existing — only touch fields the caller explicitly sent so
    // partial edits (e.g. just security_answer) don't wipe other fields.
    const update: Partial<typeof platform_profiles.$inferInsert> = {
      login_error: null, // Clear any previous error
      date_updated: new Date(),
    };
    if (username !== undefined) update.username = username || null;
    if (password !== undefined) update.password = encryptCredential(password || null);
    if (security_answer !== undefined) {
      update.security_answer = encryptCredential(security_answer || null);
    }
    await db.update(platform_profiles).set(update).where(
      eq(platform_profiles.id, existing.id),
    );
    return json({ success: true, id: existing.id });
  }

  const [created] = await db.insert(platform_profiles).values({
    profile_id: profile.id,
    platform_id: platformId,
    username: username || null,
    password: encryptCredential(password || null),
    security_answer: encryptCredential(security_answer || null),
    status: "active",
    date_created: new Date(),
  }).returning({ id: platform_profiles.id });

  return json({ success: true, id: created.id });
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
