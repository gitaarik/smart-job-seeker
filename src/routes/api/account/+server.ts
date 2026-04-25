import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db } from "$lib/server/db";
import { eq } from "drizzle-orm";
import { users } from "$lib/server/db/schema";
import { requireAuth } from "$lib/server/utils/api-helpers";

/**
 * PATCH /api/account
 *
 * Update account-level settings (timezone, time_format).
 */
export const PATCH: RequestHandler = async ({ request, locals }) => {
  const user = requireAuth(locals);
  const body = await request.json();

  const updates: Record<string, string | null> = {};

  if (typeof body.timezone === "string") {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: body.timezone });
    } catch {
      throw error(400, "Invalid timezone");
    }
    updates.timezone = body.timezone;
  }

  if (body.time_format !== undefined) {
    if (body.time_format !== null && body.time_format !== "12h" && body.time_format !== "24h") {
      throw error(400, "time_format must be '12h', '24h', or null");
    }
    updates.time_format = body.time_format;
  }

  if (Object.keys(updates).length > 0) {
    await db.update(users).set(updates).where(eq(users.id, user.id));
  }

  return json({ ok: true });
};
