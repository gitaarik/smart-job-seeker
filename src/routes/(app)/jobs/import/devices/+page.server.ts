import type { PageServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";
import { listApiKeys } from "$lib/server/auth/api-key";

export const load: PageServerLoad = async ({ parent }) => {
  const layoutData = await parent();

  if (!layoutData.selectedProfile) {
    redirect(302, "/home");
  }

  const apiKeys = await listApiKeys(layoutData.selectedProfile.id);

  return {
    apiKeys,
    profileId: layoutData.selectedProfile.id,
  };
};
