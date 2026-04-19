import { json, type RequestHandler } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";
import { requireAuth } from "$lib/server/utils/api-helpers";
import {
  languageReorderSchema,
  parseBody,
} from "$lib/server/validation/api-schemas";

export const PATCH: RequestHandler = async ({ request, locals }) => {
  const user = requireAuth(locals);

  const { profile_id, order } =
    parseBody(languageReorderSchema, await request.json());

  const profile = await db.query.profiles.findFirst({
    where: { id: profile_id, user_id: user.id },
  });

  if (!profile) {
    return json({ error: "Profile not found" }, { status: 404 });
  }

  await Promise.all(
    order.map((id, index) =>
      db.languages.updateMany({
        where: { id, profile_id: profile_id },
        data: { sort: index, date_updated: new Date() },
      })
    ),
  );

  return json({ success: true });
};
