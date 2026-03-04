/**
 * Shared API route helpers for auth, ID parsing, and field updates
 */

import { error } from "@sveltejs/kit";

/**
 * Require authenticated user from locals, or throw 401.
 */
export function requireAuth(locals: App.Locals): App.Locals["user"] & {} {
  const user = locals.user;
  if (!user) {
    error(401, "Not authenticated");
  }
  return user;
}

/**
 * Parse an integer route param, or throw 400.
 */
export function parseIntParam(value: string, label: string): number {
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    error(400, `Invalid ${label} ID`);
  }
  return parsed;
}

type FieldType = "string" | "date" | "number";

/**
 * Build an update data object from request body, coercing field types.
 * Only includes fields that are present (not undefined) in the input data.
 */
export function buildUpdateData(
  data: Record<string, unknown>,
  allowedFields: string[],
  fieldTypes?: Record<string, FieldType>,
): Record<string, unknown> {
  const updateData: Record<string, unknown> = {
    date_updated: new Date(),
  };

  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      const type = fieldTypes?.[field] ?? "string";

      if (type === "date") {
        updateData[field] = data[field] ? new Date(data[field] as string) : null;
      } else if (type === "number") {
        updateData[field] = data[field] ? parseInt(data[field] as string, 10) : null;
      } else {
        updateData[field] =
          typeof data[field] === "string"
            ? (data[field] as string).trim() || null
            : data[field];
      }
    }
  }

  return updateData;
}
