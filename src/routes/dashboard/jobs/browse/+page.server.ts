import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";
import { getSelectedProfileId } from "../../profile/utils";

export const load: PageServerLoad = async ({ parent, url }) => {
  const layoutData = await parent();

  if (!layoutData.selectedProfile) {
    redirect(302, "/dashboard");
  }

  const profileId = layoutData.selectedProfile.id;

  // Parse query parameters
  const search = url.searchParams.get("q") || "";
  const platform = url.searchParams.get("platform") || "";
  const status = url.searchParams.get("status") || "";
  const sortBy = url.searchParams.get("sort") || "date_created";
  const sortOrder = url.searchParams.get("order") || "desc";
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = 20;
  const offset = (page - 1) * limit;

  // Build where clause
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

  if (status) {
    where.status = status;
  }

  // Get jobs with pagination
  const [jobs, totalCount] = await Promise.all([
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

  // Get all matches for this profile (to show match scores and save state)
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

  // Create a map of job ID to match data for easy lookup
  const matchesByJobId = Object.fromEntries(
    jobMatches.map((m) => [m.job, m])
  );

  // Keep savedJobIds for backward compatibility
  const savedJobIds = new Set(
    jobMatches.filter((m) => m.status === "saved").map((m) => m.job)
  );

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
    savedJobIds: Array.from(savedJobIds),
    matchesByJobId,
    filters: {
      search,
      platform,
      status,
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
