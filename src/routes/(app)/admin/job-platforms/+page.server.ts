import type { PageServerLoad } from "./$types";
import { dbDirect as db } from "$lib/server/db";
import { sql } from "drizzle-orm";
import {
  job_platform_changes,
  job_platform_search_presets,
  job_platforms,
} from "$lib/server/db/schema";

export const load: PageServerLoad = async () => {
  // Three separate aggregates merged in JS — Drizzle's correlated-subquery
  // syntax was returning wrong counts when nesting table refs, so be
  // explicit.
  const [platforms, presetCounts, changeCounts] = await Promise.all([
    db
      .select({
        id: job_platforms.id,
        key: job_platforms.key,
        name: job_platforms.name,
        url: job_platforms.url,
        type: job_platforms.type,
        status: job_platforms.status,
        login_page_url: job_platforms.login_page_url,
        suggestion_priority: job_platforms.suggestion_priority,
        suggestion_hint: job_platforms.suggestion_hint,
        success_count: job_platforms.success_count,
        failure_count: job_platforms.failure_count,
        last_success_at: job_platforms.last_success_at,
        last_failure_at: job_platforms.last_failure_at,
        date_created: job_platforms.date_created,
        date_updated: job_platforms.date_updated,
      })
      .from(job_platforms)
      .orderBy(
        sql`CASE WHEN ${job_platforms.suggestion_priority} IS NULL THEN 1 ELSE 0 END`,
        job_platforms.suggestion_priority,
        job_platforms.name,
      ),
    db
      .select({
        platform_id: job_platform_search_presets.platform_id,
        total: sql<number>`count(*)::int`,
        suggestable: sql<number>`count(*) filter (where ${job_platform_search_presets.suggestion_priority} is not null)::int`,
      })
      .from(job_platform_search_presets)
      .groupBy(job_platform_search_presets.platform_id),
    db
      .select({
        platform_id: job_platform_changes.platform_id,
        count: sql<number>`count(*)::int`,
      })
      .from(job_platform_changes)
      .groupBy(job_platform_changes.platform_id),
  ]);

  const presetByPlatform = new Map(
    presetCounts.map((r) => [r.platform_id, { total: r.total, suggestable: r.suggestable }]),
  );
  const changeByPlatform = new Map(
    changeCounts.map((r) => [r.platform_id, r.count]),
  );

  return {
    platforms: platforms.map((p) => ({
      ...p,
      preset_count: presetByPlatform.get(p.id)?.total ?? 0,
      suggestable_preset_count: presetByPlatform.get(p.id)?.suggestable ?? 0,
      change_count: changeByPlatform.get(p.id) ?? 0,
    })),
  };
};
