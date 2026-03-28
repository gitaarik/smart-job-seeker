import type { Actions, PageServerLoad } from "./$types";
import { fail } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";
import { getMatchCounts } from "$lib/server/job/match-counts";
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

  // Fetch match config first — needed for visibility scope in getMatchCounts
  const matchConfig = await db.match_config.findFirst({
    where: { profile: profileId },
    select: {
      id: true,
      job_types: true,
      experience_levels: true,
      work_location: true,
      locations: true,
      match_community_jobs: true,
    },
  });

  const matchCommunityJobs = matchConfig?.match_community_jobs ?? false;

  const [
    profileData,
    searchTasksList,
    [sharedMatchCounts, curationStatsRaw],
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

    // Search tasks for this profile
    db.search_tasks.findMany({
      where: { profile: profileId },
      select: {
        id: true,
        note: true,
        is_active: true,
        status: true,
        status_message: true,
        last_run: true,
        last_run_jobs_found: true,
        job_platforms: { select: { name: true } },
      },
      orderBy: { last_run: "desc" },
    }),

    // Match stats — "total" uses shared getMatchCounts (same as Match Progress page)
    // while strong/saved/newUnreviewed still need job_statuses join
    Promise.all([
      getMatchCounts(profileId, matchCommunityJobs),
      db.$queryRaw<
        [{ strong80: bigint; strong70: bigint; saved: bigint; new_unreviewed: bigint }]
      >`
        SELECT
          COUNT(*) FILTER (WHERE jm.score >= 80 AND COALESCE(js.status, 'new') != 'rejected') as strong80,
          COUNT(*) FILTER (WHERE jm.score >= 70 AND COALESCE(js.status, 'new') != 'rejected') as strong70,
          COUNT(*) FILTER (WHERE js.status = 'saved') as saved,
          COUNT(*) FILTER (WHERE js.id IS NULL AND jm.score > 0) as new_unreviewed
        FROM job_matches jm
        LEFT JOIN job_statuses js ON js.profile = jm.profile AND js.job = jm.job
        WHERE jm.profile = ${profileId}
      `,
    ]),

    // Top 5 matches by score (excluding rejected via job_statuses)
    db.$queryRaw<{ id: number }[]>`
      SELECT jm.id
      FROM job_matches jm
      LEFT JOIN job_statuses js ON js.profile = jm.profile AND js.job = jm.job
      WHERE jm.profile = ${profileId}
      AND jm.score > 0
      AND COALESCE(js.status, 'new') != 'rejected'
      ORDER BY jm.score DESC
      LIMIT 5
    `.then(async (ids) => {
      if (ids.length === 0) return [];
      return db.job_matches.findMany({
        where: { id: { in: ids.map((r) => r.id) } },
        orderBy: { score: "desc" },
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
      });
    }),

    // Skill levels for match card highlighting
    getProfileSkillLevels(profileId),
  ]);

  // Process match stats — total from shared getMatchCounts (same as Match Progress page)
  const curationStats = curationStatsRaw[0];
  const strong80 = Number(curationStats?.strong80 ?? 0);
  const strong70 = Number(curationStats?.strong70 ?? 0);
  // Prefer 80+ threshold, fall back to 70+ if fewer than 3 strong matches at 80+
  const useHighThreshold = strong80 >= 3;
  const matchStats = {
    total: sharedMatchCounts.matchedCount,
    strong: useHighThreshold ? strong80 : strong70,
    strongThreshold: useHighThreshold ? 80 : 70,
    saved: Number(curationStats?.saved ?? 0),
    newUnreviewed: Number(curationStats?.new_unreviewed ?? 0),
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
