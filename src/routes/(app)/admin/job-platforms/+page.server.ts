import type { PageServerLoad } from "./$types";
import { dbDirect as db } from "$lib/server/db";
import { sql } from "drizzle-orm";
import { job_platform_changes, job_platforms } from "$lib/server/db/schema";

export const load: PageServerLoad = async () => {
  const platforms = await db
    .select({
      id: job_platforms.id,
      key: job_platforms.key,
      name: job_platforms.name,
      url: job_platforms.url,
      type: job_platforms.type,
      status: job_platforms.status,
      login_page_url: job_platforms.login_page_url,
      search_url_template: job_platforms.search_url_template,
      suggestion_priority: job_platforms.suggestion_priority,
      suggestion_hint: job_platforms.suggestion_hint,
      success_count: job_platforms.success_count,
      failure_count: job_platforms.failure_count,
      last_success_at: job_platforms.last_success_at,
      last_failure_at: job_platforms.last_failure_at,
      date_created: job_platforms.date_created,
      date_updated: job_platforms.date_updated,
      change_count: sql<number>`(
        SELECT count(*)::int FROM ${job_platform_changes}
        WHERE ${job_platform_changes.platform_id} = ${job_platforms.id}
      )`,
    })
    .from(job_platforms)
    .orderBy(
      sql`CASE WHEN ${job_platforms.suggestion_priority} IS NULL THEN 1 ELSE 0 END`,
      job_platforms.suggestion_priority,
      job_platforms.name,
    );

  return { platforms };
};
