import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db } from "$lib/server/db";
import { eq } from "drizzle-orm";
import { search_tasks } from "$lib/server/db/schema";
import { parseIntParam, requireAuth } from "$lib/server/utils/api-helpers";
import { resolveTunnelDevice } from "$lib/server/sjs-browser-status";

/**
 * POST /api/import-tasks/[id]/open-browser
 *
 * Open a new tab in the user's NAS Chrome (via the running tunnel device)
 * and navigate it to the task's platform URL. Lets the user reach the
 * platform manually — e.g. to toggle a site's display language — without
 * queuing a scrape. The Chrome process is the same one the scraper uses,
 * so cookies / login state are shared and any change the user makes
 * persists into the next scrape.
 *
 * Body: { url?: string } — optional override; defaults to the platform's
 * search_page_url, then platform.url.
 */
export const POST: RequestHandler = async ({ params, locals, request }) => {
  const user = requireAuth(locals);
  const taskId = parseIntParam(params.id, "import task");

  const task = await db.query.search_tasks.findFirst({
    where: eq(search_tasks.id, taskId),
    with: {
      profile: { columns: { user_id: true } },
      job_platform: { columns: { url: true, search_page_url: true } },
    },
  });
  if (!task) throw error(404, "Import task not found");
  if (task.profile.user_id !== user.id) {
    throw error(403, "Not authorized for this task");
  }

  let url: string | undefined;
  try {
    const body = (await request.json().catch(() => ({}))) as {
      url?: unknown;
    };
    if (typeof body.url === "string" && body.url.trim()) {
      url = body.url.trim();
    }
  } catch {
    // Empty body is fine — fall through to platform defaults.
  }
  if (!url) {
    url = task.job_platform?.search_page_url
      || task.job_platform?.url
      || task.search_url
      || undefined;
  }
  if (!url) {
    throw error(400, "Task has no platform URL configured");
  }

  // Pin to the task's configured device first; only fall back to the
  // user's preferred device if the task is unpinned. The scrape itself
  // uses the pinned device, so a manual open should land on the same
  // Chrome instance — otherwise cookie state diverges.
  const apiKeyIdRaw = task.sjsbrowser_api_key != null
    ? String(task.sjsbrowser_api_key)
    : null;
  const device = await resolveTunnelDevice(user.id, apiKeyIdRaw);
  if (!device) {
    throw error(404, "No connected tunnel device for this task");
  }

  const tunnelHost = process.env.SJS_TUNNEL_HOST || "127.0.0.1";
  const tunnelPort = process.env.SJS_TUNNEL_PORT || "9333";

  try {
    const res = await fetch(
      `http://${tunnelHost}:${tunnelPort}/open-page/${device.apiKeyId}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
        signal: AbortSignal.timeout(15_000),
      },
    );
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: "Unknown error" }));
      throw error(
        res.status === 404 ? 404 : 502,
        data.error || "Failed to open page",
      );
    }
    return json({ ok: true, url, apiKeyId: device.apiKeyId });
  } catch (err) {
    if (err && typeof err === "object" && "status" in err) throw err;
    throw error(502, "Tunnel server unavailable");
  }
};
