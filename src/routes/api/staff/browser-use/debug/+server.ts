import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

const BROWSER_USE_URL = process.env.SJS_BROWSER_USE_URL || "http://browser-use:8000";

/**
 * GET /api/staff/browser-use/debug
 *
 * Get detailed CDP debug information.
 * Only accessible to staff users.
 */
export const GET: RequestHandler = async ({ locals }) => {
  const user = locals.user;
  if (!user) {
    throw error(401, "Not authenticated");
  }

  // Check if user is staff
  const isStaff = (user as { is_staff?: boolean }).is_staff;
  const isAdmin = (user as { is_admin?: boolean }).is_admin;

  if (!isStaff && !isAdmin) {
    throw error(403, "Staff access required");
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(`${BROWSER_USE_URL}/debug/cdp`, {
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return json({
        error: `Service returned ${response.status}`,
      });
    }

    const data = await response.json();
    return json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({
      error: message.includes("abort") ? "Service timeout (15s)" : `Service unreachable: ${message}`,
    });
  }
};
