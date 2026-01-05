import { error } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/db";
import { PROFILE_INCLUDE } from "$lib/server/profile-default";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params }) => {
  const { identifier } = params;

  // Try to parse as number (ID)
  const id = parseInt(identifier, 10);

  let profile;

  if (!isNaN(id)) {
    // Numeric identifier - look up by ID
    profile = await db.profiles.findUnique({
      where: { id },
      include: PROFILE_INCLUDE,
    });
  } else {
    // String identifier - look up by slug
    profile = await db.profiles.findFirst({
      where: { slug: identifier },
      include: PROFILE_INCLUDE,
    });
  }

  if (!profile) {
    throw error(404, {
      message: `Portfolio not found for identifier: ${identifier}`,
    });
  }

  return { profile };
};
