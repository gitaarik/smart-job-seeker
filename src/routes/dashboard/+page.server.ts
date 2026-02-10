import type { PageServerLoad } from "./$types";
import { getProfileByIdentifier } from "$lib/server/profile/default";

export const load: PageServerLoad = async ({ parent }) => {
  // Get data from layout (user, profiles, selectedProfile)
  const layoutData = await parent();

  if (!layoutData.selectedProfile) {
    return { fullProfile: null };
  }

  // Fetch full profile data for the selected profile
  const fullProfile = await getProfileByIdentifier(
    layoutData.selectedProfile.id,
  );

  return {
    fullProfile,
  };
};
