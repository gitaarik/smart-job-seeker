/**
 * Debug API — Match Stats
 *
 * GET /api/debug/match-stats?minScore=70&profileId=<id>
 *
 * Aggregate distribution of job_matches by age and score, for tuning the
 * Top Matches decay/floor (see TOP_MATCH_* constants in
 * routes/(app)/home/+page.server.ts) and any future ranking work. Read-only,
 * curated aggregations — deliberately NOT an arbitrary-query endpoint.
 *
 * age_days mirrors the home query: board posted date preferred, falling back
 * to when we first scraped the job, clamped at 0 to absorb bogus dates.
 *
 * Protected by DEBUG_API_KEY (Bearer token). Not session-authenticated —
 * designed for machine-to-machine access from the ops machine.
 */

import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { queryRawDirect, sql } from "$lib/server/db";

function requireDebugAuth(request: Request): void {
  const key = process.env.DEBUG_API_KEY;
  if (!key) throw error(503, "Debug API not configured");
  const auth = request.headers.get("authorization");
  if (!auth || auth !== `Bearer ${key}`) {
    throw error(401, "Invalid or missing debug API key");
  }
}

function detectEnvironment(): string {
  const origin = process.env.ORIGIN || "";
  if (origin.includes("preview.")) return "preview";
  if (origin.includes("www.")) return "production";
  if (origin.includes("dev.")) return "development";
  return "development";
}

// Shared age expression — keep in sync with the Top Matches query.
const AGE_DAYS = sql`GREATEST(0, EXTRACT(epoch FROM now() - COALESCE(j.date_posted::timestamptz, j.date_created)) / 86400.0)`;

export const GET: RequestHandler = async ({ request, url }) => {
  requireDebugAuth(request);

  const minScore = Number(url.searchParams.get("minScore") ?? "70");
  const profileIdParam = url.searchParams.get("profileId");
  const profileId = profileIdParam != null ? Number(profileIdParam) : null;

  if (!Number.isFinite(minScore)) throw error(400, "minScore must be a number");
  if (profileIdParam != null && !Number.isFinite(profileId)) {
    throw error(400, "profileId must be a number");
  }

  // Optional per-profile scoping; absent → across all profiles.
  const profileClause = profileId != null ? sql`AND jm.profile_id = ${profileId}` : sql``;

  // Age distribution: how matches spread across age buckets, with avg score
  // per bucket. Flat avg_score across buckets ⇒ score is independent of age
  // (the thing the decay fixes).
  const ageBuckets = await queryRawDirect<{
    bucket: string;
    sort: number;
    matches: number;
    avg_score: number;
  }>(sql`
    SELECT bucket, MIN(age_days) AS sort, COUNT(*)::int AS matches, ROUND(AVG(score)) AS avg_score
    FROM (
      SELECT jm.score AS score,
        ${AGE_DAYS} AS age_days,
        CASE
          WHEN ${AGE_DAYS} <= 7  THEN '0-7d'
          WHEN ${AGE_DAYS} <= 14 THEN '8-14d'
          WHEN ${AGE_DAYS} <= 30 THEN '15-30d'
          WHEN ${AGE_DAYS} <= 45 THEN '31-45d'
          WHEN ${AGE_DAYS} <= 60 THEN '46-60d'
          WHEN ${AGE_DAYS} <= 90 THEN '61-90d'
          ELSE '90d+'
        END AS bucket
      FROM job_matches jm
      JOIN jobs j ON j.id = jm.job_id
      WHERE jm.score >= ${minScore} ${profileClause}
    ) t
    GROUP BY bucket
    ORDER BY sort
  `);

  // Score distribution: matches per score band, with avg age per band. Flat
  // avg_age_days across bands is the same independence from the other angle.
  const scoreBuckets = await queryRawDirect<{
    bucket: string;
    matches: number;
    avg_age_days: number;
  }>(sql`
    SELECT
      CASE
        WHEN jm.score >= 90 THEN '90-100'
        WHEN jm.score >= 80 THEN '80-89'
        WHEN jm.score >= 70 THEN '70-79'
        ELSE '<70'
      END AS bucket,
      COUNT(*)::int AS matches,
      ROUND(AVG(${AGE_DAYS}))::int AS avg_age_days
    FROM job_matches jm
    JOIN jobs j ON j.id = jm.job_id
    WHERE jm.score >= ${minScore} ${profileClause}
    GROUP BY bucket
    ORDER BY bucket DESC
  `);

  // Coverage: how trustworthy date_posted is, plus the date range. A non-zero
  // posted_null or an absurd oldest_posted (parse artifacts) justifies the
  // COALESCE fallback and the hard age floor.
  const [coverage] = await queryRawDirect<{
    total_matches: number;
    profiles: number;
    posted_null: number;
    newest_posted: string | null;
    oldest_posted: string | null;
    matches_over_floor: number;
  }>(sql`
    SELECT
      COUNT(*)::int AS total_matches,
      COUNT(DISTINCT jm.profile_id)::int AS profiles,
      COUNT(*) FILTER (WHERE j.date_posted IS NULL)::int AS posted_null,
      MAX(j.date_posted) AS newest_posted,
      MIN(j.date_posted) AS oldest_posted,
      COUNT(*) FILTER (WHERE ${AGE_DAYS} > 60)::int AS matches_over_floor
    FROM job_matches jm
    JOIN jobs j ON j.id = jm.job_id
    WHERE jm.score >= ${minScore} ${profileClause}
  `);

  return json({
    environment: detectEnvironment(),
    timestamp: new Date().toISOString(),
    filters: { minScore, profileId },
    coverage,
    ageBuckets,
    scoreBuckets,
  });
};
