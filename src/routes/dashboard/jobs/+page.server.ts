import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";
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
  const matchStatus = url.searchParams.get("matchStatus") || ""; // For filtering match statuses (new, viewed, applied, etc.)
  const sortBy = url.searchParams.get("sort") || "date_created";
  const sortOrder = url.searchParams.get("order") || "desc";
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
      // Show jobs with AI scoring (score > 0)
      matchWhere.score = { gt: 0 };
      if (matchStatus) {
        matchWhere.status = matchStatus;
      }
    }

    // Add search filter on joined jobs
    if (search) {
      matchWhere.jobs = {
        OR: [
          { title: { contains: search, mode: "insensitive" } },
          { company: { contains: search, mode: "insensitive" } },
          { office_location: { contains: search, mode: "insensitive" } },
          { job_description: { contains: search, mode: "insensitive" } },
        ],
      };
    }

    if (platform) {
      matchWhere.jobs = {
        ...matchWhere.jobs,
        job_platform: parseInt(platform),
      };
    }

    // Determine sort field - for matches, we sort on match fields or nested job fields
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let orderBy: any;
    if (sortBy === "score") {
      orderBy = { score: sortOrder };
    } else {
      // Sort by job fields - need to use nested ordering
      orderBy = { jobs: { [sortBy]: sortOrder } };
    }

    const [matches, matchCount] = await Promise.all([
      db.job_matches.findMany({
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
        take: limit,
        skip: offset,
      }),
      db.job_matches.count({ where: matchWhere }),
    ]);

    // Extract jobs from matches and build matchesByJobId
    jobs = matches.map((m) => m.jobs);
    matchesByJobId = Object.fromEntries(
      matches.map((m) => [
        m.job,
        {
          id: m.id,
          job: m.job,
          score: m.score,
          skill_match_percentage: m.skill_match_percentage,
          status: m.status,
        },
      ])
    );
    savedJobIds = matches
      .filter((m) => m.status === "saved")
      .map((m) => m.job);
    totalCount = matchCount;
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

    const [jobResults, jobCount] = await Promise.all([
      db.jobs.findMany({
        where,
        include: {
          job_platforms: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { [sortBy]: sortOrder },
        take: limit,
        skip: offset,
      }),
      db.jobs.count({ where }),
    ]);

    jobs = jobResults;
    totalCount = jobCount;

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

  return {
    jobs,
    platforms,
    totalCount,
    currentPage: page,
    totalPages,
    savedJobIds,
    matchesByJobId,
    filters: {
      filter,
      search,
      platform,
      matchStatus,
      sortBy,
      sortOrder,
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
};
