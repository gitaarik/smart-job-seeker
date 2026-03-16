import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

// Public profile feature is disabled for now
export const load: PageServerLoad = async () => {
  throw error(404, { message: "Not found" });
};
