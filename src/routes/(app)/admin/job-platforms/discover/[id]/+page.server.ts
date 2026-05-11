import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { dbDirect as db } from "$lib/server/db";
import { asc, eq } from "drizzle-orm";
import {
  job_platforms,
  platform_discovery_logs,
  platform_discovery_runs,
} from "$lib/server/db/schema";

export const load: PageServerLoad = async ({ params }) => {
  const id = parseInt(params.id, 10);
  if (!Number.isInteger(id) || id <= 0) throw error(400, "Invalid run id");

  const run = await db.query.platform_discovery_runs.findFirst({
    where: eq(platform_discovery_runs.id, id),
  });
  if (!run) throw error(404, "Run not found");

  const platform = run.platform_id
    ? await db.query.job_platforms.findFirst({
      where: eq(job_platforms.id, run.platform_id),
      columns: {
        id: true,
        name: true,
        url: true,
        login_page_url: true,
      },
    })
    : null;

  const logs = await db
    .select()
    .from(platform_discovery_logs)
    .where(eq(platform_discovery_logs.discovery_run_id, id))
    .orderBy(asc(platform_discovery_logs.id))
    .limit(500);

  return { run, platform, logs };
};
