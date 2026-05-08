import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { requireAuth, parseIntParam, requireProfileAccess } from "$lib/server/utils/api-helpers";

/**
 * POST /api/tunnel/input/:profileId — Forward raw input events to tunnel client.
 *
 * Accepts rawMouseEvent, rawScrollEvent, and rawKeyEvent payloads
 * and forwards them to the desktop app via the tunnel server.
 */
export const POST: RequestHandler = async ({ locals, params, request, url }) => {
  const user = requireAuth(locals);
  const profileId = parseIntParam(params.profileId, "profileId");
  await requireProfileAccess(profileId, user.id);

  const sjsBrowserHost = process.env.SJS_TUNNEL_HOST || "127.0.0.1";
  const sjsBrowserPort = process.env.SJS_TUNNEL_PORT || "9333";

  // Optional apiKeyId pins input events to the search-task device.
  const apiKeyId = url.searchParams.get("apiKeyId");
  const upstreamPath = `/input/${profileId}${apiKeyId ? `?apiKeyId=${encodeURIComponent(apiKeyId)}` : ""}`;

  try {
    const body = await request.json();

    const res = await fetch(`http://${sjsBrowserHost}:${sjsBrowserPort}${upstreamPath}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: "Unknown error" }));
      throw error(res.status === 404 ? 404 : res.status === 400 ? 400 : 500, data.error || "Failed to forward input event");
    }

    return json(await res.json());
  } catch (err) {
    if (err && typeof err === "object" && "status" in err) throw err;
    throw error(502, "Tunnel server unavailable");
  }
};
