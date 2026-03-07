import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { Prisma } from "../../../../generated/prisma/client";
import { dbDirect as db } from "$lib/server/db";
import { getProfileSkillLevels } from "$lib/server/job/match-utils";
import { getSelectedProfileId } from "../profile/utils";

/**
 * Build SQL WHERE fragments for JSON array column filters.
 * Uses PostgreSQL's ? operator (cast to jsonb) for proper SQL-level filtering
 * instead of in-memory filtering after LIMIT.
 * Assumes jobs table is aliased as `j`.
 */
function buildJsonFilters(workLocation: string, jobType: string): Prisma.Sql {
  const fragments: Prisma.Sql[] = [];

  if (workLocation) {
    fragments.push(Prisma.sql`j.work_location::jsonb ? ${workLocation}`);
  }

  if (jobType) {
    fragments.push(Prisma.sql`j.job_types::jsonb ? ${jobType}`);
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
  const filter = url.searchParams.get("filter") || "all"; // "all" | "matches" | "saved"
  const search = url.searchParams.get("q") || "";
  const platform = url.searchParams.get("platform") || "";
  const workLocation = url.searchParams.get("workLocation") || ""; // remote, hybrid, onsite
  const jobType = url.searchParams.get("jobType") || ""; // full_time, contract, part_time, freelance
  const minScore = url.searchParams.get("minScore") || ""; // 40, 60, 80
  const datePosted = url.searchParams.get("datePosted") || ""; // 1, 7, 30 (days)
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = 20;
  const offset = (page - 1) * limit;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let jobs: any[] = [];
  let totalCount = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let matchesByJobId: Record<number, any> = {};
  let savedJobIds: number[] = [];

  // Pre-build JSON filter SQL (used in both branches)
  const hasJsonFilters = workLocation || jobType;
  const jsonFilter = hasJsonFilters
    ? buildJsonFilters(workLocation, jobType)
    : Prisma.sql`TRUE`;

  if (filter === "matches" || filter === "saved") {
    // Query from job_matches table
    // When JSON filters are active, use raw SQL to get filtered+paginated match IDs,
    // then load full data with Prisma. This avoids post-LIMIT in-memory filtering.

    // Build base match conditions
    let statusFilter = Prisma.sql`TRUE`;
    let scoreFilter = Prisma.sql`TRUE`;
    if (filter === "saved") {
      statusFilter = Prisma.sql`jm.status = 'saved'`;
    } else if (filter === "matches") {
      const minScoreVal = minScore ? parseInt(minScore) : 0;
      scoreFilter = Prisma.sql`jm.score > ${minScoreVal}`;
      statusFilter = Prisma.sql`jm.status != 'rejected'`;
    }

    // Build search filter
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

    // Build platform filter
    const platformFilter = platform
      ? Prisma.sql`j.job_platform = ${parseInt(platform)}`
      : Prisma.sql`TRUE`;

    // Build date filter
    let dateFilter = Prisma.sql`TRUE`;
    if (datePosted) {
      const days = parseInt(datePosted);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      dateFilter = Prisma.sql`j.date_posted >= ${cutoffDate}`;
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
    // Same approach: raw SQL for filtered IDs + count, Prisma for full data

    // Build search filter
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

    // Build platform filter
    const platformFilter = platform
      ? Prisma.sql`j.job_platform = ${parseInt(platform)}`
      : Prisma.sql`TRUE`;

    // Build date filter
    let dateFilter = Prisma.sql`TRUE`;
    if (datePosted) {
      const days = parseInt(datePosted);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      dateFilter = Prisma.sql`j.date_posted >= ${cutoffDate}`;
    }

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
      filter,
      search,
      platform,
      workLocation,
      jobType,
      minScore,
      datePosted,
    },
  };
};

export const actions: Actions = {
  saveJob: async ({ request, locals, cookies }) => {
    const user = locals.user;
    if (!user) {
      return fail(401, { error: "Not authenticated" });
    }

    const profileId = await getSelectedProfileId(cookies, user.id);
    if (!profileId) {
      return fail(400, { error: "No profile selected" });
    }

    const formData = await request.formData();
    const jobId = parseInt(formData.get("jobId") as string);

    if (isNaN(jobId)) {
      return fail(400, { error: "Invalid job ID" });
    }

    // Check if job exists
    const job = await db.jobs.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      return fail(404, { error: "Job not found" });
    }

    // Check if match already exists
    const existingMatch = await db.job_matches.findFirst({
      where: { profile: profileId, job: jobId },
    });

    if (existingMatch) {
      // Update existing match to saved
      await db.job_matches.update({
        where: { id: existingMatch.id },
        data: {
          status: "saved",
          date_updated: new Date(),
        },
      });
    } else {
      // Create new match with saved status (no AI scoring)
      await db.job_matches.create({
        data: {
          profile: profileId,
          job: jobId,
          status: "saved",
          score: 0, // No AI score for manually saved jobs
          date_created: new Date(),
          date_updated: new Date(),
        },
      });
    }

    return { success: true, action: "saved", jobId };
  },

  unsaveJob: async ({ request, locals, cookies }) => {
    const user = locals.user;
    if (!user) {
      return fail(401, { error: "Not authenticated" });
    }

    const profileId = await getSelectedProfileId(cookies, user.id);
    if (!profileId) {
      return fail(400, { error: "No profile selected" });
    }

    const formData = await request.formData();
    const jobId = parseInt(formData.get("jobId") as string);

    if (isNaN(jobId)) {
      return fail(400, { error: "Invalid job ID" });
    }

    // Find the match
    const match = await db.job_matches.findFirst({
      where: { profile: profileId, job: jobId },
    });

    if (match) {
      // If the match has AI scoring data, just update status to "new"
      // If it was manually saved (score=0), delete it
      if (match.score === 0 && !match.reasoning) {
        await db.job_matches.delete({
          where: { id: match.id },
        });
      } else {
        await db.job_matches.update({
          where: { id: match.id },
          data: {
            status: "new",
            date_updated: new Date(),
          },
        });
      }
    }

    return { success: true, action: "unsaved", jobId };
  },

  rejectJob: async ({ request, locals, cookies }) => {
    const user = locals.user;
    if (!user) {
      return fail(401, { error: "Not authenticated" });
    }

    const profileId = await getSelectedProfileId(cookies, user.id);
    if (!profileId) {
      return fail(400, { error: "No profile selected" });
    }

    const formData = await request.formData();
    const jobId = parseInt(formData.get("jobId") as string);

    if (isNaN(jobId)) {
      return fail(400, { error: "Invalid job ID" });
    }

    // Check if job exists
    const job = await db.jobs.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      return fail(404, { error: "Job not found" });
    }

    // Check if match already exists
    const existingMatch = await db.job_matches.findFirst({
      where: { profile: profileId, job: jobId },
    });

    if (existingMatch) {
      // Update existing match to rejected
      await db.job_matches.update({
        where: { id: existingMatch.id },
        data: {
          status: "rejected",
          date_updated: new Date(),
        },
      });
    } else {
      // Create new match with rejected status
      await db.job_matches.create({
        data: {
          profile: profileId,
          job: jobId,
          status: "rejected",
          score: 0,
          date_created: new Date(),
          date_updated: new Date(),
        },
      });
    }

    return { success: true, action: "rejected", jobId };
  },

  unrejectJob: async ({ request, locals, cookies }) => {
    const user = locals.user;
    if (!user) {
      return fail(401, { error: "Not authenticated" });
    }

    const profileId = await getSelectedProfileId(cookies, user.id);
    if (!profileId) {
      return fail(400, { error: "No profile selected" });
    }

    const formData = await request.formData();
    const jobId = parseInt(formData.get("jobId") as string);

    if (isNaN(jobId)) {
      return fail(400, { error: "Invalid job ID" });
    }

    // Find the match
    const match = await db.job_matches.findFirst({
      where: { profile: profileId, job: jobId },
    });

    if (match) {
      // If the match has AI scoring data, update status to "new"
      // If it was manually rejected (score=0), delete it
      if (match.score === 0 && !match.reasoning) {
        await db.job_matches.delete({
          where: { id: match.id },
        });
      } else {
        await db.job_matches.update({
          where: { id: match.id },
          data: {
            status: "new",
            date_updated: new Date(),
          },
        });
      }
    }

    return { success: true, action: "unrejected", jobId };
  },
};
