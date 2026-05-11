import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db } from "$lib/server/db";
import { and, asc, eq, gt } from "drizzle-orm";
import {
  platform_discovery_logs,
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

export const GET: RequestHandler = async ({ locals, params, url }) => {
  requireAdmin(locals);
  const id = parseInt(params.id ?? "", 10);
  if (!Number.isInteger(id) || id <= 0) throw error(400, "Invalid run id");

  const run = await db.query.platform_discovery_runs.findFirst({
    where: eq(platform_discovery_runs.id, id),
  });
  if (!run) throw error(404, "Run not found");

  // Optional "since-log-id" cursor for incremental polling.
  const sinceId = parseInt(url.searchParams.get("since") ?? "0", 10);
  const logs = await db
    .select()
    .from(platform_discovery_logs)
    .where(
      sinceId > 0
        ? and(
          eq(platform_discovery_logs.discovery_run_id, id),
          gt(platform_discovery_logs.id, sinceId),
        )
        : eq(platform_discovery_logs.discovery_run_id, id),
    )
    .orderBy(asc(platform_discovery_logs.id))
    .limit(500);

  return json({ run, logs });
};
