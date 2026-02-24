import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ url }) => {
  // Preserve any existing query params
  const params = new URLSearchParams(url.search);
  // Remove filter param if it exists (browse = all jobs = default)
  params.delete("filter");
  const queryString = params.toString();
  redirect(302, `/dashboard/jobs${queryString ? `?${queryString}` : ""}`);
};
