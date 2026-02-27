import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

const BROWSER_USE_URL = process.env.SJS_BROWSER_USE_URL || "http://browser-use:8000";

/**
 * POST /api/staff/browser-use/restart
 *
 * Triggers a restart of the browser-use service.
 * Only accessible to staff users.
 */
export const POST: RequestHandler = async ({ locals }) => {
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

  try {
    console.log(`[Browser-Use] Staff user ${user.id} requested service restart`);

    const response = await fetch(`${BROWSER_USE_URL}/restart`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`[Browser-Use] Restart request failed: ${response.status} ${text}`);
      throw error(response.status, "Failed to restart browser-use service");
    }

    const result = await response.json();

    // Wait a bit for the service to restart and come back up
    await new Promise((resolve) => setTimeout(resolve, 5000));

    return json({
      success: true,
      message: result.message || "Browser-Use service restart initiated",
    });
  } catch (err) {
    // If the service went down during restart (connection reset), that's expected
    if (err instanceof Error && (err.message.includes("ECONNRESET") || err.message.includes("fetch failed"))) {
      // Wait for service to come back up
      await new Promise((resolve) => setTimeout(resolve, 5000));

      return json({
        success: true,
        message: "Browser-Use service restart initiated",
      });
    }

    console.error("Error restarting browser-use service:", err);
    throw error(500, "Failed to restart browser-use service");
  }
};
