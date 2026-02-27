import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

const BROWSER_USE_URL = process.env.SJS_BROWSER_USE_URL || "http://browser-use:8000";

/**
 * GET /api/staff/browser-use/logs
 *
 * Proxy to browser-use service logs endpoint.
 * Only accessible to staff users.
 */
export const GET: RequestHandler = async ({ locals, url }) => {
  const user = locals.user;
  if (!user) {
    throw error(401, "Not authenticated");
  }

  // Check if user is staff - use type assertion since is_staff may not be in the default type
  const isStaff = (user as { is_staff?: boolean }).is_staff;
  const isAdmin = (user as { is_admin?: boolean }).is_admin;

  if (!isStaff && !isAdmin) {
    throw error(403, "Staff access required");
  }

  // Forward query params
  const limit = url.searchParams.get("limit") || "100";
  const level = url.searchParams.get("level") || "info";
  const after = url.searchParams.get("after");

  try {
    const params = new URLSearchParams({ limit, level });
    if (after) {
      params.append("after", after);
    }

    const response = await fetch(`${BROWSER_USE_URL}/logs?${params}`);

    if (!response.ok) {
      throw error(response.status, "Failed to fetch browser-use logs");
    }

    const data = await response.json();
    return json(data);
  } catch (err) {
    console.error("Error fetching browser-use logs:", err);
    throw error(500, "Failed to fetch browser-use logs");
  }
};
