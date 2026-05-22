import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db } from "$lib/server/db";
import { and, eq, inArray } from "drizzle-orm";
import {
  job_platforms,
  platform_credentials,
  platform_profiles,
  profiles,
  search_tasks,
} from "$lib/server/db/schema";
import { parseIntParam, requireAuth } from "$lib/server/utils/api-helpers";
import {
  parseBody,
  platformCredentialsSchema,
} from "$lib/server/validation/api-schemas";
import { decryptCredential, encryptCredential } from "$lib/server/auth/crypto";

/**
 * GET /api/platforms/[id]/credentials?profileId=X
 *
 * List all credentials the logged-in user has for this platform. Returns
 * user-wide credentials (a credential is shared across every profile the
 * user owns); the `profileId` query param is retained only for ownership
 * validation — any of the user's profiles surfaces the same list.
 */
export const GET: RequestHandler = async ({ params, locals, url }) => {
  const user = requireAuth(locals);
  const platformId = parseIntParam(params.id, "platform");

  const profileIdRaw = url.searchParams.get("profileId");
  if (!profileIdRaw) {
    throw error(400, "Profile ID required");
  }

  const profile = await db.query.profiles.findFirst({
    where: and(
      eq(profiles.id, parseInt(profileIdRaw)),
      eq(profiles.user_id, user.id),
    ),
  });
  if (!profile) {
    throw error(403, "Not authorized");
  }

  const credentials = await db.query.platform_credentials.findMany({
    where: and(
      eq(platform_credentials.user_id, user.id),
      eq(platform_credentials.platform_id, platformId),
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
 * Upsert a credential for the logged-in user on this platform. With
 * credentials user-wide, this no longer creates per-profile rows — the
 * credential lives on `platform_credentials`. `profileId` is kept on the
 * input for ownership validation but is not stored on the credential.
 */
export const PUT: RequestHandler = async ({ params, locals, request }) => {
  const user = requireAuth(locals);
  const platformId = parseIntParam(params.id, "platform");

  const { profileId, credentialId, username, password, security_answer } =
    parseBody(platformCredentialsSchema, await request.json());

  const profile = await db.query.profiles.findFirst({
    where: and(
      eq(profiles.id, profileId),
      eq(profiles.user_id, user.id),
    ),
  });
  if (!profile) {
    throw error(403, "Not authorized");
  }

  const platform = await db.query.job_platforms.findFirst({
    where: and(
      eq(job_platforms.id, platformId),
      eq(job_platforms.status, "published"),
    ),
  });
  if (!platform) {
    throw error(404, "Platform not found");
  }

  const existing = credentialId !== undefined
    ? await db.query.platform_credentials.findFirst({
      where: and(
        eq(platform_credentials.id, credentialId),
        eq(platform_credentials.user_id, user.id),
        eq(platform_credentials.platform_id, platformId),
      ),
    })
    : null;

  if (credentialId !== undefined && !existing) {
    throw error(404, "Credential not found");
  }

  if (existing) {
    // Partial-edit semantics: only touch fields the caller explicitly sent.
    const update: Partial<typeof platform_credentials.$inferInsert> = {
      date_updated: new Date(),
    };
    if (username !== undefined) update.username = username || null;
    if (password !== undefined) {
      update.password = encryptCredential(password || null);
    }
    if (security_answer !== undefined) {
      update.security_answer = encryptCredential(security_answer || null);
    }
    await db.update(platform_credentials).set(update).where(
      eq(platform_credentials.id, existing.id),
    );
    // Clear any login error on this profile's runtime row — the user just
    // updated the secret, so the old error is stale.
    await db.update(platform_profiles)
      .set({ login_error: null })
      .where(and(
        eq(platform_profiles.profile_id, profile.id),
        eq(platform_profiles.platform_credential_id, existing.id),
      ));
    return json({ success: true, id: existing.id });
  }

  const [created] = await db.insert(platform_credentials).values({
    user_id: user.id,
    platform_id: platformId,
    username: username || null,
    password: encryptCredential(password || null),
    security_answer: encryptCredential(security_answer || null),
    date_created: new Date(),
    date_updated: new Date(),
  }).returning({ id: platform_credentials.id });

  return json({ success: true, id: created.id });
};

/**
 * DELETE /api/platforms/[id]/credentials
 *
 * Delete one credential (?credentialId=X) or all of the user's
 * credentials for this platform (no credentialId). Search tasks
 * referencing the deleted credentials have their platform_credential_id
 * cleared via the FK ON DELETE SET NULL on platform_profiles.
 */
export const DELETE: RequestHandler = async ({ params, locals, url }) => {
  const user = requireAuth(locals);
  const platformId = parseIntParam(params.id, "platform");

  const profileIdRaw = url.searchParams.get("profileId");
  if (!profileIdRaw) {
    throw error(400, "Profile ID required");
  }

  const profile = await db.query.profiles.findFirst({
    where: and(
      eq(profiles.id, parseInt(profileIdRaw)),
      eq(profiles.user_id, user.id),
    ),
  });
  if (!profile) {
    throw error(403, "Not authorized");
  }

  const credentialIdRaw = url.searchParams.get("credentialId");

  if (credentialIdRaw) {
    const cred = await db.query.platform_credentials.findFirst({
      where: and(
        eq(platform_credentials.id, parseInt(credentialIdRaw)),
        eq(platform_credentials.user_id, user.id),
        eq(platform_credentials.platform_id, platformId),
      ),
    });
    if (!cred) {
      throw error(404, "Credential not found");
    }

    // Find platform_profiles rows that reference this credential so we can
    // null out their FK on search_tasks before deleting.
    const ppRows = await db.query.platform_profiles.findMany({
      where: eq(platform_profiles.platform_credential_id, cred.id),
      columns: { id: true },
    });
    const ppIds = ppRows.map((r) => r.id);
    if (ppIds.length > 0) {
      await db.update(search_tasks)
        .set({ platform_profile_id: null })
        .where(inArray(search_tasks.platform_profile_id, ppIds));
    }

    await db.delete(platform_credentials).where(
      eq(platform_credentials.id, cred.id),
    );
  } else {
    const creds = await db.query.platform_credentials.findMany({
      where: and(
        eq(platform_credentials.user_id, user.id),
        eq(platform_credentials.platform_id, platformId),
      ),
      columns: { id: true },
    });
    const credIds = creds.map((c) => c.id);
    if (credIds.length === 0) {
      return json({ success: true });
    }

    const ppRows = await db.query.platform_profiles.findMany({
      where: inArray(platform_profiles.platform_credential_id, credIds),
      columns: { id: true },
    });
    const ppIds = ppRows.map((r) => r.id);
    if (ppIds.length > 0) {
      await db.update(search_tasks)
        .set({ platform_profile_id: null })
        .where(inArray(search_tasks.platform_profile_id, ppIds));
    }

    await db.delete(platform_credentials).where(
      inArray(platform_credentials.id, credIds),
    );
  }

  return json({ success: true });
};
