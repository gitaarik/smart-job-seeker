import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";
import { getProfileSkillLevels } from "$lib/server/job/match-utils";
import { getSelectedProfileId } from "../profile/utils";

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

  if (filter === "matches" || filter === "saved") {
    // Query from job_matches table
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const matchWhere: any = {
      profile: profileId,
    };

    if (filter === "saved") {
      matchWhere.status = "saved";
    } else if (filter === "matches") {
      // Show jobs with AI scoring (score > 0), exclude rejected
      matchWhere.score = { gt: minScore ? parseInt(minScore) : 0 };
      matchWhere.status = { not: "rejected" };
    }

    // Build jobs filter conditions
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const jobsFilter: any = {};

    // Add search filter on joined jobs
    if (search) {
      jobsFilter.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { company: { contains: search, mode: "insensitive" } },
        { office_location: { contains: search, mode: "insensitive" } },
        { job_description: { contains: search, mode: "insensitive" } },
      ];
    }

    if (platform) {
      jobsFilter.job_platform = parseInt(platform);
    }

    // Date posted filter
    if (datePosted) {
      const days = parseInt(datePosted);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      jobsFilter.date_posted = { gte: cutoffDate };
    }

    // Apply jobs filter if any conditions exist
    if (Object.keys(jobsFilter).length > 0) {
      matchWhere.jobs = jobsFilter;
    }

    // Sort by date_posted first (nulls last), then date_created as fallback
    const orderBy = [
      { jobs: { date_posted: { sort: "desc" as const, nulls: "last" as const } } },
      { jobs: { date_created: "desc" as const } },
    ];

    // For JSON array filters, we need to fetch more and filter in memory
    const hasJsonFilters = workLocation || jobType;
    const maxJsonFilterRows = 1000; // Safety cap for in-memory filtering
    const fetchLimit = hasJsonFilters ? maxJsonFilterRows : limit;
    const fetchOffset = hasJsonFilters ? 0 : offset;

    let allMatches = await db.job_matches.findMany({
      where: matchWhere,
      include: {
        jobs: {
          include: {
            job_platforms: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy,
      take: fetchLimit,
      skip: fetchOffset,
    });

    // Apply JSON array filters in memory
    if (workLocation) {
      const targetLocation = workLocation.toLowerCase();
      allMatches = allMatches.filter((m) => {
        const locations = m.jobs?.work_location;
        if (!locations || !Array.isArray(locations)) return false;
        return locations.some((loc: string) => loc.toLowerCase() === targetLocation);
      });
    }

    if (jobType) {
      const targetType = jobType.toLowerCase();
      allMatches = allMatches.filter((m) => {
        const types = m.jobs?.job_types;
        if (!types || !Array.isArray(types)) return false;
        return types.some((t: string) => t.toLowerCase() === targetType);
      });
    }

    // Calculate total after filtering, then paginate
    const filteredTotal = allMatches.length;
    const paginatedMatches = hasJsonFilters
      ? allMatches.slice(offset, offset + limit)
      : allMatches;

    // Extract jobs from matches and build matchesByJobId
    jobs = paginatedMatches.map((m) => m.jobs);
    totalCount = hasJsonFilters ? filteredTotal : await db.job_matches.count({ where: matchWhere });
    matchesByJobId = Object.fromEntries(
      paginatedMatches.map((m) => [
        m.job,
        {
          id: m.id,
          job: m.job,
          score: m.score,
          skill_match_percentage: m.skill_match_percentage,
          matched_skills: m.matched_skills,
          match_summary: m.match_summary,
          status: m.status,
        },
      ])
    );
    savedJobIds = paginatedMatches
      .filter((m) => m.status === "saved")
      .map((m) => m.job);
  } else {
    // "all" - Query from jobs table directly
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { company: { contains: search, mode: "insensitive" } },
        { office_location: { contains: search, mode: "insensitive" } },
        { job_description: { contains: search, mode: "insensitive" } },
      ];
    }

    if (platform) {
      where.job_platform = parseInt(platform);
    }

    // Date posted filter
    if (datePosted) {
      const days = parseInt(datePosted);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      where.date_posted = { gte: cutoffDate };
    }

    // Sort by date_posted first (nulls last), then date_created as fallback
    const jobOrderBy = [
      { date_posted: { sort: "desc" as const, nulls: "last" as const } },
      { date_created: "desc" as const },
    ];

    // For JSON array filters, we need to fetch more and filter in memory
    const hasJsonFilters = workLocation || jobType;
    const maxJsonFilterRows = 1000; // Safety cap for in-memory filtering

    let allJobs = await db.jobs.findMany({
      where,
      include: {
        job_platforms: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: jobOrderBy,
      take: hasJsonFilters ? maxJsonFilterRows : limit,
      skip: hasJsonFilters ? 0 : offset,
    });

    // Apply JSON array filters in memory
    if (workLocation) {
      const targetLocation = workLocation.toLowerCase();
      allJobs = allJobs.filter((j) => {
        const locations = j.work_location;
        if (!locations || !Array.isArray(locations)) return false;
        return locations.some((loc: string) => loc.toLowerCase() === targetLocation);
      });
    }

    if (jobType) {
      const targetType = jobType.toLowerCase();
      allJobs = allJobs.filter((j) => {
        const types = j.job_types;
        if (!types || !Array.isArray(types)) return false;
        return types.some((t: string) => t.toLowerCase() === targetType);
      });
    }

    // Calculate total after filtering, then paginate
    if (hasJsonFilters) {
      totalCount = allJobs.length;
      jobs = allJobs.slice(offset, offset + limit);
    } else {
      jobs = allJobs;
      totalCount = await db.jobs.count({ where });
    }

    // Get matches for the displayed jobs
    const jobMatches = await db.job_matches.findMany({
      where: {
        profile: profileId,
        job: { in: jobs.map((j) => j.id) },
      },
      select: {
        id: true,
        job: true,
        score: true,
        skill_match_percentage: true,
        matched_skills: true,
        match_summary: true,
        status: true,
      },
    });

    matchesByJobId = Object.fromEntries(jobMatches.map((m) => [m.job, m]));
    savedJobIds = jobMatches
      .filter((m) => m.status === "saved")
      .map((m) => m.job);
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
