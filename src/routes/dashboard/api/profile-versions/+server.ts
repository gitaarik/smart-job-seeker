import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db } from "$lib/server/db";
import { requireAuth } from "$lib/server/utils/api-helpers";
import { getSelectedProfileId } from "../../profile/utils";

export const GET: RequestHandler = async ({ locals, cookies }) => {
  const user = requireAuth(locals);

  const profileId = await getSelectedProfileId(cookies, user.id);
  if (!profileId) {
    return json([]);
  }

  const versions = await db.profile_versions.findMany({
    where: { profile_id: profileId },
    select: { slug: true },
    orderBy: { date_created: "desc" },
  });

  return json(versions.map((v) => v.slug).filter(Boolean));
};
