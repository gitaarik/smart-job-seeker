import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db } from "$lib/server/db";
import { eq } from "drizzle-orm";
import { users } from "$lib/server/db/schema";
import { requireAuth } from "$lib/server/utils/api-helpers";

/**
 * PATCH /api/account
 *
 * Update account-level settings (timezone).
 */
export const PATCH: RequestHandler = async ({ request, locals }) => {
  const user = requireAuth(locals);
  const body = await request.json();

  if (typeof body.timezone === "string") {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: body.timezone });
    } catch {
      throw error(400, "Invalid timezone");
    }
    await db.update(users).set({ timezone: body.timezone }).where(eq(users.id, user.id));
  }

  return json({ ok: true });
};
