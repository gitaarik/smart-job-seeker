import { getDefaultProfile } from "$lib/server/profile-default";

export async function load({ locals }) {
  const profile = await getDefaultProfile();

  if (profile) {
    return {
      profile,
    };
  }
}
