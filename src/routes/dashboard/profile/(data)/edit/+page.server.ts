import type { PageServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";
import { getProfileByIdentifier } from "$lib/server/profile/default";

export const load: PageServerLoad = async ({ parent }) => {
  const layoutData = await parent();

  if (!layoutData.selectedProfile) {
    redirect(302, "/dashboard");
  }

  const profile = await getProfileByIdentifier(layoutData.selectedProfile.id);

  if (!profile) {
    redirect(302, "/dashboard");
  }

  return { profile };
};
