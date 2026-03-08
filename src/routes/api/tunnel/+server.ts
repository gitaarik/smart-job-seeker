import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { requireAuth, parseIntParam, requireProfileAccess } from "$lib/server/utils/api-helpers";

/**
 * GET /api/tunnel?profileId=123 — Get tunnel connection status for a profile.
 *
 * The tunnel registry lives in the worker process, not the SvelteKit app.
 * We check the status by querying the worker's tunnel server over HTTP.
 * If the worker isn't reachable, we return "unavailable".
 */
export const GET: RequestHandler = async ({ locals, url }) => {
  const user = requireAuth(locals);

  const profileIdStr = url.searchParams.get("profileId");
  if (!profileIdStr) {
    return json({ connected: false, status: "no_profile" });
  }
  const profileId = parseIntParam(profileIdStr, "profile");
  await requireProfileAccess(profileId, user.id);

  // The tunnel server runs inside the worker, which exposes a status HTTP endpoint.
  // Try to reach it. In development, it's on localhost:9333; in production it may differ.
  try {
    const tunnelHost = process.env.SJS_TUNNEL_HOST || "127.0.0.1";
    const tunnelPort = process.env.SJS_TUNNEL_PORT || "9333";
    const res = await fetch(`http://${tunnelHost}:${tunnelPort}/status/${profileId}`, {
      signal: AbortSignal.timeout(2000),
    });
    if (res.ok) {
      const data = await res.json();
      return json(data);
    }
    return json({ connected: false, status: "unavailable" });
  } catch {
    return json({ connected: false, status: "unavailable" });
  }
};
