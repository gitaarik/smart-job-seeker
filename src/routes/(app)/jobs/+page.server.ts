import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { asc, eq, sql } from "drizzle-orm";
import { dbDirect as db, queryRaw, sqlJoin } from "$lib/server/db";
import { job_platforms } from "$lib/server/db/schema";
import { getProfileSkillLevels } from "$lib/server/job/match-utils";
import { getSelectedProfileId } from "../profile/utils";
import {
  rejectJob,
  saveJob,
  unrejectJob,
  unsaveJob,
} from "$lib/server/job/job-actions";
import {
  buildJsonFilters,
  buildScoreFilter,
  JOB_LIST_PAGE_SIZE,
  listJobs,
  parseJobListFilters,
} from "$lib/server/job/list-jobs";

export const load: PageServerLoad = async ({ parent, url }) => {
  const layoutData = await parent();

  if (!layoutData.selectedProfile) {
    redirect(302, "/home");
  }

  const profileId = layoutData.selectedProfile.id;

  const filters = parseJobListFilters(url);
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = JOB_LIST_PAGE_SIZE;

  const { jobs, matchesByJobId, savedJobIds, rejectedJobIds, totalCount } =
    await listJobs(profileId, filters, page, limit);

  // Get all platforms for filter dropdown
  const platforms = await db.query.job_platforms.findMany({
    where: eq(job_platforms.status, "published"),
    columns: { id: true, name: true },
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
      status: filters.status,
      search: filters.search,
      platform: filters.platform,
      workLocation: filters.workLocation,
      jobType: filters.jobType,
      minScore: filters.minScore,
      datePosted: filters.datePosted,
      importedBy: filters.importedBy,
      sort: filters.sort,
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
    const platformIds = platform.split(",").map((id) => parseInt(id.trim()))
      .filter((id) => !isNaN(id));
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
      importedByFilter =
        sql`EXISTS (SELECT 1 FROM job_importers ji WHERE ji.job_id = j.id AND ji.profile_id = ${profileId})`;
    } else if (hasOthers && !hasMe) {
      importedByFilter =
        sql`EXISTS (SELECT 1 FROM job_importers ji WHERE ji.job_id = j.id AND ji.profile_id != ${profileId})`;
    }
  }

  const statusValues = status
    ? status.split(",").map((v) => v.trim()).filter(Boolean)
    : [];
  const { filter: scoreFilter } = buildScoreFilter(minScore);

  let statusFilter = sql`TRUE`;
  let statusJoin = sql``;

  if (statusValues.length > 0) {
    statusJoin =
      sql`JOIN job_statuses js ON js.profile_id = jm.profile_id AND js.job_id = jm.job_id`;
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
      const platformIds = platform.split(",").map((id) => parseInt(id.trim()))
        .filter((id) => !isNaN(id));
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
        importedByFilter =
          sql`EXISTS (SELECT 1 FROM job_importers ji WHERE ji.job_id = j.id AND ji.profile_id = ${profileId})`;
      } else if (hasOthers && !hasMe) {
        importedByFilter =
          sql`EXISTS (SELECT 1 FROM job_importers ji WHERE ji.job_id = j.id AND ji.profile_id != ${profileId})`;
      }
    }

    const statusValues = status
      ? status.split(",").map((v) => v.trim()).filter(Boolean)
      : [];
    const { filter: scoreFilter } = buildScoreFilter(minScore);

    let statusFilter = sql`TRUE`;
    let statusJoin = sql``;

    if (statusValues.length > 0) {
      statusJoin =
        sql`JOIN job_statuses js ON js.profile_id = jm.profile_id AND js.job_id = jm.job_id`;
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
