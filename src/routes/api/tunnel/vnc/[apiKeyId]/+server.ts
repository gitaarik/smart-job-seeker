import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { parseIntParam, requireAuth } from "$lib/server/utils/api-helpers";
import { hasDeviceAccess } from "$lib/server/device-shares";

/**
 * POST /api/tunnel/vnc/:apiKeyId — Generate a short-lived VNC access token
 * for the specified device.
 *
 * Returns a WebSocket URL that noVNC can connect to for interactive browser
 * control. The api_key id is unique per device, so URL routing is keyed
 * directly on it — no profile indirection.
 */
export const POST: RequestHandler = async ({ locals, params }) => {
  const user = requireAuth(locals);
  const apiKeyId = parseIntParam(params.apiKeyId, "apiKeyId");

  // Demo users get a read-only browser view — never interactive control of the
  // (shared, logged-in) browser. Defense in depth behind the hidden UI control.
  if ((user as { is_demo?: boolean }).is_demo) {
    throw error(403, "Interactive control isn't available in demo mode");
  }

  if (!(await hasDeviceAccess(apiKeyId, user.id))) {
    throw error(403, "Not authorized for this device");
  }

  const sjsBrowserHost = process.env.SJS_TUNNEL_HOST || "127.0.0.1";
  const sjsBrowserPort = process.env.SJS_TUNNEL_PORT || "9333";

  try {
    const res = await fetch(
      `http://${sjsBrowserHost}:${sjsBrowserPort}/vnc-token/${apiKeyId}`,
      {
        method: "POST",
        signal: AbortSignal.timeout(5000),
      },
    );

    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: "Unknown error" }));
      throw error(
        res.status === 404 ? 404 : 500,
        data.error || "Failed to create VNC token",
      );
    }

    const { token } = await res.json();
    return json({ token, apiKeyId });
  } catch (err) {
    if (err && typeof err === "object" && "status" in err) throw err;
    throw error(502, "Tunnel server unavailable");
  }
};
