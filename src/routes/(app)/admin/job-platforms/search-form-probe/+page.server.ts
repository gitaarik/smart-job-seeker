import type { PageServerLoad } from "./$types";
import { dbDirect as db } from "$lib/server/db";
import { desc, eq } from "drizzle-orm";
import {
  job_platforms,
  search_form_probe_runs,
} from "$lib/server/db/schema";

export const load: PageServerLoad = async () => {
  const runs = await db
    .select({
      run: search_form_probe_runs,
      platform_name: job_platforms.name,
    })
    .from(search_form_probe_runs)
    .leftJoin(
      job_platforms,
      eq(search_form_probe_runs.platform_id, job_platforms.id),
    )
    .orderBy(desc(search_form_probe_runs.started_at))
    .limit(50);
  return { runs };
};
