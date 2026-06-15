import { redirect } from "@sveltejs/kit";
import { guideSections } from "$lib/guide";
import type { PageLoad } from "./$types";

// /guide → first section
export const load: PageLoad = () => {
  redirect(307, `/guide/${guideSections[0].slug}`);
};
