import type { PageServerLoad } from "./$types";
import { dbDirect as db } from "$lib/server/db";
import { asc, desc, eq } from "drizzle-orm";
import {
  job_platforms,
  platform_discovery_runs,
} from "$lib/server/db/schema";

export const load: PageServerLoad = async () => {
  const [runs, platforms] = await Promise.all([
    db
      .select({
        run: platform_discovery_runs,
        platform_name: job_platforms.name,
      })
      .from(platform_discovery_runs)
      .leftJoin(
        job_platforms,
        eq(platform_discovery_runs.platform_id, job_platforms.id),
      )
      .orderBy(desc(platform_discovery_runs.started_at))
      .limit(50),
    db
      .select({ id: job_platforms.id, name: job_platforms.name, url: job_platforms.url })
      .from(job_platforms)
      .orderBy(asc(job_platforms.name)),
  ]);
  return { runs, platforms };
};
