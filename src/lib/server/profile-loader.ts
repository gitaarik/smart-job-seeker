import { dev } from "$app/environment";
import { redirect } from "@sveltejs/kit";
import { getDefaultProfile } from "./profile-default";

export async function loadProfile() {
  if (!dev) {
    throw redirect(302, "/");
  }

  const profile = await getDefaultProfile();

  return {
    profile,
  };
}
