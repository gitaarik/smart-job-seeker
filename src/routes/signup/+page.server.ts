import type { PageServerLoad } from "./$types";
import { redirectIfAuthenticated } from "$lib/server/auth/guards";

export const load: PageServerLoad = async (event) => {
  redirectIfAuthenticated(event);
  return {};
};
