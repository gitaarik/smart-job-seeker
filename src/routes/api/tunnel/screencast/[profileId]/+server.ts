import type { RequestHandler } from "./$types";
import { requireAuth, parseIntParam, requireProfileAccess } from "$lib/server/utils/api-helpers";

const tunnelHost = process.env.SJS_TUNNEL_HOST || "127.0.0.1";
const tunnelPort = process.env.SJS_TUNNEL_PORT || "9333";

/**
 * GET /api/tunnel/screencast/:profileId — on-demand screenshot
 *
 * Takes a CDP screenshot of the current browser page via the tunnel.
 * The frontend polls this endpoint to update the browser view.
 */
export const GET: RequestHandler = async ({ params, locals, url }) => {
  const user = requireAuth(locals);
  const profileId = parseIntParam(params.profileId, "profile");
  await requireProfileAccess(profileId, user.id);

  // Optional apiKeyId pins the screenshot to a specific device — required when
  // multiple devices are connected for the same profile.
  const apiKeyId = url.searchParams.get("apiKeyId");
  const upstreamPath = `/screencast/${profileId}/frame${apiKeyId ? `?apiKeyId=${encodeURIComponent(apiKeyId)}` : ""}`;

  try {
    const upstream = await fetch(
      `http://${tunnelHost}:${tunnelPort}${upstreamPath}`,
      { signal: AbortSignal.timeout(10000) },
    );

    if (upstream.status === 204 || !upstream.ok) {
      return new Response(null, { status: 204 });
    }

    const buf = await upstream.arrayBuffer();
    return new Response(buf, {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "no-cache, no-store",
      },
    });
  } catch {
    return new Response(null, { status: 502 });
  }
};
