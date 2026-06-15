/**
 * Shared job-listing query for the /jobs page and its infinite-scroll endpoint
 * (/jobs/list). Both the initial SSR load and subsequent scroll fetches go
 * through `listJobs` so filtering, sorting, and pagination stay identical.
 *
 * Sorting: default is newest-first (by posted date). `sort=top` ranks by a
 * freshness-decayed match score — the same ranking the home "Top Matches"
 * widget uses — so the best, freshest matches surface first and you scroll
 * down into progressively lower scores.
 */

import { and, eq, inArray, type SQL, sql } from "drizzle-orm";
import { dbDirect as db, queryRaw, sqlJoin } from "$lib/server/db";
import {
  job_matches,
  job_statuses,
  jobs as jobsTable,
  match_config,
} from "$lib/server/db/schema";
import { buildVisibilityScope } from "$lib/server/job/match-counts";

export interface JobListFilters {
  status: string;
  search: string;
  platform: string;
  workLocation: string;
  jobType: string;
  minScore: string;
  datePosted: string;
  importedBy: string;
  sort: string;
}

export interface JobListResult {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  jobs: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  matchesByJobId: Record<number, any>;
  savedJobIds: number[];
  rejectedJobIds: number[];
  totalCount: number;
}

export const JOB_LIST_PAGE_SIZE = 20;

// Freshness-decayed score ranking for sort=top. Mirrors the home top-matches
// widget (grace window, then exponential decay) so "View all" shows more of the
// same ordering. No hard age floor here — older matches just sink, they aren't
// hidden, so you can still scroll to them.
const TOP_GRACE_DAYS = 14;
const TOP_HALFLIFE_DAYS = 21;
const TOP_ORDER = sql`
  jm.score * exp(
    -GREATEST(
      0,
      EXTRACT(epoch FROM now() - COALESCE(j.date_posted::timestamptz, j.date_created)) / 86400.0
        - ${TOP_GRACE_DAYS}
    ) / ${TOP_HALFLIFE_DAYS}
  ) DESC,
  jm.score DESC,
  j.date_posted DESC NULLS LAST
`;
const DATE_ORDER = sql`j.date_posted DESC NULLS LAST, j.date_created DESC`;

export function parseJobListFilters(url: URL): JobListFilters {
  return {
    status: url.searchParams.get("status") || "",
    search: url.searchParams.get("q") || "",
    platform: url.searchParams.get("platform") || "",
    workLocation: url.searchParams.get("workLocation") || "",
    jobType: url.searchParams.get("jobType") || "",
    minScore: url.searchParams.get("minScore") || "",
    datePosted: url.searchParams.get("datePosted") || "",
    importedBy: url.searchParams.get("importedBy") || "",
    sort: url.searchParams.get("sort") || "",
  };
}

/**
 * Parse minScore into a SQL WHERE fragment.
 * "" (none), "unmatched" (no match row), "0" (scored, no match), "1" (any
 * match), "1-49" (range), "50"/"60"/… (min threshold).
 */
export function buildScoreFilter(
  minScore: string,
): { filter: SQL; isActive: boolean; isUnmatched: boolean } {
  if (!minScore) {
    return { filter: sql`TRUE`, isActive: false, isUnmatched: false };
  }
  if (minScore === "unmatched") {
    return { filter: sql`TRUE`, isActive: true, isUnmatched: true };
  }
  if (minScore === "0") {
    return { filter: sql`jm.score = 0`, isActive: true, isUnmatched: false };
  }
  if (minScore.includes("-")) {
    const [min, max] = minScore.split("-").map(Number);
    return {
      filter: sql`jm.score BETWEEN ${min} AND ${max}`,
      isActive: true,
      isUnmatched: false,
    };
  }
  const val = parseInt(minScore);
  if (val > 0) {
    return {
      filter: sql`jm.score >= ${val}`,
      isActive: true,
      isUnmatched: false,
    };
  }
  return { filter: sql`TRUE`, isActive: false, isUnmatched: false };
}

/** SQL WHERE fragments for the JSON array columns. Jobs aliased as `j`. */
export function buildJsonFilters(workLocation: string, jobType: string): SQL {
  const fragments: SQL[] = [];

  if (workLocation) {
    const values = workLocation.split(",").map((v) => v.trim()).filter(Boolean);
    if (values.length === 1) {
      fragments.push(sql`j.work_location::jsonb ? ${values[0]}`);
    } else if (values.length > 1) {
      fragments.push(sql`j.work_location::jsonb ?| array[${sqlJoin(values)}]`);
    }
  }

  if (jobType) {
    const values = jobType.split(",").map((v) => v.trim()).filter(Boolean);
    if (values.length === 1) {
      fragments.push(sql`j.job_types::jsonb ? ${values[0]}`);
    } else if (values.length > 1) {
      fragments.push(sql`j.job_types::jsonb ?| array[${sqlJoin(values)}]`);
    }
  }

  if (fragments.length === 0) return sql`TRUE`;
  return fragments.reduce((acc, f) => sql`${acc} AND ${f}`);
}

