import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { Prisma } from "../../../../generated/prisma/client";
import { dbDirect as db } from "$lib/server/db";
import { getProfileSkillLevels } from "$lib/server/job/match-utils";
import { getSelectedProfileId } from "../profile/utils";
import {
  saveJob,
  unsaveJob,
  rejectJob,
  unrejectJob,
} from "$lib/server/job/job-actions";

/**
 * Build SQL WHERE fragments for JSON array column filters.
 * Uses PostgreSQL's ?| operator (cast to jsonb) for multi-value OR matching.
 * Assumes jobs table is aliased as `j`.
 */
function buildJsonFilters(workLocation: string, jobType: string): Prisma.Sql {
  const fragments: Prisma.Sql[] = [];

  if (workLocation) {
    const values = workLocation.split(",").map((v) => v.trim()).filter(Boolean);
    if (values.length === 1) {
      fragments.push(Prisma.sql`j.work_location::jsonb ? ${values[0]}`);
    } else if (values.length > 1) {
      // ?| checks if ANY of the values exist in the array
      fragments.push(Prisma.sql`j.work_location::jsonb ?| array[${Prisma.join(values)}]`);
    }
  }

  if (jobType) {
    const values = jobType.split(",").map((v) => v.trim()).filter(Boolean);
    if (values.length === 1) {
      fragments.push(Prisma.sql`j.job_types::jsonb ? ${values[0]}`);
    } else if (values.length > 1) {
      fragments.push(Prisma.sql`j.job_types::jsonb ?| array[${Prisma.join(values)}]`);
    }
  }

  if (fragments.length === 0) {
    return Prisma.sql`TRUE`;
  }

  return fragments.reduce((acc, f) => Prisma.sql`${acc} AND ${f}`);
}

