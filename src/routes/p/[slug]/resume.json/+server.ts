import { error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

// Public profile feature is disabled for now
export const GET: RequestHandler = async () => {
  throw error(404, "Not found");
};
