import { json, type RequestHandler } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";
import { eq, and } from "drizzle-orm";
import { profiles, references } from "$lib/server/db/schema";
import { requireAuth } from "$lib/server/utils/api-helpers";
import {
  referenceReorderSchema,
  parseBody,
} from "$lib/server/validation/api-schemas";

export const PATCH: RequestHandler = async ({ request, locals }) => {
  const user = requireAuth(locals);

  const { profile_id, order } =
    parseBody(referenceReorderSchema, await request.json());

  const profile = await db.query.profiles.findFirst({
    where: and(eq(profiles.id, profile_id), eq(profiles.user_id, user.id)),
  });

  if (!profile) {
    return json({ error: "Profile not found" }, { status: 404 });
  }

  await Promise.all(
    order.map((id, index) =>
      db.update(references)
        .set({ sort: index, date_updated: new Date() })
        .where(and(eq(references.id, id), eq(references.profile_id, profile_id)))
    ),
  );

  return json({ success: true });
};
