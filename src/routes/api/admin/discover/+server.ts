/**
 * Admin-only platform discovery API.
 *
 * GET  /api/admin/discover           — list recent runs
 * POST /api/admin/discover           — create a new draft run on an existing
 *                                       job_platforms row. The run is NOT
 *                                       enqueued; the admin picks credentials
 *                                       + device on the run detail page and
 *                                       hits POST /api/admin/discover/[id]/start
 *                                       to actually run it.
 */
import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db } from "$lib/server/db";
import { desc, eq } from "drizzle-orm";
import {
  job_platforms,
  platform_discovery_runs,
} from "$lib/server/db/schema";
import { requireAuth } from "$lib/server/utils/api-helpers";

function requireAdmin(locals: App.Locals) {
  const user = requireAuth(locals);
  if (!(user as { is_admin?: boolean }).is_admin) {
    throw error(403, "Admin access required");
  }
  return user;
}

export const GET: RequestHandler = async ({ locals }) => {
  requireAdmin(locals);
  const runs = await db
    .select()
    .from(platform_discovery_runs)
    .orderBy(desc(platform_discovery_runs.started_at))
    .limit(50);
  return json({ runs });
};

export const POST: RequestHandler = async ({ locals, request }) => {
  const user = requireAdmin(locals);
  const body = (await request.json()) as {
    platform_id?: number;
  };
  const platformId = Number(body.platform_id);
  if (!Number.isInteger(platformId) || platformId <= 0) {
    throw error(400, "platform_id is required");
  }

  const platform = await db.query.job_platforms.findFirst({
    where: eq(job_platforms.id, platformId),
    columns: { id: true, url: true, name: true, login_page_url: true },
  });
  if (!platform) throw error(404, "Platform not found");
  if (!platform.url) throw error(400, "Platform has no base URL");
  if (!platform.login_page_url) {
    throw error(
      400,
      "Platform has no login_page_url — set one before running discovery",
    );
  }
  let parsed: URL;
  try {
    parsed = new URL(platform.url);
  } catch {
    throw error(400, "Platform URL is not a valid URL");
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw error(400, "Platform URL must be http(s)");
  }

  // Draft run — admin picks credentials + device on the run detail page,
  // then calls /start to enqueue. Status "draft" is distinct from "queued"
  // (which now means "BullMQ has it, waiting for a worker").
  const [run] = await db.insert(platform_discovery_runs).values({
    platform_id: platform.id,
    target_url: parsed.toString(),
    status: "draft",
    triggered_by_user_id: user.id,
  }).returning();

  return json({ run });
};