export async function listJobs(
  profileId: number,
  filters: JobListFilters,
  page: number,
  limit: number = JOB_LIST_PAGE_SIZE,
): Promise<JobListResult> {
  const offset = (page - 1) * limit;
  const topSort = filters.sort === "top";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let jobs: any[] = [];
  let totalCount = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let matchesByJobId: Record<number, any> = {};
  let savedJobIds: number[] = [];
  let rejectedJobIds: number[] = [];

  const jsonFilter = buildJsonFilters(filters.workLocation, filters.jobType);

  let searchFilter = sql`TRUE`;
  if (filters.search) {
    const searchPattern = `%${filters.search}%`;
    searchFilter = sql`(
      j.title ILIKE ${searchPattern}
      OR j.company ILIKE ${searchPattern}
      OR j.office_location ILIKE ${searchPattern}
      OR j.job_description ILIKE ${searchPattern}
    )`;
  }

  let platformFilter = sql`TRUE`;
  if (filters.platform) {
    const platformIds = filters.platform.split(",").map((id) =>
      parseInt(id.trim())
    ).filter((id) => !isNaN(id));
    if (platformIds.length === 1) {
      platformFilter = sql`j.job_platform_id = ${platformIds[0]}`;
    } else if (platformIds.length > 1) {
      platformFilter = sql`j.job_platform_id IN (${sqlJoin(platformIds)})`;
    }
  }

  let dateFilter = sql`TRUE`;
  if (filters.datePosted) {
    const days = parseInt(filters.datePosted);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    dateFilter = sql`j.date_posted >= ${cutoffDate}`;
  }

  let importedByFilter = sql`TRUE`;
  if (filters.importedBy) {
    const values = filters.importedBy.split(",").map((v) => v.trim()).filter(
      Boolean,
    );
    const hasMe = values.includes("me");
    const hasOthers = values.includes("others");
    if (hasMe && !hasOthers) {
      importedByFilter =
        sql`EXISTS (SELECT 1 FROM job_importers ji WHERE ji.job_id = j.id AND ji.profile_id = ${profileId})`;
    } else if (hasOthers && !hasMe) {
      importedByFilter =
        sql`EXISTS (SELECT 1 FROM job_importers ji WHERE ji.job_id = j.id AND ji.profile_id != ${profileId})`;
    }
  }

  const statusValues = filters.status
    ? filters.status.split(",").map((v) => v.trim()).filter(Boolean)
    : [];
  const { filter: scoreFilter, isActive: hasScoreFilter, isUnmatched } =
    buildScoreFilter(filters.minScore);

  if (isUnmatched) {
    // "Not yet matched" — jobs with no job_matches row for this profile.
    const matchConfig = await db.query.match_config.findFirst({
      where: eq(match_config.profile_id, profileId),
      columns: { match_community_jobs: true },
    });
    const { from, where } = buildVisibilityScope(
      profileId,
      matchConfig?.match_community_jobs ?? false,
    );

    const jobRows = await queryRaw<{ id: number; cnt: bigint }>(sql`
      SELECT j.id, COUNT(*) OVER() as cnt
      ${from}
      LEFT JOIN job_matches jm ON j.id = jm.job_id AND jm.profile_id = ${profileId}
      ${where}
      AND jm.id IS NULL
      AND ${searchFilter}
      AND ${platformFilter}
      AND ${dateFilter}
      AND ${jsonFilter}
      AND ${importedByFilter}
      ORDER BY ${DATE_ORDER}
      LIMIT ${limit}
      OFFSET ${offset}
    `);

    totalCount = jobRows.length > 0 ? Number(jobRows[0].cnt) : 0;
    const jobIds = jobRows.map((r) => r.id);

    if (jobIds.length > 0) {
      const fullJobs = await db.query.jobs.findMany({
        where: inArray(jobsTable.id, jobIds),
        with: {
          job_platform: { columns: { id: true, name: true, url: true } },
        },
      });
      const jobById = new Map(fullJobs.map((j) => [j.id, j]));
      jobs = jobIds.map((id) => jobById.get(id)).filter(
        Boolean,
      ) as typeof fullJobs;
    }
  } else if (hasScoreFilter || statusValues.length > 0 || topSort) {
    // Query via job_matches (+ job_statuses) when filtering by score/status or
    // ranking by top matches.
    let statusFilter = sql`TRUE`;
    let statusJoin =
      sql`LEFT JOIN job_statuses js ON js.profile_id = jm.profile_id AND js.job_id = jm.job_id`;

    if (statusValues.length > 0) {
      statusJoin =
        sql`JOIN job_statuses js ON js.profile_id = jm.profile_id AND js.job_id = jm.job_id`;
      statusFilter = statusValues.length === 1
        ? sql`js.status = ${statusValues[0]}`
        : sql`js.status IN (${sqlJoin(statusValues)})`;
    } else if (filters.minScore !== "0") {
      // Score-only / top-sort views exclude rejected jobs.
      statusFilter = sql`COALESCE(js.status, 'new') != 'rejected'`;
    }

    const orderBy = topSort ? TOP_ORDER : DATE_ORDER;

    const matchRows = await queryRaw<{ id: number; cnt: bigint }>(sql`
      SELECT jm.id, COUNT(*) OVER() as cnt
      FROM job_matches jm
      JOIN jobs j ON j.id = jm.job_id
      ${statusJoin}
      WHERE jm.profile_id = ${profileId}
      AND ${statusFilter}
      AND ${scoreFilter}
      AND ${searchFilter}
      AND ${platformFilter}
      AND ${dateFilter}
      AND ${jsonFilter}
      AND ${importedByFilter}
      ORDER BY ${orderBy}
      LIMIT ${limit}
      OFFSET ${offset}
    `);

    totalCount = matchRows.length > 0 ? Number(matchRows[0].cnt) : 0;
    const matchIds = matchRows.map((r) => r.id);

    if (matchIds.length > 0) {
      const fullMatches = await db.query.job_matches.findMany({
        where: inArray(job_matches.id, matchIds),
        with: {
          job: {
            with: {
              job_platform: { columns: { id: true, name: true, url: true } },
            },
          },
        },
      });

      const matchById = new Map(fullMatches.map((m) => [m.id, m]));
      const orderedMatches = matchIds
        .map((id) => matchById.get(id))
        .filter(Boolean) as typeof fullMatches;

      const matchJobIds = orderedMatches.map((m) => m.job_id);

      const jobStatusRows = await db.query.job_statuses.findMany({
        where: and(
          eq(job_statuses.profile_id, profileId),
          inArray(job_statuses.job_id, matchJobIds),
        ),
        columns: { job_id: true, status: true },
      });
      const statusByJobId = Object.fromEntries(
        jobStatusRows.map((s) => [s.job_id, s.status]),
      );

      jobs = orderedMatches.map((m) => m.job);
      matchesByJobId = Object.fromEntries(
        orderedMatches.map((m) => [m.job_id, {
          id: m.id,
          job: m.job_id,
          score: m.score,
          skill_match_percentage: m.skill_match_percentage,
          matched_skills: m.matched_skills,
          match_summary: m.match_summary,
          recommendation: m.recommendation,
        }]),
      );
      savedJobIds = matchJobIds.filter((id) => statusByJobId[id] === "saved");
      rejectedJobIds = matchJobIds.filter((id) =>
        statusByJobId[id] === "rejected"
      );
    }
  } else {
    // "all" — query the jobs table directly.
    const jobRows = await queryRaw<{ id: number; cnt: bigint }>(sql`
      SELECT j.id, COUNT(*) OVER() as cnt
      FROM jobs j
      WHERE ${searchFilter}
      AND ${platformFilter}
      AND ${dateFilter}
      AND ${jsonFilter}
      AND ${importedByFilter}
      ORDER BY ${DATE_ORDER}
      LIMIT ${limit}
      OFFSET ${offset}
    `);

    totalCount = jobRows.length > 0 ? Number(jobRows[0].cnt) : 0;
    const jobIds = jobRows.map((r) => r.id);

    if (jobIds.length > 0) {
      const fullJobs = await db.query.jobs.findMany({
        where: inArray(jobsTable.id, jobIds),
        with: {
          job_platform: { columns: { id: true, name: true, url: true } },
        },
      });
      const jobById = new Map(fullJobs.map((j) => [j.id, j]));
      jobs = jobIds.map((id) => jobById.get(id)).filter(
        Boolean,
      ) as typeof fullJobs;

      const jobMatchRows = await db.query.job_matches.findMany({
        where: and(
          eq(job_matches.profile_id, profileId),
          inArray(job_matches.job_id, jobIds),
        ),
        columns: {
          id: true,
          job_id: true,
          score: true,
          skill_match_percentage: true,
          matched_skills: true,
          match_summary: true,
          recommendation: true,
        },
      });

      const jobStatusRows = await db.query.job_statuses.findMany({
        where: and(
          eq(job_statuses.profile_id, profileId),
          inArray(job_statuses.job_id, jobIds),
        ),
        columns: { job_id: true, status: true },
      });
      const statusByJobId = Object.fromEntries(
        jobStatusRows.map((s) => [s.job_id, s.status]),
      );

      matchesByJobId = Object.fromEntries(
        jobMatchRows.map((m) => [m.job_id, m]),
      );
      savedJobIds = jobIds.filter((id) => statusByJobId[id] === "saved");
      rejectedJobIds = jobIds.filter((id) => statusByJobId[id] === "rejected");
    }
  }

  return { jobs, matchesByJobId, savedJobIds, rejectedJobIds, totalCount };
}
