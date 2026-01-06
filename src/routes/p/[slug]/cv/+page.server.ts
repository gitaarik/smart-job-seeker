import { error } from "@sveltejs/kit";
import { getProfileByIdentifier } from "$lib/server/profile-default";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params }) => {
  const { slug } = params;

  // Get profile by slug
  const profile = await getProfileByIdentifier(slug);

  if (!profile) {
    throw error(404, {
      message: `Profile not found: ${slug}`,
    });
  }

  return { profile };
};
