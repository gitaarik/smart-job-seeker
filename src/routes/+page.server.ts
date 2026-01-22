import { redirect } from "@sveltejs/kit";
import { getDefaultProfile } from "$lib/server/profile/default";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async () => {
  // Get default profile
  const profile = await getDefaultProfile();

  if (!profile || !profile.slug) {
    // If no default profile or no slug, show error
    return {
      error: "No default profile found or profile missing slug",
    };
  }

  // Redirect to default profile's homepage
  throw redirect(302, `/p/${profile.slug}/`);
};
