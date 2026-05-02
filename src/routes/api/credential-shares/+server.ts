import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { parseIntParam, requireAuth } from "$lib/server/utils/api-helpers";
import {
  listCredentialShares,
  listSharedCredentialsWithMe,
  shareCredential,
  unshareCredential,
} from "$lib/server/credential-shares";

/**
 * GET /api/credential-shares?platformProfileId=123 — List shares for a credential.
 * GET /api/credential-shares?sharedWithMe=true — List credentials shared with current user.
 */
export const GET: RequestHandler = async ({ locals, url }) => {
  const user = requireAuth(locals);

  if (url.searchParams.get("sharedWithMe") === "true") {
    const shared = await listSharedCredentialsWithMe(user.id);
    return json({ shares: shared });
  }

  const platformProfileId = parseIntParam(
    url.searchParams.get("platformProfileId") ?? "",
    "platformProfileId",
  );
  const shares = await listCredentialShares(platformProfileId);
  return json({ shares });
};

/**
 * POST /api/credential-shares — Share a credential with a contact.
 * Body: { platformProfileId: number, userId: string }
 */
export const POST: RequestHandler = async ({ locals, request }) => {
  const user = requireAuth(locals);
  const body = await request.json();

  const platformProfileId = body.platformProfileId;
  const sharedWithUserId = body.userId;

  if (!platformProfileId || typeof platformProfileId !== "number") {
    throw error(400, "platformProfileId is required");
  }
  if (!sharedWithUserId || typeof sharedWithUserId !== "string") {
    throw error(400, "userId is required");
  }

  const result = await shareCredential(
    platformProfileId,
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
 * Body: { platformProfileId: number, userId: string }
 */
export const DELETE: RequestHandler = async ({ locals, request }) => {
  const user = requireAuth(locals);
  const body = await request.json();

  const platformProfileId = body.platformProfileId;
  const sharedWithUserId = body.userId;

  if (!platformProfileId || typeof platformProfileId !== "number") {
    throw error(400, "platformProfileId is required");
  }
  if (!sharedWithUserId || typeof sharedWithUserId !== "string") {
    throw error(400, "userId is required");
  }

  const removed = await unshareCredential(
    platformProfileId,
    user.id,
    sharedWithUserId,
  );
  if (!removed) {
    throw error(404, "Share not found");
  }
  return json({ success: true });
};
