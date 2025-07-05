import { error } from "@sveltejs/kit";
import type { LayoutServerLoad } from "./$types";
import { isAdmin } from "$lib/auth.js";

export const load: LayoutServerLoad = async ({ locals }) => {
  // Check if user is authenticated
  if (!locals.user) {
    throw error(401, "Authentication required");
  }

  // Check if user has admin permissions
  if (!isAdmin(locals.user)) {
    throw error(403, "Admin access required");
  }

  // If we reach here, user is authenticated and has admin access
  return {
    user: locals.user
  };
};