import type { PageServerLoad } from "./$types";
import { redirectIfAuthenticated } from "$lib/server/auth/guards";

export const load: PageServerLoad = async (event) => {
  // Get redirect URL from query params
  const redirectTo = event.url.searchParams.get("redirect") || "/home";
  redirectIfAuthenticated(event, redirectTo);
  return { redirectTo };
};