export const load: PageServerLoad = async ({ parent, url }) => {
  const layoutData = await parent();

  if (!layoutData.selectedProfile) {
    redirect(302, "/dashboard");
  }

  const profileId = layoutData.selectedProfile.id;

  // Parse query parameters
  const status = url.searchParams.get("status") || ""; // comma-separated: "saved", "rejected"
  const search = url.searchParams.get("q") || "";
  const platform = url.searchParams.get("platform") || ""; // comma-separated IDs for multi-select
  const workLocation = url.searchParams.get("workLocation") || ""; // remote, hybrid, onsite
  const jobType = url.searchParams.get("jobType") || ""; // full_time, contract, part_time, freelance
  const minScore = url.searchParams.get("minScore") || ""; // 40, 50, 60, 70, 80, 90
  const datePosted = url.searchParams.get("datePosted") || ""; // 1, 3, 7, 30, 90 (days)
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = 20;
  const offset = (page - 1) * limit;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let jobs: any[] = [];
  let totalCount = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let matchesByJobId: Record<number, any> = {};
  let savedJobIds: number[] = [];

  // Build filter SQL fragments shared by both branches (all reference jobs as `j`)
  const jsonFilter = buildJsonFilters(workLocation, jobType);

  let searchFilter = Prisma.sql`TRUE`;
  if (search) {
    const searchPattern = `%${search}%`;
    searchFilter = Prisma.sql`(
      j.title ILIKE ${searchPattern}
      OR j.company ILIKE ${searchPattern}
      OR j.office_location ILIKE ${searchPattern}
      OR j.job_description ILIKE ${searchPattern}
    )`;
  }

  let platformFilter = Prisma.sql`TRUE`;
  if (platform) {
    const platformIds = platform.split(",").map((id) => parseInt(id.trim())).filter((id) => !isNaN(id));
    if (platformIds.length === 1) {
      platformFilter = Prisma.sql`j.job_platform = ${platformIds[0]}`;
    } else if (platformIds.length > 1) {
      platformFilter = Prisma.sql`j.job_platform IN (${Prisma.join(platformIds)})`;
    }
  }

  let dateFilter = Prisma.sql`TRUE`;
  if (datePosted) {
    const days = parseInt(datePosted);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    dateFilter = Prisma.sql`j.date_posted >= ${cutoffDate}`;
  }

  // Parse status filter values
  const statusValues = status ? status.split(",").map((v) => v.trim()).filter(Boolean) : [];
  const minScoreVal = minScore ? parseInt(minScore) : 0;

  if (minScoreVal > 0 || statusValues.length > 0) {
    // Query via job_matches table when filtering by score or status
    let statusFilter = Prisma.sql`TRUE`;
    let scoreFilter = Prisma.sql`TRUE`;

    if (statusValues.length > 0) {
      if (statusValues.length === 1) {
        statusFilter = Prisma.sql`jm.status = ${statusValues[0]}`;
      } else {
        statusFilter = Prisma.sql`jm.status IN (${Prisma.join(statusValues)})`;
      }
    } else {
      // When filtering by score only, exclude rejected
      statusFilter = Prisma.sql`jm.status != 'rejected'`;
    }

    if (minScoreVal > 0) {
      scoreFilter = Prisma.sql`jm.score >= ${minScoreVal}`;
    }

    // Get filtered+paginated match IDs and count in one query
    const matchRows = await db.$queryRaw<{ id: number; cnt: bigint }[]>`
      SELECT jm.id, COUNT(*) OVER() as cnt
      FROM job_matches jm
      JOIN jobs j ON j.id = jm.job
      WHERE jm.profile = ${profileId}
      AND ${statusFilter}
      AND ${scoreFilter}
      AND ${searchFilter}
      AND ${platformFilter}
      AND ${dateFilter}
      AND ${jsonFilter}
      ORDER BY j.date_posted DESC NULLS LAST, j.date_created DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    totalCount = matchRows.length > 0 ? Number(matchRows[0].cnt) : 0;
    const matchIds = matchRows.map((r) => r.id);

    if (matchIds.length > 0) {
      // Load full match data with relations using Prisma
      const fullMatches = await db.job_matches.findMany({
        where: { id: { in: matchIds } },
        include: {
          jobs: {
            include: {
              job_platforms: {
                select: { id: true, name: true },
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

      jobs = orderedMatches.map((m) => m.jobs);
      matchesByJobId = Object.fromEntries(
        orderedMatches.map((m) => [
          m.job,
          {
            id: m.id,
            job: m.job,
            score: m.score,
            skill_match_percentage: m.skill_match_percentage,
            matched_skills: m.matched_skills,
            match_summary: m.match_summary,
            reasoning: m.reasoning,
            status: m.status,
          },
        ])
      );
      savedJobIds = orderedMatches
        .filter((m) => m.status === "saved")
        .map((m) => m.job);
    }
  } else {
    // "all" - Query from jobs table directly

    // Get filtered+paginated job IDs and count
    const jobRows = await db.$queryRaw<{ id: number; cnt: bigint }[]>`
      SELECT j.id, COUNT(*) OVER() as cnt
      FROM jobs j
      WHERE ${searchFilter}
      AND ${platformFilter}
      AND ${dateFilter}
      AND ${jsonFilter}
      ORDER BY j.date_posted DESC NULLS LAST, j.date_created DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    totalCount = jobRows.length > 0 ? Number(jobRows[0].cnt) : 0;
    const jobIds = jobRows.map((r) => r.id);

    if (jobIds.length > 0) {
      // Load full job data with relations using Prisma
      const fullJobs = await db.jobs.findMany({
        where: { id: { in: jobIds } },
        include: {
          job_platforms: {
            select: { id: true, name: true },
          },
        },
      });

      // Preserve the SQL sort order
      const jobById = new Map(fullJobs.map((j) => [j.id, j]));
      jobs = jobIds
        .map((id) => jobById.get(id))
        .filter(Boolean) as typeof fullJobs;

      // Get matches for the displayed jobs
      const jobMatches = await db.job_matches.findMany({
        where: {
          profile: profileId,
          job: { in: jobIds },
        },
        select: {
          id: true,
          job: true,
          score: true,
          skill_match_percentage: true,
          matched_skills: true,
          match_summary: true,
          reasoning: true,
          status: true,
        },
      });

      matchesByJobId = Object.fromEntries(jobMatches.map((m) => [m.job, m]));
      savedJobIds = jobMatches
        .filter((m) => m.status === "saved")
        .map((m) => m.job);
    }
  }

  // Get all platforms for filter dropdown
  const platforms = await db.job_platforms.findMany({
    where: { status: "published" },
    select: {
      id: true,
      name: true,
    },
    orderBy: { name: "asc" },
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
};
