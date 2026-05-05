import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { type SQL, sql, eq, and, inArray, asc, desc } from "drizzle-orm";
import { dbDirect as db, queryRaw, sqlJoin } from "$lib/server/db";
import { match_config, jobs as jobsTable, job_matches, job_statuses, job_platforms } from "$lib/server/db/schema";
import { getProfileSkillLevels } from "$lib/server/job/match-utils";
import { buildVisibilityScope } from "$lib/server/job/match-counts";
import { getSelectedProfileId } from "../profile/utils";
import {
  saveJob,
  unsaveJob,
  rejectJob,
  unrejectJob,
} from "$lib/server/job/job-actions";

/**
 * Parse minScore filter value into a SQL WHERE fragment.
 * Supports: "" (no filter), "unmatched" (no job_matches row),
 * "0" (no match — score = 0), "1" (all matches — score > 0),
 * "1-49" (range), "50"/"60"/etc (min threshold).
 */
function buildScoreFilter(minScore: string): { filter: SQL; isActive: boolean; isUnmatched: boolean } {
  if (!minScore) return { filter: sql`TRUE`, isActive: false, isUnmatched: false };
  if (minScore === "unmatched") {
    return { filter: sql`TRUE`, isActive: true, isUnmatched: true };
  }
  if (minScore === "0") {
    return { filter: sql`jm.score = 0`, isActive: true, isUnmatched: false };
  }
  if (minScore.includes("-")) {
    const [min, max] = minScore.split("-").map(Number);
    return { filter: sql`jm.score BETWEEN ${min} AND ${max}`, isActive: true, isUnmatched: false };
  }
  const val = parseInt(minScore);
  if (val > 0) {
    return { filter: sql`jm.score >= ${val}`, isActive: true, isUnmatched: false };
  }
  return { filter: sql`TRUE`, isActive: false, isUnmatched: false };
}

/**
 * Build SQL WHERE fragments for JSON array column filters.
 * Uses PostgreSQL's ?| operator (cast to jsonb) for multi-value OR matching.
 * Assumes jobs table is aliased as `j`.
 */
