/**
 * Admin-only platform discovery API.
 *
 * GET  /api/admin/discover           — list recent runs
 * POST /api/admin/discover           — create + enqueue a new run on an
 *                                       existing job_platforms row
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
import { addDiscoveryJob } from "$lib/server/queue/discovery-queue";

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
  const body = (await request.json()) as { platform_id?: number };
  const platformId = Number(body.platform_id);
  if (!Number.isInteger(platformId) || platformId <= 0) {
    throw error(400, "platform_id is required");
  }

  const platform = await db.query.job_platforms.findFirst({
    where: eq(job_platforms.id, platformId),
    columns: { id: true, url: true, name: true },
  });
  if (!platform) throw error(404, "Platform not found");
  if (!platform.url) throw error(400, "Platform has no base URL");
  let parsed: URL;
  try {
    parsed = new URL(platform.url);
  } catch {
    throw error(400, "Platform URL is not a valid URL");
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw error(400, "Platform URL must be http(s)");
  }

  const [run] = await db.insert(platform_discovery_runs).values({
    platform_id: platform.id,
    target_url: parsed.toString(),
    status: "queued",
    triggered_by_user_id: user.id,
  }).returning();

  const job = await addDiscoveryJob({
    discoveryRunId: run.id,
    targetUrl: parsed.toString(),
    triggeredByUserId: user.id,
  });

  await db.update(platform_discovery_runs)
    .set({ bullmq_job_id: job.id ?? null })
    .where(eq(platform_discovery_runs.id, run.id));

  return json({ run });
};
