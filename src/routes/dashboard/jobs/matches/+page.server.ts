import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ url }) => {
  // Redirect to matches with minimum score filter
  const params = new URLSearchParams(url.search);
  params.set("minScore", "1");
  redirect(302, `/dashboard/jobs?${params.toString()}`);
};
