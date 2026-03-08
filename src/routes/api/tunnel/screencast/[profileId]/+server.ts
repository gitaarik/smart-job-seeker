import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { requireAuth, parseIntParam, requireProfileAccess } from "$lib/server/utils/api-helpers";

const tunnelHost = process.env.SJS_TUNNEL_HOST || "127.0.0.1";
const tunnelPort = process.env.SJS_TUNNEL_PORT || "9333";

/**
 * GET /api/tunnel/screencast/:profileId — SSE stream of screencast frames
 *
 * Proxies the SSE stream from the worker's tunnel server to the dashboard.
 * Each SSE event contains a base64-encoded JPEG frame.
 */
export const GET: RequestHandler = async ({ params, locals }) => {
  const user = requireAuth(locals);
  const profileId = parseIntParam(params.profileId, "profile");
  await requireProfileAccess(profileId, user.id);

  try {
    // No timeout for SSE streams — the connection stays open indefinitely
    // and is closed by the client when they disable the browser view.
    const upstream = await fetch(
      `http://${tunnelHost}:${tunnelPort}/screencast/${profileId}/stream`,
    );

    if (!upstream.ok || !upstream.body) {
      return json({ error: "Screencast not available" }, { status: 404 });
    }

    // Pass through the SSE stream
    return new Response(upstream.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch {
    return json({ error: "Tunnel server unreachable" }, { status: 502 });
  }
};

/**
 * POST /api/tunnel/screencast/:profileId — Start or stop screencast
 *
 * Body: { action: "start" | "stop" }
 */
export const POST: RequestHandler = async ({ params, locals, request }) => {
  const user = requireAuth(locals);
  const profileId = parseIntParam(params.profileId, "profile");
  await requireProfileAccess(profileId, user.id);

  const body = await request.json();
  const action = body.action;

  if (action !== "start" && action !== "stop") {
    return json({ error: "Invalid action, use 'start' or 'stop'" }, { status: 400 });
  }

  try {
    const res = await fetch(
      `http://${tunnelHost}:${tunnelPort}/screencast/${profileId}/${action}`,
      { method: "POST", signal: AbortSignal.timeout(5000) },
    );

    if (res.ok) {
      const data = await res.json();
      return json(data);
    }
    return json({ error: "Failed to control screencast" }, { status: res.status });
  } catch {
    return json({ error: "Tunnel server unreachable" }, { status: 502 });
  }
};
