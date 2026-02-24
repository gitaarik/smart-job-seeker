import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ url }) => {
  // Preserve any existing query params and add filter=saved
  const params = new URLSearchParams(url.search);
  params.set("filter", "saved");
  redirect(302, `/dashboard/jobs?${params.toString()}`);
};
