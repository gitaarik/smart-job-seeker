import type { Actions, PageServerLoad } from "./$types";
import { fail } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";
import { getProfileSkillLevels } from "$lib/server/job/match-utils";
import {
  saveJob,
  unsaveJob,
  rejectJob,
  unrejectJob,
} from "$lib/server/job/job-actions";
import { getSelectedProfileId } from "./profile/utils";

export const load: PageServerLoad = async ({ parent }) => {
  const layoutData = await parent();

  if (!layoutData.selectedProfile) {
    return {
      profileCompleteness: null,
      matchConfig: null,
      searchTasks: null,
      matchStats: null,
      topMatches: null,
      profileSkillLevels: {},
    };
  }

  const profileId = layoutData.selectedProfile.id;

  const [
    profileData,
    matchConfig,
    searchTasksList,
    matchStatsRaw,
    topMatchesRaw,
    profileSkillLevels,
  ] = await Promise.all([
    // Lightweight profile fields for completeness check
    db.profiles.findUnique({
      where: { id: profileId },
      select: {
        title: true,
        headline: true,
        city: true,
        country_code: true,
        tech_skill_categories: {
          select: {
            id: true,
            tech_skills: { select: { id: true } },
          },
        },
        work_experiences: { select: { id: true } },
      },
    }),

    // Load match config preferences
    db.job_match_config.findFirst({
      where: { profile: profileId },
      select: {
        id: true,
        job_types: true,
        experience_levels: true,
        work_location: true,
        locations: true,
      },
    }),

    // Search tasks for this profile
    db.job_searches.findMany({
      where: { profile: profileId },
      select: {
        id: true,
        name: true,
        is_active: true,
        status: true,
        status_message: true,
        last_run: true,
        last_run_jobs_found: true,
        job_platforms: { select: { name: true } },
      },
      orderBy: { last_run: "desc" },
    }),

    // Match aggregate stats in a single query
    db.$queryRaw<
      [{ total: bigint; strong: bigint; saved: bigint; new_unreviewed: bigint }]
    >`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE score >= 70 AND status != 'rejected') as strong,
        COUNT(*) FILTER (WHERE status = 'saved') as saved,
        COUNT(*) FILTER (WHERE status = 'new' AND score > 0) as new_unreviewed
      FROM job_matches
      WHERE profile = ${profileId}
    `,

    // Top 5 matches by score
    db.job_matches.findMany({
      where: {
        profile: profileId,
        status: { not: "rejected" },
        score: { gt: 0 },
      },
      orderBy: { score: "desc" },
      take: 5,
      include: {
        jobs: {
          select: {
            id: true,
            title: true,
            company: true,
            office_location: true,
            source_url: true,
            job_description: true,
            salary_min: true,
            salary_max: true,
            salary_currency: true,
            salary_period: true,
            skills_required: true,
            work_location: true,
            job_types: true,
            experience_levels: true,
            date_posted: true,
            date_created: true,
            job_platforms: { select: { id: true, name: true } },
          },
        },
      },
    }),

    // Skill levels for match card highlighting
    getProfileSkillLevels(profileId),
  ]);

  // Process match stats
  const stats = matchStatsRaw[0];
  const matchStats = {
    total: Number(stats?.total ?? 0),
    strong: Number(stats?.strong ?? 0),
    saved: Number(stats?.saved ?? 0),
    newUnreviewed: Number(stats?.new_unreviewed ?? 0),
  };

  // Compute profile completeness
  const totalSkills =
    profileData?.tech_skill_categories?.reduce(
      (sum, cat) => sum + cat.tech_skills.length,
      0,
    ) ?? 0;

  const profileCompleteness = {
    hasSkills: totalSkills > 0,
    skillCount: totalSkills,
    hasMatchConfig: matchConfig !== null,
    hasWorkExperience: (profileData?.work_experiences?.length ?? 0) > 0,
    hasTitle: !!profileData?.title,
    hasHeadline: !!profileData?.headline,
    hasLocation: !!(profileData?.city && profileData?.country_code),
  };

  // Process search tasks
  const searchTasks = {
    tasks: searchTasksList,
    totalCount: searchTasksList.length,
    activeCount: searchTasksList.filter((s) => s.is_active).length,
    lastRun: searchTasksList.find((s) => s.last_run)?.last_run ?? null,
    totalJobsFound: searchTasksList.reduce(
      (sum, s) => sum + (s.last_run_jobs_found ?? 0),
      0,
    ),
  };

  // Process top matches
  const topMatches = topMatchesRaw.map((m) => ({
    id: m.id,
    score: m.score,
    status: m.status,
    match_summary: m.match_summary,
    matched_skills: m.matched_skills,
    skill_match_percentage: m.skill_match_percentage,
    job: m.jobs,
  }));

  return {
    profileCompleteness,
    matchConfig,
    searchTasks,
    matchStats,
    topMatches,
    profileSkillLevels,
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
