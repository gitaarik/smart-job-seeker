import { error, json } from "@sveltejs/kit";
import { and, eq } from "drizzle-orm";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { platform_credentials } from "$lib/server/db/schema";
import { parseIntParam, requireAuth } from "$lib/server/utils/api-helpers";
import {
  listCredentialShares,
  listSharedCredentialsWithMe,
  shareCredential,
  unshareCredential,
} from "$lib/server/credential-shares";

/**
 * GET /api/credential-shares?platformCredentialId=123 — List shares for a credential.
 * GET /api/credential-shares?sharedWithMe=true — List credentials shared with current user.
 */
export const GET: RequestHandler = async ({ locals, url }) => {
  const user = requireAuth(locals);

  if (url.searchParams.get("sharedWithMe") === "true") {
    const shared = await listSharedCredentialsWithMe(user.id);
    return json({ shares: shared });
  }

  const platformCredentialId = parseIntParam(
    url.searchParams.get("platformCredentialId") ?? "",
    "platformCredentialId",
  );
  // Only the credential owner may see who it's shared with — share recipients
  // shouldn't be able to enumerate the rest of the owner's contacts.
  const cred = await db.query.platform_credentials.findFirst({
    where: and(
      eq(platform_credentials.id, platformCredentialId),
      eq(platform_credentials.user_id, user.id),
    ),
    columns: { id: true },
  });
  if (!cred) {
    throw error(403, "Not authorized");
  }
  const shares = await listCredentialShares(platformCredentialId);
  return json({ shares });
};

/**
 * POST /api/credential-shares — Share a credential with a contact.
 * Body: { platformCredentialId: number, userId: string }
 */
export const POST: RequestHandler = async ({ locals, request }) => {
  const user = requireAuth(locals);
  const body = await request.json();

  const platformCredentialId = body.platformCredentialId;
  const sharedWithUserId = body.userId;

  if (!platformCredentialId || typeof platformCredentialId !== "number") {
    throw error(400, "platformCredentialId is required");
  }
  if (!sharedWithUserId || typeof sharedWithUserId !== "string") {
    throw error(400, "userId is required");
  }

  const result = await shareCredential(
    platformCredentialId,
    user.id,
    sharedWithUserId,
  );
  if (!result.success) {
    return json({ error: result.error }, { status: 400 });
  }
  return json({ success: true });
};

/**
 * DELETE /api/credential-shares — Unshare a credential.
 * Body: { platformCredentialId: number, userId: string }
 */
export const DELETE: RequestHandler = async ({ locals, request }) => {
  const user = requireAuth(locals);
  const body = await request.json();

  const platformCredentialId = body.platformCredentialId;
  const sharedWithUserId = body.userId;

  if (!platformCredentialId || typeof platformCredentialId !== "number") {
    throw error(400, "platformCredentialId is required");
  }
  if (!sharedWithUserId || typeof sharedWithUserId !== "string") {
    throw error(400, "userId is required");
  }

  const removed = await unshareCredential(
    platformCredentialId,
    user.id,
    sharedWithUserId,
  );
  if (!removed) {
    throw error(404, "Share not found");
  }
  return json({ success: true });
};
