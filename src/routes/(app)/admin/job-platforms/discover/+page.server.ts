import type { PageServerLoad } from "./$types";
import { dbDirect as db } from "$lib/server/db";
import { desc } from "drizzle-orm";
import { platform_discovery_runs } from "$lib/server/db/schema";

export const load: PageServerLoad = async () => {
  const runs = await db
    .select()
    .from(platform_discovery_runs)
    .orderBy(desc(platform_discovery_runs.started_at))
    .limit(50);
  return { runs };
};
