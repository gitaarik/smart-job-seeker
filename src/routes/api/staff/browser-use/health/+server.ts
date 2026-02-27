import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

const BROWSER_USE_URL = process.env.SJS_BROWSER_USE_URL || "http://browser-use:8000";

/**
 * GET /api/staff/browser-use/health
 *
 * Get detailed health status of the browser-use service.
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
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(`${BROWSER_USE_URL}/health/detailed`, {
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return json({
        service_healthy: false,
        chrome_running: false,
        cdp_responsive: false,
        cdp_port: 9222,
        socat_running: false,
        error: `Service returned ${response.status}`,
      });
    }

    const data = await response.json();
    return json(data);
  } catch (err) {
    // Service unreachable
    const message = err instanceof Error ? err.message : String(err);
    return json({
      service_healthy: false,
      chrome_running: false,
      cdp_responsive: false,
      cdp_port: 9222,
      socat_running: false,
      error: message.includes("abort") ? "Service timeout (10s)" : `Service unreachable: ${message}`,
    });
  }
};
