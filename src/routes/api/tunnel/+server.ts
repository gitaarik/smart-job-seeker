import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { requireAuth } from "$lib/server/utils/api-helpers";

/**
 * GET /api/tunnel — Get tunnel connection status for the current profile.
 *
 * The tunnel registry lives in the worker process, not the SvelteKit app.
 * We check the status by querying the worker's tunnel server over HTTP.
 * If the worker isn't reachable, we return "unavailable".
 */
export const GET: RequestHandler = async ({ locals, cookies, fetch: svelteFetch }) => {
  requireAuth(locals);

  const profileIdStr = cookies.get("selected_profile_id");
  if (!profileIdStr) {
    return json({ connected: false, status: "no_profile" });
  }
  const profileId = parseInt(profileIdStr, 10);

  // The tunnel server runs inside the worker, which exposes a status HTTP endpoint.
  // Try to reach it. In development, it's on localhost:9333; in production it may differ.
  try {
    const tunnelPort = process.env.SJS_TUNNEL_PORT || "9333";
    const res = await fetch(`http://127.0.0.1:${tunnelPort}/status/${profileId}`, {
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