function buildJsonFilters(workLocation: string, jobType: string): SQL {
  const fragments: SQL[] = [];

  if (workLocation) {
    const values = workLocation.split(",").map((v) => v.trim()).filter(Boolean);
    if (values.length === 1) {
      fragments.push(sql`j.work_location::jsonb ? ${values[0]}`);
    } else if (values.length > 1) {
      // ?| checks if ANY of the values exist in the array
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

  if (fragments.length === 0) {
    return sql`TRUE`;
  }

  return fragments.reduce((acc, f) => sql`${acc} AND ${f}`);
}

export const load: PageServerLoad = async ({ parent, url }) => {
  const layoutData = await parent();

  if (!layoutData.selectedProfile) {
    redirect(302, "/home");
  }

  const profileId = layoutData.selectedProfile.id;

  // Parse query parameters
  const status = url.searchParams.get("status") || ""; // comma-separated: "saved", "rejected"
  const search = url.searchParams.get("q") || "";
  const platform = url.searchParams.get("platform") || ""; // comma-separated IDs for multi-select
  const workLocation = url.searchParams.get("workLocation") || ""; // remote, hybrid, onsite
  const jobType = url.searchParams.get("jobType") || ""; // full_time, contract, part_time, freelance
  const minScore = url.searchParams.get("minScore") || ""; // 50, 60, 70, 80, 90, 1-49, 0, unmatched
  const datePosted = url.searchParams.get("datePosted") || ""; // 1, 3, 7, 30, 90 (days)
  const importedBy = url.searchParams.get("importedBy") || ""; // comma-separated: "me", "others"
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = 20;
  const offset = (page - 1) * limit;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let jobs: any[] = [];
  let totalCount = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let matchesByJobId: Record<number, any> = {};
  let savedJobIds: number[] = [];
  let rejectedJobIds: number[] = [];

  // Build filter SQL fragments shared by both branches (all reference jobs as `j`)
  const jsonFilter = buildJsonFilters(workLocation, jobType);

  let searchFilter = sql`TRUE`;
  if (search) {
    const searchPattern = `%${search}%`;
    searchFilter = sql`(
      j.title ILIKE ${searchPattern}
      OR j.company ILIKE ${searchPattern}
      OR j.office_location ILIKE ${searchPattern}
      OR j.job_description ILIKE ${searchPattern}
    )`;
  }

  let platformFilter = sql`TRUE`;
  if (platform) {
    const platformIds = platform.split(",").map((id) => parseInt(id.trim())).filter((id) => !isNaN(id));
    if (platformIds.length === 1) {
      platformFilter = sql`j.job_platform_id = ${platformIds[0]}`;
    } else if (platformIds.length > 1) {
      platformFilter = sql`j.job_platform_id IN (${sqlJoin(platformIds)})`;
    }
  }

  let dateFilter = sql`TRUE`;
  if (datePosted) {
    const days = parseInt(datePosted);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    dateFilter = sql`j.date_posted >= ${cutoffDate}`;
  }

  let importedByFilter = sql`TRUE`;
  if (importedBy) {
    const values = importedBy.split(",").map((v) => v.trim()).filter(Boolean);
    const hasMe = values.includes("me");
    const hasOthers = values.includes("others");
    if (hasMe && !hasOthers) {
      importedByFilter = sql`EXISTS (SELECT 1 FROM job_importers ji WHERE ji.job = j.id AND ji.profile = ${profileId})`;
    } else if (hasOthers && !hasMe) {
      importedByFilter = sql`EXISTS (SELECT 1 FROM job_importers ji WHERE ji.job = j.id AND ji.profile != ${profileId})`;
    }
  }

  // Parse status filter values
  const statusValues = status ? status.split(",").map((v) => v.trim()).filter(Boolean) : [];
  const { filter: scoreFilter, isActive: hasScoreFilter, isUnmatched } = buildScoreFilter(minScore);

  if (isUnmatched) {
    // "Not yet matched" — jobs with no job_matches row for this profile
    // Uses same visibility scope as the matcher (respects match_community_jobs)
    const matchConfig = await db.query.match_config.findFirst({
      where: eq(match_config.profile_id, profileId),
      columns: { match_community_jobs: true },
    });
    const { from, where } = buildVisibilityScope(profileId, matchConfig?.match_community_jobs ?? false);

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
      ORDER BY j.date_posted DESC NULLS LAST, j.date_created DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `);

    totalCount = jobRows.length > 0 ? Number(jobRows[0].cnt) : 0;
    const jobIds = jobRows.map((r) => r.id);

    if (jobIds.length > 0) {
      const fullJobs = await db.query.jobs.findMany({
        where: inArray(jobsTable.id, jobIds),
        with: {
          job_platform: {
            columns: { id: true, name: true, url: true },
          },
        },
      });

      const jobById = new Map(fullJobs.map((j) => [j.id, j]));
      jobs = jobIds
        .map((id) => jobById.get(id))
        .filter(Boolean) as typeof fullJobs;
      // No matches exist for these jobs by definition
    }
  } else if (hasScoreFilter || statusValues.length > 0) {
    // Query via job_matches + job_statuses tables when filtering by score or status
    let statusFilter = sql`TRUE`;
    let statusJoin = sql`LEFT JOIN job_statuses js ON js.profile = jm.profile_id AND js.job = jm.job_id`;

    if (statusValues.length > 0) {
      // When filtering by specific statuses, use INNER JOIN to require a status row
      statusJoin = sql`JOIN job_statuses js ON js.profile = jm.profile_id AND js.job = jm.job_id`;
      if (statusValues.length === 1) {
        statusFilter = sql`js.status = ${statusValues[0]}`;
      } else {
        statusFilter = sql`js.status IN (${sqlJoin(statusValues)})`;
      }
    } else if (minScore !== "0") {
      // When filtering by score only (not "no match"), exclude rejected
      statusFilter = sql`COALESCE(js.status, 'new') != 'rejected'`;
    }

    // Get filtered+paginated match IDs and count in one query
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
      ORDER BY j.date_posted DESC NULLS LAST, j.date_created DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `);

    totalCount = matchRows.length > 0 ? Number(matchRows[0].cnt) : 0;
    const matchIds = matchRows.map((r) => r.id);

    if (matchIds.length > 0) {
      // Load full match data with relations
      const fullMatches = await db.query.job_matches.findMany({
        where: inArray(job_matches.id, matchIds),
        with: {
          job: {
            with: {
              job_platform: {
                columns: { id: true, name: true, url: true },
              },
            },
          },
        },
      });

      // Preserve the SQL sort order
      const matchById = new Map(fullMatches.map((m) => [m.id, m]));
      const orderedMatches = matchIds
        .map((id) => matchById.get(id))
        .filter(Boolean) as typeof fullMatches;

      const matchJobIds = orderedMatches.map((m) => m.job_id);

      // Load user statuses from job_statuses table
      const jobStatusRows = await db.query.job_statuses.findMany({
        where: and(eq(job_statuses.profile, profileId), inArray(job_statuses.job, matchJobIds)),
        columns: { job: true, status: true },
      });
      const statusByJobId = Object.fromEntries(jobStatusRows.map((s) => [s.job, s.status]));

      jobs = orderedMatches.map((m) => m.job);
      matchesByJobId = Object.fromEntries(
        orderedMatches.map((m) => [
          m.job_id,
          {
            id: m.id,
            job: m.job_id,
            score: m.score,
            skill_match_percentage: m.skill_match_percentage,
            matched_skills: m.matched_skills,
            match_summary: m.match_summary,
            recommendation: m.recommendation,
          },
        ])
      );
      savedJobIds = matchJobIds.filter((id) => statusByJobId[id] === "saved");
      rejectedJobIds = matchJobIds.filter((id) => statusByJobId[id] === "rejected");
    }
  } else {
    // "all" - Query from jobs table directly

    // Get filtered+paginated job IDs and count
    const jobRows = await queryRaw<{ id: number; cnt: bigint }>(sql`
      SELECT j.id, COUNT(*) OVER() as cnt
      FROM jobs j
      WHERE ${searchFilter}
      AND ${platformFilter}
      AND ${dateFilter}
      AND ${jsonFilter}
      AND ${importedByFilter}
      ORDER BY j.date_posted DESC NULLS LAST, j.date_created DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `);

    totalCount = jobRows.length > 0 ? Number(jobRows[0].cnt) : 0;
    const jobIds = jobRows.map((r) => r.id);

    if (jobIds.length > 0) {
      // Load full job data with relations
      const fullJobs = await db.query.jobs.findMany({
        where: inArray(jobsTable.id, jobIds),
        with: {
          job_platform: {
            columns: { id: true, name: true, url: true },
          },
        },
      });

      // Preserve the SQL sort order
      const jobById = new Map(fullJobs.map((j) => [j.id, j]));
      jobs = jobIds
        .map((id) => jobById.get(id))
        .filter(Boolean) as typeof fullJobs;

      // Get matches for the displayed jobs
      const jobMatchRows = await db.query.job_matches.findMany({
        where: and(eq(job_matches.profile_id, profileId), inArray(job_matches.job_id, jobIds)),
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

      // Load user statuses from job_statuses table
      const jobStatusRows = await db.query.job_statuses.findMany({
        where: and(eq(job_statuses.profile, profileId), inArray(job_statuses.job, jobIds)),
        columns: { job: true, status: true },
      });
      const statusByJobId = Object.fromEntries(jobStatusRows.map((s) => [s.job, s.status]));

      matchesByJobId = Object.fromEntries(jobMatchRows.map((m) => [m.job_id, m]));
      savedJobIds = jobIds.filter((id) => statusByJobId[id] === "saved");
      rejectedJobIds = jobIds.filter((id) => statusByJobId[id] === "rejected");
    }
  }

  // Get all platforms for filter dropdown
  const platforms = await db.query.job_platforms.findMany({
    where: eq(job_platforms.status, "published"),
    columns: {
      id: true,
      name: true,
    },
    orderBy: asc(job_platforms.name),
  });

  const totalPages = Math.ceil(totalCount / limit);

  // Load user's skill proficiency levels for highlighting
  const profileSkillLevels = await getProfileSkillLevels(profileId);

  return {
    jobs,
    platforms,
    totalCount,
    currentPage: page,
    totalPages,
    savedJobIds,
    rejectedJobIds,
    matchesByJobId,
    profileSkillLevels,
    filters: {
      status,
      search,
      platform,
      workLocation,
      jobType,
      minScore,
      datePosted,
      importedBy,
    },
  };
};

function parseJobId(formData: FormData) {
  const jobId = parseInt(formData.get("jobId") as string);
  if (isNaN(jobId)) return null;
  return jobId;
}

async function getAuthProfileId(
  locals: App.Locals,
  cookies: import("@sveltejs/kit").Cookies,
) {
  const user = locals.user;
  if (!user) return null;
  return getSelectedProfileId(cookies, user.id);
}

async function countMatchingJobs(
  profileId: number,
  url: URL,
): Promise<number> {
  const search = url.searchParams.get("q") || "";
  const platform = url.searchParams.get("platform") || "";
  const workLocation = url.searchParams.get("workLocation") || "";
  const jobType = url.searchParams.get("jobType") || "";
  const minScore = url.searchParams.get("minScore") || "";
  const datePosted = url.searchParams.get("datePosted") || "";
  const importedBy = url.searchParams.get("importedBy") || "";
  const status = url.searchParams.get("status") || "";

  const jsonFilter = buildJsonFilters(workLocation, jobType);

  let searchFilter = sql`TRUE`;
  if (search) {
    const searchPattern = `%${search}%`;
    searchFilter = sql`(
      j.title ILIKE ${searchPattern}
      OR j.company ILIKE ${searchPattern}
      OR j.office_location ILIKE ${searchPattern}
      OR j.job_description ILIKE ${searchPattern}
    )`;
  }

  let platformFilter = sql`TRUE`;
  if (platform) {
    const platformIds = platform.split(",").map((id) => parseInt(id.trim())).filter((id) => !isNaN(id));
    if (platformIds.length === 1) {
      platformFilter = sql`j.job_platform_id = ${platformIds[0]}`;
    } else if (platformIds.length > 1) {
      platformFilter = sql`j.job_platform_id IN (${sqlJoin(platformIds)})`;
    }
  }

  let dateFilter = sql`TRUE`;
  if (datePosted) {
    const days = parseInt(datePosted);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    dateFilter = sql`j.date_posted >= ${cutoffDate}`;
  }

  let importedByFilter = sql`TRUE`;
  if (importedBy) {
    const values = importedBy.split(",").map((v) => v.trim()).filter(Boolean);
    const hasMe = values.includes("me");
    const hasOthers = values.includes("others");
    if (hasMe && !hasOthers) {
      importedByFilter = sql`EXISTS (SELECT 1 FROM job_importers ji WHERE ji.job = j.id AND ji.profile = ${profileId})`;
    } else if (hasOthers && !hasMe) {
      importedByFilter = sql`EXISTS (SELECT 1 FROM job_importers ji WHERE ji.job = j.id AND ji.profile != ${profileId})`;
    }
  }

  const statusValues = status ? status.split(",").map((v) => v.trim()).filter(Boolean) : [];
  const { filter: scoreFilter } = buildScoreFilter(minScore);

  let statusFilter = sql`TRUE`;
  let statusJoin = sql``;

  if (statusValues.length > 0) {
    statusJoin = sql`JOIN job_statuses js ON js.profile = jm.profile_id AND js.job = jm.job_id`;
    if (statusValues.length === 1) {
      statusFilter = sql`js.status = ${statusValues[0]}`;
    } else {
      statusFilter = sql`js.status IN (${sqlJoin(statusValues)})`;
    }
  }

  const result = await queryRaw<{ cnt: bigint }>(sql`
    SELECT COUNT(*) as cnt
    FROM job_matches jm
    JOIN jobs j ON j.id = jm.job_id
    ${statusJoin}
    WHERE jm.profile_id = ${profileId}
    AND jm.recommendation IS NOT NULL
    AND ${statusFilter}
    AND ${scoreFilter}
    AND ${searchFilter}
    AND ${platformFilter}
    AND ${dateFilter}
    AND ${jsonFilter}
    AND ${importedByFilter}
  `);

  return Number(result[0]?.cnt ?? 0);
}

export const actions: Actions = {
  saveJob: async ({ request, locals, cookies }) => {
    const profileId = await getAuthProfileId(locals, cookies);
    if (!profileId) return fail(401, { error: "Not authenticated" });
    const jobId = parseJobId(await request.formData());
    if (!jobId) return fail(400, { error: "Invalid job ID" });
    return saveJob(profileId, jobId);
  },

  unsaveJob: async ({ request, locals, cookies }) => {
    const profileId = await getAuthProfileId(locals, cookies);
    if (!profileId) return fail(401, { error: "Not authenticated" });
    const jobId = parseJobId(await request.formData());
    if (!jobId) return fail(400, { error: "Invalid job ID" });
    return unsaveJob(profileId, jobId);
  },

  rejectJob: async ({ request, locals, cookies }) => {
    const profileId = await getAuthProfileId(locals, cookies);
    if (!profileId) return fail(401, { error: "Not authenticated" });
    const jobId = parseJobId(await request.formData());
    if (!jobId) return fail(400, { error: "Invalid job ID" });
    return rejectJob(profileId, jobId);
  },

  unrejectJob: async ({ request, locals, cookies }) => {
    const profileId = await getAuthProfileId(locals, cookies);
    if (!profileId) return fail(401, { error: "Not authenticated" });
    const jobId = parseJobId(await request.formData());
    if (!jobId) return fail(400, { error: "Invalid job ID" });
    return unrejectJob(profileId, jobId);
  },

  clearMatchData: async ({ locals, cookies, url }) => {
    if (!locals.user?.is_staff) {
      return fail(403, { error: "Staff access required" });
    }

    const profileId = await getAuthProfileId(locals, cookies);
    if (!profileId) return fail(401, { error: "Not authenticated" });

    const count = await countMatchingJobs(profileId, url);

    if (count === 0) {
      return fail(400, { error: "No matched jobs found for current filters" });
    }

    // Delete match rows so jobs get re-scored from scratch
    const search = url.searchParams.get("q") || "";
    const platform = url.searchParams.get("platform") || "";
    const workLocation = url.searchParams.get("workLocation") || "";
    const jobType = url.searchParams.get("jobType") || "";
    const minScore = url.searchParams.get("minScore") || "";
    const datePosted = url.searchParams.get("datePosted") || "";
    const importedBy = url.searchParams.get("importedBy") || "";
    const status = url.searchParams.get("status") || "";

    const jsonFilter = buildJsonFilters(workLocation, jobType);

    let searchFilter = sql`TRUE`;
    if (search) {
      const searchPattern = `%${search}%`;
      searchFilter = sql`(
        j.title ILIKE ${searchPattern}
        OR j.company ILIKE ${searchPattern}
        OR j.office_location ILIKE ${searchPattern}
        OR j.job_description ILIKE ${searchPattern}
      )`;
    }

    let platformFilter = sql`TRUE`;
    if (platform) {
      const platformIds = platform.split(",").map((id) => parseInt(id.trim())).filter((id) => !isNaN(id));
      if (platformIds.length === 1) {
        platformFilter = sql`j.job_platform_id = ${platformIds[0]}`;
      } else if (platformIds.length > 1) {
        platformFilter = sql`j.job_platform_id IN (${sqlJoin(platformIds)})`;
      }
    }

    let dateFilter = sql`TRUE`;
    if (datePosted) {
      const days = parseInt(datePosted);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      dateFilter = sql`j.date_posted >= ${cutoffDate}`;
    }

    let importedByFilter = sql`TRUE`;
    if (importedBy) {
      const values = importedBy.split(",").map((v) => v.trim()).filter(Boolean);
      const hasMe = values.includes("me");
      const hasOthers = values.includes("others");
      if (hasMe && !hasOthers) {
        importedByFilter = sql`EXISTS (SELECT 1 FROM job_importers ji WHERE ji.job = j.id AND ji.profile = ${profileId})`;
      } else if (hasOthers && !hasMe) {
        importedByFilter = sql`EXISTS (SELECT 1 FROM job_importers ji WHERE ji.job = j.id AND ji.profile != ${profileId})`;
      }
    }

    const statusValues = status ? status.split(",").map((v) => v.trim()).filter(Boolean) : [];
    const { filter: scoreFilter } = buildScoreFilter(minScore);

    let statusFilter = sql`TRUE`;
    let statusJoin = sql``;

    if (statusValues.length > 0) {
      statusJoin = sql`JOIN job_statuses js ON js.profile = jm.profile_id AND js.job = jm.job_id`;
      if (statusValues.length === 1) {
        statusFilter = sql`js.status = ${statusValues[0]}`;
      } else {
        statusFilter = sql`js.status IN (${sqlJoin(statusValues)})`;
      }
    }

    await queryRaw(sql`
      DELETE FROM job_matches jm
      USING jobs j ${statusJoin}
      WHERE j.id = jm.job_id
      AND jm.profile_id = ${profileId}
      AND jm.recommendation IS NOT NULL
      AND ${statusFilter}
      AND ${scoreFilter}
      AND ${searchFilter}
      AND ${platformFilter}
      AND ${dateFilter}
      AND ${jsonFilter}
      AND ${importedByFilter}
    `);

    return { success: true, action: "clearMatchData", clearedCount: count };
  },
};
