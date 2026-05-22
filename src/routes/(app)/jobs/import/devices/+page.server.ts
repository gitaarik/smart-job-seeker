import type { PageServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";
import { listApiKeys } from "$lib/server/auth/api-key";
import { listSharedWithMe } from "$lib/server/device-shares";

export const load: PageServerLoad = async ({ parent }) => {
  const layoutData = await parent();

  if (!layoutData.selectedProfile) {
    redirect(302, "/home");
  }
  if (!layoutData.user) {
    redirect(302, "/login");
  }

  const apiKeys = await listApiKeys(layoutData.user.id);
  const sharedRaw = await listSharedWithMe(layoutData.user.id);

  // Drop key_plain — the contact uses the device via import flow, not by configuring a tunnel client themselves
  const sharedDevices = sharedRaw.map((s) => ({
    id: s.id,
    date_created: s.date_created,
    api_key: {
      id: s.api_key.id,
      name: s.api_key.name,
      owner: s.api_key.owner,
    },
  }));

  return {
    apiKeys,
    sharedDevices,
  };
};
