import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { requireAuth, parseIntParam } from "$lib/server/utils/api-helpers";
import {
  validateEntityOwnership,
  validateEntityField,
  saveEntityMedia,
  deleteEntityMedia,
} from "$lib/server/uploads/entity-media";

export const POST: RequestHandler = async ({ params, request, locals }) => {
  const user = requireAuth(locals);

  const { entityType, entityId, field } = params;
  const entityIdNum = parseIntParam(entityId, "entity");

  // Validate entity type and field
  if (!validateEntityField(entityType, field)) {
    error(400, "Invalid entity type or field");
  }

  // Validate ownership
  const hasAccess = await validateEntityOwnership(entityType, entityIdNum, user.id);
  if (!hasAccess) {
    error(403, "Access denied");
  }

  // Get file from request
  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file || file.size === 0) {
    error(400, "No file provided");
  }

  // Save file
  const result = await saveEntityMedia(entityType, entityIdNum, field, file);

  if (!result.success) {
    error(400, result.error || "Upload failed");
  }

  return json({
    success: true,
    path: result.path,
    url: result.url,
  });
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
  const user = requireAuth(locals);

  const { entityType, entityId, field } = params;
  const entityIdNum = parseIntParam(entityId, "entity");

  // Validate entity type and field
  if (!validateEntityField(entityType, field)) {
    error(400, "Invalid entity type or field");
  }

  // Validate ownership
  const hasAccess = await validateEntityOwnership(entityType, entityIdNum, user.id);
  if (!hasAccess) {
    error(403, "Access denied");
  }

  // Delete file
  const result = await deleteEntityMedia(entityType, entityIdNum, field);

  if (!result.success) {
    error(500, result.error || "Delete failed");
  }

  return json({ success: true });
};
