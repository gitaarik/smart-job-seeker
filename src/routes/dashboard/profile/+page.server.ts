import type { PageServerLoad } from "./$types";
import { getProfileByIdentifier } from "$lib/server/profile/default";

export const load: PageServerLoad = async ({ parent }) => {
  const layoutData = await parent();

  if (!layoutData.selectedProfile) {
    return { profile: null };
  }

  const profile = await getProfileByIdentifier(layoutData.selectedProfile.id);

  return { profile };
};
