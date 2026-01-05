import { redirect } from "@sveltejs/kit";
import { getDefaultProfileId } from "$lib/server/profile-default";

export async function load() {
  const defaultProfileId = await getDefaultProfileId();

  if (!defaultProfileId) {
    throw new Error(
      "No default profile configured. " +
        "Please set a default profile in the config table.",
    );
  }

  throw redirect(308, `/portfolio/${defaultProfileId}`);
}
