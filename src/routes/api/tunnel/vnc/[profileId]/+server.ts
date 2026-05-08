import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { requireAuth, parseIntParam, requireProfileAccess } from "$lib/server/utils/api-helpers";

/**
 * POST /api/tunnel/vnc/:profileId — Generate a short-lived VNC access token.
 *
 * Returns a WebSocket URL that noVNC can connect to for interactive browser control.
 */
export const POST: RequestHandler = async ({ locals, params, url }) => {
  const user = requireAuth(locals);
  const profileId = parseIntParam(params.profileId, "profileId");
  await requireProfileAccess(profileId, user.id);

  const sjsBrowserHost = process.env.SJS_TUNNEL_HOST || "127.0.0.1";
  const sjsBrowserPort = process.env.SJS_TUNNEL_PORT || "9333";

  // Optional apiKeyId pins VNC to a specific device.
  const apiKeyId = url.searchParams.get("apiKeyId");
  const upstreamPath = `/vnc-token/${profileId}${apiKeyId ? `?apiKeyId=${encodeURIComponent(apiKeyId)}` : ""}`;

  try {
    const res = await fetch(`http://${sjsBrowserHost}:${sjsBrowserPort}${upstreamPath}`, {
      method: "POST",
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: "Unknown error" }));
      throw error(res.status === 404 ? 404 : 500, data.error || "Failed to create VNC token");
    }

    const { token } = await res.json();
    return json({ token, profileId });
  } catch (err) {
    if (err && typeof err === "object" && "status" in err) throw err;
    throw error(502, "Tunnel server unavailable");
  }
};
