/**
 * DELETE /api/profile/[id]/documents/[docId]
 *
 * Remove a document project (cascades to its extracted files). Scoped to the
 * profile so a user can only delete their own.
 */

import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db } from "$lib/server/db";
import { and, eq } from "drizzle-orm";
import { profile_document_projects } from "$lib/server/db/schema";
import {
  parseIntParam,
  requireAuth,
  requireProfileAccess,
} from "$lib/server/utils/api-helpers";

export const DELETE: RequestHandler = async ({ params, locals }) => {
  const user = requireAuth(locals);
  const profileId = parseIntParam(params.id, "profile");
  const docId = parseIntParam(params.docId, "document");
  await requireProfileAccess(profileId, user.id);

  const [deleted] = await db
    .delete(profile_document_projects)
    .where(and(
      eq(profile_document_projects.id, docId),
      eq(profile_document_projects.profile_id, profileId),
    ))
    .returning({ id: profile_document_projects.id });

  if (!deleted) error(404, "Document not found");
  return json({ success: true });
};
